-- ============================================================
-- DualLedger - Migración 0005_articulos
-- Maestro de Artículos del módulo de compras.
-- Según el manual, los artículos son las cuentas contables que
-- se seleccionan según el concepto de la factura a registrar.
-- C.C Compra / C.C Venta guardan ese vínculo con el plan de cuentas.
-- ============================================================

CREATE TABLE IF NOT EXISTS articulos (
  uid                 TEXT PRIMARY KEY,
  codigo              TEXT NOT NULL DEFAULT '',
  descripcion         TEXT NOT NULL DEFAULT '',
  nombre              TEXT NOT NULL DEFAULT '',
  tipo                TEXT NOT NULL DEFAULT 'Servicio',
  para_venta          BOOLEAN NOT NULL DEFAULT FALSE,
  iva                 TEXT NOT NULL DEFAULT 'No aplica',
  grupo_articulos     TEXT NOT NULL DEFAULT '',
  presentacion_modelo TEXT NOT NULL DEFAULT '',
  almacen_inicial     TEXT NOT NULL DEFAULT '',
  medida              TEXT NOT NULL DEFAULT '',
  factor_conversion   NUMERIC(12,4) NOT NULL DEFAULT 1,
  marca               TEXT NOT NULL DEFAULT '',
  precio_venta        NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock_maximo        NUMERIC(14,2) NOT NULL DEFAULT 0,
  stock_minimo        NUMERIC(14,2) NOT NULL DEFAULT 0,
  existencia          NUMERIC(14,2) NOT NULL DEFAULT 0,
  centro_costo_venta  TEXT NOT NULL DEFAULT '',
  centro_costo_compra TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articulos_codigo ON articulos(codigo);
CREATE INDEX IF NOT EXISTS idx_articulos_nombre ON articulos(nombre);
CREATE INDEX IF NOT EXISTS idx_articulos_tipo ON articulos(tipo);
CREATE INDEX IF NOT EXISTS idx_articulos_grupo ON articulos(grupo_articulos);

DROP TRIGGER IF EXISTS update_articulos_updated_at ON articulos;
CREATE TRIGGER update_articulos_updated_at
  BEFORE UPDATE ON articulos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
