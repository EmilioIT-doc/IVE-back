-- "Mantener mi sesión iniciada": guardamos si el usuario lo marcó,
-- para respetar esa elección cada vez que se renueva (rota) el refresh token.
-- Nota: es una migración NUEVA; nunca se edita una migración ya aplicada.
ALTER TABLE refresh_tokens
  ADD COLUMN remember BOOLEAN NOT NULL DEFAULT FALSE;
