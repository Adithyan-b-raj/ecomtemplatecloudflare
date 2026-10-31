/**
 * Cloudflare Pages Function: Orders & Dispatch Management API (Secured)
 * Handles GET /api/orders & PATCH /api/orders
 * 
 * SECURITY: Protected by x-admin-key to prevent public leakage of customer PII
 */

function isAuthorized(request, env) {
    if (!env.ADMIN_SECRET_KEY) return true;
    const authHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    if (!authHeader) return false;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    return token === env.ADMIN_SECRET_KEY;
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });
    }

    if (!isAuthorized(request, env)) {
        return new Response(JSON.stringify({ error: "Unauthorized: Admin key required to view customer orders" }), { 
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const { results: orders } = await db.prepare(
            `SELECT * FROM orders ORDER BY id DESC LIMIT 50`
        ).all();

        const { results: items } = await db.prepare(
            `SELECT * FROM order_items`
        ).all();

        const itemsMap = {};
        for (const item of items) {
            if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
            itemsMap[item.order_id].push(item);
        }

        const formatted = orders.map(o => ({
            ...o,
            items: itemsMap[o.id] || []
        }));

        return new Response(JSON.stringify(formatted), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function onRequestPatch(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });
    }

    if (!isAuthorized(request, env)) {
        return new Response(JSON.stringify({ error: "Unauthorized: Admin key required" }), { 
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const body = await request.json();
        const { order_number, courier, tracking_awb, payment_status } = body;

        await db.prepare(
            `UPDATE orders 
             SET courier = ?, tracking_awb = ?, payment_status = ? 
             WHERE order_number = ?`
        ).bind(courier || 'Delhivery', tracking_awb || '', payment_status || 'COMPLETED', order_number).run();

        return new Response(JSON.stringify({ success: true, order_number }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
