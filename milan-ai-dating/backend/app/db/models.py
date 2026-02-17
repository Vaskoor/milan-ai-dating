"""
Milan AI - SQLAlchemy Models
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Date, Text, 
    ForeignKey, Numeric, ARRAY, JSON, Enum, Index, CheckConstraint,
    UniqueConstraint, text
)
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.orm import relationship
from app.db.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Account status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_premium = Column(Boolean, default=False)
    subscription_tier = Column(String(20), default='free')
    
    # Role
    role = Column(String(20), default='user')
    
    # Security
    email_verified_at = Column(DateTime, nullable=True)
    phone_verified_at = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    
    # GDPR/Privacy
    consent_given = Column(Boolean, default=False)
    consent_given_at = Column(DateTime, nullable=True)
    data_processing_consent = Column(Boolean, default=False)
    marketing_consent = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships
    profile = relationship("Profile", back_populates="user", uselist=False)
    preferences = relationship("UserPreference", back_populates="user", uselist=False)
    photos = relationship("Photo", back_populates="user")
    subscriptions = relationship("Subscription", back_populates="user")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")


class Profile(Base):
    __tablename__ = "profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Basic Info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    display_name = Column(String(100), nullable=True)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(20), nullable=True)
    
    # Location (Nepal-specific)
    country = Column(String(50), default='Nepal')
    province = Column(String(50), nullable=True)
    district = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    latitude = Column(Numeric(10, 8), nullable=True)
    longitude = Column(Numeric(11, 8), nullable=True)
    
    # Bio & About
    bio = Column(Text, nullable=True)
    about_me = Column(Text, nullable=True)
    looking_for = Column(Text, nullable=True)
    
    # Physical Attributes
    height_cm = Column(Integer, nullable=True)
    body_type = Column(String(30), nullable=True)
    
    # Lifestyle
    education = Column(String(100), nullable=True)
    occupation = Column(String(100), nullable=True)
    company = Column(String(100), nullable=True)
    income_range = Column(String(50), nullable=True)
    religion = Column(String(50), nullable=True)
    caste = Column(String(50), nullable=True)
    mother_tongue = Column(String(50), nullable=True)
    marital_status = Column(String(30), nullable=True)
    have_children = Column(Boolean, default=False)
    want_children = Column(Boolean, nullable=True)
    
    # Habits
    drinking = Column(String(20), nullable=True)
    smoking = Column(String(20), nullable=True)
    diet = Column(String(30), nullable=True)
    
    # Profile Media
    profile_photo_url = Column(String(500), nullable=True)
    photo_count = Column(Integer, default=0)
    
    # Verification
    is_photo_verified = Column(Boolean, default=False)
    is_identity_verified = Column(Boolean, default=False)
    is_phone_verified = Column(Boolean, default=False)
    verification_badge_level = Column(Integer, default=0)
    
    # Profile Status
    profile_completion_score = Column(Integer, default=0)
    is_profile_visible = Column(Boolean, default=True)
    is_incognito = Column(Boolean, default=False)
    
    # AI-generated fields
    personality_traits = Column(JSONB, nullable=True)
    interest_categories = Column(JSONB, nullable=True)
    embedding_vector_id = Column(String(100), nullable=True)
    
    # Metadata
    last_active_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="profile")
    interests = relationship("Interest", back_populates="profile")


class Interest(Base):
    __tablename__ = "interests"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    interest_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=True)
    importance_level = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    profile = relationship("Profile", back_populates="interests")
    
    __table_args__ = (
        UniqueConstraint('profile_id', 'interest_name', name='unique_profile_interest'),
    )


class Photo(Base):
    __tablename__ = "photos"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    photo_url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    
    is_primary = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_moderated = Column(Boolean, default=False)
    moderation_status = Column(String(20), default='pending')
    
    has_face = Column(Boolean, nullable=True)
    face_count = Column(Integer, nullable=True)
    nsfw_score = Column(Numeric(3, 2), nullable=True)
    photo_quality_score = Column(Numeric(3, 2), nullable=True)
    
    file_size_bytes = Column(Integer, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    mime_type = Column(String(50), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    moderated_at = Column(DateTime, nullable=True)
    moderated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="photos", foreign_keys=[user_id])


class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Basic Preferences
    looking_for_gender = Column(ARRAY(String), default=['male', 'female'])
    age_min = Column(Integer, default=18)
    age_max = Column(Integer, default=50)
    
    # Location Preferences
    preferred_distance_km = Column(Integer, default=50)
    preferred_provinces = Column(ARRAY(String), nullable=True)
    preferred_districts = Column(ARRAY(String), nullable=True)
    
    # Lifestyle Preferences
    preferred_religions = Column(ARRAY(String), nullable=True)
    preferred_marital_status = Column(ARRAY(String), nullable=True)
    preferred_education_levels = Column(ARRAY(String), nullable=True)
    
    # Deal Breakers
    deal_breaker_smoking = Column(Boolean, default=False)
    deal_breaker_drinking = Column(Boolean, default=False)
    deal_breaker_children = Column(Boolean, default=False)
    
    # AI-learned preferences
    learned_interests = Column(JSONB, nullable=True)
    learned_personality_preferences = Column(JSONB, nullable=True)
    compatibility_weights = Column(JSONB, nullable=True)
    
    # Notification Preferences
    email_notifications = Column(Boolean, default=True)
    push_notifications = Column(Boolean, default=True)
    match_notifications = Column(Boolean, default=True)
    message_notifications = Column(Boolean, default=True)
    marketing_notifications = Column(Boolean, default=False)
    
    # Privacy Preferences
    show_online_status = Column(Boolean, default=True)
    show_last_active = Column(Boolean, default=True)
    show_distance = Column(Boolean, default=True)
    allow_discovery = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")


class Swipe(Base):
    __tablename__ = "swipes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    swiper_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    swiped_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(20), nullable=False)  # like, dislike, superlike
    swipe_context = Column(String(50), default='discovery')
    compatibility_score = Column(Numeric(4, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('swiper_id', 'swiped_id', name='unique_swipe'),
        Index('idx_swipes_swiper', 'swiper_id', 'created_at'),
        Index('idx_swipes_swiped', 'swiped_id', 'action'),
    )


class Match(Base):
    __tablename__ = "matches"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user1_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user2_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    status = Column(String(20), default='active')
    initiated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    compatibility_score = Column(Numeric(4, 2), nullable=True)
    match_reason = Column(Text, nullable=True)
    
    first_message_at = Column(DateTime, nullable=True)
    last_message_at = Column(DateTime, nullable=True)
    message_count = Column(Integer, default=0)
    
    unmatched_at = Column(DateTime, nullable=True)
    unmatched_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    unmatched_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="match_rel", uselist=False)
    
    __table_args__ = (
        UniqueConstraint('user1_id', 'user2_id', name='unique_match'),
        CheckConstraint('user1_id != user2_id', name='different_users'),
    )


class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id = Column(UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), unique=True, nullable=False)
    user1_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user2_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    is_active = Column(Boolean, default=True)
    total_messages = Column(Integer, default=0)
    unread_count_user1 = Column(Integer, default=0)
    unread_count_user2 = Column(Integer, default=0)
    
    last_message_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    match_rel = relationship("Match", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    content = Column(Text, nullable=False)
    content_type = Column(String(20), default='text')
    
    media_url = Column(String(500), nullable=True)
    media_metadata = Column(JSONB, nullable=True)
    
    moderation_status = Column(String(20), default='pending')
    toxicity_score = Column(Numeric(4, 3), nullable=True)
    flagged_reason = Column(Text, nullable=True)
    
    is_ai_suggestion = Column(Boolean, default=False)
    ai_suggestion_metadata = Column(JSONB, nullable=True)
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    edited_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_code = Column(String(20), unique=True, nullable=False)
    name_en = Column(String(100), nullable=False)
    name_ne = Column(String(100), nullable=True)
    
    monthly_price_npr = Column(Numeric(10, 2), nullable=False)
    quarterly_price_npr = Column(Numeric(10, 2), nullable=True)
    yearly_price_npr = Column(Numeric(10, 2), nullable=True)
    
    features = Column(JSONB, nullable=False)
    
    daily_swipe_limit = Column(Integer, nullable=True)
    superlikes_per_day = Column(Integer, nullable=True)
    boosts_per_month = Column(Integer, nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    subscriptions = relationship("Subscription", back_populates="plan")


class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False)
    
    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    
    status = Column(String(20), default='active')
    auto_renew = Column(Boolean, default=True)
    
    payment_method = Column(String(50), nullable=True)
    
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")


class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=True)
    
    amount_npr = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default='NPR')
    payment_method = Column(String(50), nullable=False)
    
    external_transaction_id = Column(String(255), nullable=True)
    external_reference = Column(String(255), nullable=True)
    
    status = Column(String(20), default='pending')
    
    payment_metadata = Column(JSONB, nullable=True)
    failure_reason = Column(Text, nullable=True)
    
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reported_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    report_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    
    evidence_urls = Column(ARRAY(String), nullable=True)
    related_message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id"), nullable=True)
    
    status = Column(String(20), default='pending')
    
    resolution = Column(String(50), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    action_taken = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class Block(Base):
    __tablename__ = "blocks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blocker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('blocker_id', 'blocked_id', name='unique_block'),
    )


class AgentLog(Base):
    __tablename__ = "agent_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    agent_name = Column(String(50), nullable=False)
    agent_version = Column(String(20), nullable=True)
    
    request_type = Column(String(50), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    input_payload = Column(JSONB, nullable=True)
    output_payload = Column(JSONB, nullable=True)
    
    execution_time_ms = Column(Integer, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    session_id = Column(String(100), nullable=True)
    request_id = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    notification_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=True)
    
    action_url = Column(String(500), nullable=True)
    action_data = Column(JSONB, nullable=True)
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    sent_via_push = Column(Boolean, default=False)
    sent_via_email = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class Recommendation(Base):
    __tablename__ = "recommendations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recommended_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    compatibility_score = Column(Numeric(4, 2), nullable=False)
    match_probability = Column(Numeric(4, 2), nullable=True)
    
    recommendation_reason = Column(Text, nullable=True)
    common_interests = Column(ARRAY(String), nullable=True)
    
    shown_to_user = Column(Boolean, default=False)
    user_action = Column(String(20), nullable=True)
    action_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('user_id', 'recommended_user_id', name='unique_recommendation'),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actor_type = Column(String(20), default='user')
    
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    
    old_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)
    
    ip_address = Column(INET, nullable=True)
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
