-- Direcciones de envío de cada usuario (formato México).
CREATE TABLE addresses (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name  TEXT NOT NULL,
  phone           TEXT NOT NULL CHECK (phone ~ '^[0-9]{10}$'),
  street          TEXT NOT NULL,
  ext_number      TEXT NOT NULL,
  int_number      TEXT,
  neighborhood    TEXT NOT NULL,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  postal_code     TEXT NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
  country         TEXT NOT NULL DEFAULT 'MX',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- Índice ÚNICO PARCIAL: solo aplica a las filas con is_default = TRUE.
-- Resultado: cada usuario puede tener muchas direcciones,
-- pero solo UNA marcada como predeterminada.
CREATE UNIQUE INDEX uq_addresses_one_default_per_user
  ON addresses(user_id)
  WHERE is_default;
