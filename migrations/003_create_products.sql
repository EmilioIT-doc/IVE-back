CREATE TABLE products (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id  BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE
               CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description  TEXT,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category_id ON products(category_id);