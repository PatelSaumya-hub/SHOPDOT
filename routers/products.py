from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import models
import schemas
import auth
from database import get_db

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

@router.get("", response_model=List[schemas.ProductResponse])
def get_products(
    search: Optional[str] = None,
    supplier: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Public endpoint: Get all available products in the catalog.
    Supports optional search filters (by product name) and supplier brand filters.
    """
    query = db.query(models.Product).join(models.User, models.Product.supplier_id == models.User.id)
    
    if search:
        query = query.filter(models.Product.name.ilike(f"%{search}%"))
        
    if supplier:
        query = query.filter(models.User.brand_name.ilike(f"%{supplier}%"))
        
    products = query.all()
    
    # Structure response to flat schema returning supplier brand names
    return [
        schemas.ProductResponse(
            id=p.id,
            name=p.name,
            sku=p.sku,
            price=p.price,
            stock=p.stock,
            supplier_id=p.supplier_id,
            supplier_brand=p.supplier.brand_name if p.supplier else "Unknown Brand",
            created_at=p.created_at
        )
        for p in products
    ]


@router.post("", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_data: schemas.ProductCreate,
    current_user: models.User = Depends(auth.require_supplier_or_admin),
    db: Session = Depends(get_db)
):
    """
    Supplier/Admin only: Add a new product to the drop-shipping catalog.
    Checks for SKU uniqueness before creation.
    """
    # 1. Check SKU uniqueness
    existing_product = db.query(models.Product).filter(models.Product.sku == product_data.sku).first()
    if existing_product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with SKU '{product_data.sku}' already exists."
        )
    
    # 2. Add product
    new_product = models.Product(
        name=product_data.name,
        sku=product_data.sku,
        price=product_data.price,
        stock=product_data.stock,
        supplier_id=current_user.id
    )
    
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    return schemas.ProductResponse(
        id=new_product.id,
        name=new_product.name,
        sku=new_product.sku,
        price=new_product.price,
        stock=new_product.stock,
        supplier_id=new_product.supplier_id,
        supplier_brand=current_user.brand_name or "ShopDot Admin",
        created_at=new_product.created_at
    )


@router.put("/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    product_data: schemas.ProductUpdate,
    current_user: models.User = Depends(auth.require_supplier_or_admin),
    db: Session = Depends(get_db)
):
    """
    Supplier/Admin only: Edit details of an existing product in the catalog.
    Suppliers can only edit their own products, while Admins can edit any product.
    """
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    
    # 1. Verify product exists
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
        
    # 2. Verify ownership (unless Admin)
    if current_user.role != "admin" and product.supplier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this product."
        )
        
    # 3. Verify SKU uniqueness if changed
    if product_data.sku and product_data.sku != product.sku:
        sku_clash = db.query(models.Product).filter(models.Product.sku == product_data.sku).first()
        if sku_clash:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another product already uses SKU '{product_data.sku}'."
            )
            
    # 4. Update fields
    if product_data.name is not None:
        product.name = product_data.name
    if product_data.sku is not None:
        product.sku = product_data.sku
    if product_data.price is not None:
        product.price = product_data.price
    if product_data.stock is not None:
        product.stock = product_data.stock
        
    db.commit()
    db.refresh(product)
    
    return schemas.ProductResponse(
        id=product.id,
        name=product.name,
        sku=product.sku,
        price=product.price,
        stock=product.stock,
        supplier_id=product.supplier_id,
        supplier_brand=product.supplier.brand_name if product.supplier else "Unknown Supplier",
        created_at=product.created_at
    )


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    current_user: models.User = Depends(auth.require_supplier_or_admin),
    db: Session = Depends(get_db)
):
    """
    Supplier/Admin only: Remove a product from the catalog.
    Suppliers can only delete their own products, while Admins can delete any product.
    """
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    
    # 1. Verify product exists
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found."
        )
        
    # 2. Verify ownership (unless Admin)
    if current_user.role != "admin" and product.supplier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this product."
        )
        
    db.delete(product)
    db.commit()
    
    return {"message": f"Product with ID {product_id} successfully deleted."}
