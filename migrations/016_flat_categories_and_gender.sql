-- Nuevo catálogo de IVE:
--   * Las categorías son el TIPO de prenda y ya no tienen padre:
--       T-shirts · Crop tops · Gym · Sudaderas   (el admin puede crear más)
--   * "Para quién" es un dato del PRODUCTO: unisex, hombre o mujer.
--     En la tienda, "Mujer" muestra lo de mujer + lo unisex (igual "Hombre").
--   * Cada categoría tiene portada (la foto que la representa en el home),
--     orden y si está visible.
--
-- Esta migración también convierte los datos que ya existían (Hombre/Mujer → género).

-- 1) Columnas nuevas ---------------------------------------------------------
ALTER TABLE categories
  ADD COLUMN cover_url  TEXT,
  ADD COLUMN position   INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  ADD COLUMN is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE products
  ADD COLUMN gender TEXT NOT NULL DEFAULT 'unisex'
  CHECK (gender IN ('unisex', 'hombre', 'mujer'));

-- 2) Las 4 categorías nuevas (si ya existen, no se duplican) -----------------
INSERT INTO categories (name, slug, position) VALUES
  ('T-shirts',  't-shirts',  0),
  ('Crop tops', 'crop-tops', 1),
  ('Gym',       'gym',       2),
  ('Sudaderas', 'sudaderas', 3)
ON CONFLICT (slug) DO NOTHING;

-- 3) El género sale de la categoría padre vieja (Hombre / Mujer) --------------
UPDATE products p SET gender = parent.slug
FROM categories c
JOIN categories parent ON parent.id = c.parent_id
WHERE p.category_id = c.id AND parent.slug IN ('hombre', 'mujer');

UPDATE products p SET gender = c.slug
FROM categories c
WHERE p.category_id = c.id AND c.slug IN ('hombre', 'mujer');

-- 4) Mover los productos a las categorías nuevas -----------------------------
-- Sudaderas → Sudaderas; todo lo demás (playeras, blusas, lo que sea) → T-shirts
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'sudaderas')
WHERE category_id IN (SELECT id FROM categories WHERE slug LIKE '%-sudaderas');

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 't-shirts')
WHERE category_id NOT IN (SELECT id FROM categories WHERE slug IN ('t-shirts', 'crop-tops', 'gym', 'sudaderas'));

-- 5) Productos de ejemplo del seed viejo: se borran ---------------------------
-- Si alguno ya tiene pedidos no se puede borrar (el pedido lo necesita): solo se oculta.
UPDATE products SET is_active = FALSE
WHERE slug IN ('playera-basica', 'playera-oversize', 'sudadera-con-capucha', 'pantalon-cargo',
               'blusa-de-lino', 'vestido-midi', 'jeans-mom-fit');

DELETE FROM products p
WHERE p.slug IN ('playera-basica', 'playera-oversize', 'sudadera-con-capucha', 'pantalon-cargo',
                 'blusa-de-lino', 'vestido-midi', 'jeans-mom-fit')
  AND NOT EXISTS (
    SELECT 1 FROM order_items oi
    JOIN product_variants v ON v.id = oi.variant_id
    WHERE v.product_id = p.id
  );

-- 6) Adiós categorías viejas y columna parent_id ------------------------------
DELETE FROM categories WHERE slug NOT IN ('t-shirts', 'crop-tops', 'gym', 'sudaderas');
ALTER TABLE categories DROP COLUMN parent_id;

-- 7) Portada inicial de T-shirts: la foto que ya estaba en el home -------------
UPDATE categories SET cover_url = '/products/born-to-die-blanco.jpg'
WHERE slug = 't-shirts' AND cover_url IS NULL;

CREATE INDEX idx_categories_position ON categories (position, id);
CREATE INDEX idx_products_gender ON products (gender);
