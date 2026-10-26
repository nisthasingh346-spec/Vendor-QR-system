from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
import datetime
from database import Base

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    upi_id = Column(String)
    logo_url = Column(String, nullable=True)

class MenuItem(Base):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    price = Column(Float)
    category = Column(String) # Snacks, Drinks, Meals
    image_url = Column(String)
    is_available = Column(Boolean, default=True)

class DiningTable(Base):
    __tablename__ = "tables"
    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(Integer, unique=True, index=True)
    status = Column(String, default="AVAILABLE") # AVAILABLE, OCCUPIED

    sessions = relationship("TableSession", back_populates="table", order_by="desc(TableSession.id)")

class TableSession(Base):
    __tablename__ = "table_sessions"
    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=False)
    table_number = Column(Integer, index=True, nullable=False)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    status = Column(String, default="ACTIVE") # ACTIVE, CLOSED
    total_amount = Column(Float, default=0.0)
    payment_status = Column(String, default="UNPAID") # UNPAID, PAID

    table = relationship("DiningTable", back_populates="sessions")
    orders = relationship("Order", back_populates="session", order_by="Order.id")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True)
    table_number = Column(Integer, default=1, index=True)
    session_id = Column(Integer, ForeignKey("table_sessions.id"), nullable=True)
    token_number = Column(Integer)
    total_amount = Column(Float)
    payment_method = Column(String) # Cash, UPI
    payment_status = Column(String, default="UNPAID") # UNPAID, PAID
    status = Column(String, default="Pending") # Pending, Accepted, Preparing, Ready, Delivered, Cancelled
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    is_priority = Column(Boolean, default=False)
    is_loyalty_boosted = Column(Boolean, default=False)
    
    session = relationship("TableSession", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"))
    quantity = Column(Integer)
    unit_price = Column(Float, nullable=True)
    subtotal = Column(Float, nullable=True)
    
    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem")

class Rating(Base):
    __tablename__ = "ratings"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    stars = Column(Integer) # 1-5
    comment = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
