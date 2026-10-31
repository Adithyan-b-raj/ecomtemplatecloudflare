/**
 * Cloudflare Pages Function: Stock & In-Store POS API (Secured)
 * Handles /api/stock (PATCH variant stock, record POS counter sale)
 */

function isAuthorized(request, env) {
    if (!env.ADMIN_SECRET_KEY) return true; // Open in local dev if no key set
    const authHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    if (!authHeader) return false;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    return token === env.ADMIN_SECRET_KEY;
}

export async function onRequestPatch(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
    }

    if (!isAuthorized(request, env)) {
        return new Response(JSON.stringify({ error: "Unauthorized access: Valid x-admin-key required" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const body = await request.json();
        const { product_id, size, stock_qty, delta, is_pos_sale, price } = body;

        let newStock = null;

        // If delta is provided (e.g. -1 for a POS sale)
        if (delta !== undefined) {
            const updateStmt = db.prepare(
                `UPDATE product_variants 
                 SET stock_qty = MAX(0, stock_qty + ?) 
                 WHERE product_id = ? AND size = ?
                 RETURNING stock_qty`
            ).bind(delta, product_id, size);

            if (is_pos_sale) {
                const insertStmt = db.prepare(
                    `INSERT INTO pos_sales (product_id, size, quantity, total_price, payment_mode) 
                     VALUES (?, ?, 1, ?, 'CASH')`
                ).bind(product_id, size, price || 0);

                // BMAD Batch: Atomic stock decrement + POS sale receipt in 1 transaction
                const batchRes = await db.batch([updateStmt, insertStmt]);
                newStock = batchRes[0]?.results?.[0]?.stock_qty;
            } else {
                const res = await updateStmt.all();
                newStock = res.results?.[0]?.stock_qty;
            }
        } 
        // If absolute stock_qty is provided (Matrix quick edit)
        else if (stock_qty !== undefined) {
            const cleanQty = Math.max(0, parseInt(stock_qty, 10));
            const updateStmt = db.prepare(
                `UPDATE product_variants 
                 SET stock_qty = ? 
                 WHERE product_id = ? AND size = ?
                 RETURNING stock_qty`
            ).bind(cleanQty, product_id, size);

            const res = await updateStmt.all();
            newStock = res.results?.[0]?.stock_qty ?? cleanQty;
        }

        // Graceful fallback if SQLite RETURNING clause is not returned
        if (newStock === null || newStock === undefined) {
            const updated = await db.prepare(
                `SELECT stock_qty FROM product_variants WHERE product_id = ? AND size = ?`
            ).bind(product_id, size).first();
            newStock = updated ? updated.stock_qty : 0;
        }

        return new Response(JSON.stringify({ 
            success: true, 
            product_id, 
            size, 
            new_stock: newStock 
        }), {
            headers: { 
                "Content-Type": "application/json",
                "Cache-Control": "no-store"
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
