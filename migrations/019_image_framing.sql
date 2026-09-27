-- "Encuadre" de las portadas (categorías y fotos del inicio), estilo foto de perfil de LinkedIn.
-- NO se recorta el archivo: guardamos cómo mostrarlo y el navegador lo aplica con CSS.
-- Así el mismo encuadre sirve en todos los tamaños (computadora, celular, mosaico) y
-- siempre se puede "Restablecer" sin volver a subir la foto.
--   zoom     1 = sin zoom … 3 = 3 veces más grande
--   focus_x  0 = pegado a la izquierda … 50 = centro … 100 = pegado a la derecha
--   focus_y  0 = arriba … 50 = centro … 100 = abajo
ALTER TABLE categories
  ADD COLUMN cover_zoom    REAL NOT NULL DEFAULT 1  CHECK (cover_zoom BETWEEN 1 AND 3),
  ADD COLUMN cover_focus_x REAL NOT NULL DEFAULT 50 CHECK (cover_focus_x BETWEEN 0 AND 100),
  ADD COLUMN cover_focus_y REAL NOT NULL DEFAULT 50 CHECK (cover_focus_y BETWEEN 0 AND 100);

ALTER TABLE site_images
  ADD COLUMN zoom    REAL NOT NULL DEFAULT 1  CHECK (zoom BETWEEN 1 AND 3),
  ADD COLUMN focus_x REAL NOT NULL DEFAULT 50 CHECK (focus_x BETWEEN 0 AND 100),
  ADD COLUMN focus_y REAL NOT NULL DEFAULT 50 CHECK (focus_y BETWEEN 0 AND 100);
