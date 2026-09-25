-- Órdenes de compra.
CREATE TABLE orders (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  subtotal_cents    INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents    INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  total_cents       INTEGER NOT NULL CHECK (total_cents >= 0),
  -- Copia (snapshot) de la dirección al momento de comprar.
  -- Si el usuario edita o borra su dirección después, la orden no cambia.
  shipping_address  JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (total_cents = subtotal_cents + shipping_cents)
);

-- Para "mis pedidos, del más reciente al más viejo".
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);

-- Renglones de la orden. Guardan COPIA del nombre, talla, color, SKU y precio:
-- si mañana cambia el precio del producto, la orden vieja conserva el de ese día.
CREATE TABLE order_items (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id        BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name      TEXT NOT NULL,
  sku               TEXT NOT NULL,
  size              TEXT NOT NULL,
  color             TEXT NOT NULL,
  unit_price_cents  INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  -- Columna GENERADA: Postgres la calcula sola y nunca se desincroniza.
  line_total_cents  INTEGER GENERATED ALWAYS AS (unit_price_cents * quantity) STORED
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);
