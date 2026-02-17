"""
Milan AI - Matches & Swipes Router
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
from uuid import UUID

from app.core.security import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.db.models import User, Profile, Swipe, Match, Conversation, UserPreference
from app.schemas.match import (
    SwipeCreate, SwipeResponse, MatchResponse, 
    RecommendationResponse, DiscoveryFilters
)
from app.agents import orchestrator

router = APIRouter(prefix="/matches", tags=["Matches"])


@router.post("/swipe", response_model=SwipeResponse)
async def create_swipe(
    swipe_data: SwipeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a swipe (like/dislike/superlike)"""
    # Check if already swiped
    result = await db.execute(
        select(Swipe).where(
            and_(
                Swipe.swiper_id == current_user.id,
                Swipe.swiped_id == swipe_data.swiped_id
            )
        )
    )
    existing_swipe = result.scalar_one_or_none()
    
    if existing_swipe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already swiped on this user"
        )
    
    # Get AI compatibility score
    ai_result = await orchestrator.execute(
        action="calculate_compatibility",
        payload={
            "user1_id": str(current_user.id),
            "user2_id": str(swipe_data.swiped_id)
        },
        user_id=current_user.id
    )
    
    compatibility_score = None
    if ai_result.get("success"):
        compatibility_score = ai_result.get("result", {}).get("overall_score")
    
    # Create swipe
    swipe = Swipe(
        swiper_id=current_user.id,
        swiped_id=swipe_data.swiped_id,
        action=swipe_data.action,
        compatibility_score=compatibility_score
    )
    
    db.add(swipe)
    
    # Check for mutual like (match)
    is_match = False
    if swipe_data.action in ["like", "superlike"]:
        result = await db.execute(
            select(Swipe).where(
                and_(
                    Swipe.swiper_id == swipe_data.swiped_id,
                    Swipe.swiped_id == current_user.id,
                    Swipe.action.in_(["like", "superlike"])
                )
            )
        )
        mutual_swipe = result.scalar_one_or_none()
        
        if mutual_swipe:
            is_match = True
            
            # Create match (ensure user1_id < user2_id for consistency)
            user1_id, user2_id = sorted([current_user.id, swipe_data.swiped_id])
            
            match = Match(
                user1_id=user1_id,
                user2_id=user2_id,
                initiated_by=current_user.id,
                compatibility_score=compatibility_score
            )
            
            db.add(match)
            await db.flush()
            
            # Create conversation
            conversation = Conversation(
                match_id=match.id,
                user1_id=user1_id,
                user2_id=user2_id
            )
            
            db.add(conversation)
            
            # Generate match explanation
            await orchestrator.execute(
                action="explain_match",
                payload={
                    "match_id": str(match.id),
                    "user1_id": str(user1_id),
                    "user2_id": str(user2_id)
                },
                user_id=current_user.id
            )
    
    await db.commit()
    await db.refresh(swipe)
    
    return SwipeResponse(
        id=swipe.id,
        swiper_id=swipe.swiper_id,
        swiped_id=swipe.swiped_id,
        action=swipe.action,
        is_match=is_match,
        compatibility_score=compatibility_score,
        created_at=swipe.created_at
    )


@router.get("/my-matches", response_model=List[MatchResponse])
async def get_my_matches(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's matches"""
    result = await db.execute(
        select(Match).where(
            and_(
                or_(
                    Match.user1_id == current_user.id,
                    Match.user2_id == current_user.id
                ),
                Match.status == "active"
            )
        ).order_by(desc(Match.created_at))
    )
    matches = result.scalars().all()
    
    response = []
    for match in matches:
        # Get other user's profile
        other_user_id = match.user2_id if match.user1_id == current_user.id else match.user1_id
        
        result = await db.execute(
            select(Profile).where(Profile.user_id == other_user_id)
        )
        other_profile = result.scalar_one_or_none()
        
        if other_profile:
            from datetime import date
            age = None
            if other_profile.date_of_birth:
                age = date.today().year - other_profile.date_of_birth.year
            
            other_user = {
                "id": str(other_user_id),
                "first_name": other_profile.first_name,
                "profile_photo_url": other_profile.profile_photo_url,
                "age": age
            }
            
            # Get conversation ID
            result = await db.execute(
                select(Conversation).where(Conversation.match_id == match.id)
            )
            conversation = result.scalar_one_or_none()
            
            response.append(MatchResponse(
                id=match.id,
                user1_id=match.user1_id,
                user2_id=match.user2_id,
                other_user=other_user,
                status=match.status,
                compatibility_score=match.compatibility_score,
                match_reason=match.match_reason,
                message_count=match.message_count,
                last_message_at=match.last_message_at,
                created_at=match.created_at
            ))
    
    return response


@router.post("/unmatch/{match_id}")
async def unmatch(
    match_id: UUID,
    reason: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unmatch with a user"""
    result = await db.execute(
        select(Match).where(
            and_(
                Match.id == match_id,
                or_(
                    Match.user1_id == current_user.id,
                    Match.user2_id == current_user.id
                )
            )
        )
    )
    match = result.scalar_one_or_none()
    
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found"
        )
    
    match.status = "unmatched"
    match.unmatched_at = __import__('datetime').datetime.utcnow()
    match.unmatched_by = current_user.id
    match.unmatched_reason = reason
    
    # Deactivate conversation
    result = await db.execute(
        select(Conversation).where(Conversation.match_id == match.id)
    )
    conversation = result.scalar_one_or_none()
    if conversation:
        conversation.is_active = False
    
    await db.commit()
    
    return {"message": "Unmatched successfully"}


@router.get("/discover", response_model=List[dict])
async def discover_profiles(
    filters: DiscoveryFilters = Depends(),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Discover profiles to swipe on"""
    from datetime import date
    
    # Get user preferences
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    
    # Get current user profile
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    my_profile = result.scalar_one_or_none()
    
    # Build query
    query = select(Profile).where(
        and_(
            Profile.user_id != current_user.id,
            Profile.is_profile_visible == True,
            Profile.profile_completion_score >= 50  # Only show complete profiles
        )
    )
    
    # Apply gender filter from preferences
    if prefs and prefs.looking_for_gender:
        query = query.where(Profile.gender.in_(prefs.looking_for_gender))
    
    # Apply age filter
    age_min = filters.min_age or (prefs.age_min if prefs else 18)
    age_max = filters.max_age or (prefs.age_max if prefs else 50)
    
    max_dob = date.today().replace(year=date.today().year - age_min)
    min_dob = date.today().replace(year=date.today().year - age_max)
    query = query.where(Profile.date_of_birth.between(min_dob, max_dob))
    
    # Filter out already swiped profiles
    result = await db.execute(
        select(Swipe.swiped_id).where(Swipe.swiper_id == current_user.id)
    )
    swiped_ids = [r[0] for r in result.all()]
    
    if swiped_ids:
        query = query.where(Profile.user_id.notin_(swiped_ids))
    
    # Filter out blocked users
    from app.db.models import Block
    result = await db.execute(
        select(Block.blocked_id).where(Block.blocker_id == current_user.id)
    )
    blocked_ids = [r[0] for r in result.all()]
    
    if blocked_ids:
        query = query.where(Profile.user_id.notin_(blocked_ids))
    
    # Apply additional filters
    if filters.city:
        query = query.where(Profile.city == filters.city)
    
    if filters.has_photo:
        query = query.where(Profile.profile_photo_url.isnot(None))
    
    if filters.is_verified:
        query = query.where(Profile.verification_badge_level >= 2)
    
    # Order by last active (most active first)
    query = query.order_by(desc(Profile.last_active_at))
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    profiles = result.scalars().all()
    
    # Format response
    response = []
    for profile in profiles:
        age = None
        if profile.date_of_birth:
            age = date.today().year - profile.date_of_birth.year
        
        # Get interests
        result = await db.execute(
            select(Interest.interest_name).where(Interest.profile_id == profile.id)
        )
        interests = [r[0] for r in result.all()]
        
        response.append({
            "id": str(profile.id),
            "user_id": str(profile.user_id),
            "first_name": profile.first_name,
            "age": age,
            "profile_photo_url": profile.profile_photo_url,
            "city": profile.city,
            "bio": profile.bio,
            "interests": interests,
            "verification_badge_level": profile.verification_badge_level
        })
    
    return response


@router.get("/recommendations", response_model=List[dict])
async def get_recommendations(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI-powered profile recommendations"""
    # Get AI recommendations
    ai_result = await orchestrator.execute(
        action="find_matches",
        payload={
            "user_id": str(current_user.id),
            "limit": limit
        },
        user_id=current_user.id
    )
    
    if not ai_result.get("success"):
        # Fallback to basic discovery
        return await discover_profiles(
            filters=DiscoveryFilters(),
            limit=limit,
            current_user=current_user,
            db=db
        )
    
    matches = ai_result.get("result", {}).get("matches", [])
    
    return matches


@router.get("/likes-me")
async def get_who_liked_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get users who liked current user (premium feature)"""
    # Check if user has premium
    if current_user.subscription_tier == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a premium subscription"
        )
    
    # Get likes
    result = await db.execute(
        select(Swipe, Profile).join(
            Profile, Swipe.swiper_id == Profile.user_id
        ).where(
            and_(
                Swipe.swiped_id == current_user.id,
                Swipe.action.in_(["like", "superlike"])
            )
        ).order_by(desc(Swipe.created_at))
    )
    
    likes = []
    for swipe, profile in result.all():
        from datetime import date
        age = None
        if profile.date_of_birth:
            age = date.today().year - profile.date_of_birth.year
        
        likes.append({
            "user_id": str(swipe.swiper_id),
            "first_name": profile.first_name,
            "age": age,
            "profile_photo_url": profile.profile_photo_url,
            "liked_at": swipe.created_at.isoformat()
        })
    
    return {"likes": likes, "count": len(likes)}
