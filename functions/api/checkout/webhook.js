/**
 * Cloudflare Pages Function: Cashfree Payment Webhook & Stock Decrement
 * Handles POST /api/checkout/webhook
 */

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });
    }

    try {
        const payload = await request.json();
        
        // Extract order info from Cashfree webhook payload
        const orderNumber = payload?.data?.order?.order_id || payload?.order_id;
        const paymentStatus = payload?.data?.payment?.payment_status || payload?.payment_status;

        if (!orderNumber) {
            return new Response(JSON.stringify({ message: "No order_id in webhook" }), { status: 400 });
        }

        if (paymentStatus === "SUCCESS" || paymentStatus === "PAID") {
            // 1. Mark order as PROCESSING in D1
            await db.prepare(
                `UPDATE orders SET payment_status = 'PROCESSING' WHERE order_number = ?`
            ).bind(orderNumber).run();

            // 2. Fetch order items to atomically decrement stock
            const order = await db.prepare(
                `SELECT id, customer_name, phone, total_amount FROM orders WHERE order_number = ?`
            ).bind(orderNumber).first();

            if (order) {
                const { results: items } = await db.prepare(
                    `SELECT product_id, size, quantity FROM order_items WHERE order_id = ?`
                ).bind(order.id).all();

                for (const item of items) {
                    await db.prepare(
                        `UPDATE product_variants 
                         SET stock_qty = MAX(0, stock_qty - ?) 
                         WHERE product_id = ? AND size = ?`
                    ).bind(item.quantity, item.product_id, item.size).run();
                }

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
                            customer_name: order.customer_name,
                            phone: order.phone,
                            amount: order.total_amount
                        })
                    }).catch(() => {});
                }
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
