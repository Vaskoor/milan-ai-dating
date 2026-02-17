"""
AI Agent Schemas
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


class AgentRequest(BaseModel):
    agent_name: str = Field(..., pattern="^(orchestrator|user_profile|matching|conversation|safety|fraud_detection|image_verification|subscription|analytics|admin)$")
    action: str
    payload: Dict[str, Any]
    user_id: Optional[UUID] = None
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")


class AgentResponse(BaseModel):
    success: bool
    agent_name: str
    action: str
    result: Dict[str, Any]
    execution_time_ms: int
    tokens_used: Optional[int] = None
    error: Optional[str] = None


class AgentLogResponse(BaseModel):
    id: UUID
    agent_name: str
    request_type: str
    user_id: Optional[UUID] = None
    success: bool
    execution_time_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    error_message: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class ProfileAnalysisRequest(BaseModel):
    profile_id: UUID
    analyze_photos: bool = True
    generate_embedding: bool = True


class ProfileAnalysisResponse(BaseModel):
    personality_traits: Dict[str, float]
    interests: List[str]
    red_flags: List[str]
    suggestions: List[str]
    profile_quality_score: float
    embedding_generated: bool


class MatchRecommendationRequest(BaseModel):
    user_id: UUID
    limit: int = Field(default=20, ge=1, le=100)
    filters: Optional[Dict[str, Any]] = None


class MatchRecommendationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    total_candidates: int
    algorithm_version: str


class ContentModerationRequest(BaseModel):
    content: str
    content_type: str = Field(default="text", pattern="^(text|image)$")
    user_id: Optional[UUID] = None
    context: Optional[str] = None  # 'profile', 'message', 'bio'


class ContentModerationResponse(BaseModel):
    is_safe: bool
    safety_score: float
    flags: List[str]
    severity: str  # low, medium, high, critical
    action: str  # allow, flag, block, escalate
    reason: str


class FraudCheckRequest(BaseModel):
    user_id: UUID
    check_type: str = Field(..., pattern="^(profile|behavior|message|all)$")


class FraudCheckResponse(BaseModel):
    risk_score: float
    is_suspicious: bool
    red_flags: List[str]
    confidence: float
    recommended_action: str  # none, warn, suspend, review


class ConversationSuggestionRequest(BaseModel):
    conversation_id: UUID
    user_id: UUID
    tone: str = Field(default="friendly", pattern="^(friendly|flirty|formal|casual|funny)$")
    message_count: Optional[int] = None


class ConversationSuggestionResponse(BaseModel):
    suggestions: List[str]
    topic_ideas: List[str]
    tone_analysis: Dict[str, Any]
    engagement_tips: List[str]
    icebreaker_suggestions: List[str]


class ImageVerificationRequest(BaseModel):
    photo_id: UUID
    verification_type: str = Field(default="moderation", pattern="^(moderation|face_verification|authenticity)$")


class ImageVerificationResponse(BaseModel):
    is_approved: bool
    has_face: bool
    face_count: int
    nsfw_score: float
    quality_score: float
    is_authentic: Optional[bool] = None
    flags: List[str]
