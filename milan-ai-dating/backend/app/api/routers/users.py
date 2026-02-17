"""
Milan AI - Users & Profiles Router
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from uuid import UUID

from app.core.security import get_current_user, require_admin
from app.db.database import get_db
from app.db.models import User, Profile, Interest, Photo, UserPreference
from app.schemas.user import (
    ProfileCreate, ProfileUpdate, ProfileResponse, ProfileCardResponse,
    InterestCreate, InterestResponse, UserPreferenceUpdate, UserPreferenceResponse
)
from app.agents import orchestrator

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/profile/me", response_model=ProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's profile"""
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Load interests
    result = await db.execute(
        select(Interest).where(Interest.profile_id == profile.id)
    )
    profile.interests = result.scalars().all()
    
    return profile


@router.put("/profile/me", response_model=ProfileResponse)
async def update_profile(
    profile_update: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user's profile"""
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Update fields
    update_data = profile_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
    
    await db.commit()
    await db.refresh(profile)
    
    # Trigger AI profile analysis in background
    await orchestrator.execute(
        action="analyze_profile",
        payload={"profile_id": str(profile.id)},
        user_id=current_user.id
    )
    
    return profile


@router.get("/profile/{user_id}", response_model=ProfileCardResponse)
async def get_user_profile(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get another user's profile (limited view)"""
    result = await db.execute(
        select(Profile).where(Profile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile or not profile.is_profile_visible:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Calculate age
    from datetime import date
    age = None
    if profile.date_of_birth:
        age = date.today().year - profile.date_of_birth.year
    
    # Get interests as strings
    result = await db.execute(
        select(Interest.interest_name).where(Interest.profile_id == profile.id)
    )
    interests = [r[0] for r in result.all()]
    
    return ProfileCardResponse(
        id=profile.id,
        user_id=profile.user_id,
        first_name=profile.first_name,
        age=age,
        profile_photo_url=profile.profile_photo_url,
        city=profile.city,
        bio=profile.bio,
        interests=interests,
        verification_badge_level=profile.verification_badge_level
    )


@router.post("/interests", response_model=InterestResponse)
async def add_interest(
    interest: InterestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add an interest to profile"""
    # Get profile
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Check if interest already exists
    result = await db.execute(
        select(Interest).where(
            and_(
                Interest.profile_id == profile.id,
                Interest.interest_name == interest.interest_name
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interest already exists"
        )
    
    # Create interest
    new_interest = Interest(
        profile_id=profile.id,
        interest_name=interest.interest_name,
        category=interest.category,
        importance_level=interest.importance_level
    )
    
    db.add(new_interest)
    await db.commit()
    await db.refresh(new_interest)
    
    return new_interest


@router.delete("/interests/{interest_id}")
async def remove_interest(
    interest_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove an interest from profile"""
    result = await db.execute(
        select(Interest)
        .join(Profile)
        .where(
            and_(
                Interest.id == interest_id,
                Profile.user_id == current_user.id
            )
        )
    )
    interest = result.scalar_one_or_none()
    
    if not interest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interest not found"
        )
    
    await db.delete(interest)
    await db.commit()
    
    return {"message": "Interest removed"}


@router.post("/photos")
async def upload_photo(
    file: UploadFile = File(...),
    is_primary: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a profile photo"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPEG, PNG, and WebP are allowed."
        )
    
    # In production, upload to S3/MinIO
    # For now, mock the URL
    photo_url = f"https://storage.milan.ai/photos/{current_user.id}/{file.filename}"
    
    # Create photo record
    photo = Photo(
        user_id=current_user.id,
        photo_url=photo_url,
        thumbnail_url=photo_url.replace("/photos/", "/thumbnails/"),
        is_primary=is_primary,
        mime_type=file.content_type
    )
    
    db.add(photo)
    
    # Update profile photo count
    result = await db.execute(
        select(Profile).where(Profile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile:
        profile.photo_count = (profile.photo_count or 0) + 1
        if is_primary:
            profile.profile_photo_url = photo_url
    
    await db.commit()
    await db.refresh(photo)
    
    # Trigger image moderation
    await orchestrator.execute(
        action="moderate_image",
        payload={"photo_id": str(photo.id), "image_url": photo_url},
        user_id=current_user.id
    )
    
    return {
        "id": photo.id,
        "photo_url": photo_url,
        "is_primary": is_primary,
        "message": "Photo uploaded successfully"
    }


@router.get("/preferences", response_model=UserPreferenceResponse)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user preferences"""
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    
    if not prefs:
        # Create default preferences
        prefs = UserPreference(user_id=current_user.id)
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    
    return prefs


@router.put("/preferences", response_model=UserPreferenceResponse)
async def update_preferences(
    prefs_update: UserPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user preferences"""
    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == current_user.id)
    )
    prefs = result.scalar_one_or_none()
    
    if not prefs:
        prefs = UserPreference(user_id=current_user.id)
        db.add(prefs)
    
    # Update fields
    update_data = prefs_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prefs, field, value)
    
    await db.commit()
    await db.refresh(prefs)
    
    return prefs


@router.get("/search", response_model=List[ProfileCardResponse])
async def search_users(
    q: Optional[str] = None,
    city: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    gender: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Search users with filters"""
    from datetime import date
    
    query = select(Profile).where(Profile.is_profile_visible == True)
    
    # Exclude current user
    query = query.where(Profile.user_id != current_user.id)
    
    # Apply filters
    if city:
        query = query.where(Profile.city.ilike(f"%{city}%"))
    
    if gender:
        query = query.where(Profile.gender == gender)
    
    if min_age:
        max_dob = date.today().replace(year=date.today().year - min_age)
        query = query.where(Profile.date_of_birth <= max_dob)
    
    if max_age:
        min_dob = date.today().replace(year=date.today().year - max_age)
        query = query.where(Profile.date_of_birth >= min_dob)
    
    if q:
        query = query.where(
            or_(
                Profile.first_name.ilike(f"%{q}%"),
                Profile.bio.ilike(f"%{q}%")
            )
        )
    
    query = query.limit(limit).offset(offset)
    
    result = await db.execute(query)
    profiles = result.scalars().all()
    
    # Convert to response format
    responses = []
    for profile in profiles:
        age = None
        if profile.date_of_birth:
            age = date.today().year - profile.date_of_birth.year
        
        result = await db.execute(
            select(Interest.interest_name).where(Interest.profile_id == profile.id)
        )
        interests = [r[0] for r in result.all()]
        
        responses.append(ProfileCardResponse(
            id=profile.id,
            user_id=profile.user_id,
            first_name=profile.first_name,
            age=age,
            profile_photo_url=profile.profile_photo_url,
            city=profile.city,
            bio=profile.bio,
            interests=interests,
            verification_badge_level=profile.verification_badge_level
        ))
    
    return responses
