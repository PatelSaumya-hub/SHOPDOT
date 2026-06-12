from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# --- AUTH SCHEMAS ---

class UserCreate(BaseModel):
    email: str = Field(..., examples=["retailer@shopdot.com"])
    password: str = Field(..., min_length=6, examples=["securepassword"])
    role: str = Field("retailer", description="Role: retailer, supplier, or admin", examples=["retailer"])
    brand_name: Optional[str] = Field(None, description="Brand/Supplier name. Required if role is supplier.", examples=["Aura Goods Co."])

class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    brand_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: str = Field(..., examples=["retailer@shopdot.com"])
    password: str = Field(..., examples=["securepassword"])

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None


# --- PRODUCT SCHEMAS ---

class ProductCreate(BaseModel):
    name: str = Field(..., examples=["Minimalist Leather Wallet"])
    sku: str = Field(..., examples=["WL-LTHR-01"])
    price: float = Field(..., gt=0, examples=[45.0])
    stock: int = Field(0, ge=0, examples=[25])

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    stock: Optional[int] = None

class ProductResponse(BaseModel):
    id: int
    name: str
    sku: str
    price: float
    stock: int
    supplier_id: int
    supplier_brand: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- ORDER SCHEMAS ---

class OrderCreate(BaseModel):
    product_id: int = Field(..., description="The ID of the product to order", examples=[1])
    quantity: int = Field(..., description="The quantity of the product to order", examples=[2])

class OrderUpdateStatus(BaseModel):
    status: str = Field(..., description="New status: routed_to_supplier, shipped, delivered, cancelled", examples=["shipped"])

class OrderResponse(BaseModel):
    order_id: int
    product_id: int
    product_name: str
    sku: str
    quantity: int
    total_price: float
    supplier: str
    status: str
    message: str

    class Config:
        from_attributes = True

class OrderDetailResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    quantity: int
    total_price: float
    retailer_id: int
    retailer_email: str
    supplier_id: int
    supplier_brand: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- ANALYTICS SCHEMA ---

class AnalyticsResponse(BaseModel):
    role: str
    metrics: dict
