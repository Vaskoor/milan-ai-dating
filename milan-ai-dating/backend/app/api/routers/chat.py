"""
Milan AI - Chat Router
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, asc
from uuid import UUID

from app.core.security import get_current_user
from app.db.database import get_db
from app.db.models import User, Conversation, Message, Match
from app.schemas.chat import (
    MessageCreate, MessageResponse, ConversationResponse,
    AISuggestionRequest, AISuggestionResponse
)
from app.agents import orchestrator

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's conversations"""
    result = await db.execute(
        select(Conversation).where(
            or_(
                Conversation.user1_id == current_user.id,
                Conversation.user2_id == current_user.id
            )
        ).order_by(desc(Conversation.last_message_at))
    )
    conversations = result.scalars().all()
    
    response = []
    for conv in conversations:
        # Get other user
        other_user_id = conv.user2_id if conv.user1_id == current_user.id else conv.user1_id
        
        result = await db.execute(
            select(User, Profile).join(Profile).where(User.id == other_user_id)
        )
        user, profile = result.first() or (None, None)
        
        if profile:
            from datetime import date
            age = None
            if profile.date_of_birth:
                age = date.today().year - profile.date_of_birth.year
            
            other_user = {
                "id": str(other_user_id),
                "first_name": profile.first_name,
                "profile_photo_url": profile.profile_photo_url,
                "age": age
            }
            
            # Get last message
            result = await db.execute(
                select(Message).where(
                    Message.conversation_id == conv.id
                ).order_by(desc(Message.created_at)).limit(1)
            )
            last_message = result.scalar_one_or_none()
            
            unread_count = conv.unread_count_user1 if conv.user1_id == current_user.id else conv.unread_count_user2
            
            response.append(ConversationResponse(
                id=conv.id,
                match_id=conv.match_id,
                other_user=other_user,
                is_active=conv.is_active,
                total_messages=conv.total_messages,
                unread_count=unread_count,
                last_message=MessageResponse(
                    id=last_message.id,
                    conversation_id=last_message.conversation_id,
                    sender_id=last_message.sender_id,
                    content=last_message.content,
                    content_type=last_message.content_type,
                    is_read=last_message.is_read,
                    created_at=last_message.created_at
                ) if last_message else None,
                last_message_at=conv.last_message_at,
                created_at=conv.created_at
            ))
    
    return response


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: UUID,
    limit: int = 50,
    before_id: UUID = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get messages in a conversation"""
    # Verify user is part of conversation
    result = await db.execute(
        select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                or_(
                    Conversation.user1_id == current_user.id,
                    Conversation.user2_id == current_user.id
                )
            )
        )
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Get messages
    query = select(Message).where(
        Message.conversation_id == conversation_id
    ).order_by(desc(Message.created_at)).limit(limit)
    
    if before_id:
        result = await db.execute(
            select(Message).where(Message.id == before_id)
        )
        before_msg = result.scalar_one_or_none()
        if before_msg:
            query = query.where(Message.created_at < before_msg.created_at)
    
    result = await db.execute(query)
    messages = result.scalars().all()
    
    # Mark messages as read
    unread_messages = [m for m in messages if m.sender_id != current_user.id and not m.is_read]
    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = __import__('datetime').datetime.utcnow()
    
    # Update unread count
    if conversation.user1_id == current_user.id:
        conversation.unread_count_user1 = 0
    else:
        conversation.unread_count_user2 = 0
    
    await db.commit()
    
    # Format response
    response = []
    for msg in reversed(messages):  # Return in chronological order
        response.append(MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            content=msg.content,
            content_type=msg.content_type,
            media_url=msg.media_url,
            is_read=msg.is_read,
            read_at=msg.read_at,
            is_ai_suggestion=msg.is_ai_suggestion,
            created_at=msg.created_at
        ))
    
    return response


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: UUID,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message"""
    # Verify user is part of conversation
    result = await db.execute(
        select(Conversation).where(
            and_(
                Conversation.id == conversation_id,
                or_(
                    Conversation.user1_id == current_user.id,
                    Conversation.user2_id == current_user.id
                )
            )
        )
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if not conversation.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conversation is no longer active"
        )
    
    # Moderate message content
    moderation = await orchestrator.execute(
        action="check_message",
        payload={
            "message": message_data.content,
            "sender_id": str(current_user.id)
        },
        user_id=current_user.id
    )
    
    if moderation.get("success") and not moderation.get("result", {}).get("is_safe", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message contains inappropriate content"
        )
    
    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=message_data.content,
        content_type=message_data.content_type,
        media_url=message_data.media_url,
        toxicity_score=moderation.get("result", {}).get("safety_score")
    )
    
    db.add(message)
    
    # Update conversation
    conversation.last_message_at = __import__('datetime').datetime.utcnow()
    conversation.total_messages += 1
    
    # Update unread count for other user
    if conversation.user1_id == current_user.id:
        conversation.unread_count_user2 += 1
    else:
        conversation.unread_count_user1 += 1
    
    # Update match message count
    result = await db.execute(
        select(Match).where(Match.id == conversation.match_id)
    )
    match = result.scalar_one_or_none()
    if match:
        match.message_count += 1
        match.last_message_at = conversation.last_message_at
        if not match.first_message_at:
            match.first_message_at = conversation.last_message_at
    
    await db.commit()
    await db.refresh(message)
    
    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        content=message.content,
        content_type=message.content_type,
        media_url=message.media_url,
        is_read=message.is_read,
        is_ai_suggestion=message.is_ai_suggestion,
        created_at=message.created_at
    )


@router.post("/ai-suggestion", response_model=AISuggestionResponse)
async def get_ai_suggestion(
    request: AISuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI conversation suggestions (premium feature)"""
    # Check if user has premium
    if current_user.subscription_tier not in ["premium", "elite"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a premium subscription"
        )
    
    # Get conversation history
    result = await db.execute(
        select(Message).where(
            Message.conversation_id == request.conversation_id
        ).order_by(desc(Message.created_at)).limit(10)
    )
    messages = result.scalars().all()
    
    # Get other user's profile
    result = await db.execute(
        select(Conversation).where(Conversation.id == request.conversation_id)
    )
    conversation = result.scalar_one_or_none()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    other_user_id = conversation.user2_id if conversation.user1_id == current_user.id else conversation.user1_id
    
    result = await db.execute(
        select(Profile).where(Profile.user_id == other_user_id)
    )
    other_profile = result.scalar_one_or_none()
    
    # Get AI suggestions
    ai_result = await orchestrator.execute(
        action="suggest_reply",
        payload={
            "conversation_history": [
                {"sender_name": "You" if m.sender_id == current_user.id else "Match", "content": m.content}
                for m in reversed(messages)
            ],
            "user_profile": {"first_name": "You"},
            "match_profile": {"first_name": other_profile.first_name if other_profile else "Match"},
            "tone": request.tone
        },
        user_id=current_user.id
    )
    
    if not ai_result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate suggestions"
        )
    
    result = ai_result.get("result", {})
    
    return AISuggestionResponse(
        suggestions=result.get("suggestions", []),
        topic_ideas=result.get("topic_ideas", []),
        tone_analysis=result.get("tone_analysis"),
        engagement_tips=result.get("engagement_tips", [])
    )


# WebSocket for real-time chat
@router.websocket("/ws/{conversation_id}")
async def chat_websocket(websocket: WebSocket, conversation_id: str):
    """WebSocket endpoint for real-time chat"""
    await websocket.accept()
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            msg_type = data.get("type")
            
            if msg_type == "message":
                # Process new message
                await websocket.send_json({
                    "type": "ack",
                    "message_id": data.get("temp_id")
                })
            
            elif msg_type == "typing":
                # Broadcast typing indicator
                await websocket.send_json({
                    "type": "typing",
                    "user_id": data.get("user_id"),
                    "is_typing": data.get("is_typing")
                })
            
            elif msg_type == "read":
                # Mark messages as read
                await websocket.send_json({
                    "type": "read_receipt",
                    "message_ids": data.get("message_ids")
                })
    
    except WebSocketDisconnect:
        pass
