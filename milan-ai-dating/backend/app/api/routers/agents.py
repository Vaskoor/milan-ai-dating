"""
Milan AI - Agent Router
Direct access to AI agents for testing and admin
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_admin
from app.db.database import get_db
from app.db.models import User
from app.schemas.agent import (
    AgentRequest, AgentResponse,
    ProfileAnalysisRequest, ProfileAnalysisResponse,
    ContentModerationRequest, ContentModerationResponse,
    FraudCheckRequest, FraudCheckResponse,
    ConversationSuggestionRequest, ConversationSuggestionResponse
)
from app.agents import orchestrator

router = APIRouter(prefix="/agents", tags=["AI Agents"])


@router.post("/invoke", response_model=AgentResponse)
async def invoke_agent(
    request: AgentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invoke an AI agent directly"""
    # Only premium users can invoke agents directly
    if current_user.subscription_tier == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium subscription required for direct agent access"
        )
    
    result = await orchestrator.execute(
        action=request.action,
        payload=request.payload,
        user_id=current_user.id
    )
    
    return AgentResponse(
        success=result.get("success", False),
        agent_name=result.get("agent_name", request.agent_name),
        action=result.get("action", request.action),
        result=result.get("result", {}),
        execution_time_ms=result.get("execution_time_ms", 0),
        error=result.get("error")
    )


@router.post("/analyze-profile", response_model=ProfileAnalysisResponse)
async def analyze_profile(
    request: ProfileAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Analyze a user profile"""
    result = await orchestrator.execute(
        action="analyze_profile",
        payload={"profile_id": str(request.profile_id)},
        user_id=current_user.id
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Analysis failed")
        )
    
    analysis = result.get("result", {})
    
    return ProfileAnalysisResponse(
        personality_traits=analysis.get("personality_traits", {}),
        interests=analysis.get("interests", []),
        red_flags=analysis.get("red_flags", []),
        suggestions=analysis.get("suggestions", []),
        profile_quality_score=analysis.get("profile_quality_score", 0),
        embedding_generated=analysis.get("embedding_generated", False)
    )


@router.post("/moderate", response_model=ContentModerationResponse)
async def moderate_content(
    request: ContentModerationRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Moderate content (admin only)"""
    result = await orchestrator.execute(
        action="moderate_content",
        payload={
            "content": request.content,
            "content_type": request.content_type,
            "context": request.context
        },
        user_id=current_user.id
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Moderation failed")
        )
    
    moderation = result.get("result", {})
    
    return ContentModerationResponse(
        is_safe=moderation.get("is_safe", True),
        safety_score=moderation.get("safety_score", 1.0),
        flags=moderation.get("flags", []),
        severity=moderation.get("severity", "low"),
        action=moderation.get("action", "allow"),
        reason=moderation.get("reason", "")
    )


@router.post("/fraud-check", response_model=FraudCheckResponse)
async def fraud_check(
    request: FraudCheckRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Check for fraud (admin only)"""
    result = await orchestrator.execute(
        action="check_fraud",
        payload={
            "user_id": str(request.user_id),
            "check_type": request.check_type
        },
        user_id=current_user.id
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error", "Fraud check failed")
        )
    
    check = result.get("result", {})
    
    return FraudCheckResponse(
        risk_score=check.get("risk_score", 0.0),
        is_suspicious=check.get("is_suspicious", False),
        red_flags=check.get("red_flags", []),
        confidence=check.get("confidence", 0.0),
        recommended_action=check.get("recommended_action", "none")
    )


@router.get("/status")
async def get_agent_status(
    current_user: User = Depends(require_admin)
):
    """Get status of all agents (admin only)"""
    return orchestrator.get_agent_status()
