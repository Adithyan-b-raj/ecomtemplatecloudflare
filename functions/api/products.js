/**
 * Cloudflare Pages Function: Products API
 * Handles /api/products (GET catalog, POST new product)
 */

export async function onRequestGet(context) {
    const { env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database binding missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        // 1. Fetch all products
        const { results: products } = await db.prepare(
            `SELECT * FROM products ORDER BY id DESC`
        ).all();

        // 2. Fetch all variants
        const { results: variants } = await db.prepare(
            `SELECT * FROM product_variants ORDER BY id ASC`
        ).all();

        // 3. Map variants to their corresponding products
        const variantMap = {};
        for (const v of variants) {
            if (!variantMap[v.product_id]) {
                variantMap[v.product_id] = [];
            }
            variantMap[v.product_id].push({
                size: v.size,
                stock: v.stock_qty,
                variant_id: v.id
            });
        }

        const formatted = products.map(p => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            category: p.category,
            description: p.description,
            price: p.price,
            originalPrice: p.sale_price,
            img: p.image_front,
            hoverImg: p.image_back || p.image_front,
            sku: p.sku,
            isInStoreOnly: Boolean(p.is_in_store_only),
            badge: p.is_in_store_only ? "In Store" : (
                (variantMap[p.id] && variantMap[p.id].some(v => v.stock <= 2 && v.stock > 0)) ? "Only 1-2 Left" : null
            ),
            badgeType: p.is_in_store_only ? "in-store" : "urgency",
            variations: variantMap[p.id] || []
        }));

        return new Response(JSON.stringify(formatted), {
            headers: { 
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=10" // 10s edge cache
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = env.DB;

    if (!db) {
        return new Response(JSON.stringify({ error: "D1 database binding missing" }), { status: 500 });
    }

    try {
        const body = await request.json();
        const { title, category, price, sale_price, image_front, image_back, sku, variations } = body;

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

        // Insert Product
        const prodInsert = await db.prepare(
            `INSERT INTO products (title, slug, category, price, sale_price, image_front, image_back, sku, is_in_store_only)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            title, 
            slug, 
            category, 
            price, 
            sale_price || null, 
            image_front, 
            image_back || image_front, 
            sku || null, 
            category === 'In Store' ? 1 : 0
        ).run();

        const newProductId = prodInsert.meta.last_row_id;

        // Insert Variations (Sizes: XS, S, M, etc.)
        if (variations && Array.isArray(variations)) {
            for (const v of variations) {
                await db.prepare(
                    `INSERT INTO product_variants (product_id, size, stock_qty) VALUES (?, ?, ?)`
                ).bind(newProductId, v.size, parseInt(v.stock, 10) || 0).run();
            }
        }

        return new Response(JSON.stringify({ success: true, id: newProductId }), {
            status: 201,
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
