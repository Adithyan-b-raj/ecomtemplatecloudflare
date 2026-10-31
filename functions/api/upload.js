/**
 * Cloudflare Pages Function: Photo Upload to Cloudflare R2 (Secured)
 * Handles POST /api/upload
 * 
 * SECURITY: Protected by x-admin-key to prevent arbitrary bucket writes & storage abuse
 */

function isAuthorized(request, env) {
    if (!env.ADMIN_SECRET_KEY) return true; // Open in local dev if no key set
    const authHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    if (!authHeader) return false;
    const token = authHeader.replace(/^Bearer\s+/i, '');
    return token === env.ADMIN_SECRET_KEY;
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const bucket = env.PHOTOS;

    if (!isAuthorized(request, env)) {
        return new Response(JSON.stringify({ error: "Unauthorized access: Valid x-admin-key required" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
        });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('photo');

        if (!file) {
            return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
        }

        const extension = file.name.split('.').pop() || 'jpg';
        const key = `boutique_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

        if (bucket) {
            await bucket.put(key, file.stream(), {
                httpMetadata: { contentType: file.type }
            });

            // Return public URL (or custom domain if configured)
            const publicUrl = env.R2_PUBLIC_DOMAIN 
                ? `https://${env.R2_PUBLIC_DOMAIN}/${key}` 
                : `/api/photos/${key}`;

            return new Response(JSON.stringify({ success: true, url: publicUrl, key }), {
                headers: { "Content-Type": "application/json" }
            });
        } else {
            // Local fallback simulation
            return new Response(JSON.stringify({ 
                success: true, 
                url: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=700&q=80",
                key: "local-simulation.jpg" 
            }), {
                headers: { "Content-Type": "application/json" }
            });
        }
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
