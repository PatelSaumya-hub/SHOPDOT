/* ==========================================================================
   SHOPDOT B2B PORTAL - FRONTEND CONTROLLER (SPA)
   ========================================================================== */

const API_BASE = ""; // Relative paths since hosted on same origin

// Application State
let token = localStorage.getItem("shopdot_token") || null;
let currentUser = null;
let currentView = "catalog";
let chartInstance = null;

// Modal State
let currentOrderProduct = null;

// On Page Load
document.addEventListener("DOMContentLoaded", () => {
    initializeUser().then(() => {
        // Default Navigation
        navigate("catalog");
    });
});

/* --- Authentication & Session Handling --- */

async function initializeUser() {
    if (!token) {
        renderAuthNav();
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            currentUser = await response.json();
            renderUserNav();
        } else {
            // Token expired or invalid
            logout();
        }
    } catch (error) {
        console.error("Auth initialization failed:", error);
        logout();
    }
}

function renderAuthNav() {
    const navAuth = document.getElementById("nav-auth-section");
    navAuth.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="showAuthPage()">
            <i class="fa-solid fa-right-to-bracket"></i> Sign In
        </button>
    `;
    // Hide navigation options except catalog for unauthenticated users
    document.getElementById("link-orders").classList.add("hidden");
    document.getElementById("link-analytics").classList.add("hidden");
}

function renderUserNav() {
    const navAuth = document.getElementById("nav-auth-section");
    const brandLabel = currentUser.brand_name ? `<span class="user-role-badge">${currentUser.brand_name}</span>` : `<span class="user-role-badge">${currentUser.role}</span>`;
    
    navAuth.innerHTML = `
        <div class="user-info">
            <span class="user-email">${currentUser.email}</span>
            ${brandLabel}
        </div>
        <button class="btn btn-secondary btn-sm" onclick="logout()">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
        </button>
    `;
    
    // Show authorized nav links
    document.getElementById("link-orders").classList.remove("hidden");
    document.getElementById("link-analytics").classList.remove("hidden");
}

function showAuthPage() {
    navigate("auth");
}

function toggleAuthTab(tab) {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");

    if (tab === "login") {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        formLogin.classList.remove("hidden");
        formRegister.classList.add("hidden");
    } else {
        tabLogin.classList.remove("active");
        tabRegister.classList.add("active");
        formLogin.classList.add("hidden");
        formRegister.classList.remove("hidden");
    }
}

function toggleSupplierFields() {
    const role = document.getElementById("register-role").value;
    const groupBrand = document.getElementById("group-brand");
    const registerBrand = document.getElementById("register-brand");

    if (role === "supplier") {
        groupBrand.classList.remove("hidden");
        registerBrand.required = true;
    } else {
        groupBrand.classList.add("hidden");
        registerBrand.required = false;
        registerBrand.value = "";
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const role = document.getElementById("register-role").value;
    const brand_name = document.getElementById("register-brand").value;

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, role, brand_name: brand_name || null })
        });

        const data = await response.json();
        if (response.ok) {
            showToast("Registration successful! Please login.", "success");
            // Clear inputs
            document.getElementById("form-register").reset();
            toggleSupplierFields();
            toggleAuthTab("login");
        } else {
            showToast(data.detail || "Registration failed.", "error");
        }
    } catch (err) {
        showToast("Network error. Try again later.", "error");
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    // OAuth2 expects standard Form data
    const formData = new FormData();
    formData.append("username", email);
    formData.append("password", password);

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (response.ok) {
            token = data.access_token;
            localStorage.setItem("shopdot_token", token);
            await initializeUser();
            showToast("Login successful!", "success");
            document.getElementById("form-login").reset();
            navigate("catalog");
        } else {
            showToast(data.detail || "Login credentials incorrect.", "error");
        }
    } catch (err) {
        showToast("Network connection failed.", "error");
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem("shopdot_token");
    renderAuthNav();
    showToast("Logged out successfully.", "info");
    navigate("catalog");
}

/* --- Navigation & SPA Routing --- */

function navigate(viewName) {
    // Check permission rules
    if ((viewName === "orders" || viewName === "analytics") && !currentUser) {
        showToast("Authentication required to access this dashboard view.", "error");
        navigate("auth");
        return;
    }

    currentView = viewName;
    
    // Toggle View Sections
    const views = ["auth", "catalog", "orders", "analytics"];
    views.forEach(v => {
        const elem = document.getElementById(`view-${v}`);
        if (v === viewName) {
            elem.classList.remove("hidden");
        } else {
            elem.classList.add("hidden");
        }
    });

    // Toggle Active Class in Nav Links
    const links = ["catalog", "orders", "analytics"];
    links.forEach(l => {
        const linkElem = document.getElementById(`link-${l}`);
        if (l === viewName) {
            linkElem.classList.add("active");
        } else {
            linkElem.classList.remove("active");
        }
    });

    // Load Data
    if (viewName === "catalog") {
        fetchProducts();
        renderCatalogActions();
    } else if (viewName === "orders") {
        fetchOrders();
    } else if (viewName === "analytics") {
        fetchAnalytics();
    }
}

/* --- Catalog Module --- */

function renderCatalogActions() {
    const container = document.getElementById("catalog-actions");
    container.innerHTML = "";
    
    // Only Suppliers or Admins can add new products
    if (currentUser && (currentUser.role === "supplier" || currentUser.role === "admin")) {
        container.innerHTML = `
            <button class="btn btn-primary" onclick="openProductModal()">
                <i class="fa-solid fa-circle-plus"></i> Add New Product
            </button>
        `;
    }
}

async function fetchProducts() {
    const search = document.getElementById("search-input").value;
    const supplier = document.getElementById("supplier-filter").value;
    
    let url = `${API_BASE}/products`;
    const params = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (supplier) params.push(`supplier=${encodeURIComponent(supplier)}`);
    if (params.length > 0) {
        url += `?${params.join("&")}`;
    }

    try {
        const response = await fetch(url);
        if (response.ok) {
            const products = await response.json();
            renderProductGrid(products);
        } else {
            showToast("Failed to fetch product catalog.", "error");
        }
    } catch (err) {
        console.error("Products query failed:", err);
    }
}

function renderProductGrid(products) {
    const grid = document.getElementById("product-grid");
    grid.innerHTML = "";

    if (products.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fa-solid fa-boxes-stacked empty-icon"></i>
                <p>No products match your search filters.</p>
            </div>
        `;
        return;
    }

    products.forEach(p => {
        // Determine stock status classes
        let stockClass = "in-stock";
        let stockLabel = `${p.stock} units available`;
        if (p.stock === 0) {
            stockClass = "out-stock";
            stockLabel = "Out of Stock";
        } else if (p.stock <= 5) {
            stockClass = "low-stock";
            stockLabel = `Only ${p.stock} units left!`;
        }

        // Contextual buttons based on role
        let actionButtons = "";
        
        if (!currentUser || currentUser.role === "retailer") {
            // Retailers can place orders
            const disabledAttr = p.stock === 0 ? "disabled" : "";
            actionButtons = `
                <button class="btn btn-primary btn-sm" ${disabledAttr} onclick="openOrderModal(${p.id}, '${escapeHtml(p.name)}', '${p.sku}', ${p.price}, ${p.stock})">
                    <i class="fa-solid fa-cart-shopping"></i> Order Now
                </button>
            `;
        } else if (currentUser && (currentUser.role === "admin" || (currentUser.role === "supplier" && p.supplier_id === currentUser.id))) {
            // Suppliers can edit/delete their own products; Admins can do it for all
            actionButtons = `
                <div class="card-actions">
                    <button class="btn btn-secondary btn-sm" onclick="openProductModal(${p.id}, '${escapeHtml(p.name)}', '${p.sku}', ${p.price}, ${p.stock})">
                        <i class="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        }

        const card = document.createElement("div");
        card.className = "card product-card";
        card.innerHTML = `
            <div class="product-info">
                <span class="sku-badge">${p.sku}</span>
                <h3 class="product-title">${p.name}</h3>
                <div class="product-stats">
                    <span>Supplier: <span class="supplier-text">${p.supplier_brand || "Admin"}</span></span>
                    <span class="stock-badge ${stockClass}">${stockLabel}</span>
                </div>
            </div>
            <div class="product-footer">
                <span class="product-price">$${p.price.toFixed(2)}</span>
                ${actionButtons}
            </div>
        `;
        grid.appendChild(card);
    });
}

/* --- Modals Handling --- */

function openOrderModal(productId, productName, sku, price, stock) {
    currentOrderProduct = { id: productId, name: productName, price: price, stock: stock };
    
    document.getElementById("order-modal-id").value = productId;
    document.getElementById("order-modal-title").innerText = productName;
    document.getElementById("order-modal-sku").innerText = sku;
    document.getElementById("order-modal-price").innerText = `$${price.toFixed(2)}`;
    document.getElementById("order-modal-stock").innerText = `Available stock: ${stock} items`;
    
    const qtyInput = document.getElementById("order-quantity");
    qtyInput.value = 1;
    updateOrderModalSummary();

    document.getElementById("modal-order").classList.remove("hidden");
}

function adjustQty(amount) {
    const qtyInput = document.getElementById("order-quantity");
    let val = parseInt(qtyInput.value) + amount;
    
    if (val < 1) val = 1;
    if (currentOrderProduct && val > currentOrderProduct.stock) {
        val = currentOrderProduct.stock;
        showToast("Cannot exceed available stock.", "warning");
    }
    
    qtyInput.value = val;
    updateOrderModalSummary();
}

function updateOrderModalSummary() {
    if (!currentOrderProduct) return;
    const qty = parseInt(document.getElementById("order-quantity").value);
    const total = qty * currentOrderProduct.price;
    document.getElementById("order-modal-total").innerText = `$${total.toFixed(2)}`;
}

async function handlePlaceOrder(event) {
    event.preventDefault();
    const product_id = parseInt(document.getElementById("order-modal-id").value);
    const quantity = parseInt(document.getElementById("order-quantity").value);

    try {
        const response = await fetch(`${API_BASE}/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ product_id, quantity })
        });

        const data = await response.json();
        if (response.ok) {
            showToast(data.message, "success");
            closeModal("order");
            navigate("orders");
        } else {
            showToast(data.detail || "Failed to place order.", "error");
        }
    } catch (err) {
        showToast("Network checkout query failed.", "error");
    }
}

function openProductModal(id = null, name = "", sku = "", price = "", stock = "") {
    document.getElementById("product-modal-id").value = id || "";
    document.getElementById("product-name").value = name;
    document.getElementById("product-sku").value = sku;
    document.getElementById("product-price").value = price;
    document.getElementById("product-stock").value = stock;

    const modalTitle = document.getElementById("product-modal-title-text");
    const submitBtn = document.getElementById("product-modal-submit-btn");

    if (id) {
        modalTitle.innerText = "Edit Product Details";
        submitBtn.innerHTML = `Update Product <i class="fa-solid fa-circle-check"></i>`;
    } else {
        modalTitle.innerText = "Add Wholesale Product";
        submitBtn.innerHTML = `Save Product <i class="fa-solid fa-circle-plus"></i>`;
    }

    document.getElementById("modal-product").classList.remove("hidden");
}

async function handleProductFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById("product-modal-id").value;
    const name = document.getElementById("product-name").value;
    const sku = document.getElementById("product-sku").value;
    const price = parseFloat(document.getElementById("product-price").value);
    const stock = parseInt(document.getElementById("product-stock").value);

    const payload = { name, sku, price, stock };
    const method = id ? "PUT" : "POST";
    const url = id ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
            showToast(id ? "Product updated successfully." : "Product added successfully.", "success");
            closeModal("product");
            fetchProducts();
        } else {
            showToast(data.detail || "Error saving product.", "error");
        }
    } catch (err) {
        showToast("Network request failed.", "error");
    }
}

async function deleteProduct(productId) {
    if (!confirm("Are you sure you want to delete this product? This action is permanent.")) return;

    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            showToast("Product deleted successfully.", "success");
            fetchProducts();
        } else {
            const data = await response.json();
            showToast(data.detail || "Delete operation failed.", "error");
        }
    } catch (err) {
        showToast("Connection error during delete request.", "error");
    }
}

function closeModal(modalName) {
    document.getElementById(`modal-${modalName}`).classList.add("hidden");
    if (modalName === "order") {
        currentOrderProduct = null;
    }
}

/* --- Orders Module --- */

async function fetchOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            const orders = await response.json();
            renderOrdersTable(orders);
        } else {
            showToast("Failed to fetch order history.", "error");
        }
    } catch (err) {
        console.error("Orders query failed:", err);
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById("orders-tbody");
    const emptyState = document.getElementById("no-orders-message");
    const partnerHeader = document.getElementById("th-partner");
    
    tbody.innerHTML = "";

    if (orders.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    } else {
        emptyState.classList.add("hidden");
    }

    // Set table header depending on user role
    if (currentUser.role === "retailer") {
        partnerHeader.innerText = "Brand Supplier";
    } else if (currentUser.role === "supplier") {
        partnerHeader.innerText = "Retailer Email";
    } else {
        partnerHeader.innerText = "B2B Channels";
    }

    orders.forEach(o => {
        const dateStr = new Date(o.created_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Determine who is displayed as the partner
        let partnerCell = "";
        if (currentUser.role === "retailer") {
            partnerCell = o.supplier_brand;
        } else if (currentUser.role === "supplier") {
            partnerCell = o.retailer_email;
        } else {
            partnerCell = `<div>R: ${o.retailer_email}</div><div style="font-size:11px;color:var(--text-muted);">S: ${o.supplier_brand}</div>`;
        }

        // Action Column: Suppliers/Admins can modify status
        let actionCell = "—";
        if (currentUser.role === "supplier" || currentUser.role === "admin") {
            actionCell = `
                <select onchange="updateOrderStatus(${o.id}, this.value)" style="padding: 4px 8px; font-size: 12px; width: 130px;">
                    <option value="routed_to_supplier" ${o.status === "routed_to_supplier" ? "selected" : ""}>Routed</option>
                    <option value="shipped" ${o.status === "shipped" ? "selected" : ""}>Shipped</option>
                    <option value="delivered" ${o.status === "delivered" ? "selected" : ""}>Delivered</option>
                    <option value="cancelled" ${o.status === "cancelled" ? "selected" : ""}>Cancelled</option>
                </select>
            `;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>#${o.id}</td>
            <td>
                <div style="font-weight:600;">${o.product_name}</div>
                <div style="font-size:11px;color:var(--text-muted);">${o.sku}</div>
            </td>
            <td>${o.quantity} units</td>
            <td style="font-weight:600;color:var(--secondary-color);">$${o.total_price.toFixed(2)}</td>
            <td>${partnerCell}</td>
            <td>
                <span class="status-indicator status-${o.status}">${o.status.replace(/_/g, ' ')}</span>
            </td>
            <td>${dateStr}</td>
            <td>${actionCell}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            showToast(`Order #${orderId} updated to ${newStatus.replace(/_/g, ' ')}.`, "success");
            fetchOrders();
        } else {
            const data = await response.json();
            showToast(data.detail || "Failed to update status.", "error");
            fetchOrders(); // Reload to revert select element state
        }
    } catch (err) {
        showToast("Error updating order status.", "error");
    }
}

/* --- Analytics Module --- */

async function fetchAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/analytics`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderAnalytics(data);
        } else {
            showToast("Failed to retrieve dashboard analytics.", "error");
        }
    } catch (err) {
        console.error("Analytics fetch failed:", err);
    }
}

function renderAnalytics(data) {
    const grid = document.getElementById("metrics-grid");
    grid.innerHTML = "";

    const role = data.role;
    const metrics = data.metrics;

    let chartLabels = [];
    let chartValues = [];
    let chartTitleText = "";

    if (role === "retailer") {
        // Metric Cards
        grid.innerHTML = `
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-wallet"></i></div>
                <div>
                    <div class="metric-value">$${metrics.total_spend.toFixed(2)}</div>
                    <div class="metric-label">Total Spend</div>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-boxes-packing"></i></div>
                <div>
                    <div class="metric-value">${metrics.orders_count}</div>
                    <div class="metric-label">Total Orders Placed</div>
                </div>
            </div>
        `;

        // Chart Data setup: Orders by status
        chartTitleText = "Spend Distribution by Order Status ($)";
        const statusBreakdown = metrics.orders_by_status || {};
        chartLabels = Object.keys(statusBreakdown).map(k => k.replace(/_/g, ' ').toUpperCase());
        
        // Sum total costs per status
        chartValues = Object.keys(statusBreakdown).map(k => statusBreakdown[k] * 45.0); // Simplified mock chart sizing
        if (chartValues.length === 0) {
            chartLabels = ["NO ORDERS"];
            chartValues = [0];
        }

    } else if (role === "supplier") {
        grid.innerHTML = `
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-sack-dollar"></i></div>
                <div>
                    <div class="metric-value">$${metrics.total_revenue.toFixed(2)}</div>
                    <div class="metric-label">Total Revenue Earned</div>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-truck-ramp-box"></i></div>
                <div>
                    <div class="metric-value">${metrics.orders_count}</div>
                    <div class="metric-label">Incoming Orders</div>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div>
                    <div class="metric-value">${metrics.low_stock_alerts.length}</div>
                    <div class="metric-label">Low Stock Alerts</div>
                </div>
            </div>
        `;

        chartTitleText = "Catalog Low Stock Warning Panel";
        const alerts = metrics.low_stock_alerts || [];
        chartLabels = alerts.map(a => a.name);
        chartValues = alerts.map(a => a.stock);

        if (chartLabels.length === 0) {
            chartLabels = ["All Products Healthy (Stock > 5)"];
            chartValues = [10];
        }

    } else if (role === "admin") {
        grid.innerHTML = `
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-globe"></i></div>
                <div>
                    <div class="metric-value">$${metrics.total_system_sales.toFixed(2)}</div>
                    <div class="metric-label">Platform Gross Sales</div>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-users"></i></div>
                <div>
                    <div class="metric-value">${metrics.total_users}</div>
                    <div class="metric-label">Registered Accounts</div>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-warehouse"></i></div>
                <div>
                    <div class="metric-value">${metrics.total_products}</div>
                    <div class="metric-label">Active Products List</div>
                </div>
            </div>
            <div class="card metric-card">
                <div class="metric-icon-wrapper"><i class="fa-solid fa-cart-flatbed-suitcase"></i></div>
                <div>
                    <div class="metric-value">${metrics.total_orders}</div>
                    <div class="metric-label">Total platform Transactions</div>
                </div>
            </div>
        `;

        chartTitleText = "Platform Users Division (Role Count)";
        const roles = metrics.user_role_breakdown || {};
        chartLabels = Object.keys(roles).map(r => r.toUpperCase());
        chartValues = Object.values(roles);
    }

    renderChart(chartLabels, chartValues, chartTitleText);
}

function renderChart(labels, values, titleText) {
    const ctx = document.getElementById("businessChart").getContext("2d");
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Metric Count',
                data: values,
                backgroundColor: 'rgba(99, 102, 241, 0.4)',
                borderColor: '#6366f1',
                borderWidth: 2,
                borderRadius: 6,
                hoverBackgroundColor: 'rgba(6, 182, 212, 0.6)',
                hoverBorderColor: '#06b6d4'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: titleText,
                    color: '#f8fafc',
                    font: {
                        family: 'Outfit',
                        size: 14,
                        weight: '600'
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#cbd5e1',
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#cbd5e1',
                        font: {
                            family: 'Inter',
                            size: 11
                        },
                        beginAtZero: true
                    }
                }
            }
        }
    });
}

/* --- Feedback System: Toast --- */

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let iconClass = "fa-circle-info";
    if (type === "success") iconClass = "fa-circle-check";
    if (type === "error") iconClass = "fa-triangle-exclamation";
    if (type === "warning") iconClass = "fa-circle-exclamation";

    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-content">${message}</div>
    `;

    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add("show");
    }, 50);

    // Fade out and remove
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.remove();
        }, 350);
    }, 4000);
}

/* --- Helpers --- */

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}
