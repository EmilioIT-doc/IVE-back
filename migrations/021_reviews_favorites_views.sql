-- Reseñas (la tabla ya existía desde la 010), favoritos y contador de vistas.

-- 1) Reseñas: título opcional, moderación y fecha de edición
ALTER TABLE reviews
  ADD COLUMN title      TEXT CHECK (title IS NULL OR char_length(title) <= 80),
  ADD COLUMN is_hidden  BOOLEAN NOT NULL DEFAULT FALSE, -- el admin puede ocultarla
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE reviews
  ADD CONSTRAINT reviews_comment_length CHECK (comment IS NULL OR char_length(comment) <= 2000);

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Índice parcial: la ficha solo lee las visibles, de la más nueva a la más vieja
CREATE INDEX idx_reviews_product_visible ON reviews (product_id, created_at DESC) WHERE NOT is_hidden;

-- 2) Favoritos: la llave primaria compuesta impide guardar dos veces el mismo producto
CREATE TABLE favorites (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX idx_favorites_product ON favorites (product_id);

-- 3) Vistas públicas de cada producto (INTEGER aguanta ~2,100 millones)
ALTER TABLE products ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0);
