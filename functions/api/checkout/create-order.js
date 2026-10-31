/**
 * Cloudflare Pages Function: Secure Order Creation & Pricing Validation
 * Handles POST /api/checkout/create-order
 * 
 * SECURITY HARDENING:
 * 1. Server-authoritative price calculation (never trusts client total_amount)
 * 2. Pre-checkout stock verification (prevents overselling)
 * 3. Input sanitation & validation
 */

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
    }

    try {
        const body = await request.json();
        const { customer_name, phone, email, city, pincode, items } = body;

        // 1. Strict Input Validation
        if (!customer_name || !phone || !city || !pincode || !Array.isArray(items) || items.length === 0) {
            return new Response(JSON.stringify({ error: "Missing required checkout fields" }), { status: 400 });
        }

        const cleanPhone = String(phone).replace(/[^0-9]/g, '');
        if (cleanPhone.length < 10) {
            return new Response(JSON.stringify({ error: "Invalid 10-digit mobile number" }), { status: 400 });
        }

        const cleanPincode = String(pincode).replace(/[^0-9]/g, '');
        if (cleanPincode.length !== 6) {
            return new Response(JSON.stringify({ error: "Invalid 6-digit Indian PIN code" }), { status: 400 });
        }

        // 2. Server-Authoritative Price Calculation & Live Stock Check
        // BMAD Optimization: Consolidated JOIN query retrieves product and variant stock in 1 single row read
        let calculatedTotal = 0;
        const verifiedItems = [];

        for (const item of items) {
            const row = await db.prepare(
                `SELECT p.id, p.title, p.price, p.is_in_store_only, v.id AS variant_id, v.stock_qty
                 FROM products p
                 LEFT JOIN product_variants v ON p.id = v.product_id AND v.size = ?
                 WHERE p.id = ?`
            ).bind(item.size, item.id).first();

            if (!row) {
                return new Response(JSON.stringify({ error: `Product ID #${item.id} not found` }), { status: 404 });
            }

            if (row.is_in_store_only) {
                return new Response(JSON.stringify({ error: `"${row.title}" is in-store only and cannot be ordered online.` }), { status: 400 });
            }

            if (!row.variant_id) {
                return new Response(JSON.stringify({ error: `Size ${item.size} is not available for "${row.title}"` }), { status: 400 });
            }

            const requestedQty = parseInt(item.qty, 10) || 1;

            if (row.stock_qty < requestedQty) {
                return new Response(JSON.stringify({ 
                    error: `"${row.title}" in size ${item.size} is out of stock.` 
                }), { status: 409 });
            }

            const itemSubtotal = row.price * requestedQty;
            calculatedTotal += itemSubtotal;

            verifiedItems.push({
                product_id: row.id,
                title: row.title,
                size: item.size,
                price: row.price,
                qty: requestedQty
            });
        }

        // Check Free Shipping Threshold from settings
        const thresholdSetting = await db.prepare(
            `SELECT value FROM settings WHERE key = 'free_shipping_threshold'`
        ).first();
        const freeShippingThreshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 999;
        
        let finalAmount = calculatedTotal;
        if (calculatedTotal < freeShippingThreshold) {
            finalAmount += 100; // Flat ₹100 standard domestic shipping
        }

        const orderNumber = "KB-" + Math.floor(1000 + Math.random() * 9000);

        // 3. Create Draft Order in D1 with PENDING status
        const orderInsert = await db.prepare(
            `INSERT INTO orders (order_number, customer_name, phone, email, city, pincode, total_amount, payment_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`
        ).bind(orderNumber, customer_name.trim(), cleanPhone, email ? email.trim() : '', city.trim(), cleanPincode, finalAmount).run();

        const orderId = orderInsert.meta.last_row_id;

        // 4. BMAD Batch Insertion: Record all line items in 1 atomic roundtrip
        if (verifiedItems.length > 0) {
            const itemBatch = verifiedItems.map(item =>
                db.prepare(
                    `INSERT INTO order_items (order_id, product_id, product_title, size, unit_price, quantity)
                     VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(orderId, item.product_id, item.title, item.size, item.price, item.qty)
            );
            await db.batch(itemBatch);
        }

        // 5. Generate Cashfree Payment Session (if credentials present)
        let paymentSessionId = null;
        const cashfreeAppId = env.CASHFREE_APP_ID;
        const cashfreeSecret = env.CASHFREE_SECRET_KEY;
        const isProd = env.CASHFREE_ENV === "PRODUCTION";

        if (cashfreeAppId && cashfreeSecret) {
            const cfEndpoint = isProd 
                ? "https://api.cashfree.com/pg/orders" 
                : "https://sandbox.cashfree.com/pg/orders";

            const cfPayload = {
                order_id: orderNumber,
                order_amount: finalAmount,
                order_currency: "INR",
                customer_details: {
                    customer_id: "CUST_" + cleanPhone,
                    customer_name: customer_name.trim(),
                    customer_phone: cleanPhone,
                    customer_email: email ? email.trim() : "order@kakabyeliza.com"
                },
                order_meta: {
                    return_url: `${new URL(request.url).origin}/?order_id=${orderNumber}`
                }
            };

            const cfRes = await fetch(cfEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-client-id": cashfreeAppId,
                    "x-client-secret": cashfreeSecret,
                    "x-api-version": "2023-08-01"
                },
                body: JSON.stringify(cfPayload)
            });

            if (cfRes.ok) {
                const cfData = await cfRes.json();
                paymentSessionId = cfData.payment_session_id;
            }
        }

        return new Response(JSON.stringify({
            success: true,
            order_number: orderNumber,
            total_amount: finalAmount,
            payment_session_id: paymentSessionId
        }), {
            status: 201,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
