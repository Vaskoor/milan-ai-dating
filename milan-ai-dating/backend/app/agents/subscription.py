"""
Milan AI - Subscription & Billing Agent
Handles payments and subscriptions
"""
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from app.agents.base import BaseAgent
from app.core.config import SUBSCRIPTION_PLANS


class SubscriptionAgent(BaseAgent):
    """Agent for subscription and billing operations"""
    
    def __init__(self):
        super().__init__(name="subscription", version="1.0.0")
    
    def get_system_prompt(self) -> str:
        return "You are a subscription and billing agent for a dating app. Handle payment processing and subscription management."
    
    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process subscription request"""
        action = payload.get("action")
        
        if action == "process_payment":
            return await self._process_payment(payload)
        elif action == "check_subscription":
            return await self._check_subscription(payload)
        elif action == "upgrade_plan":
            return await self._upgrade_plan(payload)
        elif action == "calculate_proration":
            return await self._calculate_proration(payload)
        elif action == "handle_failed_payment":
            return await self._handle_failed_payment(payload)
        else:
            return {"error": f"Unknown action: {action}"}
    
    async def _process_payment(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process a payment"""
        user_id = payload.get("user_id")
        plan_code = payload.get("plan_code")
        payment_method = payload.get("payment_method")
        period = payload.get("period", "monthly")
        
        plan = SUBSCRIPTION_PLANS.get(plan_code)
        if not plan:
            return {"error": f"Invalid plan: {plan_code}"}
        
        # Calculate amount based on period
        if period == "monthly":
            amount = plan["monthly_price"]
        elif period == "quarterly":
            amount = plan.get("quarterly_price", plan["monthly_price"] * 3 * 0.9)
        elif period == "yearly":
            amount = plan.get("yearly_price", plan["monthly_price"] * 12 * 0.75)
        else:
            return {"error": f"Invalid period: {period}"}
        
        # Process based on payment method
        if payment_method == "khalti":
            result = await self._process_khalti_payment(payload, amount)
        elif payment_method == "esewa":
            result = await self._process_esewa_payment(payload, amount)
        elif payment_method == "imepay":
            result = await self._process_imepay_payment(payload, amount)
        elif payment_method == "bank_transfer":
            result = await self._process_bank_transfer(payload, amount)
        else:
            return {"error": f"Unsupported payment method: {payment_method}"}
        
        return {
            "success": result.get("success", False),
            "amount_npr": amount,
            "payment_method": payment_method,
            "transaction_id": result.get("transaction_id"),
            "status": result.get("status", "failed"),
            "message": result.get("message"),
            "payment_url": result.get("payment_url")
        }
    
    async def _process_khalti_payment(self, payload: Dict[str, Any], amount: float) -> Dict[str, Any]:
        """Process Khalti payment"""
        # Integration with Khalti API would go here
        # For now, return mock response
        
        return {
            "success": True,
            "status": "initiated",
            "transaction_id": f"KHL_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "payment_url": f"https://khalti.com/pay?amount={amount}",
            "message": "Redirect to Khalti for payment"
        }
    
    async def _process_esewa_payment(self, payload: Dict[str, Any], amount: float) -> Dict[str, Any]:
        """Process eSewa payment"""
        # Integration with eSewa API would go here
        
        return {
            "success": True,
            "status": "initiated",
            "transaction_id": f"ESW_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "payment_url": f"https://esewa.com.np/pay?amount={amount}",
            "message": "Redirect to eSewa for payment"
        }
    
    async def _process_imepay_payment(self, payload: Dict[str, Any], amount: float) -> Dict[str, Any]:
        """Process IME Pay payment"""
        return {
            "success": True,
            "status": "initiated",
            "transaction_id": f"IME_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "payment_url": f"https://imepay.com.np/pay?amount={amount}",
            "message": "Redirect to IME Pay for payment"
        }
    
    async def _process_bank_transfer(self, payload: Dict[str, Any], amount: float) -> Dict[str, Any]:
        """Process bank transfer"""
        return {
            "success": True,
            "status": "pending",
            "transaction_id": f"BNK_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "message": "Bank transfer initiated. Please complete transfer and upload receipt.",
            "bank_details": {
                "bank_name": "Nepal Investment Bank",
                "account_name": "Milan AI Pvt. Ltd.",
                "account_number": "XXXXXXXXXX",
                "branch": "Kathmandu"
            }
        }
    
    async def _check_subscription(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Check user's subscription status"""
        subscription = payload.get("subscription", {})
        
        if not subscription:
            return {
                "has_active_subscription": False,
                "tier": "free",
                "features": SUBSCRIPTION_PLANS["free"]["features"]
            }
        
        expires_at = subscription.get("expires_at")
        is_active = subscription.get("status") == "active"
        
        if expires_at:
            expires_datetime = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            is_expired = expires_datetime < datetime.now(expires_datetime.tzinfo)
        else:
            is_expired = True
        
        plan_code = subscription.get("plan_code", "free")
        plan = SUBSCRIPTION_PLANS.get(plan_code, SUBSCRIPTION_PLANS["free"])
        
        return {
            "has_active_subscription": is_active and not is_expired,
            "tier": plan_code,
            "status": subscription.get("status"),
            "started_at": subscription.get("started_at"),
            "expires_at": expires_at,
            "auto_renew": subscription.get("auto_renew", False),
            "features": plan["features"],
            "days_remaining": (expires_datetime - datetime.now(expires_datetime.tzinfo)).days if expires_at and not is_expired else 0
        }
    
    async def _upgrade_plan(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Upgrade subscription plan"""
        current_plan = payload.get("current_plan", "free")
        new_plan = payload.get("new_plan")
        
        if new_plan not in SUBSCRIPTION_PLANS:
            return {"error": f"Invalid plan: {new_plan}"}
        
        # Calculate proration if needed
        proration = await self._calculate_proration(payload)
        
        return {
            "can_upgrade": True,
            "current_plan": current_plan,
            "new_plan": new_plan,
            "proration_amount": proration.get("proration_amount", 0),
            "next_billing_date": proration.get("next_billing_date"),
            "features_gained": self._compare_features(current_plan, new_plan)
        }
    
    async def _calculate_proration(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate proration for plan change"""
        current_plan = payload.get("current_plan", "free")
        new_plan = payload.get("new_plan")
        days_used = payload.get("days_used", 0)
        days_in_period = payload.get("days_in_period", 30)
        
        current_price = SUBSCRIPTION_PLANS.get(current_plan, {}).get("monthly_price", 0)
        new_price = SUBSCRIPTION_PLANS.get(new_plan, {}).get("monthly_price", 0)
        
        if current_price == 0:
            return {
                "proration_amount": new_price,
                "credit_amount": 0,
                "next_billing_date": (datetime.now() + timedelta(days=30)).isoformat()
            }
        
        # Calculate remaining value
        daily_rate = current_price / days_in_period
        remaining_days = days_in_period - days_used
        remaining_value = daily_rate * remaining_days
        
        # Calculate new plan cost
        new_daily_rate = new_price / days_in_period
        new_cost = new_daily_rate * remaining_days
        
        proration = new_cost - remaining_value
        
        return {
            "proration_amount": max(0, round(proration, 2)),
            "credit_amount": max(0, round(-proration, 2)),
            "remaining_value": round(remaining_value, 2),
            "next_billing_date": (datetime.now() + timedelta(days=remaining_days)).isoformat()
        }
    
    async def _handle_failed_payment(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Handle failed payment"""
        failure_reason = payload.get("failure_reason", "")
        retry_count = payload.get("retry_count", 0)
        
        actions = []
        
        if retry_count < 3:
            actions.append("retry_payment")
        
        if "insufficient" in failure_reason.lower():
            actions.append("suggest_different_payment_method")
        
        if retry_count >= 3:
            actions.append("downgrade_to_free")
            actions.append("notify_user")
        
        return {
            "handled": True,
            "actions": actions,
            "retry_recommended": retry_count < 3,
            "grace_period_days": 3 if retry_count < 3 else 0
        }
    
    def _compare_features(self, current_plan: str, new_plan: str) -> Dict[str, Any]:
        """Compare features between plans"""
        current = SUBSCRIPTION_PLANS.get(current_plan, {}).get("features", {})
        new = SUBSCRIPTION_PLANS.get(new_plan, {}).get("features", {})
        
        gained = {}
        for key, value in new.items():
            if key not in current or current[key] != value:
                gained[key] = {
                    "old": current.get(key),
                    "new": value
                }
        
        return gained
