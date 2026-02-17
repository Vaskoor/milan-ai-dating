"""
Milan AI - Orchestrator Agent
Central coordinator for all AI agents
"""
from typing import Dict, Any, Optional, List, Type
from uuid import UUID
import asyncio

from app.agents.base import BaseAgent
from app.core.config import AGENT_PROMPTS


class OrchestratorAgent(BaseAgent):
    """Orchestrator that routes requests to appropriate agents"""
    
    def __init__(self):
        super().__init__(name="orchestrator", version="1.0.0")
        self.agents: Dict[str, BaseAgent] = {}
        self._register_agents()
    
    def _register_agents(self):
        """Register all available agents"""
        # Import agents here to avoid circular imports
        from app.agents.user_profile import UserProfileAgent
        from app.agents.matching import MatchingAgent
        from app.agents.conversation import ConversationAgent
        from app.agents.safety import SafetyAgent
        from app.agents.fraud_detection import FraudDetectionAgent
        from app.agents.image_verification import ImageVerificationAgent
        from app.agents.subscription import SubscriptionAgent
        from app.agents.analytics import AnalyticsAgent
        from app.agents.admin import AdminAgent
        
        self.agents = {
            "user_profile": UserProfileAgent(),
            "matching": MatchingAgent(),
            "conversation": ConversationAgent(),
            "safety": SafetyAgent(),
            "fraud_detection": FraudDetectionAgent(),
            "image_verification": ImageVerificationAgent(),
            "subscription": SubscriptionAgent(),
            "analytics": AnalyticsAgent(),
            "admin": AdminAgent(),
        }
    
    def get_system_prompt(self) -> str:
        return AGENT_PROMPTS["orchestrator"]
    
    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process orchestration request"""
        action = payload.get("action")
        target_agent = payload.get("agent")
        agent_payload = payload.get("payload", {})
        
        if target_agent and target_agent in self.agents:
            # Direct agent routing
            agent = self.agents[target_agent]
            return await agent.execute(
                action=action,
                payload=agent_payload,
                user_id=payload.get("user_id")
            )
        
        # Intelligent routing based on action
        routed_agent = self._route_action(action)
        if routed_agent:
            agent = self.agents.get(routed_agent)
            if agent:
                return await agent.execute(
                    action=action,
                    payload=agent_payload,
                    user_id=payload.get("user_id")
                )
        
        # Use LLM for complex routing decisions
        return await self._llm_route(payload)
    
    def _route_action(self, action: str) -> Optional[str]:
        """Route action to appropriate agent"""
        routing_map = {
            # User Profile Agent
            "analyze_profile": "user_profile",
            "generate_embedding": "user_profile",
            "extract_interests": "user_profile",
            "suggest_profile_improvements": "user_profile",
            
            # Matching Agent
            "find_matches": "matching",
            "calculate_compatibility": "matching",
            "get_recommendations": "matching",
            "explain_match": "matching",
            
            # Conversation Agent
            "suggest_reply": "conversation",
            "generate_icebreaker": "conversation",
            "analyze_conversation": "conversation",
            "get_conversation_tips": "conversation",
            
            # Safety Agent
            "moderate_content": "safety",
            "check_message": "safety",
            "flag_content": "safety",
            
            # Fraud Detection Agent
            "check_fraud": "fraud_detection",
            "analyze_behavior": "fraud_detection",
            "verify_account": "fraud_detection",
            
            # Image Verification Agent
            "verify_photo": "image_verification",
            "moderate_image": "image_verification",
            "check_face": "image_verification",
            
            # Subscription Agent
            "process_payment": "subscription",
            "check_subscription": "subscription",
            "upgrade_plan": "subscription",
            
            # Analytics Agent
            "track_event": "analytics",
            "generate_report": "analytics",
            "analyze_funnel": "analytics",
            
            # Admin Agent
            "get_user_details": "admin",
            "suspend_user": "admin",
            "resolve_report": "admin",
        }
        
        return routing_map.get(action)
    
    async def _llm_route(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Use LLM for complex routing decisions"""
        messages = [
            {"role": "system", "content": self.get_system_prompt()},
            {"role": "user", "content": f"""
Route this request to the appropriate agent:

Action: {payload.get('action')}
Payload: {payload.get('payload')}

Available agents: {list(self.agents.keys())}

Respond with JSON:
{{
    "agent": "agent_name",
    "reasoning": "why this agent",
    "confidence": 0.0-1.0
}}
"""}
        ]
        
        response = await self.call_llm(messages, temperature=0.3, response_format="json")
        routing = self.parse_json_response(response["content"])
        
        agent_name = routing.get("agent")
        if agent_name and agent_name in self.agents:
            agent = self.agents[agent_name]
            return await agent.execute(
                action=payload.get("action"),
                payload=payload.get("payload", {}),
                user_id=payload.get("user_id")
            )
        
        return {
            "success": False,
            "error": f"Could not route action: {payload.get('action')}",
            "routing_attempt": routing
        }
    
    async def execute_parallel(
        self,
        requests: List[Dict[str, Any]],
        user_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """Execute multiple agent requests in parallel"""
        tasks = []
        for req in requests:
            agent_name = req.get("agent")
            if agent_name in self.agents:
                agent = self.agents[agent_name]
                task = agent.execute(
                    action=req.get("action"),
                    payload=req.get("payload", {}),
                    user_id=user_id
                )
                tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "success": False,
                    "agent": requests[i].get("agent"),
                    "error": str(result)
                })
            else:
                processed_results.append(result)
        
        return processed_results
    
    async def execute_pipeline(
        self,
        pipeline: List[Dict[str, Any]],
        initial_payload: Dict[str, Any],
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Execute a pipeline of agent operations"""
        current_payload = initial_payload.copy()
        results = []
        
        for step in pipeline:
            agent_name = step.get("agent")
            action = step.get("action")
            transform = step.get("transform")  # Function to transform output to next input
            
            if agent_name not in self.agents:
                results.append({
                    "step": action,
                    "success": False,
                    "error": f"Agent {agent_name} not found"
                })
                continue
            
            agent = self.agents[agent_name]
            result = await agent.execute(
                action=action,
                payload=current_payload,
                user_id=user_id
            )
            
            results.append({
                "step": action,
                "agent": agent_name,
                "success": result.get("success"),
                "result": result
            })
            
            if not result.get("success") and step.get("stop_on_error", True):
                break
            
            # Transform output for next step
            if transform and result.get("success"):
                current_payload = transform(result.get("result", {}))
            elif result.get("success"):
                current_payload = result.get("result", {})
        
        return {
            "success": all(r.get("success") for r in results),
            "pipeline_results": results,
            "final_payload": current_payload
        }
    
    def get_agent_status(self) -> Dict[str, Any]:
        """Get status of all agents"""
        return {
            agent_name: {
                "name": agent.name,
                "version": agent.version,
                "llm_initialized": agent.llm_client is not None
            }
            for agent_name, agent in self.agents.items()
        }
