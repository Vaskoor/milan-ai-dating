"""
User Schemas
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from uuid import UUID


class UserBase(BaseModel):
    email: EmailStr
    phone: Optional[str] = None
    is_verified: bool = False
    subscription_tier: str = "free"
    
    model_config = ConfigDict(from_attributes=True)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    marketing_consent: Optional[bool] = None


class UserInDB(UserBase):
    id: UUID
    is_active: bool
    role: str
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    role: str
    created_at: datetime
    subscription_tier: str


class UserProfileBrief(BaseModel):
    id: UUID
    first_name: str
    profile_photo_url: Optional[str] = None
    age: Optional[int] = None
    city: Optional[str] = None


# Interest Schema
class InterestBase(BaseModel):
    interest_name: str = Field(..., min_length=1, max_length=100)
    category: Optional[str] = None
    importance_level: int = Field(default=3, ge=1, le=5)


class InterestCreate(InterestBase):
    pass


class InterestResponse(InterestBase):
    id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Photo Schema
class PhotoBase(BaseModel):
    is_primary: bool = False


class PhotoCreate(PhotoBase):
    pass


class PhotoResponse(PhotoBase):
    id: UUID
    photo_url: str
    thumbnail_url: Optional[str] = None
    is_verified: bool
    moderation_status: str
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Profile Schema
class ProfileBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    display_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: date
    gender: str = Field(..., pattern="^(male|female|non_binary|other)$")
    
    # Location
    province: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Bio
    bio: Optional[str] = Field(None, max_length=1000)
    about_me: Optional[str] = Field(None, max_length=2000)
    looking_for: Optional[str] = Field(None, max_length=1000)
    
    # Physical
    height_cm: Optional[int] = Field(None, ge=100, le=250)
    body_type: Optional[str] = Field(None, pattern="^(slim|average|athletic|curvy|plus_size)$")
    
    # Lifestyle
    education: Optional[str] = None
    occupation: Optional[str] = None
    company: Optional[str] = None
    income_range: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    mother_tongue: Optional[str] = None
    marital_status: Optional[str] = Field(None, pattern="^(never_married|divorced|widowed|separated)$")
    have_children: bool = False
    want_children: Optional[bool] = None
    
    # Habits
    drinking: Optional[str] = Field(None, pattern="^(never|socially|regularly)$")
    smoking: Optional[str] = Field(None, pattern="^(never|socially|regularly)$")
    diet: Optional[str] = Field(None, pattern="^(vegetarian|vegan|non_vegetarian|jain|other)$")


class ProfileCreate(ProfileBase):
    pass


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=1000)
    about_me: Optional[str] = Field(None, max_length=2000)
    looking_for: Optional[str] = Field(None, max_length=1000)
    height_cm: Optional[int] = Field(None, ge=100, le=250)
    body_type: Optional[str] = None
    education: Optional[str] = None
    occupation: Optional[str] = None
    company: Optional[str] = None
    income_range: Optional[str] = None
    religion: Optional[str] = None
    caste: Optional[str] = None
    mother_tongue: Optional[str] = None
    marital_status: Optional[str] = None
    have_children: Optional[bool] = None
    want_children: Optional[bool] = None
    drinking: Optional[str] = None
    smoking: Optional[str] = None
    diet: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ProfileResponse(ProfileBase):
    id: UUID
    user_id: UUID
    profile_photo_url: Optional[str] = None
    photo_count: int
    is_photo_verified: bool
    is_identity_verified: bool
    verification_badge_level: int
    profile_completion_score: int
    last_active_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    interests: List[InterestResponse] = []
    personality_traits: Optional[dict] = None
    
    model_config = ConfigDict(from_attributes=True)


class ProfileCardResponse(BaseModel):
    """Minimal profile for swipe cards"""
    id: UUID
    user_id: UUID
    first_name: str
    age: int
    profile_photo_url: Optional[str] = None
    city: Optional[str] = None
    bio: Optional[str] = None
    interests: List[str] = []
    verification_badge_level: int
    
    model_config = ConfigDict(from_attributes=True)


# User Preferences Schema
class UserPreferenceBase(BaseModel):
    looking_for_gender: List[str] = ["male", "female"]
    age_min: int = Field(default=18, ge=18, le=80)
    age_max: int = Field(default=50, ge=18, le=80)
    preferred_distance_km: int = Field(default=50, ge=1, le=500)
    preferred_provinces: Optional[List[str]] = None
    preferred_religions: Optional[List[str]] = None
    preferred_marital_status: Optional[List[str]] = None
    deal_breaker_smoking: bool = False
    deal_breaker_drinking: bool = False
    deal_breaker_children: bool = False


class UserPreferenceCreate(UserPreferenceBase):
    pass


class UserPreferenceUpdate(BaseModel):
    looking_for_gender: Optional[List[str]] = None
    age_min: Optional[int] = Field(None, ge=18, le=80)
    age_max: Optional[int] = Field(None, ge=18, le=80)
    preferred_distance_km: Optional[int] = Field(None, ge=1, le=500)
    preferred_provinces: Optional[List[str]] = None
    preferred_religions: Optional[List[str]] = None
    preferred_marital_status: Optional[List[str]] = None
    deal_breaker_smoking: Optional[bool] = None
    deal_breaker_drinking: Optional[bool] = None
    deal_breaker_children: Optional[bool] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    show_online_status: Optional[bool] = None
    allow_discovery: Optional[bool] = None


class UserPreferenceResponse(UserPreferenceBase):
    id: UUID
    user_id: UUID
    email_notifications: bool
    push_notifications: bool
    show_online_status: bool
    allow_discovery: bool
    
    model_config = ConfigDict(from_attributes=True)
