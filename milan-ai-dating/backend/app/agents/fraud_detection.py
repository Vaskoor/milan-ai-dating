"""
Milan AI - Fraud Detection Agent
Detects fake accounts and scam attempts
"""
from typing import Dict, Any, List
from datetime import datetime, timedelta
from app.agents.base import BaseAgent
from app.core.config import AGENT_PROMPTS


class FraudDetectionAgent(BaseAgent):
    """Agent for detecting fraudulent behavior"""
    
    def __init__(self):
        super().__init__(name="fraud_detection", version="1.0.0")
    
    def get_system_prompt(self) -> str:
        return AGENT_PROMPTS["fraud_detection"]
    
    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process fraud detection request"""
        action = payload.get("action")
        
        if action == "check_fraud":
            return await self._check_fraud(payload)
        elif action == "analyze_behavior":
            return await self._analyze_behavior(payload)
        elif action == "check_profile":
            return await self._check_profile(payload)
        elif action == "verify_account":
            return await self._verify_account(payload)
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def _check_fraud(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive fraud check"""
        user_id = payload.get("user_id")
        profile = payload.get("profile", {})
        behavior_data = payload.get("behavior_data", {})
        
        # Run multiple checks
        profile_risk = self._assess_profile_risk(profile)
        behavior_risk = self._assess_behavior_risk(behavior_data)
        pattern_risk = self._detect_suspicious_patterns(profile, behavior_data)
        
        # Calculate overall risk score
        risk_score = (
            0.4 * profile_risk["score"] +
            0.4 * behavior_risk["score"] +
            0.2 * pattern_risk["score"]
        )
        
        # Determine action
        if risk_score > 0.8:
            action = "suspend"
        elif risk_score > 0.6:
            action = "review"
        elif risk_score > 0.4:
            action = "warn"
        else:
            action = "none"
        
        return {
            "risk_score": round(risk_score, 2),
            "is_suspicious": risk_score > 0.5,
            "confidence": round(max(profile_risk["confidence"], behavior_risk["confidence"]), 2),
            "red_flags": list(set(
                profile_risk["flags"] + 
                behavior_risk["flags"] + 
                pattern_risk["flags"]
            )),
            "recommended_action": action,
            "breakdown": {
                "profile_risk": profile_risk,
                "behavior_risk": behavior_risk,
                "pattern_risk": pattern_risk
            }
        }
    
    async def _analyze_behavior(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze user behavior patterns"""
        behavior_data = payload.get("behavior_data", {})
        
        messages = [
            {"role": "system", "content": "Analyze user behavior for fraud indicators."},
            {"role": "user", "content": f"""
Analyze this user behavior data:

{behavior_data}

Respond with JSON:
{{
    "behavior_anomalies": ["list of anomalies"],
    "risk_indicators": ["risk signs"],
    "normal_patterns": ["normal behavior"],
    "risk_score": 0.0-1.0,
    "recommendation": "assessment"
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.5, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    async def _check_profile(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Check profile for fake indicators"""
        profile = payload.get("profile", {})
        
        flags = []
        score = 0.0
        
        # Check for stock photo indicators
        if profile.get("photo_metadata"):
            meta = profile["photo_metadata"]
            if meta.get("is_stock_photo"):
                flags.append("potential_stock_photo")
                score += 0.3
            if meta.get("face_count") == 0:
                flags.append("no_face_detected")
                score += 0.2
        
        # Check profile completeness
        if profile.get("profile_completion_score", 0) < 30:
            flags.append("incomplete_profile")
            score += 0.2
        
        # Check bio quality
        bio = profile.get("bio", "")
        if len(bio) < 20:
            flags.append("very_short_bio")
            score += 0.15
        
        # Generic bio patterns
        generic_phrases = ["i am a simple person", "i like to have fun", "looking for someone nice"]
        if any(phrase in bio.lower() for phrase in generic_phrases):
            flags.append("generic_bio")
            score += 0.1
        
        # Check for inconsistent information
        if profile.get("age") and profile.get("date_of_birth"):
            # Could add age verification here
            pass
        
        # External link in bio
        if "http" in bio or "www." in bio:
            flags.append("external_link_in_bio")
            score += 0.25
        
        return {
            "score": min(score, 1.0),
            "flags": flags,
            "confidence": 0.7 if flags else 0.5,
            "is_likely_fake": score > 0.6
        }
    
    async def _verify_account(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Verify account authenticity"""
        user_id = payload.get("user_id")
        verification_data = payload.get("verification_data", {})
        
        checks = {
            "phone_verified": verification_data.get("phone_verified", False),
            "email_verified": verification_data.get("email_verified", False),
            "photo_verified": verification_data.get("photo_verified", False),
            "identity_verified": verification_data.get("identity_verified", False),
            "social_connected": verification_data.get("social_connected", False),
        }
        
        verification_score = sum(checks.values()) / len(checks)
        
        return {
            "verification_score": round(verification_score, 2),
            "checks": checks,
            "is_verified": verification_score >= 0.6,
            "missing_verifications": [k for k, v in checks.items() if not v]
        }
    
    def _assess_profile_risk(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Assess risk based on profile characteristics"""
        flags = []
        score = 0.0
        
        # New account with premium features
        account_age_days = profile.get("account_age_days", 0)
        if account_age_days < 1 and profile.get("is_premium"):
            flags.append("new_premium_account")
            score += 0.3
        
        # Multiple accounts from same IP
        if profile.get("accounts_from_same_ip", 0) > 1:
            flags.append("multiple_accounts_same_ip")
            score += 0.4
        
        # Suspicious photo patterns
        if profile.get("photo_count", 0) == 0:
            flags.append("no_photos")
            score += 0.2
        
        # Location inconsistencies
        if profile.get("ip_country") != profile.get("profile_country"):
            flags.append("location_mismatch")
            score += 0.25
        
        return {
            "score": min(score, 1.0),
            "flags": flags,
            "confidence": 0.75
        }
    
    def _assess_behavior_risk(self, behavior_data: Dict[str, Any]) -> Dict[str, Any]:
        """Assess risk based on behavior patterns"""
        flags = []
        score = 0.0
        
        # Message velocity
        messages_per_hour = behavior_data.get("messages_per_hour", 0)
        if messages_per_hour > 50:
            flags.append("extremely_high_message_velocity")
            score += 0.4
        elif messages_per_hour > 20:
            flags.append("high_message_velocity")
            score += 0.2
        
        # Swipe patterns
        swipe_ratio = behavior_data.get("swipe_right_ratio", 0.5)
        if swipe_ratio > 0.95:
            flags.append("indiscriminate_swiping")
            score += 0.3
        
        # Copy-paste messages
        if behavior_data.get("duplicate_message_ratio", 0) > 0.5:
            flags.append("copy_paste_messages")
            score += 0.35
        
        # Rapid match-to-message
        avg_time_to_message = behavior_data.get("avg_time_to_message_minutes", 1000)
        if avg_time_to_message < 1:
            flags.append("immediate_messaging")
            score += 0.2
        
        # External link sharing
        if behavior_data.get("external_link_sharing", False):
            flags.append("shares_external_links")
            score += 0.4
        
        return {
            "score": min(score, 1.0),
            "flags": flags,
            "confidence": 0.8
        }
    
    def _detect_suspicious_patterns(
        self,
        profile: Dict[str, Any],
        behavior_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Detect suspicious patterns"""
        flags = []
        score = 0.0
        
        # Romance scam indicators
        if behavior_data.get("love_bombing_score", 0) > 0.7:
            flags.append("potential_love_bombing")
            score += 0.5
        
        # Investment scam
        if behavior_data.get("investment_mentions", 0) > 0:
            flags.append("investment_mentions")
            score += 0.4
        
        # Emergency/crisis stories
        if behavior_data.get("crisis_mentions", 0) > 2:
            flags.append("repeated_crisis_stories")
            score += 0.35
        
        # Request to move off platform
        if behavior_data.get("off_platform_requests", 0) > 0:
            flags.append("requests_to_move_off_platform")
            score += 0.3
        
        return {
            "score": min(score, 1.0),
            "flags": flags,
            "confidence": 0.7
        }
