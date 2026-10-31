/**
 * Cloudflare Pages Function: Storefront Settings API (Secured)
 * Handles GET & POST /api/settings
 * 
 * SECURITY: POST requires x-admin-key to prevent unauthorized store config modification
 */

function isAuthorized(request, env) {
    if (!env.ADMIN_SECRET_KEY) return true; // Open in local dev if no key set
    const authHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    if (!authHeader) return false;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    return token === env.ADMIN_SECRET_KEY;
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const db = env.DB;

    const fallbackSettings = {
        announcement_text: "All India Free Shipping | 4 to 6 Days Delivery | Handcrafted in Kerala",
        free_shipping_threshold: 999,
        stock_urgency_limit: 5,
        support_whatsapp_number: "919876543210"
    };

    if (!db) {
        return new Response(JSON.stringify(fallbackSettings), { 
            headers: { 
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60, s-maxage=300"
            } 
        });
    }

    try {
        const url = new URL(request.url);
        const isFresh = url.searchParams.get("fresh") === "true" || isAuthorized(request, env);

        const { results } = await db.prepare(`SELECT key, value FROM settings`).all();
        const map = { ...fallbackSettings };
        for (const r of (results || [])) {
            map[r.key] = r.value;
        }

        const cacheControl = isFresh
            ? "no-store, no-cache, must-revalidate"
            : "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

        return new Response(JSON.stringify(map), {
            headers: { 
                "Content-Type": "application/json",
                "Cache-Control": cacheControl,
                "Access-Control-Allow-Origin": "*"
            }
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

    if (!isAuthorized(request, env)) {
        return new Response(JSON.stringify({ error: "Unauthorized access: Valid x-admin-key required" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
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
