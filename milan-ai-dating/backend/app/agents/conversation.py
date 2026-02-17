"""
Milan AI - Conversation Coach Agent
Helps users improve conversation quality
"""
from typing import Dict, Any, List
from app.agents.base import BaseAgent
from app.core.config import AGENT_PROMPTS


class ConversationAgent(BaseAgent):
    """Agent for conversation coaching and suggestions"""
    
    def __init__(self):
        super().__init__(name="conversation", version="1.0.0")
    
    def get_system_prompt(self) -> str:
        return AGENT_PROMPTS["conversation"]
    
    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process conversation coaching request"""
        action = payload.get("action")
        
        if action == "suggest_reply":
            return await self._suggest_reply(payload)
        elif action == "generate_icebreaker":
            return await self._generate_icebreaker(payload)
        elif action == "analyze_conversation":
            return await self._analyze_conversation(payload)
        elif action == "get_topic_ideas":
            return await self._get_topic_ideas(payload)
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def _suggest_reply(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest reply options based on conversation context"""
        conversation_history = payload.get("conversation_history", [])
        user_profile = payload.get("user_profile", {})
        match_profile = payload.get("match_profile", {})
        tone = payload.get("tone", "friendly")
        
        # Format conversation history
        history_text = self._format_conversation(conversation_history)
        
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
            {"role": "user", "content": f"""
Suggest reply options for this conversation.

User: {user_profile.get('first_name')}, interests: {user_profile.get('interests', [])}
Match: {match_profile.get('first_name')}, interests: {match_profile.get('interests', [])}

Conversation:
{history_text}

Tone: {tone}

Respond with JSON:
{{
    "suggestions": [
        "Natural reply option 1",
        "Natural reply option 2", 
        "Natural reply option 3"
    ],
    "tone_analysis": {{
        "current_tone": "description",
        "suggested_tone": "description"
    }},
    "engagement_tips": ["tip 1", "tip 2"]
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.8, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    async def _generate_icebreaker(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Generate conversation icebreakers"""
        user_profile = payload.get("user_profile", {})
        match_profile = payload.get("match_profile", {})
        context = payload.get("context", "first_contact")
        
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
            {"role": "user", "content": f"""
Generate icebreaker messages for a new match.

Context: {context}

You ({user_profile.get('first_name')}):
- Interests: {user_profile.get('interests', [])}
- Bio: {user_profile.get('bio', 'N/A')}

Match ({match_profile.get('first_name')}):
- Interests: {match_profile.get('interests', [])}
- Bio: {match_profile.get('bio', 'N/A')}
- Looking for: {match_profile.get('looking_for', 'N/A')}

Generate natural, culturally appropriate icebreakers for Nepalese context.
Avoid overly personal questions. Be respectful and friendly.

Respond with JSON:
{{
    "icebreakers": [
        {{
            "message": "First icebreaker message",
            "approach": "why this works",
            "confidence": 0.0-1.0
        }},
        {{
            "message": "Second icebreaker message",
            "approach": "why this works",
            "confidence": 0.0-1.0
        }},
        {{
            "message": "Third icebreaker message",
            "approach": "why this works",
            "confidence": 0.0-1.0
        }}
    ],
    "common_ground": ["shared interests or topics"],
    "recommended_approach": "which icebreaker to use and why"
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.9, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    async def _analyze_conversation(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze conversation health and engagement"""
        conversation_history = payload.get("conversation_history", [])
        
        if len(conversation_history) < 3:
            return {
                "analysis": "Not enough messages for analysis",
                "message_count": len(conversation_history)
            }
        
        history_text = self._format_conversation(conversation_history)
        
        messages = [
            {"role": "system", "content": "Analyze conversation health and engagement."},
            {"role": "user", "content": f"""
Analyze this conversation:

{history_text}

Respond with JSON:
{{
    "engagement_level": "high/medium/low",
    "conversation_health": "healthy/stagnant/declining",
    "balance_score": 0-100,
    "response_quality": "good/average/poor",
    "red_flags": ["any concerns"],
    "positive_signals": ["good signs"],
    "stagnation_risk": true/false,
    "recommendations": ["how to improve"],
    "next_step_suggestion": "what to do next"
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.6, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    async def _get_topic_ideas(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Get conversation topic ideas"""
        user_interests = payload.get("user_interests", [])
        match_interests = payload.get("match_interests", [])
        used_topics = payload.get("used_topics", [])
        
        messages = [
            {"role": "system", "content": "Suggest conversation topics for dating app users."},
            {"role": "user", "content": f"""
Suggest conversation topics based on shared interests.

User interests: {user_interests}
Match interests: {match_interests}
Already discussed: {used_topics}

Consider Nepalese cultural context. Topics should be:
- Appropriate for early dating stages
- Engaging and open-ended
- Culturally sensitive

Respond with JSON:
{{
    "topic_ideas": [
        {{
            "topic": "Topic name",
            "opening_question": "How to start this topic",
            "follow_up_questions": ["q1", "q2"],
            "why_it_works": "explanation"
        }}
    ],
    "categories": ["categories of topics"],
    "avoid_topics": ["topics to avoid"]
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.8, response_format="json")
        result = self.parse_json_response(response["content"])
        result["tokens_used"] = response.get("tokens_used", 0)
        
        return result
    
    def _format_conversation(self, messages: List[Dict[str, Any]]) -> str:
        """Format conversation history for LLM"""
        formatted = []
        for msg in messages[-10:]:  # Last 10 messages
            sender = msg.get("sender_name", "User")
            content = msg.get("content", "")
            formatted.append(f"{sender}: {content}")
        return "\n".join(formatted)
