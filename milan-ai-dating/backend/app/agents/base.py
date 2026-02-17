"""
Milan AI - Base Agent Class
"""
import time
import json
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from datetime import datetime
from uuid import UUID
import openai
import anthropic
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models import AgentLog


class BaseAgent(ABC):
    """Base class for all AI agents"""
    
    def __init__(self, name: str, version: str = "1.0.0"):
        self.name = name
        self.version = version
        self.llm_client = None
        self._init_llm()
    
    def _init_llm(self):
        """Initialize LLM client"""
        if settings.OPENAI_API_KEY:
            self.llm_client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        elif settings.ANTHROPIC_API_KEY:
            self.llm_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Return the system prompt for this agent"""
        pass
    
    @abstractmethod
    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process the request and return result"""
        pass
    
    @retry(
        stop=stop_after_attempt(settings.AGENT_MAX_RETRIES),
        wait=wait_exponential(multiplier=settings.AGENT_RETRY_DELAY, min=1, max=10)
    )
    async def call_llm(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        response_format: Optional[str] = None
    ) -> Dict[str, Any]:
        """Call LLM with retry logic"""
        if not self.llm_client:
            raise ValueError("LLM client not initialized")
        
        temp = temperature or settings.LLM_TEMPERATURE
        max_tok = max_tokens or settings.LLM_MAX_TOKENS
        
        try:
            if isinstance(self.llm_client, openai.AsyncOpenAI):
                kwargs = {
                    "model": settings.DEFAULT_LLM_MODEL,
                    "messages": messages,
                    "temperature": temp,
                    "max_tokens": max_tok,
                }
                if response_format == "json":
                    kwargs["response_format"] = {"type": "json_object"}
                
                response = await self.llm_client.chat.completions.create(**kwargs)
                
                return {
                    "content": response.choices[0].message.content,
                    "tokens_used": response.usage.total_tokens if response.usage else 0,
                    "model": response.model
                }
            
            elif isinstance(self.llm_client, anthropic.AsyncAnthropic):
                system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
                user_messages = [m for m in messages if m["role"] != "system"]
                
                response = await self.llm_client.messages.create(
                    model="claude-3-sonnet-20240229",
                    max_tokens=max_tok,
                    temperature=temp,
                    system=system_msg,
                    messages=user_messages
                )
                
                return {
                    "content": response.content[0].text if response.content else "",
                    "tokens_used": response.usage.input_tokens + response.usage.output_tokens if response.usage else 0,
                    "model": response.model
                }
        
        except Exception as e:
            print(f"LLM call failed: {str(e)}")
            raise
    
    async def log_execution(
        self,
        request_type: str,
        user_id: Optional[UUID],
        input_payload: Dict[str, Any],
        output_payload: Dict[str, Any],
        execution_time_ms: int,
        tokens_used: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None
    ):
        """Log agent execution to database"""
        try:
            async with AsyncSessionLocal() as session:
                log = AgentLog(
                    agent_name=self.name,
                    agent_version=self.version,
                    request_type=request_type,
                    user_id=user_id,
                    input_payload=input_payload,
                    output_payload=output_payload,
                    execution_time_ms=execution_time_ms,
                    tokens_used=tokens_used,
                    success=success,
                    error_message=error_message,
                    session_id=session_id,
                    request_id=request_id
                )
                session.add(log)
                await session.commit()
        except Exception as e:
            print(f"Failed to log agent execution: {str(e)}")
    
    async def execute(
        self,
        action: str,
        payload: Dict[str, Any],
        user_id: Optional[UUID] = None,
        session_id: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute agent with logging and error handling"""
        start_time = time.time()
        tokens_used = 0
        
        try:
            # Process the request
            result = await self.process(payload)
            
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            # Log successful execution
            await self.log_execution(
                request_type=action,
                user_id=user_id,
                input_payload=payload,
                output_payload=result,
                execution_time_ms=execution_time_ms,
                tokens_used=result.get("tokens_used"),
                success=True,
                session_id=session_id,
                request_id=request_id
            )
            
            return {
                "success": True,
                "agent_name": self.name,
                "action": action,
                "result": result,
                "execution_time_ms": execution_time_ms
            }
        
        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            # Log failed execution
            await self.log_execution(
                request_type=action,
                user_id=user_id,
                input_payload=payload,
                output_payload={},
                execution_time_ms=execution_time_ms,
                success=False,
                error_message=error_msg,
                session_id=session_id,
                request_id=request_id
            )
            
            return {
                "success": False,
                "agent_name": self.name,
                "action": action,
                "error": error_msg,
                "execution_time_ms": execution_time_ms
            }
    
    def parse_json_response(self, content: str) -> Dict[str, Any]:
        """Parse JSON from LLM response"""
        try:
            # Try direct parsing
            return json.loads(content)
        except json.JSONDecodeError:
            # Try extracting JSON from markdown
            import re
            json_match = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(1))
                except json.JSONDecodeError:
                    pass
            
            # Try finding JSON between braces
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    pass
            
            # Return raw content as fallback
            return {"raw_response": content}
