"""
Milan AI - AI Agents Module
"""
from app.agents.base import BaseAgent
from app.agents.orchestrator import OrchestratorAgent
from app.agents.user_profile import UserProfileAgent
from app.agents.matching import MatchingAgent
from app.agents.conversation import ConversationAgent
from app.agents.safety import SafetyAgent
from app.agents.fraud_detection import FraudDetectionAgent
from app.agents.image_verification import ImageVerificationAgent
from app.agents.subscription import SubscriptionAgent
from app.agents.analytics import AnalyticsAgent
from app.agents.admin import AdminAgent

__all__ = [
    "BaseAgent",
    "OrchestratorAgent",
    "UserProfileAgent",
    "MatchingAgent",
    "ConversationAgent",
    "SafetyAgent",
    "FraudDetectionAgent",
    "ImageVerificationAgent",
    "SubscriptionAgent",
    "AnalyticsAgent",
    "AdminAgent",
]

# Global orchestrator instance
orchestrator = OrchestratorAgent()


async def get_orchestrator() -> OrchestratorAgent:
    """Get the global orchestrator instance"""
    return orchestrator
