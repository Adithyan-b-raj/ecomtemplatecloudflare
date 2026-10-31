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
        let calculatedTotal = 0;
        const verifiedItems = [];

        for (const item of items) {
            const product = await db.prepare(
                `SELECT id, title, price, is_in_store_only FROM products WHERE id = ?`
            ).bind(item.id).first();

            if (!product) {
                return new Response(JSON.stringify({ error: `Product ID #${item.id} not found` }), { status: 404 });
            }

            if (product.is_in_store_only) {
                return new Response(JSON.stringify({ error: `"${product.title}" is in-store only and cannot be ordered online.` }), { status: 400 });
            }

            // Verify variant stock availability
            const variant = await db.prepare(
                `SELECT id, stock_qty FROM product_variants WHERE product_id = ? AND size = ?`
            ).bind(item.id, item.size).first();

            const requestedQty = parseInt(item.qty, 10) || 1;

            if (!variant || variant.stock_qty < requestedQty) {
                return new Response(JSON.stringify({ 
                    error: `"${product.title}" in size ${item.size} is out of stock.` 
                }), { status: 409 });
            }

            const itemSubtotal = product.price * requestedQty;
            calculatedTotal += itemSubtotal;

            verifiedItems.push({
                product_id: product.id,
                title: product.title,
                size: item.size,
                price: product.price,
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

        // 4. Record verified line items
        for (const item of verifiedItems) {
            await db.prepare(
                `INSERT INTO order_items (order_id, product_id, product_title, size, unit_price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(orderId, item.product_id, item.title, item.size, item.price, item.qty).run();
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
