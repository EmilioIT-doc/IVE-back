-- El checkout deja elegir envío estándar o express; lo guardamos en la orden.
ALTER TABLE orders
  ADD COLUMN shipping_method TEXT NOT NULL DEFAULT 'standard'
  CHECK (shipping_method IN ('standard', 'express'));
