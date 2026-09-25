-- Pagos de una orden (con el proveedor falso "mock" en local).
CREATE TABLE payments (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id             BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider             TEXT NOT NULL DEFAULT 'mock',
  provider_payment_id  TEXT UNIQUE,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  amount_cents         INTEGER NOT NULL CHECK (amount_cents > 0),
  -- Llave de idempotencia: si el cliente reintenta el mismo pago
  -- (doble clic, se cayó la red), no se cobra dos veces.
  idempotency_key      TEXT NOT NULL UNIQUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
