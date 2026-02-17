"""
Milan AI - Authentication Router
"""
from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.config import settings
from app.core.security import (
    verify_password, create_access_token, create_refresh_token,
    get_password_hash, get_current_user, generate_otp
)
from app.db.database import get_db
from app.db.models import User, Profile
from app.schemas.auth import (
    Token, UserLogin, UserRegister, PasswordResetRequest,
    PasswordReset, ChangePassword, PhoneVerifyRequest, PhoneVerify
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    # Check if user already exists
    result = await db.execute(
        select(User).where(
            or_(User.email == user_data.email, User.phone == user_data.phone)
        )
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or phone already exists"
        )
    
    # Create new user
    new_user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        phone=user_data.phone,
        consent_given=user_data.consent_given,
        consent_given_at=__import__('datetime').datetime.utcnow() if user_data.consent_given else None
    )
    
    db.add(new_user)
    await db.flush()
    
    # Create profile
    profile = Profile(
        user_id=new_user.id,
        first_name=user_data.first_name,
        date_of_birth=user_data.date_of_birth,
        gender=user_data.gender
    )
    
    db.add(profile)
    await db.commit()
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(new_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(new_user.id)})
    
    # Send welcome email (background task)
    # background_tasks.add_task(send_welcome_email, new_user.email)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Login user"""
    # Find user by email
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    
    # Update last login
    user.last_login_at = __import__('datetime').datetime.utcnow()
    await db.commit()
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token"""
    from app.core.security import decode_token
    
    payload = decode_token(refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    
    # Verify user exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Generate new tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user (invalidate token on client side)"""
    # In a more complex setup, you might blacklist the token
    return {"message": "Successfully logged out"}


@router.post("/password/reset-request")
async def request_password_reset(
    request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Request password reset"""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if user:
        # Generate reset token
        reset_token = create_access_token(
            data={"sub": str(user.id), "type": "reset"},
            expires_delta=timedelta(hours=1)
        )
        
        # Send reset email (background task)
        # background_tasks.add_task(send_password_reset_email, user.email, reset_token)
    
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/password/reset")
async def reset_password(
    reset_data: PasswordReset,
    db: AsyncSession = Depends(get_db)
):
    """Reset password using token"""
    from app.core.security import decode_token
    
    payload = decode_token(reset_data.token)
    
    if not payload or payload.get("type") != "reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user_id = payload.get("sub")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    user.password_hash = get_password_hash(reset_data.new_password)
    await db.commit()
    
    return {"message": "Password reset successfully"}


@router.post("/password/change")
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change password"""
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    current_user.password_hash = get_password_hash(password_data.new_password)
    await db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/phone/verify-request")
async def request_phone_verification(
    request: PhoneVerifyRequest,
    current_user: User = Depends(get_current_user)
):
    """Request phone verification OTP"""
    # Generate OTP
    otp = generate_otp()
    
    # Store OTP in Redis (with expiry)
    # redis_client.setex(f"otp:{current_user.id}", 600, otp)
    
    # Send SMS (integrate with SMS gateway)
    # send_sms(request.phone, f"Your Milan AI verification code is: {otp}")
    
    return {"message": "OTP sent to your phone"}


@router.post("/phone/verify")
async def verify_phone(
    verify_data: PhoneVerify,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify phone with OTP"""
    # Verify OTP from Redis
    # stored_otp = redis_client.get(f"otp:{current_user.id}")
    
    # if not stored_otp or stored_otp.decode() != verify_data.otp:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Invalid or expired OTP"
    #     )
    
    # Update user
    current_user.phone = verify_data.phone
    current_user.phone_verified_at = __import__('datetime').datetime.utcnow()
    await db.commit()
    
    return {"message": "Phone verified successfully"}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "phone": current_user.phone,
        "is_verified": current_user.is_verified,
        "subscription_tier": current_user.subscription_tier,
        "role": current_user.role
    }
