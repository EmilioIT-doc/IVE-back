-- Subidas de imágenes pesadas: cada archivo es una "sesión de subida".
--
-- 1. El front crea la sesión (status = 'uploading') y manda el archivo en pedazos (chunks).
--    received_bytes dice cuánto ya llegó: si se cae la conexión, se continúa desde ahí.
-- 2. Cuando llega completo, pasa a 'queued' (en cola).
-- 3. Un worker la toma ('processing'), la convierte a WebP optimizado y la agrega al producto ('ready').
--    Si la imagen no sirve → 'failed'. Si el admin la cancela → 'canceled'.
--
-- La cola vive en ESTA tabla: los workers toman trabajos con FOR UPDATE SKIP LOCKED,
-- así varios workers nunca agarran la misma imagen y no necesitamos Redis.
CREATE TABLE upload_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_by       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Archivos elegidos juntos forman un lote; seq es el orden en que los elegiste
  -- (la 1ª del lote queda antes que la 2ª aunque termine de procesarse después).
  batch_id         UUID NOT NULL,
  seq              INTEGER NOT NULL CHECK (seq >= 0),

  file_name        TEXT NOT NULL,
  mime_type        TEXT,
  -- INTEGER aguanta hasta ~2 GB; el back limita a 100 MB por archivo
  size_bytes       INTEGER NOT NULL CHECK (size_bytes > 0),
  received_bytes   INTEGER NOT NULL DEFAULT 0,

  status           TEXT NOT NULL DEFAULT 'uploading'
                   CHECK (status IN ('uploading', 'queued', 'processing', 'ready', 'failed', 'canceled')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  -- Mientras un worker procesa, renueva este "préstamo". Si el proceso muere,
  -- el préstamo vence y otro worker retoma la imagen.
  lease_expires_at TIMESTAMPTZ,

  error_code       TEXT,
  error_message    TEXT,
  image_id         BIGINT REFERENCES product_images(id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (received_bytes BETWEEN 0 AND size_bytes)
);

-- Índice parcial: solo contiene lo que está en la cola, así buscar trabajo es instantáneo
CREATE INDEX idx_upload_sessions_queue
  ON upload_sessions (created_at, seq)
  WHERE status IN ('queued', 'processing');

CREATE INDEX idx_upload_sessions_batch ON upload_sessions (batch_id);

CREATE TRIGGER trg_upload_sessions_updated_at
  BEFORE UPDATE ON upload_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
