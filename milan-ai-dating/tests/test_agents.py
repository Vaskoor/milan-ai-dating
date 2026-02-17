"""
Milan AI - Agent Tests
"""
import pytest
import asyncio
from app.agents.safety import SafetyAgent
from app.agents.matching import MatchingAgent
from app.agents.conversation import ConversationAgent


@pytest.mark.asyncio
async def test_safety_agent_moderation():
    """Test safety agent content moderation"""
    agent = SafetyAgent()
    
    result = await agent.execute(
        action="moderate_content",
        payload={
            "content": "Hello, nice to meet you!",
            "content_type": "text",
            "context": "message"
        }
    )
    
    assert result["success"] is True
    assert "is_safe" in result.get("result", {})


@pytest.mark.asyncio
async def test_matching_agent_compatibility():
    """Test matching agent compatibility scoring"""
    agent = MatchingAgent()
    
    user1 = {
        "interests": ["hiking", "reading", "music"],
        "age": 25,
        "embedding": [0.1] * 1536
    }
    
    user2 = {
        "interests": ["hiking", "travel", "photography"],
        "age": 27,
        "embedding": [0.1] * 1536
    }
    
    result = await agent.execute(
        action="calculate_compatibility",
        payload={
            "user1": user1,
            "user2": user2
        }
    )
    
    assert result["success"] is True
    assert "overall_score" in result.get("result", {})


@pytest.mark.asyncio
async def test_conversation_agent_suggestions():
    """Test conversation agent suggestions"""
    agent = ConversationAgent()
    
    result = await agent.execute(
        action="generate_icebreaker",
        payload={
            "user_profile": {
                "first_name": "Alice",
                "interests": ["travel", "food"]
            },
            "match_profile": {
                "first_name": "Bob",
                "interests": ["cooking", "hiking"]
            }
        }
    )
    
    assert result["success"] is True
    assert "icebreakers" in result.get("result", {})


@pytest.mark.asyncio
async def test_orchestrator_routing():
    """Test orchestrator agent routing"""
    from app.agents.orchestrator import OrchestratorAgent
    
    orchestrator = OrchestratorAgent()
    
    # Test direct routing
    result = await orchestrator.execute(
        action="moderate_content",
        payload={"content": "test"},
        agent_name="safety"
    )
    
    assert result["success"] is True
    assert result["agent_name"] == "safety"
