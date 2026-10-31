/**
 * Cloudflare Pages Function: Create Order & Cashfree Payment Session
 * Handles POST /api/checkout/create-order
 */

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
    }

    try {
        const body = await request.json();
        const { customer_name, phone, email, city, pincode, items, total_amount } = body;

        if (!customer_name || !phone || !items || !items.length) {
            return new Response(JSON.stringify({ error: "Missing required checkout fields" }), { status: 400 });
        }

        const orderNumber = "KB-" + Math.floor(1000 + Math.random() * 9000);

        // 1. Create order record in D1
        const orderInsert = await db.prepare(
            `INSERT INTO orders (order_number, customer_name, phone, email, city, pincode, total_amount, payment_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`
        ).bind(orderNumber, customer_name, phone, email || '', city, pincode, total_amount).run();

        const orderId = orderInsert.meta.last_row_id;

        // 2. Insert line items
        for (const item of items) {
            await db.prepare(
                `INSERT INTO order_items (order_id, product_id, product_title, size, unit_price, quantity)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(orderId, item.id, item.title, item.size, item.price, item.qty || 1).run();
        }

        // 3. Check for Cashfree Integration
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
                order_amount: total_amount,
                order_currency: "INR",
                customer_details: {
                    customer_id: "CUST_" + phone,
                    customer_name: customer_name,
                    customer_phone: phone,
                    customer_email: email || "customer@kakabyeliza.com"
                },
                order_meta: {
                    return_url: `${new URL(request.url).origin}/track-order/?order_id=${orderNumber}`
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
            total_amount: total_amount,
            payment_session_id: paymentSessionId
        }), {
            status: 201,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
