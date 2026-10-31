# 📋 BMAD Implementation Plan: Cloudflare Native Boutique E-Commerce

**Project:** `ecomtemplatecloudflare`  
**Architecture:** 100% Serverless Edge E-Commerce (Cloudflare Pages + D1 Database + R2 Storage + Functions API)  
**Cost:** ₹0 / $0 per month forever (Free Tier covers 5M D1 reads/day, 100k writes/day, 10GB R2 storage).

---

## 🏗️ Architecture Blueprint

```mermaid
flowchart TD
    subgraph Client ["Client Devices (Mobile 4G/5G)"]
        Shopper["Shopper Mobile Storefront (index.html)"]
        StoreOwner["Store Owner Admin / In-Store POS (admin.html)"]
    end

    subgraph Edge ["Cloudflare Pages & Functions Edge"]
        Pages["Cloudflare Pages CDN"]
        API["Cloudflare Pages Functions (/api/*)"]
        Pages --> API
    end

    subgraph DataStore ["Serverless Storage (Cloudflare)"]
        D1[("Cloudflare D1 (SQLite Database)")]
        R2[("Cloudflare R2 (Product Photos)")]
    end

    subgraph External ["External Services"]
        Cashfree["Cashfree Payments SDK (UPI / QR)"]
        WhatsApp["WhatsApp Cloud / Interakt Webhook"]
    end

    Shopper --> Pages
    StoreOwner --> Pages
    API <--> D1
    API <--> R2
    API <--> Cashfree
    API --> WhatsApp
```

---

## 📦 Phase-by-Phase BMAD Roadmap

### 🧱 Epic 1: Database Architecture & D1 SQLite Schema
* **Story 1.1 — Schema Definition (`schema.sql`)**
  * `products`: Core product entity (title, slug, category, description, price, sale_price, image_front, image_back, sku).
  * `product_variants`: Size variations (`size`: XS, S, M, L, XL, XXL) with `stock_qty` and zero-backorder tracking.
  * `orders`: Customer checkout details (order_id, customer_name, phone, city, pincode, total_amount, payment_status, tracking_awb, courier, created_at).
  * `order_items`: Order line items with size and price snapshots.
  * `settings`: Key-value store for announcement bar, free shipping threshold, urgency threshold, and WhatsApp number.
* **Story 1.2 — Catalog Seeder (`seed.sql`)**
  * Seed initial Kaka by Eliza catalog pieces (Green Floral Flare Kurthi, Amber Leaf Dress, Red Printed Peplum Top, etc.) with exact size stock.

---

### ⚡ Epic 2: Cloudflare Functions Edge API
* **Story 2.1 — Product Catalog API (`functions/api/products.js`)**
  * `GET /api/products`: Fast edge fetch of all products with their nested size variants.
  * `POST /api/products`: Create new boutique piece with photos, prices, and size stock.
* **Story 2.2 — Stock Matrix & In-Store POS API (`functions/api/stock.js`)**
  * `PATCH /api/stock`: Atomic update of variant stock quantity for the quick Matrix and in-store counter register (decrements stock immediately to prevent double-selling).
* **Story 2.3 — Store Settings API (`functions/api/settings.js`)**
  * `GET /api/settings`: Returns announcement bar text, free shipping threshold, and urgency limit.
  * `POST /api/settings`: Updates settings from Admin Hub.

---

### 💳 Epic 3: Cashfree UPI Payment & Webhook Automation
* **Story 3.1 — Create Order Session (`functions/api/checkout/create-order.js`)**
  * Creates order record in D1 with `payment_status = 'PENDING'`.
  * Calls Cashfree Orders API to generate `payment_session_id` for instant UPI (GPay, PhonePe, Paytm).
* **Story 3.2 — Webhook Stock Decrement & WhatsApp (`functions/api/checkout/webhook.js`)**
  * Verifies Cashfree webhook signature.
  * Marks order `PAID` / `PROCESSING`.
  * **Atomically decrements stock** in `product_variants` in D1.
  * Dispatches automated WhatsApp notification payload to store webhook.

---

### 📷 Epic 4: Cloudflare R2 Media Storage
* **Story 4.1 — Direct Photo Upload Engine (`functions/api/upload.js`)**
  * Handles image upload directly to Cloudflare R2 bucket (`PHOTOS`).
  * Generates clean public CDN URL for product front & hover photos.

---

### 📱 Epic 5: Frontend & Mobile Command Center Integration
* **Story 5.1 — Storefront Wireup (`public/index.html`)**
  * Connects product grid to live `/api/products`.
  * Live stock urgency bar calculated dynamically from D1 size stock.
  * Checkout form connected to `/api/checkout/create-order`.
* **Story 5.2 — Mobile Command Center & POS Wireup (`public/admin.html`)**
  * Stock Matrix with live stepper saves to `/api/stock`.
  * In-Store POS Register with 1-tap counter sale linked to D1 atomic decrement.
  * Add Product screen uploading photos to R2 and publishing to D1.

---

### 🛡️ Epic 6: BMAD Security Hardening & Anti-Tampering Protection
* **Story 6.1 — Anti-Fake Order Cryptographic Verification (`functions/api/checkout/webhook.js`)**
  * HMAC-SHA256 signature verification over `timestamp + rawBody` using Web Crypto API.
  * Idempotency safeguard prevents duplicate stock deductions from webhook retries.
* **Story 6.2 — Server-Authoritative Pricing Guard (`functions/api/checkout/create-order.js`)**
  * Strict database price lookup per item ID; rejects client-altered `total_amount`.
  * Pre-checkout stock validation prevents phantom orders for sold-out variants.
* **Story 6.3 — Role-Based API Authorization (`x-admin-key`)**
  * Protection of `/api/orders`, `/api/stock`, `/api/products` (POST), `/api/settings` (POST), and `/api/upload` (POST) against unauthorized access and customer PII leakage.

---

### ⚡ Epic 7: D1 Read/Write Minimization & Edge Caching
* **Story 7.1 — Edge CDN Caching Strategy (`s-maxage=60`, `stale-while-revalidate=120`)**
  * Serves 98%+ of public catalog and settings reads directly from Cloudflare Edge RAM (15ms TTFB).
  * Automatic `no-store` cache bypass for store managers (`x-admin-key` / `?fresh=1`) ensuring 100% real-time inventory visibility.
* **Story 7.2 — Query Scoping & Unbounded Scan Prevention (`functions/api/orders.js`)**
  * Replaced full-table `order_items` scan with scoped `WHERE order_id IN (...)` targeting only the 50 active orders.
* **Story 7.3 — Consolidated Pre-Flight JOIN Query (`functions/api/checkout/create-order.js`)**
  * Merged separate product and variant queries into 1 `LEFT JOIN`, reducing cart validation reads by 50%.
* **Story 7.4 — Transaction Batching & Zero-Read Writes (`db.batch`, `RETURNING`)**
  * Consolidated multi-step order inserts and webhook decrements into single atomic `db.batch()` transactions.
  * Utilized SQLite `RETURNING stock_qty` in `functions/api/stock.js` to eliminate post-update `SELECT` queries.
