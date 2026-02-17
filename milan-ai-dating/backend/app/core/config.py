"""
Milan AI Dating Platform - Configuration
"""
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    """Application settings"""
    
    # App
    APP_NAME: str = "Milan AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/milan_ai"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PASSWORD: Optional[str] = None
    
    # Vector DB (FAISS)
    FAISS_INDEX_PATH: str = "./data/faiss_index"
    EMBEDDING_DIMENSION: int = 1536  # OpenAI text-embedding-3-small
    
    # LLM Configuration
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    DEFAULT_LLM_MODEL: str = "gpt-4"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    LLM_TEMPERATURE: float = 0.7
    LLM_MAX_TOKENS: int = 1000
    
    # File Storage
    STORAGE_ENDPOINT: str = "http://localhost:9000"
    STORAGE_ACCESS_KEY: str = "minioadmin"
    STORAGE_SECRET_KEY: str = "minioadmin"
    STORAGE_BUCKET: str = "milan-ai"
    MAX_UPLOAD_SIZE_MB: int = 10
    
    # Payment (Nepal)
    KHALTI_PUBLIC_KEY: Optional[str] = None
    KHALTI_SECRET_KEY: Optional[str] = None
    ESEWA_MERCHANT_ID: Optional[str] = None
    ESEWA_SECRET_KEY: Optional[str] = None
    
    # SMS Gateway
    SMS_API_KEY: Optional[str] = None
    SMS_SENDER_ID: str = "MilanAI"
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds
    
    # Matching Algorithm
    DAILY_SWIPE_LIMIT_FREE: int = 50
    DAILY_SWIPE_LIMIT_BASIC: int = 100
    DAILY_SWIPE_LIMIT_PREMIUM: int = 999999  # Unlimited
    
    # AI Agent Settings
    AGENT_TIMEOUT_SECONDS: int = 30
    AGENT_MAX_RETRIES: int = 3
    AGENT_RETRY_DELAY: float = 1.0
    
    # Safety & Moderation
    TOXICITY_THRESHOLD: float = 0.7
    NSFW_THRESHOLD: float = 0.8
    AUTO_MODERATION_ENABLED: bool = True
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30
    
    # Nepal-specific
    DEFAULT_COUNTRY_CODE: str = "+977"
    SUPPORTED_LANGUAGES: List[str] = ["en", "ne"]
    
    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()


# Subscription Plans (NPR)
SUBSCRIPTION_PLANS = {
    "free": {
        "name_en": "Free",
        "name_ne": "निःशुल्क",
        "monthly_price": 0,
        "features": {
            "daily_swipes": 50,
            "superlikes_per_day": 0,
            "boosts_per_month": 0,
            "see_likes": False,
            "advanced_filters": False,
            "unlimited_likes": False,
            "read_receipts": False,
            "ai_assistant": False,
            "incognito_mode": False,
            "who_viewed": False,
        }
    },
    "basic": {
        "name_en": "Basic",
        "name_ne": "बेसिक",
        "monthly_price": 499,
        "features": {
            "daily_swipes": 100,
            "superlikes_per_day": 1,
            "boosts_per_month": 0,
            "see_likes": True,
            "advanced_filters": True,
            "unlimited_likes": True,
            "read_receipts": False,
            "ai_assistant": False,
            "incognito_mode": False,
            "who_viewed": False,
        }
    },
    "premium": {
        "name_en": "Premium",
        "name_ne": "प्रीमियम",
        "monthly_price": 999,
        "features": {
            "daily_swipes": 999999,  # Unlimited
            "superlikes_per_day": 5,
            "boosts_per_month": 2,
            "see_likes": True,
            "advanced_filters": True,
            "unlimited_likes": True,
            "read_receipts": True,
            "ai_assistant": True,
            "incognito_mode": False,
            "who_viewed": True,
        }
    },
    "elite": {
        "name_en": "Elite",
        "name_ne": "एलीट",
        "monthly_price": 1999,
        "features": {
            "daily_swipes": 999999,  # Unlimited
            "superlikes_per_day": 10,
            "boosts_per_month": 5,
            "see_likes": True,
            "advanced_filters": True,
            "unlimited_likes": True,
            "read_receipts": True,
            "ai_assistant": True,
            "incognito_mode": True,
            "who_viewed": True,
            "priority_support": True,
            "exclusive_matches": True,
        }
    }
}


# Agent System Prompts
AGENT_PROMPTS = {
    "orchestrator": """You are the Orchestrator Agent for Milan AI, a dating platform for Nepal.
Your role is to coordinate between specialized AI agents to provide the best user experience.

Available Agents:
- user_profile: Analyzes and enhances user profiles
- matching: Finds compatible matches
- conversation: Suggests conversation improvements
- safety: Moderates content and ensures safety
- fraud_detection: Identifies suspicious behavior
- subscription: Handles billing and payments

Route requests to the appropriate agent based on the user's intent.
Always respond in JSON format.
""",
    
    "user_profile": """You are the User Profile Agent for Milan AI.
Analyze user profiles to extract personality traits, interests, and compatibility indicators.

Tasks:
1. Generate personality insights from profile text
2. Identify interests and hobbies
3. Detect inconsistencies or red flags
4. Suggest profile improvements
5. Generate vector embeddings for matching

Output must be valid JSON with these fields:
- personality_traits: object with trait scores (0-1)
- interests: array of identified interests
- red_flags: array of any concerns
- suggestions: array of improvement tips
- embedding_text: string for vector generation

Consider Nepalese cultural context in your analysis.
""",
    
    "matching": """You are the Matching Agent for Milan AI.
Find the most compatible matches for users based on multiple factors.

Scoring weights:
- Vector similarity: 40%
- Preference alignment: 30%
- Behavioral compatibility: 20%
- Diversity bonus: 10%

For each match, provide:
- compatibility_score (0-100)
- match_reason (personalized explanation)
- common_interests (shared interests)
- potential_challenges (if any)

Output in JSON format.
""",
    
    "conversation": """You are the Conversation Coach for Milan AI, helping Nepalese users connect better.

Tasks:
1. Generate culturally appropriate icebreakers
2. Suggest replies based on context
3. Identify conversation stagnation
4. Recommend topics to discuss

Guidelines:
- Respect Nepalese culture and values
- Be natural and friendly
- Avoid overly personal questions initially
- Consider both urban and rural contexts

Output JSON with:
- suggestions: array of message options
- topic_ideas: array of conversation topics
- tone_analysis: object with sentiment
- engagement_tips: array of tips
""",
    
    "safety": """You are the Safety & Moderation Agent for Milan AI.
Protect users from harmful content and behavior.

Check for:
- Hate speech or discrimination
- Sexual harassment
- Scam attempts
- Personal information oversharing
- Threats or violence
- Inappropriate content

Output JSON:
- is_safe: boolean
- safety_score: 0-1
- flags: array of detected issues
- severity: low/medium/high/critical
- action: allow/flag/block/escalate
- reason: explanation
""",
    
    "fraud_detection": """You are the Fraud Detection Agent for Milan AI.
Identify fake accounts and scam attempts.

Red flags to detect:
- Profile inconsistencies
- Suspicious messaging patterns
- Stock photos or stolen images
- Rapid relationship escalation
- External link sharing
- Money requests
- Multiple accounts from same device

Output JSON:
- risk_score: 0-1
- is_suspicious: boolean
- red_flags: array of concerns
- confidence: 0-1
- recommended_action: none/warn/suspend/review
"""
}
