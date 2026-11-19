-- ============================================================
-- Campos de la ficha de proveedores del manual del módulo compras.
-- `direccion_fiscal` y `dias_credito` ya vienen en 0002_compras.sql.
-- ============================================================

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS codigo_validacion TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS clasificacion TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS extranjero BOOLEAN NOT NULL DEFAULT FALSE;
