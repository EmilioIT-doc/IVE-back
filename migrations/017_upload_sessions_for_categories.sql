-- Las subidas pesadas ahora también sirven para la PORTADA de una categoría.
-- Cada sesión apunta a un producto O a una categoría (nunca a los dos, nunca a ninguno).
ALTER TABLE upload_sessions ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE upload_sessions
  ADD COLUMN category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
  -- URL final de la foto ya optimizada (sirve para los dos casos)
  ADD COLUMN result_url  TEXT,
  ADD CONSTRAINT upload_sessions_one_target CHECK ((product_id IS NULL) <> (category_id IS NULL));
