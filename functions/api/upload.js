/**
 * Cloudflare Pages Function: Photo Upload to Cloudflare R2
 * Handles POST /api/upload
 */

export async function onRequestPost(context) {
    const { request, env } = context;
    const bucket = env.PHOTOS;

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
