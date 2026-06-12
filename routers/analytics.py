from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import models
import schemas
import auth
from database import get_db

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)

@router.get("", response_model=schemas.AnalyticsResponse)
def get_analytics(
    current_user: models.User = Depends(auth.require_any_user),
    db: Session = Depends(get_db)
):
    """
    Get customized analytics metrics based on the logged-in user's role:
    - Retailer: total spend, order count, and orders by status.
    - Supplier: total sales revenue, count of orders routed to them, and products with low stock.
    - Admin: global B2B system statistics (total sales, users count, order count, product count).
    """
    if current_user.role == "retailer":
        # 1. Retailer Analytics
        total_spend_query = db.query(func.sum(models.Order.total_price))\
            .filter(models.Order.retailer_id == current_user.id).scalar()
        total_spend = round(total_spend_query, 2) if total_spend_query else 0.0
        
        orders_count = db.query(models.Order).filter(models.Order.retailer_id == current_user.id).count()
        
        # Breakdown by status
        status_counts = {}
        status_query = db.query(models.Order.status, func.count(models.Order.id))\
            .filter(models.Order.retailer_id == current_user.id)\
            .group_by(models.Order.status).all()
        for status_name, count in status_query:
            status_counts[status_name] = count
            
        return schemas.AnalyticsResponse(
            role="retailer",
            metrics={
                "total_spend": total_spend,
                "orders_count": orders_count,
                "orders_by_status": status_counts
            }
        )
        
    elif current_user.role == "supplier":
        # 2. Supplier Analytics
        total_revenue_query = db.query(func.sum(models.Order.total_price))\
            .filter(models.Order.supplier_id == current_user.id)\
            .filter(models.Order.status != "cancelled").scalar()
        total_revenue = round(total_revenue_query, 2) if total_revenue_query else 0.0
        
        orders_count = db.query(models.Order).filter(models.Order.supplier_id == current_user.id).count()
        
        # Find products with low stock (<= 5)
        low_stock_products = db.query(models.Product)\
            .filter(models.Product.supplier_id == current_user.id)\
            .filter(models.Product.stock <= 5).all()
            
        low_stock_alerts = [
            {"product_id": p.id, "name": p.name, "sku": p.sku, "stock": p.stock}
            for p in low_stock_products
        ]
        
        return schemas.AnalyticsResponse(
            role="supplier",
            metrics={
                "total_revenue": total_revenue,
                "orders_count": orders_count,
                "low_stock_alerts": low_stock_alerts
            }
        )
        
    elif current_user.role == "admin":
        # 3. Global Admin Analytics
        total_sales_query = db.query(func.sum(models.Order.total_price))\
            .filter(models.Order.status != "cancelled").scalar()
        total_sales = round(total_sales_query, 2) if total_sales_query else 0.0
        
        total_users = db.query(models.User).count()
        total_products = db.query(models.Product).count()
        total_orders = db.query(models.Order).count()
        
        # User role breakdown
        role_counts = {}
        role_query = db.query(models.User.role, func.count(models.User.id)).group_by(models.User.role).all()
        for role_name, count in role_query:
            role_counts[role_name] = count
            
        return schemas.AnalyticsResponse(
            role="admin",
            metrics={
                "total_system_sales": total_sales,
                "total_users": total_users,
                "total_products": total_products,
                "total_orders": total_orders,
                "user_role_breakdown": role_counts
            }
        )
    
    return schemas.AnalyticsResponse(role="unknown", metrics={})
