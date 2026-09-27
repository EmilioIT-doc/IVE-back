-- Registro con más datos y verificación con código (correo o SMS).

ALTER TABLE users
  ADD COLUMN phone       TEXT CHECK (phone IS NULL OR phone ~ '^[0-9]{10}$'),
  ADD COLUMN birth_date  DATE CHECK (birth_date IS NULL OR birth_date > DATE '1900-01-01'),
  -- NULL = todavía no confirma su código: no puede iniciar sesión
  ADD COLUMN verified_at TIMESTAMPTZ;

-- Las cuentas que ya existían (admin, demo y las tuyas) se dan por verificadas
UPDATE users SET verified_at = NOW() WHERE verified_at IS NULL;

-- Códigos de 6 dígitos. NUNCA se guarda el código tal cual: solo su hash (como las contraseñas).
CREATE TABLE verification_codes (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  destination  TEXT NOT NULL,          -- a qué correo / celular se mandó
  code_hash    TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,            -- se usó (o lo reemplazó uno nuevo)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "El código vigente de este usuario" y "cuántos le mandamos en la última hora"
CREATE INDEX idx_verification_codes_user ON verification_codes (user_id, created_at DESC);
