# ShopDot B2B Drop-shipping Backend — Week 2

Welcome to the **ShopDot Week 2 Backend**! 

This is a simple, lightweight backend powered by **Python with FastAPI** and run via **Uvicorn**. Designed specifically as a starting point for your internship project, it focuses on exactly **two core drop-shipping tasks** using in-memory data, making it simple to run and understand without needing external databases.

---

## 🚀 Key Features (The 2 Core Tasks)

1. **Task 1: View Products (`GET /products`)**
   - Returns a real-time list of products in the supplier catalog.
   - Contains pre-populated mock products with SKU, price, supplier name, and stock level.

2. **Task 2: Place Order (`POST /orders`)**
   - Validates purchase requests.
   - Verifies real-time stock levels.
   - If stock is sufficient, it **decrements product inventory in-memory** and automatically **routes the order to the corresponding brand supplier** (with status: `routed_to_supplier`).
   - If stock is insufficient, it raises a helpful HTTP 400 bad request error.

---

## 🛠️ How to Set Up & Run

### 1. Install Dependencies
Open your terminal inside the `SHOPDOT` folder and install the required libraries:
```bash
pip install -r requirements.txt
```

### 2. Start the Backend Server
Run the FastAPI development server using **Uvicorn**:
```bash
uvicorn main:app --reload
```
- `main:app` tells Uvicorn to look inside `main.py` for the FastAPI instance called `app`.
- `--reload` enables automatic code reloading so any changes you make will instantly apply.

---

## 🧪 How to Test the Backend (Interactive Docs)

Once the server is running, FastAPI provides an **interactive API documentation console** (Swagger UI) out of the box!

1. Open your web browser and navigate to: **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**
2. You will see a beautiful visual dashboard of the two endpoints:
   - **`GET /products`**: Click `Try it out` ➡️ `Execute` to see all current products.
   - **`POST /orders`**: Click `Try it out`, enter a request JSON (like the one below), and click `Execute` to place an order.

### Example Order Request JSON
```json
{
  "product_id": 1,
  "quantity": 3
}
```

### Example Success Response JSON (Automated Routing)
```json
{
  "order_id": 1,
  "product_id": 1,
  "product_name": "Minimalist Leather Wallet",
  "sku": "WL-LTHR-01",
  "quantity": 3,
  "total_price": 135.0,
  "supplier": "Aura Goods Co.",
  "status": "routed_to_supplier",
  "message": "Order placed successfully! This order has been automatically routed to the supplier 'Aura Goods Co.' for fulfillment."
}
```

---

## 📂 Project Architecture

- **`main.py`**: Contains the full application code, mock data store, Pydantic data schemas, and both API endpoints.
- **`requirements.txt`**: Specifies python packages (`fastapi` and `uvicorn`).
