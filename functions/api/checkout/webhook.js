/**
 * Cloudflare Pages Function: Secure Cashfree Webhook Handler
 * Handles POST /api/checkout/webhook
 * 
 * SECURITY HARDENING:
 * 1. Cryptographic HMAC-SHA256 signature verification (prevents fake paid orders)
 * 2. Idempotency protection (prevents double stock decrement on retried webhooks)
 * 3. Atomic stock decrement in D1
 */

async function verifyCashfreeSignature(rawBody, timestamp, signature, secret) {
    if (!signature || !timestamp || !secret) {
        return false;
    }

    try {
        const encoder = new TextEncoder();
        const dataToSign = encoder.encode(timestamp + rawBody);
        const keyData = encoder.encode(secret);

        const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
        );

        const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataToSign);
        
        // Convert to Base64
        const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
        return computedSignature === signature;
    } catch (e) {
        return false;
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });
    }

    try {
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");
        const timestamp = request.headers.get("x-webhook-timestamp");
        const secret = env.CASHFREE_SECRET_KEY;

        // Enforce HMAC-SHA256 signature verification whenever secret is configured or in production
        if (secret) {
            const isValid = await verifyCashfreeSignature(rawBody, timestamp, signature, secret);
            if (!isValid) {
                return new Response(JSON.stringify({ error: "Invalid cryptographic webhook signature" }), { 
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }
        } else if (env.CASHFREE_ENV === "PRODUCTION" || env.ENVIRONMENT === "production") {
            return new Response(JSON.stringify({ error: "CASHFREE_SECRET_KEY missing in production" }), { 
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        const payload = JSON.parse(rawBody);
        const orderNumber = payload?.data?.order?.order_id || payload?.order_id;
        const paymentStatus = payload?.data?.payment?.payment_status || payload?.payment_status;

        if (!orderNumber) {
            return new Response(JSON.stringify({ message: "No order_id in webhook" }), { status: 400 });
        }

        if (paymentStatus === "SUCCESS" || paymentStatus === "PAID") {
            // Check if order is already processed (Idempotency Protection)
            const currentOrder = await db.prepare(
                `SELECT id, payment_status, customer_name, phone, total_amount FROM orders WHERE order_number = ?`
            ).bind(orderNumber).first();

            if (!currentOrder) {
                return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
            }

            // If already processed or completed, do not decrement stock again!
            if (currentOrder.payment_status === 'PROCESSING' || currentOrder.payment_status === 'COMPLETED') {
                return new Response(JSON.stringify({ message: "Order already processed" }), { status: 200 });
            }

            // 1. Fetch order items to atomically decrement stock
            const { results: items } = await db.prepare(
                `SELECT product_id, size, quantity FROM order_items WHERE order_id = ?`
            ).bind(currentOrder.id).all();

            // 2. BMAD Atomic Write Batch:
            // Single transaction updates order status AND decrements variant stocks.
            // Eliminates multi-roundtrip write latency and prevents partial state desync.
            const batchStatements = [
                db.prepare(`UPDATE orders SET payment_status = 'PROCESSING' WHERE order_number = ?`).bind(orderNumber)
            ];

            for (const item of (items || [])) {
                batchStatements.push(
                    db.prepare(
                        `UPDATE product_variants 
                         SET stock_qty = MAX(0, stock_qty - ?) 
                         WHERE product_id = ? AND size = ?`
                    ).bind(item.quantity, item.product_id, item.size)
                );
            }

            await db.batch(batchStatements);

            // 3. Trigger WhatsApp notification webhook if configured
            const waWebhook = await db.prepare(
                `SELECT value FROM settings WHERE key = 'whatsapp_webhook_url'`
            ).first();

            if (waWebhook && waWebhook.value) {
                await fetch(waWebhook.value, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        event: "ORDER_PAID",
                        order_number: orderNumber,
                        customer_name: currentOrder.customer_name,
                        phone: currentOrder.phone,
                        amount: currentOrder.total_amount
                    })
                }).catch(() => {});
            }
        }

        return new Response(JSON.stringify({ received: true, order_number: orderNumber }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
