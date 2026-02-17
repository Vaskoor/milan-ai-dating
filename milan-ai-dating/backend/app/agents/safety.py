"""
Milan AI - Safety & Moderation Agent
Content moderation and user safety
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.config import AGENT_PROMPTS, settings


class SafetyAgent(BaseAgent):
    """Agent for content moderation and safety"""
    
    def __init__(self):
        super().__init__(name="safety", version="1.0.0")
        self.toxicity_keywords = [
            # English
            "hate", "kill", "die", "stupid", "idiot", "loser", "ugly",
            # Nepali/Hindi common slurs (romanized)
            "randi", "madarchod", "behenchod", "chutiya", "bhosdi",
        ]
    
    def get_system_prompt(self) -> str:
        return AGENT_PROMPTS["safety"]
    
    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process safety/moderation request"""
        action = payload.get("action")
        
        if action == "moderate_content":
            return await self._moderate_content(payload)
        elif action == "check_message":
            return await self._check_message(payload)
        elif action == "check_profile":
            return await self._check_profile(payload)
        elif action == "analyze_image":
            return await self._analyze_image(payload)
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def _moderate_content(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Moderate text content"""
        content = payload.get("content", "")
        content_type = payload.get("content_type", "text")
        context = payload.get("context", "general")
        
        # Quick keyword check first
        keyword_flags = self._check_keywords(content.lower())
        
        # LLM-based analysis
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
            {"role": "user", "content": f"""
Moderate this content:

Content: "{content}"
Type: {content_type}
Context: {context}

Respond with JSON:
{{
    "is_safe": true/false,
    "safety_score": 0.0-1.0,
    "flags": ["list", "of", "issues"],
    "severity": "low/medium/high/critical",
    "action": "allow/flag/block/escalate",
    "reason": "explanation",
    "categories": {{
        "hate_speech": 0.0-1.0,
        "harassment": 0.0-1.0,
        "sexual_content": 0.0-1.0,
        "scam": 0.0-1.0,
        "personal_info": 0.0-1.0,
        "violence": 0.0-1.0
    }}
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.3, response_format="json")
        result = self.parse_json_response(response["content"])
        
        # Combine keyword and LLM results
        if keyword_flags:
            result["keyword_flags"] = keyword_flags
            result["is_safe"] = False
            result["safety_score"] = min(result.get("safety_score", 1.0), 0.5)
        
        result["tokens_used"] = response.get("tokens_used", 0)
        
        # Determine final action
        if result.get("safety_score", 1.0) < 0.3:
            result["action"] = "block"
        elif result.get("safety_score", 1.0) < 0.6:
            result["action"] = "flag"
        elif result.get("severity") == "critical":
            result["action"] = "escalate"
        
        return result
    
    async def _check_message(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Check a chat message for safety"""
        message = payload.get("message", "")
        sender_id = payload.get("sender_id")
        receiver_id = payload.get("receiver_id")
        
        # Check for common scam patterns
        scam_indicators = self._detect_scam_patterns(message)
        
        # Moderate content
        moderation = await self._moderate_content({
            "content": message,
            "content_type": "text",
            "context": "message"
        })
        
        result = {
            "is_safe": moderation.get("is_safe", True),
            "safety_score": moderation.get("safety_score", 1.0),
            "flags": moderation.get("flags", []),
            "scam_indicators": scam_indicators,
            "action": moderation.get("action", "allow"),
            "reason": moderation.get("reason", ""),
            "tokens_used": moderation.get("tokens_used", 0)
        }
        
        # Escalate if scam detected
        if scam_indicators:
            result["is_safe"] = False
            result["action"] = "escalate"
            result["flags"].append("potential_scam")
        
        return result
    
    async def _check_profile(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Check profile content for safety"""
        profile = payload.get("profile", {})
        
        checks = []
        
        # Check bio
        if profile.get("bio"):
            bio_check = await self._moderate_content({
                "content": profile["bio"],
                "content_type": "text",
                "context": "profile_bio"
            })
            checks.append({"field": "bio", "result": bio_check})
        
        # Check about_me
        if profile.get("about_me"):
            about_check = await self._moderate_content({
                "content": profile["about_me"],
                "content_type": "text",
                "context": "profile_about"
            })
            checks.append({"field": "about_me", "result": about_check})
        
        # Check looking_for
        if profile.get("looking_for"):
            looking_check = await self._moderate_content({
                "content": profile["looking_for"],
                "content_type": "text",
                "context": "profile_looking"
            })
            checks.append({"field": "looking_for", "result": looking_check})
        
        # Aggregate results
        all_safe = all(c["result"].get("is_safe", True) for c in checks)
        min_score = min(c["result"].get("safety_score", 1.0) for c in checks) if checks else 1.0
        all_flags = []
        for c in checks:
            all_flags.extend(c["result"].get("flags", []))
        
        return {
            "is_safe": all_safe,
            "safety_score": min_score,
            "flags": list(set(all_flags)),
            "field_checks": checks,
            "action": "block" if min_score < 0.3 else "flag" if min_score < 0.6 else "allow"
        }
    
    async def _analyze_image(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze image for safety"""
        image_url = payload.get("image_url", "")
        
        # This would integrate with image moderation API
        # For now, return placeholder
        return {
            "is_safe": True,
            "nsfw_score": 0.0,
            "violence_score": 0.0,
            "flags": [],
            "action": "allow"
        }
    
    def _check_keywords(self, text: str) -> List[str]:
        """Check for toxic keywords"""
        flags = []
        for keyword in self.toxicity_keywords:
            if keyword in text:
                flags.append(f"contains_{keyword}")
        return flags
    
    def _detect_scam_patterns(self, text: str) -> List[str]:
        """Detect common scam patterns"""
        indicators = []
        text_lower = text.lower()
        
        # External links
        if "http" in text_lower or "www." in text_lower:
            indicators.append("contains_external_link")
        
        # Money requests
        money_words = ["money", "cash", "payment", "bank", "transfer", "send", "pay", "dollar", "rupee", "rs."]
        if any(word in text_lower for word in money_words):
            indicators.append("potential_money_request")
        
        # Contact info sharing
        if any(x in text for x in ["@gmail.com", "@yahoo.com", "facebook.com", "instagram.com", "whatsapp"]):
            indicators.append("contact_info_sharing")
        
        # Phone numbers
        import re
        if re.search(r'\b\d{10}\b', text) or re.search(r'\+977\d{10}', text):
            indicators.append("phone_number_sharing")
        
        # Rapid relationship escalation
        love_words = ["i love you", "marry me", "soulmate", "destiny", "forever"]
        if any(word in text_lower for word in love_words):
            indicators.append("rapid_relationship_escalation")
        
        return indicators
