-- Fotos "fijas" del sitio que el admin puede cambiar desde el panel.
-- Cada lugar (slot) tiene una sola foto:
--   home_hero       → la portada grande del inicio (a la derecha de "Lo esencial, bien hecho.")
--   home_editorial  → la foto del bloque editorial, arriba del footer
CREATE TABLE site_images (
  slot       TEXT PRIMARY KEY CHECK (slot ~ '^[a-z_]+$'),
  url        TEXT,           -- NULL = se muestra el bloque de color de siempre
  alt_text   TEXT,           -- descripción para lectores de pantalla
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_site_images_updated_at
  BEFORE UPDATE ON site_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO site_images (slot) VALUES ('home_hero'), ('home_editorial');

-- Las subidas pesadas ahora también pueden ir a uno de estos lugares.
ALTER TABLE upload_sessions
  ADD COLUMN site_slot TEXT REFERENCES site_images(slot) ON DELETE CASCADE;

-- Exactamente UN destino: producto, categoría o lugar del sitio
ALTER TABLE upload_sessions DROP CONSTRAINT upload_sessions_one_target;
ALTER TABLE upload_sessions
  ADD CONSTRAINT upload_sessions_one_target CHECK (num_nonnulls(product_id, category_id, site_slot) = 1);
