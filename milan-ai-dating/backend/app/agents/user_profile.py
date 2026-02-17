"""
Milan AI - User Profile Agent
Analyzes and enhances user profiles
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.config import AGENT_PROMPTS


class UserProfileAgent(BaseAgent):
    """Agent for analyzing and enhancing user profiles"""
    
    def __init__(self):
        super().__init__(name="user_profile", version="1.0.0")
    
    def get_system_prompt(self) -> str:
        return AGENT_PROMPTS["user_profile"]
    
    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process profile analysis request"""
        action = payload.get("action")
        
        if action == "analyze_profile":
            return await self._analyze_profile(payload)
        elif action == "generate_embedding":
            return await self._generate_embedding(payload)
        elif action == "extract_interests":
            return await self._extract_interests(payload)
        elif action == "suggest_improvements":
            return await self._suggest_improvements(payload)
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def _analyze_profile(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a user profile and extract insights"""
        profile_data = payload.get("profile", {})
        
        # Build profile text for analysis
        profile_text = self._build_profile_text(profile_data)
        
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
            {"role": "user", "content": f"""
Analyze this dating profile and provide insights:

{profile_text}

Respond with JSON:
{{
    "personality_traits": {{
        "openness": 0.0-1.0,
        "conscientiousness": 0.0-1.0,
        "extraversion": 0.0-1.0,
        "agreeableness": 0.0-1.0,
        "neuroticism": 0.0-1.0
    }},
    "interests": ["list", "of", "interests"],
    "values": ["list", "of", "values"],
    "lifestyle_indicators": {{
        "activity_level": "low/medium/high",
        "social_preference": "introvert/extrovert/ambivert",
        "relationship_readiness": "casual/serious/unsure"
    }},
    "red_flags": ["any", "concerns"],
    "suggestions": ["improvement", "tips"],
    "profile_quality_score": 0-100,
    "embedding_text": "consolidated text for vector generation"
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.7, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    async def _generate_embedding(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Generate vector embedding for profile"""
        text = payload.get("text", "")
        
        if not self.llm_client:
            return {"error": "LLM client not initialized"}
        
        try:
            response = await self.llm_client.embeddings.create(
                model=settings.EMBEDDING_MODEL,
                input=text
            )
            
            return {
                "embedding": response.data[0].embedding,
                "dimension": len(response.data[0].embedding),
                "tokens_used": response.usage.total_tokens if response.usage else 0
            }
        except Exception as e:
            return {"error": str(e)}
    
    async def _extract_interests(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Extract interests from profile data"""
        bio = payload.get("bio", "")
        about_me = payload.get("about_me", "")
        existing_interests = payload.get("existing_interests", [])
        
        messages = [
            {"role": "system", "content": "Extract interests from dating profile text."},
            {"role": "user", "content": f"""
Extract interests from this profile:

Bio: {bio}
About Me: {about_me}
Existing Interests: {existing_interests}

Respond with JSON:
{{
    "interests": [
        {{"name": "interest", "category": "hobbies/sports/music/travel/food/arts/tech/other", "confidence": 0.0-1.0}}
    ],
    "new_interests": ["interests", "not", "in", "existing"],
    "categories": ["detected", "categories"]
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.5, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    async def _suggest_improvements(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest profile improvements"""
        profile_data = payload.get("profile", {})
        completion_score = payload.get("completion_score", 0)
        
        messages = [
            {"role": "system", "content": "Suggest improvements for dating profile."},
            {"role": "user", "content": f"""
Current completion score: {completion_score}%

Profile data: {profile_data}

Suggest specific improvements to increase profile quality and attract more matches.
Consider Nepalese cultural context.

Respond with JSON:
{{
    "priority_improvements": ["most", "important", "changes"],
    "bio_suggestions": ["tips", "for", "better", "bio"],
    "photo_suggestions": ["photo", "tips"],
    "missing_fields": ["important", "empty", "fields"],
    "expected_impact": "How much these changes could improve match rate"
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.7, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    def _build_profile_text(self, profile: Dict[str, Any]) -> str:
        """Build consolidated profile text for analysis"""
        parts = []
        
        if profile.get("bio"):
            parts.append(f"Bio: {profile['bio']}")
        if profile.get("about_me"):
            parts.append(f"About: {profile['about_me']}")
        if profile.get("looking_for"):
            parts.append(f"Looking for: {profile['looking_for']}")
        if profile.get("interests"):
            parts.append(f"Interests: {', '.join(profile['interests'])}")
        if profile.get("occupation"):
            parts.append(f"Occupation: {profile['occupation']}")
        if profile.get("education"):
            parts.append(f"Education: {profile['education']}")
        
        return "\n".join(parts)
