"""
Authentication Schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[datetime] = None
    type: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=2, max_length=100)
    date_of_birth: datetime
    gender: str = Field(..., pattern="^(male|female|non_binary|other)$")
    phone: Optional[str] = None
    consent_given: bool = True
    
    @field_validator('password')
    def validate_password(cls, v):
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @field_validator('phone')
    def validate_phone(cls, v):
        if v and not re.match(r'^(\+977)?[0-9]{10}$', v.replace('-', '')):
            raise ValueError('Invalid Nepalese phone number')
        return v


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class PhoneVerifyRequest(BaseModel):
    phone: str = Field(..., pattern=r'^(\+977)?[0-9]{10}$')


class PhoneVerify(BaseModel):
    phone: str
    otp: str = Field(..., min_length=4, max_length=6)
