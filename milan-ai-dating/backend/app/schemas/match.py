"""
Match & Swipe Schemas
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


class SwipeCreate(BaseModel):
    swiped_id: UUID
    action: str = Field(..., pattern="^(like|dislike|superlike)$")


class SwipeResponse(BaseModel):
    id: UUID
    swiper_id: UUID
    swiped_id: UUID
    action: str
    is_match: bool
    compatibility_score: Optional[float] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class MatchResponse(BaseModel):
    id: UUID
    user1_id: UUID
    user2_id: UUID
    other_user: dict  # Profile info of the other user
    status: str
    compatibility_score: Optional[float] = None
    match_reason: Optional[str] = None
    message_count: int
    last_message_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class MatchDetailResponse(MatchResponse):
    conversation_id: Optional[UUID] = None
    first_message_at: Optional[datetime] = None


class UnmatchRequest(BaseModel):
    match_id: UUID
    reason: Optional[str] = None


class RecommendationResponse(BaseModel):
    id: UUID
    user_id: UUID
    recommended_user: dict
    compatibility_score: float
    match_probability: Optional[float] = None
    recommendation_reason: Optional[str] = None
    common_interests: List[str] = []
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class DiscoveryFilters(BaseModel):
    min_age: Optional[int] = Field(None, ge=18, le=80)
    max_age: Optional[int] = Field(None, ge=18, le=80)
    gender: Optional[List[str]] = None
    distance_km: Optional[int] = Field(None, ge=1, le=500)
    has_photo: Optional[bool] = None
    is_verified: Optional[bool] = None
