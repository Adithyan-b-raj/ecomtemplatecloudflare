/**
 * Cloudflare Pages Function: Stock & In-Store POS API
 * Handles /api/stock (PATCH variant stock, record POS counter sale)
 */

export async function onRequestPatch(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
    }

    try {
        const body = await request.json();
        const { product_id, size, stock_qty, delta, is_pos_sale, price } = body;

        // If delta is provided (e.g. -1 for a POS sale)
        if (delta !== undefined) {
            await db.prepare(
                `UPDATE product_variants 
                 SET stock_qty = MAX(0, stock_qty + ?) 
                 WHERE product_id = ? AND size = ?`
            ).bind(delta, product_id, size).run();

            // Record into POS log if it's an offline counter sale
            if (is_pos_sale) {
                await db.prepare(
                    `INSERT INTO pos_sales (product_id, size, quantity, total_price, payment_mode) 
                     VALUES (?, ?, 1, ?, 'CASH')`
                ).bind(product_id, size, price || 0).run();
            }
        } 
        // If absolute stock_qty is provided (Matrix quick edit)
        else if (stock_qty !== undefined) {
            await db.prepare(
                `UPDATE product_variants 
                 SET stock_qty = ? 
                 WHERE product_id = ? AND size = ?`
            ).bind(Math.max(0, parseInt(stock_qty, 10)), product_id, size).run();
        }

        // Fetch updated stock
        const updated = await db.prepare(
            `SELECT stock_qty FROM product_variants WHERE product_id = ? AND size = ?`
        ).bind(product_id, size).first();

        return new Response(JSON.stringify({ 
            success: true, 
            product_id, 
            size, 
            new_stock: updated ? updated.stock_qty : 0 
        }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
