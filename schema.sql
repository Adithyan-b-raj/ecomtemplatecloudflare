-- =============================================================================
-- Cloudflare D1 Database Schema: Boutique E-Commerce
-- =============================================================================

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    sale_price REAL,
    image_front TEXT NOT NULL,
    image_back TEXT,
    sku TEXT,
    is_in_store_only INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Product Variants (Size Inventory with Strict Zero-Backorders)
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    size TEXT NOT NULL,          -- XS, S, M, L, XL, XXL
    stock_qty INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    city TEXT NOT NULL,
    pincode TEXT NOT NULL,
    total_amount REAL NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, PROCESSING, COMPLETED, FAILED
    payment_method TEXT DEFAULT 'CASHFREE_UPI',
    cashfree_order_id TEXT,
    courier TEXT,
    tracking_awb TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Order Line Items
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_title TEXT NOT NULL,
    size TEXT NOT NULL,
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 5. In-Store POS Sales Logs (Offline Counter Records)
CREATE TABLE IF NOT EXISTS pos_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    size TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_price REAL NOT NULL,
    payment_mode TEXT DEFAULT 'CASH', -- CASH or UPI
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Store Settings (Key-Value)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes for ultra-fast edge queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status);
