from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import datetime
from sqlalchemy import desc, text
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Optional
import json
import asyncio

import models
import schemas
import database
from database import engine, get_db
import priority_queue
from menu_data import MENU_ITEMS, default_image_for

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Food and Food - QR Ordering System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

# Auto-seed on startup if DB is empty or update broken images + DB migrations
@app.on_event("startup")
def startup_event():
    # 1. Auto-migration checks for SQLite
    with engine.connect() as conn:
        # Check orders table columns
        order_cols = {
            "is_loyalty_boosted": "ALTER TABLE orders ADD COLUMN is_loyalty_boosted BOOLEAN DEFAULT 0",
            "table_id": "ALTER TABLE orders ADD COLUMN table_id INTEGER",
            "table_number": "ALTER TABLE orders ADD COLUMN table_number INTEGER DEFAULT 1",
            "session_id": "ALTER TABLE orders ADD COLUMN session_id INTEGER",
            "payment_status": "ALTER TABLE orders ADD COLUMN payment_status VARCHAR DEFAULT 'UNPAID'",
        }
        for col, alter_sql in order_cols.items():
            try:
                conn.execute(text(f"SELECT {col} FROM orders LIMIT 1"))
            except Exception:
                try:
                    conn.execute(text(alter_sql))
                    print(f"Added {col} column to orders table")
                except Exception as e:
                    print(f"Migration for {col} failed: {e}")

        # Check order_items table columns
        item_cols = {
            "unit_price": "ALTER TABLE order_items ADD COLUMN unit_price FLOAT",
            "subtotal": "ALTER TABLE order_items ADD COLUMN subtotal FLOAT",
        }
        for col, alter_sql in item_cols.items():
            try:
                conn.execute(text(f"SELECT {col} FROM order_items LIMIT 1"))
            except Exception:
                try:
                    conn.execute(text(alter_sql))
                    print(f"Added {col} column to order_items table")
                except Exception as e:
                    print(f"Migration for {col} failed: {e}")

    db = next(get_db())

    # Ensure tables 1 through 7 exist in the database
    for t_num in range(1, 8):
        existing_t = db.query(models.DiningTable).filter(models.DiningTable.table_number == t_num).first()
        if not existing_t:
            db.add(models.DiningTable(table_number=t_num, status="AVAILABLE"))
    db.commit()

    # Menu auto-seeding
    if db.query(models.MenuItem).count() == 0:
        print("Empty database detected. Auto-seeding...")
        seed_data(db)
    else:
        seed_lookup = {
            (menu_item["name"], menu_item["category"]): menu_item
            for menu_item in MENU_ITEMS
        }
        existing_items = {
            (menu_item.name, menu_item.category): menu_item
            for menu_item in db.query(models.MenuItem).all()
        }

        items_added = 0
        items_updated = 0
        for key, seed_item in seed_lookup.items():
            menu_item = existing_items.get(key)
            if not menu_item:
                db.add(models.MenuItem(**seed_item))
                items_added += 1
                continue

            expected_description = seed_item.get("description", "")
            expected_price = float(seed_item["price"])
            expected_image = seed_item.get("image_url") or default_image_for(
                seed_item["name"], seed_item["category"]
            )

            changed = False
            if menu_item.description != expected_description:
                menu_item.description = expected_description
                changed = True
            if float(menu_item.price or 0) != expected_price:
                menu_item.price = expected_price
                changed = True
            if menu_item.image_url != expected_image:
                menu_item.image_url = expected_image
                changed = True

            if changed:
                items_updated += 1

        placeholder_items = db.query(models.MenuItem).filter(
            models.MenuItem.name == "string",
            models.MenuItem.category == "string",
        ).all()
        for menu_item in placeholder_items:
            db.delete(menu_item)

        if items_added or items_updated or placeholder_items:
            db.commit()

        fallback_images_updated = 0
        menu_items = db.query(models.MenuItem).all()
        for menu_item in menu_items:
            if not menu_item.image_url or menu_item.image_url == "string":
                menu_item.image_url = default_image_for(menu_item.name, menu_item.category)
                fallback_images_updated += 1
        if fallback_images_updated:
            db.commit()

        trio = db.query(models.MenuItem).filter(models.MenuItem.name == "Value Trio").first()
        if trio:
            trio.image_url = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80"
            db.commit()


# --- Table & Session Helpers ---

def get_or_create_active_session(db: Session, table_number: int) -> models.TableSession:
    table = db.query(models.DiningTable).filter(models.DiningTable.table_number == table_number).first()
    if not table:
        table = models.DiningTable(table_number=table_number, status="AVAILABLE")
        db.add(table)
        db.commit()
        db.refresh(table)

    session = db.query(models.TableSession).filter(
        models.TableSession.table_number == table_number,
        models.TableSession.status == "ACTIVE"
    ).order_by(models.TableSession.id.desc()).first()

    if not session:
        session = models.TableSession(
            table_id=table.id,
            table_number=table_number,
            status="ACTIVE",
            total_amount=0.0,
            payment_status="UNPAID",
            started_at=datetime.datetime.utcnow()
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    table.status = "OCCUPIED"
    db.commit()
    return session


def recalculate_session_total(db: Session, session_id: int) -> float:
    session = db.query(models.TableSession).filter(models.TableSession.id == session_id).first()
    if not session:
        return 0.0
    orders = db.query(models.Order).filter(
        models.Order.session_id == session_id,
        models.Order.status != "Cancelled"
    ).all()
    total = sum(o.total_amount for o in orders)
    session.total_amount = total
    db.commit()
    return total


def attach_unlinked_table_orders(db: Session, session: models.TableSession) -> None:
    db.query(models.Order).filter(
        models.Order.table_number == session.table_number,
        models.Order.session_id == None,
        models.Order.payment_status == "UNPAID",
        models.Order.status != "Cancelled"
    ).update({
        "session_id": session.id,
        "table_id": session.table_id
    }, synchronize_session=False)
    db.commit()
    recalculate_session_total(db, session.id)


def get_table_summary_dict(db: Session, table: models.DiningTable) -> dict:
    active_session = db.query(models.TableSession).filter(
        models.TableSession.table_number == table.table_number,
        models.TableSession.status == "ACTIVE"
    ).order_by(models.TableSession.id.desc()).first()

    if not active_session:
        return {
            "id": table.id,
            "table_number": table.table_number,
            "status": "AVAILABLE",
            "active_session_id": None,
            "running_total": 0.0,
            "order_count": 0,
            "pending_count": 0,
            "visual_state": "gray",
            "payment_status": "UNPAID",
            "started_at": None
        }

    attach_unlinked_table_orders(db, active_session)

    orders = db.query(models.Order).filter(
        models.Order.session_id == active_session.id,
        models.Order.status != "Cancelled"
    ).all()

    order_count = len(orders)
    pending_count = sum(1 for o in orders if o.status in ["Pending", "Preparing"])
    ready_count = sum(1 for o in orders if o.status == "Ready")

    # Visual state logic:
    # Green = Active / has current orders
    # Yellow = Preparing / pending orders
    # Red = unpaid / attention required
    # Gray = Available / no active order
    if order_count == 0:
        visual_state = "gray"
    elif pending_count > 0:
        visual_state = "yellow"
    elif ready_count > 0 or (active_session.payment_status != "PAID" and all(o.status in ["Ready", "Delivered"] for o in orders)):
        visual_state = "red"
    else:
        visual_state = "green"

    return {
        "id": table.id,
        "table_number": table.table_number,
        "status": table.status,
        "active_session_id": active_session.id,
        "running_total": round(active_session.total_amount, 2),
        "order_count": order_count,
        "pending_count": pending_count,
        "visual_state": visual_state,
        "payment_status": active_session.payment_status,
        "started_at": active_session.started_at.isoformat() if active_session.started_at else None
    }


# Order Queue Logic
def calculate_priority(order: models.Order, items_count: int):
    is_prepaid = order.payment_method == "UPI"
    score = priority_queue.calculate_priority(items_count, is_prepaid)
    return score > 0


def get_wait_time_estimate(db: Session):
    pending_count = db.query(models.Order).filter(models.Order.status == "Pending").count()
    preparing_count = db.query(models.Order).filter(models.Order.status == "Preparing").count()
    total_mins = (pending_count * 3) + (preparing_count * 5)
    return max(5, total_mins)


# Endpoints
@app.get("/wait-time")
def get_wait_time(db: Session = Depends(get_db)):
    return {"estimated_wait_minutes": get_wait_time_estimate(db)}


@app.get("/menu", response_model=List[schemas.MenuItem])
def get_menu(db: Session = Depends(get_db)):
    return db.query(models.MenuItem).all()


@app.post("/menu", response_model=schemas.MenuItem)
def add_menu_item(item: schemas.MenuItemCreate, db: Session = Depends(get_db)):
    new_item = models.MenuItem(**item.dict())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


@app.put("/menu/{item_id}", response_model=schemas.MenuItem)
def update_menu_item(item_id: int, item_data: schemas.MenuItemCreate, db: Session = Depends(get_db)):
    item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in item_data.dict().items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@app.delete("/menu/{item_id}")
def delete_menu_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    order_count = db.query(models.OrderItem).filter(models.OrderItem.menu_item_id == item_id).count()
    if order_count:
        raise HTTPException(
            status_code=409,
            detail="This item is part of existing orders. Mark it Sold Out instead."
        )

    db.delete(item)
    db.commit()
    return {"message": "Item deleted"}


@app.patch("/menu/{item_id}/availability")
def toggle_menu_item_availability(item_id: int, is_available: bool, db: Session = Depends(get_db)):
    item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_available = is_available
    db.commit()
    return {"message": "Availability updated", "is_available": item.is_available}


@app.post("/orders", response_model=schemas.Order)
async def create_order(order_data: schemas.OrderCreate, db: Session = Depends(get_db)):
    # Validate table number (1 through 7)
    table_num = order_data.table_number if (1 <= order_data.table_number <= 7) else 1
    session = get_or_create_active_session(db, table_num)

    # Calculate token number
    last_order = db.query(models.Order).order_by(models.Order.id.desc()).first()
    token_number = (last_order.token_number % 100) + 1 if last_order else 1

    payment_status = "PAID" if order_data.payment_method == "UPI" else "UNPAID"

    new_order = models.Order(
        table_id=session.table_id,
        table_number=table_num,
        session_id=session.id,
        token_number=token_number,
        total_amount=order_data.total_amount,
        payment_method=order_data.payment_method,
        payment_status=payment_status,
        status="Pending",
        is_loyalty_boosted=order_data.is_loyalty_boosted
    )

    items_count = 0
    for item in order_data.items:
        menu_item = db.query(models.MenuItem).filter(models.MenuItem.id == item.menu_item_id).first()
        unit_price = menu_item.price if menu_item else 0.0
        subtotal = unit_price * item.quantity
        order_item = models.OrderItem(
            menu_item_id=item.menu_item_id,
            quantity=item.quantity,
            unit_price=unit_price,
            subtotal=subtotal
        )
        items_count += item.quantity
        new_order.items.append(order_item)

    new_order.is_priority = calculate_priority(new_order, items_count)

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # Recalculate session running total
    recalculate_session_total(db, session.id)

    # Broadcast to WebSocket
    order_dict = schemas.Order.model_validate(new_order).model_dump()
    order_dict['timestamp'] = order_dict['timestamp'].isoformat()

    table_obj = db.query(models.DiningTable).filter(models.DiningTable.id == session.table_id).first()
    table_summary = get_table_summary_dict(db, table_obj)

    await manager.broadcast(json.dumps({
        "type": "NEW_ORDER",
        "order": order_dict,
        "table": table_summary
    }))
    await manager.broadcast(json.dumps({
        "type": "TABLE_UPDATE",
        "table": table_summary
    }))

    return new_order


@app.get("/orders", response_model=List[schemas.Order])
def get_orders(db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    all_orders = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.menu_item)
    ).all()

    def get_score(order):
        if order.status not in ["Pending", "Preparing"]:
            return -1000

        wait_time = (datetime.now(timezone.utc) - order.timestamp.replace(tzinfo=timezone.utc)).total_seconds() / 60
        score = wait_time * 10

        if order.payment_method == "UPI":
            score += 50

        if sum(i.quantity for i in order.items) <= 2:
            score += 30

        if order.is_loyalty_boosted:
            score += 40

        return score

    sorted_orders = sorted(all_orders, key=get_score, reverse=True)
    return sorted_orders


@app.patch("/orders/{order_id}/status")
async def update_order_status(order_id: int, status: str, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status
    db.commit()

    if order.session_id:
        recalculate_session_total(db, order.session_id)

    # Broadcast order status update
    await manager.broadcast(json.dumps({
        "type": "STATUS_UPDATE",
        "order_id": order_id,
        "status": status,
        "token": order.token_number
    }))

    # Broadcast updated table status
    if order.table_id:
        table_obj = db.query(models.DiningTable).filter(models.DiningTable.id == order.table_id).first()
        if table_obj:
            table_summary = get_table_summary_dict(db, table_obj)
            await manager.broadcast(json.dumps({
                "type": "TABLE_UPDATE",
                "table": table_summary
            }))

    return {"message": "Status updated"}


@app.get("/orders/{order_id}", response_model=schemas.Order)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.menu_item)
    ).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# --- 7 Table Management & Cumulative Billing Endpoints ---

@app.get("/tables", response_model=List[schemas.DiningTableOut])
def get_tables(db: Session = Depends(get_db)):
    tables = db.query(models.DiningTable).order_by(models.DiningTable.table_number.asc()).all()
    return [get_table_summary_dict(db, t) for t in tables]


@app.get("/tables/{table_number}/session")
def get_table_session(table_number: int, db: Session = Depends(get_db)):
    session = db.query(models.TableSession).filter(
        models.TableSession.table_number == table_number,
        models.TableSession.status == "ACTIVE"
    ).order_by(models.TableSession.id.desc()).first()

    if not session:
        return {
            "table_number": table_number,
            "has_active_session": False,
            "session_id": None,
            "started_at": None,
            "status": "AVAILABLE",
            "total_amount": 0.0,
            "payment_status": "UNPAID",
            "orders": []
        }

    attach_unlinked_table_orders(db, session)

    orders = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.menu_item)
    ).filter(
        models.Order.session_id == session.id
    ).order_by(models.Order.id.asc()).all()

    serialized_orders = []
    for o in orders:
        o_data = schemas.Order.model_validate(o).model_dump()
        o_data["timestamp"] = o.timestamp.isoformat()
        serialized_orders.append(o_data)

    return {
        "table_number": table_number,
        "has_active_session": True,
        "session_id": session.id,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "status": session.status,
        "total_amount": round(session.total_amount, 2),
        "payment_status": session.payment_status,
        "orders": serialized_orders
    }


@app.get("/tables/{table_number}/bill")
def get_table_bill(table_number: int, db: Session = Depends(get_db)):
    # Find active session or most recent session
    session = db.query(models.TableSession).filter(
        models.TableSession.table_number == table_number
    ).order_by(models.TableSession.id.desc()).first()

    if not session:
        raise HTTPException(status_code=404, detail="No session found for Table " + str(table_number))

    if session.status == "ACTIVE":
        attach_unlinked_table_orders(db, session)

    orders = db.query(models.Order).options(
        joinedload(models.Order.items).joinedload(models.OrderItem.menu_item)
    ).filter(
        models.Order.session_id == session.id,
        models.Order.status != "Cancelled"
    ).all()

    # Aggregate items across orders in this session
    item_agg = {}
    for o in orders:
        for it in o.items:
            name = it.menu_item.name if it.menu_item else "Special Item"
            unit_price = it.unit_price if it.unit_price is not None else (it.menu_item.price if it.menu_item else 0.0)
            if name not in item_agg:
                item_agg[name] = {
                    "name": name,
                    "quantity": 0,
                    "unit_price": unit_price,
                    "subtotal": 0.0
                }
            item_agg[name]["quantity"] += it.quantity
            item_agg[name]["subtotal"] += (unit_price * it.quantity)

    items_list = list(item_agg.values())
    grand_total = sum(i["subtotal"] for i in items_list)

    vendor = db.query(models.Vendor).first()
    restaurant_name = vendor.name if vendor else "Food and Food"

    return {
        "restaurant_name": restaurant_name,
        "table_number": table_number,
        "session_id": session.id,
        "started_at": session.started_at.isoformat() if session.started_at else datetime.datetime.utcnow().isoformat(),
        "generated_at": datetime.datetime.utcnow().isoformat(),
        "items": items_list,
        "grand_total": round(grand_total, 2),
        "payment_status": session.payment_status,
        "session_status": session.status
    }


@app.post("/tables/{table_number}/close")
async def close_table_session(table_number: int, db: Session = Depends(get_db)):
    session = db.query(models.TableSession).filter(
        models.TableSession.table_number == table_number,
        models.TableSession.status == "ACTIVE"
    ).order_by(models.TableSession.id.desc()).first()

    table = db.query(models.DiningTable).filter(models.DiningTable.table_number == table_number).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if session:
        attach_unlinked_table_orders(db, session)
        session.status = "CLOSED"
        session.payment_status = "PAID"
        session.closed_at = datetime.datetime.utcnow()
        # Mark orders in this session as paid
        db.query(models.Order).filter(
            models.Order.session_id == session.id,
            models.Order.payment_status == "UNPAID"
        ).update({"payment_status": "PAID"})
        db.commit()

    table.status = "AVAILABLE"
    db.commit()

    table_summary = get_table_summary_dict(db, table)
    await manager.broadcast(json.dumps({
        "type": "TABLE_UPDATE",
        "table": table_summary
    }))
    return {
        "message": f"Table {table_number} session closed and marked as PAID",
        "table": table_summary
    }


@app.get("/analytics/top-items")
def get_top_items(db: Session = Depends(get_db)):
    from sqlalchemy import func
    top_items = db.query(
        models.MenuItem.name, 
        func.count(models.OrderItem.id).label('total_ordered')
    ).join(models.OrderItem).group_by(models.MenuItem.name).order_by(desc('total_ordered')).limit(5).all()
    
    return [{"name": item[0], "count": item[1]} for item in top_items]


@app.post("/ratings")
def create_rating(rating: schemas.RatingCreate, db: Session = Depends(get_db)):
    new_rating = models.Rating(**rating.dict())
    db.add(new_rating)
    db.commit()
    db.refresh(new_rating)
    return new_rating


# WebSocket Route
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Seed Data
@app.post("/seed")
def seed_data(db: Session = Depends(get_db)):
    db.query(models.OrderItem).delete()
    db.query(models.MenuItem).delete()
    
    items = [models.MenuItem(**menu_item) for menu_item in MENU_ITEMS]
    db.add_all(items)
    db.commit()
    return {"message": f"{len(items)} menu items seeded successfully"}


@app.post("/reset-menu")
def reset_menu(db: Session = Depends(get_db)):
    db.query(models.OrderItem).delete()
    db.query(models.MenuItem).delete()
    db.commit()
    return seed_data(db)


@app.get("/health")
def health_check():
    return {"status": "A-OK", "version": "v2.0"}
