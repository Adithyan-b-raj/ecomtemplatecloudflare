# ⚡ Cloudflare Native Boutique E-Commerce (Pages + D1 + R2)

A 100% serverless, zero-maintenance e-commerce platform designed to replicate the boutique shopping experience, stock scarcity mechanics, and Indian UPI payments of [Kaka by Eliza](https://kakabyeliza.com), powered entirely by **Cloudflare's Global Edge Network**.

---

## 🌟 Why Cloudflare Serverless vs Traditional Hosting?

| Feature | Cloudflare Serverless (`ecomtemplatecloudflare`) | Traditional WordPress / Hostinger |
| :--- | :--- | :--- |
| **Monthly Cost** | **₹0 / $0 forever** (Cloudflare Free Tier) | ₹249 – ₹399 / month recurring |
| **Speed (TTFB)** | **Sub-50ms** across Indian Edge nodes (Mumbai, Chennai, Delhi) | 800ms – 1.8s (depending on server load) |
| **Traffic Resilience** | Automatically scales to 50,000+ concurrent visitors | Can freeze/crash during viral Instagram sales |
| **Database** | **Cloudflare D1 (Serverless SQLite)** | MySQL (requires manual tuning & cleanup) |
| **Media Photos** | **Cloudflare R2 (10 GB free object storage)** | Local server disk |
| **Maintenance** | **Zero.** No PHP updates, no plugin conflicts | Requires continuous plugin & core patching |

---

## 🏗️ Architecture

```text
├── BMAD_PLAN.md                  # BMAD phased architecture & ticket specs
├── README.md                     # Setup & deployment guide
├── wrangler.toml                 # Cloudflare bindings (D1 Database + R2 Bucket)
├── schema.sql                    # Cloudflare D1 SQLite database schema
├── seed.sql                      # Initial catalog seed (Kurthis, Dresses, Tops)
├── functions/                    # Cloudflare Pages Serverless Edge API
│   └── api/
│       ├── products.js           # GET /api/products & POST /api/products
│       ├── stock.js              # PATCH /api/stock (Matrix & POS counter sync)
│       ├── orders.js             # GET /api/orders & PATCH dispatch
│       ├── settings.js           # GET /api/settings & POST update
│       ├── upload.js             # POST /api/upload (Direct upload to R2)
│       └── checkout/
│           ├── create-order.js   # Cashfree UPI session & D1 order draft
│           └── webhook.js        # Cashfree webhook, stock decrement & WhatsApp
└── public/                       # Static Edge Frontend (Mobile-First)
    ├── index.html                # Responsive storefront & dynamic urgency bar
    └── admin.html                # Mobile command center & in-store POS register
```

---

## 🚀 Quick Setup & Deployment Guide

### 1. Prerequisites
Ensure you have Node.js and Wrangler installed:
```bash
npm install -g wrangler
wrangler login
```

### 2. Create the Cloudflare D1 Database
```bash
# Create D1 database
npx wrangler d1 create ecom_boutique_db

# Copy the database_id into wrangler.toml under [[d1_databases]]
```

### 3. Apply Schema and Seed Catalog
```bash
# Apply schema to local testing:
npx wrangler d1 execute ecom_boutique_db --local --file=schema.sql
npx wrangler d1 execute ecom_boutique_db --local --file=seed.sql

# Or apply directly to Cloudflare Remote production:
npx wrangler d1 execute ecom_boutique_db --remote --file=schema.sql
npx wrangler d1 execute ecom_boutique_db --remote --file=seed.sql
```

### 4. Create Cloudflare R2 Storage Bucket
```bash
npx wrangler r2 bucket create boutique-photos
```

### 5. Local Development Test
Run the serverless stack locally with live D1 bindings:
```bash
npx wrangler pages dev public --d1 DB=ecom_boutique_db
```
Open `http://localhost:8788` for the Storefront and `http://localhost:8788/admin.html` for the Mobile Admin Hub!

### 6. Production Deployment
```bash
npx wrangler pages deploy public --project-name ecomtemplatecloudflare
```

---

## 💳 Cashfree UPI & WhatsApp Configuration

Set your environment variables in the Cloudflare Dashboard under **Settings → Environment Variables**:

| Variable | Description |
| :--- | :--- |
| `CASHFREE_APP_ID` | Your Cashfree Merchant App ID |
| `CASHFREE_SECRET_KEY` | Your Cashfree Merchant Secret Key |
| `CASHFREE_ENV` | `TEST` or `PRODUCTION` |
| `R2_PUBLIC_DOMAIN` | Optional custom domain for photos (e.g. `photos.yourdomain.com`) |
