-- =============================================================================
-- Initial Catalog Seed (Kaka by Eliza Inspired Pieces)
-- =============================================================================

-- Seed Settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
('announcement_text', 'All India Free Shipping | 4 to 6 Days Delivery | Handcrafted in Kerala'),
('free_shipping_threshold', '999'),
('stock_urgency_limit', '5'),
('support_whatsapp_number', '919876543210'),
('whatsapp_webhook_url', ''),
('dispatch_lead_days', '2-3');

-- 1. Green Floral Flare Kurthi
INSERT OR IGNORE INTO products (id, title, slug, category, description, price, sale_price, image_front, image_back, sku, is_in_store_only) VALUES
(1, 'Green Floral Flare Kurthi', 'green-floral-flare-kurthi', 'Kurthis', 'Crafted from 100% pure breathable cotton with natural floral motifs. Handcrafted in Kerala.', 1450, 1799, 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=700&q=80', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=700&q=80', 'KB-KUR-01', 0);

INSERT OR IGNORE INTO product_variants (product_id, size, stock_qty) VALUES
(1, 'S', 1),
(1, 'M', 2),
(1, 'L', 0),
(1, 'XL', 1);

-- 2. Red Printed Peplum Top
INSERT OR IGNORE INTO products (id, title, slug, category, description, price, sale_price, image_front, image_back, sku, is_in_store_only) VALUES
(2, 'Red Printed Peplum Top', 'red-printed-peplum-top', 'Peplum Tops', 'Chic peplum silhouette featuring artisan wooden buttons and breathable handspun cotton.', 1250, NULL, 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=700&q=80', 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=700&q=80', 'KB-PEP-02', 0);

INSERT OR IGNORE INTO product_variants (product_id, size, stock_qty) VALUES
(2, 'XS', 2),
(2, 'S', 1),
(2, 'M', 0),
(2, 'L', 4);

-- 3. Amber Leaf Pastel Dress
INSERT OR IGNORE INTO products (id, title, slug, category, description, price, sale_price, image_front, image_back, sku, is_in_store_only) VALUES
(3, 'Amber Leaf Pastel Dress', 'amber-leaf-pastel-dress', 'Dresses', 'Flowy boutique maxi dress dyed in subtle amber tones. Effortless comfort for daily elegance.', 1890, 2200, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=700&q=80', 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=700&q=80', 'KB-DRS-03', 0);

INSERT OR IGNORE INTO product_variants (product_id, size, stock_qty) VALUES
(3, 'S', 0),
(3, 'M', 1),
(3, 'L', 2);

-- 4. Kochi Heritage In-Store Kurthi
INSERT OR IGNORE INTO products (id, title, slug, category, description, price, sale_price, image_front, image_back, sku, is_in_store_only) VALUES
(4, 'Kochi Heritage In-Store Kurthi', 'kochi-heritage-in-store-kurthi', 'In Store', 'Exclusive boutique showroom piece with hand embroidery. Available at offline counter register.', 1650, NULL, 'https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?auto=format&fit=crop&w=700&q=80', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=700&q=80', 'KB-INS-04', 1);

INSERT OR IGNORE INTO product_variants (product_id, size, stock_qty) VALUES
(4, 'M', 1),
(4, 'L', 1);

-- 5. Sand Dune Cotton Dress
INSERT OR IGNORE INTO products (id, title, slug, category, description, price, sale_price, image_front, image_back, sku, is_in_store_only) VALUES
(5, 'Sand Dune Cotton Dress', 'sand-dune-cotton-dress', 'Dresses', 'Minimalist earthly tone dress designed for Kerala summers.', 1750, NULL, 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=700&q=80', 'https://images.unsplash.com/photo-1550614000-4895a10e1bfd?auto=format&fit=crop&w=700&q=80', 'KB-DRS-05', 0);

INSERT OR IGNORE INTO product_variants (product_id, size, stock_qty) VALUES
(5, 'S', 1),
(5, 'M', 0);

-- 6. Zo Chic Short Kurti
INSERT OR IGNORE INTO products (id, title, slug, category, description, price, sale_price, image_front, image_back, sku, is_in_store_only) VALUES
(6, 'Zo Chic Short Kurti', 'zo-chic-short-kurti', 'Short Kurti', 'Everyday short kurti with wooden button neck detail.', 1100, NULL, 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=700&q=80', 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=700&q=80', 'KB-SHK-06', 0);

INSERT OR IGNORE INTO product_variants (product_id, size, stock_qty) VALUES
(6, 'S', 0),
(6, 'M', 0),
(6, 'L', 0);
