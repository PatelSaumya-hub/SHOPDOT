from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import models
import schemas
import auth
from database import get_db

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)

@router.post("", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
def place_order(
    order_data: schemas.OrderCreate,
    current_user: models.User = Depends(auth.require_retailer),
    db: Session = Depends(get_db)
):
    """
    Retailer only: Place a new drop-shipping order.
    Checks stock levels in real-time, decrements product inventory,
    and automatically routes the order to the correct brand supplier.
    """
    # 1. Validate quantity
    if order_data.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order quantity must be greater than 0."
        )

    # 2. Retrieve product
    product = db.query(models.Product).filter(models.Product.id == order_data.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {order_data.product_id} not found."
        )

    # 3. Check stock level
    if product.stock < order_data.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock. Available stock is {product.stock}, but {order_data.quantity} was requested."
        )

    # 4. Decrement product inventory
    product.stock -= order_data.quantity

    # 5. Calculate pricing
    total_price = round(product.price * order_data.quantity, 2)
    supplier = product.supplier
    supplier_brand = supplier.brand_name if supplier else "ShopDot Admin"

    # 6. Record the order
    new_order = models.Order(
        product_id=product.id,
        quantity=order_data.quantity,
        total_price=total_price,
        retailer_id=current_user.id,
        supplier_id=product.supplier_id,
        status="routed_to_supplier"
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    # Return backwards-compatible response format
    return schemas.OrderResponse(
        order_id=new_order.id,
        product_id=product.id,
        product_name=product.name,
        sku=product.sku,
        quantity=new_order.quantity,
        total_price=new_order.total_price,
        supplier=supplier_brand,
        status=new_order.status,
        message=f"Order placed successfully! This order has been automatically routed to the supplier '{supplier_brand}' for fulfillment."
    )


@router.get("", response_model=List[schemas.OrderDetailResponse])
def get_orders(
    current_user: models.User = Depends(auth.require_any_user),
    db: Session = Depends(get_db)
):
    """
    Get all orders relevant to the current user:
    - Retailers see orders they placed.
    - Suppliers see orders routed to them.
    - Admins see all system orders.
    """
    query = db.query(models.Order).join(models.Product, models.Order.product_id == models.Product.id)
    
    if current_user.role == "retailer":
        orders = query.filter(models.Order.retailer_id == current_user.id).all()
    elif current_user.role == "supplier":
        orders = query.filter(models.Order.supplier_id == current_user.id).all()
    elif current_user.role == "admin":
        orders = query.all()
    else:
        orders = []

    return [
        schemas.OrderDetailResponse(
            id=o.id,
            product_id=o.product_id,
            product_name=o.product.name,
            sku=o.product.sku,
            quantity=o.quantity,
            total_price=o.total_price,
            retailer_id=o.retailer_id,
            retailer_email=o.retailer.email if o.retailer else "Deleted Retailer",
            supplier_id=o.supplier_id,
            supplier_brand=o.supplier.brand_name if o.supplier else "Unknown Brand",
            status=o.status,
            created_at=o.created_at,
            updated_at=o.updated_at
        )
        for o in orders
    ]


@router.get("/{order_id}", response_model=schemas.OrderDetailResponse)
def get_order_by_id(
    order_id: int,
    current_user: models.User = Depends(auth.require_any_user),
    db: Session = Depends(get_db)
):
    """
    Get a single order detail record by ID.
    - Retailers can view their placed orders.
    - Suppliers can view their routed orders.
    - Admins can view any order.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )

    # Authorization Check
    if current_user.role == "retailer" and order.retailer_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    elif current_user.role == "supplier" and order.supplier_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return schemas.OrderDetailResponse(
        id=order.id,
        product_id=order.product_id,
        product_name=order.product.name,
        sku=order.product.sku,
        quantity=order.quantity,
        total_price=order.total_price,
        retailer_id=order.retailer_id,
        retailer_email=order.retailer.email if order.retailer else "Deleted Retailer",
        supplier_id=order.supplier_id,
        supplier_brand=order.supplier.brand_name if order.supplier else "Unknown Brand",
        status=order.status,
        created_at=order.created_at,
        updated_at=order.updated_at
    )


@router.patch("/{order_id}/status", response_model=schemas.OrderDetailResponse)
def update_order_status(
    order_id: int,
    status_data: schemas.OrderUpdateStatus,
    current_user: models.User = Depends(auth.require_supplier_or_admin),
    db: Session = Depends(get_db)
):
    """
    Supplier/Admin only: Update order shipment/fulfillment status (e.g. shipped, delivered, cancelled).
    Suppliers can only update status of orders routed to them. Admins can update any order status.
    """
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with ID {order_id} not found."
        )

    # Authorization Check
    if current_user.role != "admin" and order.supplier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this order's status."
        )

    # Update Status
    order.status = status_data.status
    db.commit()
    db.refresh(order)

    return schemas.OrderDetailResponse(
        id=order.id,
        product_id=order.product_id,
        product_name=order.product.name,
        sku=order.product.sku,
        quantity=order.quantity,
        total_price=order.total_price,
        retailer_id=order.retailer_id,
        retailer_email=order.retailer.email if order.retailer else "Deleted Retailer",
        supplier_id=order.supplier_id,
        supplier_brand=order.supplier.brand_name if order.supplier else "Unknown Brand",
        status=order.status,
        created_at=order.created_at,
        updated_at=order.updated_at
    )
