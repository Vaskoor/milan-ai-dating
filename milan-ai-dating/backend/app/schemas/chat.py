"""
Chat & Message Schemas
"""
from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    content_type: str = Field(default="text", pattern="^(text|image|voice|gif|location)$")
    media_url: Optional[str] = None
    reply_to_id: Optional[UUID] = None


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    content_type: str
    media_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    is_ai_suggestion: bool
    created_at: datetime
    sender: Optional[Dict] = None
    
    model_config = ConfigDict(from_attributes=True)


class ConversationResponse(BaseModel):
    id: UUID
    match_id: UUID
    other_user: Dict  # Profile info
    is_active: bool
    total_messages: int
    unread_count: int
    last_message: Optional[MessageResponse] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]
    total_unread: int


class ChatMessageEvent(BaseModel):
    type: str = "message"
    conversation_id: UUID
    message: MessageResponse


class ChatTypingEvent(BaseModel):
    type: str = "typing"
    conversation_id: UUID
    user_id: UUID
    is_typing: bool


class ChatReadEvent(BaseModel):
    type: str = "read"
    conversation_id: UUID
    user_id: UUID
    message_ids: List[UUID]


class AISuggestionRequest(BaseModel):
    conversation_id: UUID
    tone: Optional[str] = Field(default="friendly", pattern="^(friendly|flirty|formal|casual)$")
    context: Optional[str] = None


class AISuggestionResponse(BaseModel):
    suggestions: List[str]
    topic_ideas: List[str]
    tone_analysis: Optional[Dict] = None
    engagement_tips: List[str]
