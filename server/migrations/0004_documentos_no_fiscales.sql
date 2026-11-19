-- ============================================================
-- Comprobantes NO fiscales del módulo de compras.
-- Se guardan aparte de `compras_documentos` para que NUNCA entren
-- al Libro de Compras ni a los reportes de retenciones del SENIAT.
-- ============================================================

CREATE TABLE IF NOT EXISTS documentos_no_fiscales (
  uid             TEXT PRIMARY KEY,
  numero          TEXT NOT NULL DEFAULT '',
  fecha           DATE NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'Recibo',
  rif             TEXT NOT NULL DEFAULT '',
  proveedor       TEXT NOT NULL DEFAULT '',
  concepto        TEXT NOT NULL DEFAULT '',
  monto           NUMERIC(14,2) NOT NULL DEFAULT 0,
  codigo_cuenta   TEXT NOT NULL DEFAULT '',
  no_deducible    BOOLEAN NOT NULL DEFAULT TRUE,
  notas           TEXT NOT NULL DEFAULT '',
  archivo_nombre  TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documentos_no_fiscales_fecha ON documentos_no_fiscales(fecha);
CREATE INDEX IF NOT EXISTS idx_documentos_no_fiscales_numero ON documentos_no_fiscales(numero);
CREATE INDEX IF NOT EXISTS idx_documentos_no_fiscales_rif ON documentos_no_fiscales(rif);
CREATE INDEX IF NOT EXISTS idx_documentos_no_fiscales_tipo ON documentos_no_fiscales(tipo);

DROP TRIGGER IF EXISTS update_documentos_no_fiscales_updated_at ON documentos_no_fiscales;
CREATE TRIGGER update_documentos_no_fiscales_updated_at
  BEFORE UPDATE ON documentos_no_fiscales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
