"""
Milan AI - Matching Agent
Intelligent profile matching and recommendations
"""
from typing import Dict, Any, List, Optional
from app.agents.base import BaseAgent
from app.core.config import AGENT_PROMPTS, settings
import numpy as np


class MatchingAgent(BaseAgent):
    """Agent for finding compatible matches"""
    
    def __init__(self):
        super().__init__(name="matching", version="1.0.0")
    
    def get_system_prompt(self) -> str:
        return AGENT_PROMPTS["matching"]
    
    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process matching request"""
        action = payload.get("action")
        
        if action == "find_matches":
            return await self._find_matches(payload)
        elif action == "calculate_compatibility":
            return await self._calculate_compatibility(payload)
        elif action == "explain_match":
            return await self._explain_match(payload)
        elif action == "rank_candidates":
            return await self._rank_candidates(payload)
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def _find_matches(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Find compatible matches for a user"""
        user_profile = payload.get("user_profile", {})
        candidates = payload.get("candidates", [])
        preferences = payload.get("preferences", {})
        limit = payload.get("limit", 20)
        
        if not candidates:
            return {"matches": [], "total_candidates": 0}
        
        # Calculate compatibility for each candidate
        scored_candidates = []
        for candidate in candidates:
            score = await self._compute_compatibility_score(
                user_profile, candidate, preferences
            )
            scored_candidates.append({
                "candidate": candidate,
                "compatibility_score": score["overall_score"],
                "score_breakdown": score
            })
        
        # Sort by compatibility score
        scored_candidates.sort(key=lambda x: x["compatibility_score"], reverse=True)
        
        # Get top matches
        top_matches = scored_candidates[:limit]
        
        # Generate explanations for top matches
        for match in top_matches:
            explanation = await self._generate_explanation(
                user_profile, match["candidate"], match["score_breakdown"]
            )
            match["explanation"] = explanation
        
        return {
            "matches": top_matches,
            "total_candidates": len(candidates),
            "algorithm_version": "2.1.0"
        }
    
    async def _calculate_compatibility(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate detailed compatibility between two users"""
        user1 = payload.get("user1", {})
        user2 = payload.get("user2", {})
        preferences = payload.get("preferences", {})
        
        score = await self._compute_compatibility_score(user1, user2, preferences)
        
        # Generate detailed analysis
        messages = [
            {"role": "system", "content": "Analyze compatibility between two dating profiles."},
            {"role": "user", "content": f"""
User 1: {user1}
User 2: {user2}
Compatibility Score: {score['overall_score']}

Provide detailed compatibility analysis.

Respond with JSON:
{{
    "overall_score": 0-100,
    "strengths": ["areas", "of", "compatibility"],
    "challenges": ["potential", "challenges"],
    "conversation_starters": ["suggested", "topics"],
    "long_term_potential": "high/medium/low",
    "recommendation": "why they should connect"
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.7, response_format="json")
        result = self.parse_json_response(response["content"])
        result["score_breakdown"] = score
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    async def _compute_compatibility_score(
        self,
        user1: Dict[str, Any],
        user2: Dict[str, Any],
        preferences: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compute compatibility score using multiple factors"""
        
        # Vector similarity (40%)
        vector_score = self._calculate_vector_similarity(
            user1.get("embedding", []),
            user2.get("embedding", [])
        )
        
        # Preference alignment (30%)
        preference_score = self._calculate_preference_alignment(user1, user2, preferences)
        
        # Behavioral compatibility (20%)
        behavioral_score = self._calculate_behavioral_compatibility(user1, user2)
        
        # Diversity bonus (10%)
        diversity_score = self._calculate_diversity_bonus(user1, user2)
        
        # Weighted sum
        overall_score = (
            0.40 * vector_score +
            0.30 * preference_score +
            0.20 * behavioral_score +
            0.10 * diversity_score
        )
        
        return {
            "overall_score": round(overall_score * 100, 2),
            "vector_similarity": round(vector_score * 100, 2),
            "preference_alignment": round(preference_score * 100, 2),
            "behavioral_compatibility": round(behavioral_score * 100, 2),
            "diversity_bonus": round(diversity_score * 100, 2)
        }
    
    def _calculate_vector_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """Calculate cosine similarity between embeddings"""
        if not embedding1 or not embedding2:
            return 0.5  # Neutral if no embeddings
        
        try:
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.5
            
            similarity = dot_product / (norm1 * norm2)
            return (similarity + 1) / 2  # Normalize to 0-1
        except Exception:
            return 0.5
    
    def _calculate_preference_alignment(
        self,
        user1: Dict[str, Any],
        user2: Dict[str, Any],
        preferences: Dict[str, Any]
    ) -> float:
        """Calculate preference alignment score"""
        scores = []
        
        # Age preference
        age1 = user1.get("age")
        age2 = user2.get("age")
        if age1 and age2:
            age_pref_min = preferences.get("age_min", 18)
            age_pref_max = preferences.get("age_max", 50)
            if age_pref_min <= age2 <= age_pref_max:
                scores.append(1.0)
            else:
                scores.append(0.3)
        
        # Location preference
        if user1.get("city") == user2.get("city"):
            scores.append(1.0)
        elif user1.get("province") == user2.get("province"):
            scores.append(0.7)
        else:
            scores.append(0.3)
        
        # Religion preference
        if preferences.get("preferred_religions"):
            if user2.get("religion") in preferences["preferred_religions"]:
                scores.append(1.0)
            else:
                scores.append(0.2)
        
        # Education preference
        if preferences.get("preferred_education_levels"):
            if user2.get("education") in preferences["preferred_education_levels"]:
                scores.append(1.0)
            else:
                scores.append(0.4)
        
        return sum(scores) / len(scores) if scores else 0.5
    
    def _calculate_behavioral_compatibility(
        self,
        user1: Dict[str, Any],
        user2: Dict[str, Any]
    ) -> float:
        """Calculate behavioral/lifestyle compatibility"""
        scores = []
        
        # Smoking compatibility
        smoking1 = user1.get("smoking", "never")
        smoking2 = user2.get("smoking", "never")
        if smoking1 == smoking2:
            scores.append(1.0)
        elif smoking1 == "never" and smoking2 != "never":
            scores.append(0.3)
        else:
            scores.append(0.6)
        
        # Drinking compatibility
        drinking1 = user1.get("drinking", "never")
        drinking2 = user2.get("drinking", "never")
        if drinking1 == drinking2:
            scores.append(1.0)
        else:
            scores.append(0.7)
        
        # Diet compatibility
        diet1 = user1.get("diet")
        diet2 = user2.get("diet")
        if diet1 and diet2:
            if diet1 == diet2:
                scores.append(1.0)
            elif diet1 in ["vegetarian", "jain"] and diet2 == "non_vegetarian":
                scores.append(0.3)
            else:
                scores.append(0.7)
        
        # Interest overlap
        interests1 = set(user1.get("interests", []))
        interests2 = set(user2.get("interests", []))
        if interests1 and interests2:
            overlap = len(interests1 & interests2)
            total = len(interests1 | interests2)
            if total > 0:
                scores.append(overlap / total)
        
        return sum(scores) / len(scores) if scores else 0.5
    
    def _calculate_diversity_bonus(
        self,
        user1: Dict[str, Any],
        user2: Dict[str, Any]
    ) -> float:
        """Calculate diversity bonus to avoid filter bubbles"""
        # Give slight bonus for complementary traits
        scores = []
        
        # Different but complementary interests
        interests1 = set(user1.get("interests", []))
        interests2 = set(user2.get("interests", []))
        if interests1 and interests2:
            # Some overlap but not complete
            overlap = len(interests1 & interests2)
            if 1 <= overlap <= 3:
                scores.append(1.0)  # Good diversity
            elif overlap == 0:
                scores.append(0.5)  # Too different
            else:
                scores.append(0.7)  # High overlap
        
        # Different backgrounds can be interesting
        if user1.get("education") != user2.get("education"):
            scores.append(0.8)
        
        return sum(scores) / len(scores) if scores else 0.5
    
    async def _generate_explanation(
        self,
        user1: Dict[str, Any],
        user2: Dict[str, Any],
        score_breakdown: Dict[str, Any]
    ) -> str:
        """Generate human-readable match explanation"""
        messages = [
            {"role": "system", "content": "Generate a brief, appealing match explanation."},
            {"role": "user", "content": f"""
Generate a 1-2 sentence explanation for why these users might be a good match.
Keep it natural and appealing.

User 1 interests: {user1.get('interests', [])}
User 2 interests: {user2.get('interests', [])}
Compatibility: {score_breakdown['overall_score']}%

Example: "You both love hiking and share similar values around family."
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.8, max_tokens=100)
        return response["content"].strip().strip('"')
    
    async def _explain_match(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Generate detailed explanation for a match"""
        user1 = payload.get("user1", {})
        user2 = payload.get("user2", {})
        
        messages = [
            {"role": "system", "content": "Explain why two users are a good match."},
            {"role": "user", "content": f"""
Explain this match in detail:

User 1: {user1.get('first_name')}, {user1.get('age')} years old
- Bio: {user1.get('bio', 'N/A')}
- Interests: {user1.get('interests', [])}
- Looking for: {user1.get('looking_for', 'N/A')}

User 2: {user2.get('first_name')}, {user2.get('age')} years old
- Bio: {user2.get('bio', 'N/A')}
- Interests: {user2.get('interests', [])}
- Looking for: {user2.get('looking_for', 'N/A')}

Respond with JSON:
{{
    "match_summary": "Brief summary",
    "key_similarities": ["list"],
    "complementary_traits": ["list"],
    "conversation_starters": ["suggested topics"],
    "relationship_potential": "assessment"
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.7, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    async def _rank_candidates(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Rank candidate matches"""
        candidates = payload.get("candidates", [])
        user_profile = payload.get("user_profile", {})
        
        # Score and rank all candidates
        scored = []
        for candidate in candidates:
            score = await self._compute_compatibility_score(user_profile, candidate, {})
            scored.append({
                "candidate": candidate,
                "score": score["overall_score"]
            })
        
        # Sort by score
        scored.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "ranked_candidates": scored,
            "total": len(scored)
        }
