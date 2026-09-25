-- Imágenes de un producto. Las fotos se guardan en disco (uploads/)
-- y aquí solo guardamos la ruta.
CREATE TABLE product_images (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt_text    TEXT,
  position    INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice compuesto: busca por producto y ya las devuelve ordenadas.
CREATE INDEX idx_product_images_product_position
  ON product_images(product_id, position);
