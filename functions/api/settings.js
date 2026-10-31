/**
 * Cloudflare Pages Function: Storefront Settings API
 * Handles GET & POST /api/settings
 */

export async function onRequestGet(context) {
    const { env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({
            announcement_text: "All India Free Shipping | 4 to 6 Days Delivery | Handcrafted in Kerala",
            free_shipping_threshold: 999,
            stock_urgency_limit: 5,
            support_whatsapp_number: "919876543210"
        }), { headers: { "Content-Type": "application/json" } });
    }

    try {
        const { results } = await db.prepare(`SELECT key, value FROM settings`).all();
        const map = {};
        for (const r of results) {
            map[r.key] = r.value;
        }
        return new Response(JSON.stringify(map), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database missing" }), { status: 500 });
    }

    try {
        const body = await request.json();
        for (const [key, value] of Object.entries(body)) {
            await db.prepare(
                `INSERT INTO settings (key, value) VALUES (?, ?) 
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
            ).bind(key, String(value)).run();
        }
        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
