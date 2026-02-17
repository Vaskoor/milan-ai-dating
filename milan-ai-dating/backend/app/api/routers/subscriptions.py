"""
Milan AI - Subscriptions Router
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from uuid import UUID

from app.core.security import get_current_user
from app.core.config import SUBSCRIPTION_PLANS
from app.db.database import get_db
from app.db.models import User, Subscription, SubscriptionPlan, Payment
from app.schemas.subscription import (
    SubscriptionPlanResponse, SubscriptionResponse,
    PaymentCreate, PaymentResponse, PaymentInitiateResponse,
    KhaltiCallback, ESewaCallback
)
from app.agents import orchestrator

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("/plans", response_model=List[SubscriptionPlanResponse])
async def get_subscription_plans():
    """Get all available subscription plans"""
    plans = []
    for code, plan in SUBSCRIPTION_PLANS.items():
        plans.append(SubscriptionPlanResponse(
            id=UUID(int=0),  # Mock ID
            plan_code=code,
            name_en=plan["name_en"],
            name_ne=plan.get("name_ne"),
            monthly_price_npr=plan["monthly_price"],
            features=plan["features"],
            daily_swipe_limit=plan["features"].get("daily_swipes"),
            superlikes_per_day=plan["features"].get("superlikes_per_day"),
            boosts_per_month=plan["features"].get("boosts_per_month")
        ))
    
    return plans


@router.get("/my-subscription", response_model=SubscriptionResponse)
async def get_my_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's subscription"""
    result = await db.execute(
        select(Subscription).where(
            and_(
                Subscription.user_id == current_user.id,
                Subscription.status == "active"
            )
        )
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        # Return free plan
        free_plan = SUBSCRIPTION_PLANS["free"]
        return SubscriptionResponse(
            id=UUID(int=0),
            user_id=current_user.id,
            plan=SubscriptionPlanResponse(
                id=UUID(int=0),
                plan_code="free",
                name_en=free_plan["name_en"],
                monthly_price_npr=free_plan["monthly_price"],
                features=free_plan["features"]
            ),
            status="active",
            started_at=current_user.created_at,
            expires_at=None,
            auto_renew=False
        )
    
    # Get plan details
    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == subscription.plan_id)
    )
    plan = result.scalar_one_or_none()
    
    return SubscriptionResponse(
        id=subscription.id,
        user_id=subscription.user_id,
        plan=SubscriptionPlanResponse(
            id=plan.id,
            plan_code=plan.plan_code,
            name_en=plan.name_en,
            name_ne=plan.name_ne,
            monthly_price_npr=plan.monthly_price_npr,
            features=plan.features
        ),
        status=subscription.status,
        started_at=subscription.started_at,
        expires_at=subscription.expires_at,
        auto_renew=subscription.auto_renew,
        payment_method=subscription.payment_method
    )


@router.post("/subscribe", response_model=PaymentInitiateResponse)
async def create_subscription(
    payment_data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new subscription"""
    # Validate plan
    if payment_data.plan_code not in SUBSCRIPTION_PLANS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plan code"
        )
    
    plan = SUBSCRIPTION_PLANS[payment_data.plan_code]
    
    # Calculate amount
    if payment_data.period == "monthly":
        amount = plan["monthly_price"]
    elif payment_data.period == "quarterly":
        amount = plan.get("quarterly_price", plan["monthly_price"] * 3 * 0.9)
    elif payment_data.period == "yearly":
        amount = plan.get("yearly_price", plan["monthly_price"] * 12 * 0.75)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid period"
        )
    
    # Process payment through agent
    payment_result = await orchestrator.execute(
        action="process_payment",
        payload={
            "user_id": str(current_user.id),
            "plan_code": payment_data.plan_code,
            "payment_method": payment_data.payment_method,
            "period": payment_data.period,
            "amount": amount
        },
        user_id=current_user.id
    )
    
    if not payment_result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=payment_result.get("error", "Payment processing failed")
        )
    
    result = payment_result.get("result", {})
    
    # Create pending payment record
    payment = Payment(
        user_id=current_user.id,
        amount_npr=amount,
        payment_method=payment_data.payment_method,
        external_transaction_id=result.get("transaction_id"),
        status="pending"
    )
    
    db.add(payment)
    await db.commit()
    
    return PaymentInitiateResponse(
        payment_id=payment.id,
        amount_npr=amount,
        payment_method=payment_data.payment_method,
        payment_url=result.get("payment_url"),
        payment_data=result.get("payment_data")
    )


@router.post("/payment-callback/khalti")
async def khalti_callback(
    callback: KhaltiCallback,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Handle Khalti payment callback"""
    # Verify payment with Khalti API
    # In production, make API call to Khalti to verify
    
    # Update payment status
    result = await db.execute(
        select(Payment).where(
            Payment.external_transaction_id == callback.pidx
        )
    )
    payment = result.scalar_one_or_none()
    
    if payment:
        payment.status = "completed"
        payment.completed_at = __import__('datetime').datetime.utcnow()
        
        # Activate subscription
        # ...
        
        await db.commit()
    
    return {"status": "success"}


@router.post("/payment-callback/esewa")
async def esewa_callback(
    callback: ESewaCallback,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Handle eSewa payment callback"""
    # Verify payment with eSewa API
    
    # Update payment status
    result = await db.execute(
        select(Payment).where(
            Payment.external_transaction_id == callback.pid
        )
    )
    payment = result.scalar_one_or_none()
    
    if payment:
        payment.status = "completed"
        payment.completed_at = __import__('datetime').datetime.utcnow()
        await db.commit()
    
    return {"status": "success"}


@router.post("/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Cancel current subscription"""
    result = await db.execute(
        select(Subscription).where(
            and_(
                Subscription.user_id == current_user.id,
                Subscription.status == "active"
            )
        )
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found"
        )
    
    subscription.status = "cancelled"
    subscription.cancelled_at = __import__('datetime').datetime.utcnow()
    subscription.auto_renew = False
    
    await db.commit()
    
    return {"message": "Subscription cancelled successfully"}


@router.get("/payment-history", response_model=List[PaymentResponse])
async def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get payment history"""
    result = await db.execute(
        select(Payment).where(
            Payment.user_id == current_user.id
        ).order_by(Payment.created_at.desc())
    )
    payments = result.scalars().all()
    
    return [
        PaymentResponse(
            id=p.id,
            amount_npr=p.amount_npr,
            currency=p.currency,
            payment_method=p.payment_method,
            status=p.status,
            external_transaction_id=p.external_transaction_id,
            completed_at=p.completed_at,
            created_at=p.created_at
        )
        for p in payments
    ]
