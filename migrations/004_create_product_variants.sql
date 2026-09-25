-- Variantes: cada combinación de talla + color de un producto,
-- con su propio SKU, stock y (opcionalmente) su propio precio.
CREATE TABLE product_variants (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id   BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku          TEXT NOT NULL UNIQUE
               CHECK (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  size         TEXT NOT NULL,
  color        TEXT NOT NULL,
  -- NULL = usa el precio del producto
  price_cents  INTEGER CHECK (price_cents >= 0),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- No puede haber dos "Playera negra talla M" del mismo producto.
  -- Este UNIQUE también crea un índice que empieza por product_id,
  -- así que no hace falta otro índice aparte para esa columna.
  UNIQUE (product_id, size, color)
);
