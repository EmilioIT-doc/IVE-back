-- Ofertas y cupones.

-- 1) Precio "antes": si existe, la tienda muestra  $599 tachado → $449 (-25%).
--    Siempre debe ser MAYOR que el precio actual (si no, no es oferta).
ALTER TABLE products
  ADD COLUMN compare_at_cents INTEGER
  CHECK (compare_at_cents IS NULL OR compare_at_cents > price_cents);

-- 2) Cupones: un código que da un descuento sobre el subtotal de la bolsa.
CREATE TABLE coupons (
  id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{3,30}$'), -- siempre en MAYÚSCULAS
  description         TEXT,
  discount_type       TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  -- percent → 1 a 100 (%) · fixed → centavos ($100 = 10000)
  discount_value      INTEGER NOT NULL CHECK (discount_value > 0),
  min_subtotal_cents  INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal_cents >= 0),
  max_uses            INTEGER CHECK (max_uses IS NULL OR max_uses > 0),      -- NULL = sin límite
  uses_count          INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  per_user_limit      INTEGER CHECK (per_user_limit IS NULL OR per_user_limit > 0), -- NULL = sin límite
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CHECK (max_uses IS NULL OR uses_count <= max_uses), -- la base misma impide pasarse de usos
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3) El pedido guarda qué cupón se usó y cuánto se descontó (copia, como los precios).
ALTER TABLE orders
  ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  ADD COLUMN coupon_id      BIGINT REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN coupon_code    TEXT;

-- La regla del total cambia: subtotal − descuento + envío
ALTER TABLE orders DROP CONSTRAINT orders_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_total_matches CHECK (total_cents = subtotal_cents - discount_cents + shipping_cents),
  ADD CONSTRAINT orders_discount_not_above_subtotal CHECK (discount_cents <= subtotal_cents);

-- "¿Cuántas veces usó este cupón esta persona?"
CREATE INDEX idx_orders_coupon_user ON orders (coupon_id, user_id) WHERE coupon_id IS NOT NULL;
