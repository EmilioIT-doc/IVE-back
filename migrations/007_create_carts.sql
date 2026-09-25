-- Carrito de usuarios registrados. El carrito de invitado vive en el
-- front (localStorage) y se sincroniza aquí al iniciar sesión.
CREATE TABLE carts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Llave primaria COMPUESTA: la misma variante no puede aparecer dos veces
-- en el mismo carrito; si el usuario agrega otra, se sube la cantidad.
CREATE TABLE cart_items (
  cart_id     BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id  BIGINT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cart_id, variant_id)
);

CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);
