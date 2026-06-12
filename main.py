import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import models
from database import engine, SessionLocal
from auth import get_password_hash
from routers.auth import router as auth_router
from routers.products import router as products_router
from routers.orders import router as orders_router
from routers.analytics import router as analytics_router

# 1. Create all database tables on startup
models.Base.metadata.create_all(bind=engine)

# 2. Seed initial database data if empty
def seed_database():
    db = SessionLocal()
    try:
        user_count = db.query(models.User).count()
        if user_count == 0:
            print("Seeding initial database...")
            
            # Create default users
            admin_user = models.User(
                email="admin@shopdot.com",
                hashed_password=get_password_hash("adminpass"),
                role="admin"
            )
            aura_supplier = models.User(
                email="aura@supplier.com",
                hashed_password=get_password_hash("supplierpass"),
                role="supplier",
                brand_name="Aura Goods Co."
            )
            clay_supplier = models.User(
                email="clay@supplier.com",
                hashed_password=get_password_hash("supplierpass"),
                role="supplier",
                brand_name="Clay & Roast"
            )
            volt_supplier = models.User(
                email="volt@supplier.com",
                hashed_password=get_password_hash("supplierpass"),
                role="supplier",
                brand_name="VoltTech Labs"
            )
            retailer_user = models.User(
                email="retailer@shopdot.com",
                hashed_password=get_password_hash("retailerpass"),
                role="retailer"
            )
            
            db.add_all([admin_user, aura_supplier, clay_supplier, volt_supplier, retailer_user])
            db.commit()
            
            # Refresh to fetch auto-increment IDs
            db.refresh(aura_supplier)
            db.refresh(clay_supplier)
            db.refresh(volt_supplier)
            
            # Create default products
            products = [
                models.Product(
                    name="Minimalist Leather Wallet",
                    sku="WL-LTHR-01",
                    price=45.0,
                    stock=25,
                    supplier_id=aura_supplier.id
                ),
                models.Product(
                    name="Premium Ceramic Coffee Mug",
                    sku="MG-CRMC-02",
                    price=18.5,
                    stock=50,
                    supplier_id=clay_supplier.id
                ),
                models.Product(
                    name="Wireless Charging Pad",
                    sku="CH-WRLS-03",
                    price=35.0,
                    stock=8,
                    supplier_id=volt_supplier.id
                )
            ]
            db.add_all(products)
            db.commit()
            print("Database seeded successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
    finally:
        db.close()

seed_database()

# 3. Initialize FastAPI Application
app = FastAPI(
    title="ShopDot B2B Drop-shipping Backend",
    description="A fully persistence-backed B2B drop-shipping API with role-based JWT auth, product catalogs, routed orders, and analytics.",
    version="2.0.0"
)

# Enable CORS (Cross-Origin Resource Sharing)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods
    allow_headers=["*"],  # Allows all headers
)

# 4. Include Routers
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(analytics_router)

# Mount static files folder to serve CSS/JS assets
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
def root():
    """
    Serves the frontend Single-Page Application (SPA) dashboard.
    """
    index_path = os.path.join(os.path.dirname(__file__), "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r") as f:
            return f.read()
    return HTMLResponse(content="<h1>ShopDot Frontend Index Not Found</h1>", status_code=404)
