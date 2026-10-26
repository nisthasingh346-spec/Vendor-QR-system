from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MenuItemBase(BaseModel):
    name: str
    description: str
    price: float
    category: str
    image_url: str
    is_available: bool = True

class MenuItemCreate(MenuItemBase):
    pass

class MenuItem(MenuItemBase):
    id: int
    class Config:
        from_attributes = True

class OrderItemBase(BaseModel):
    menu_item_id: int
    quantity: int
    unit_price: Optional[float] = None
    subtotal: Optional[float] = None

class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int

class OrderItem(OrderItemBase):
    id: int
    menu_item: MenuItem
    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    total_amount: float
    payment_method: str
    table_number: int = 1
    payment_status: Optional[str] = "UNPAID"

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]
    is_loyalty_boosted: bool = False

class Order(OrderBase):
    id: int
    table_id: Optional[int] = None
    session_id: Optional[int] = None
    token_number: int
    status: str
    timestamp: datetime
    is_priority: bool
    is_loyalty_boosted: bool
    items: List[OrderItem]
    
    class Config:
        from_attributes = True

class TableSessionBase(BaseModel):
    table_number: int
    status: str = "ACTIVE"
    total_amount: float = 0.0
    payment_status: str = "UNPAID"

class TableSessionOut(TableSessionBase):
    id: int
    table_id: int
    started_at: datetime
    closed_at: Optional[datetime] = None
    orders: List[Order] = []

    class Config:
        from_attributes = True

class DiningTableOut(BaseModel):
    id: int
    table_number: int
    status: str
    active_session_id: Optional[int] = None
    running_total: float = 0.0
    order_count: int = 0
    pending_count: int = 0
    visual_state: str = "gray" # green, yellow, red, gray
    payment_status: str = "UNPAID"
    started_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class BillItem(BaseModel):
    name: str
    quantity: int
    unit_price: float
    subtotal: float

class BillResponse(BaseModel):
    restaurant_name: str
    table_number: int
    session_id: int
    started_at: datetime
    generated_at: datetime
    items: List[BillItem]
    grand_total: float
    payment_status: str
    session_status: str

class VendorBase(BaseModel):
    name: str
    upi_id: str
    logo_url: Optional[str] = None

class Vendor(VendorBase):
    id: int
    class Config:
        from_attributes = True

class RatingCreate(BaseModel):
    order_id: int
    stars: int
    comment: Optional[str] = None

class Rating(RatingCreate):
    id: int
    timestamp: datetime
    class Config:
        from_attributes = True
