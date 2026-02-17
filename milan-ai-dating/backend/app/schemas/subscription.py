"""
Subscription & Payment Schemas
"""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


class SubscriptionPlanResponse(BaseModel):
    id: UUID
    plan_code: str
    name_en: str
    name_ne: Optional[str] = None
    monthly_price_npr: float
    quarterly_price_npr: Optional[float] = None
    yearly_price_npr: Optional[float] = None
    features: Dict[str, Any]
    daily_swipe_limit: Optional[int] = None
    superlikes_per_day: Optional[int] = None
    boosts_per_month: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


class SubscriptionResponse(BaseModel):
    id: UUID
    user_id: UUID
    plan: SubscriptionPlanResponse
    status: str
    started_at: datetime
    expires_at: datetime
    auto_renew: bool
    payment_method: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class PaymentCreate(BaseModel):
    plan_code: str = Field(..., pattern="^(basic|premium|elite)$")
    payment_method: str = Field(..., pattern="^(khalti|esewa|imepay|bank_transfer)$")
    period: str = Field(default="monthly", pattern="^(monthly|quarterly|yearly)$")


class PaymentResponse(BaseModel):
    id: UUID
    amount_npr: float
    currency: str
    payment_method: str
    status: str
    external_transaction_id: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PaymentInitiateResponse(BaseModel):
    payment_id: UUID
    amount_npr: float
    payment_method: str
    payment_url: Optional[str] = None  # For redirect-based payments
    payment_data: Optional[Dict[str, Any]] = None  # For SDK-based payments


class KhaltiCallback(BaseModel):
    pidx: str
    transaction_id: Optional[str] = None
    amount: Optional[int] = None
    mobile: Optional[str] = None
    purchase_order_id: Optional[str] = None
    purchase_order_name: Optional[str] = None


class ESewaCallback(BaseModel):
    amt: float
    rid: str  # Reference ID
    pid: str  # Product ID
    scd: str  # Merchant Code
    fu: Optional[str] = None  # Failure URL
    su: Optional[str] = None  # Success URL


class BoostCreate(BaseModel):
    duration_hours: int = Field(default=1, ge=1, le=24)


class BoostResponse(BaseModel):
    id: UUID
    user_id: UUID
    started_at: datetime
    expires_at: datetime
    is_active: bool
