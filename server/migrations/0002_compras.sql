-- ============================================================
-- DualLedger - Migración 0002_compras_documentos
-- ============================================================
-- Libro de Compras SENIAT. Las 25 columnas del libro se guardan
-- como columnas reales (no dentro de un JSONB) para poder filtrar,
-- ordenar y totalizar en SQL.
--
-- Orden de columnas (idéntico a src/utils/excelTemplate.js):
--   1  nro                    Nro.
--   2  fecha                  Fecha
--   3  rif                    Rif
--   4  nombre_razon           Nombre o Razon Social
--   5  nro_factura            Nro. Factura
--   6  nro_control            Nro. Control
--   7  nro_nota_debito        Nro. Nota de Debito
--   8  nro_nota_credito       Nro. Nota de Credito
--   9  tipo_transaccion       Tipo de Transaccion
--   10 nro_factura_afectada   Nro. Factura Afectada
--   11 total_compras_iva      Total de Compras Incluyendo IVA
--   12 no_gravadas            No Gravadas
--   13 base_nacional          Base Imponible Nac.
--   14 alicuota_nac           Alicuota Nac.
--   15 credito_fiscal_nac     Credito Fiscal Nac.
--   16 base_importacion       Base Imponible Imp.
--   17 alicuota_imp           Alicuota Imp.
--   18 credito_fiscal_imp     Credito Fiscal Imp.
--   19 num_expediente         Numero Expediente Import.
--   20 num_planilla           Numero Planilla Import.
--   21 fecha_planilla         Fecha Planilla Import.
--   22 ret_iva                Ret IVA
--   23 comprobante_iva        Comprobante IVA
--   24 fecha_iva              Fecha IVA
--   25 igtf                   (3%) IGTF
-- ============================================================

CREATE TABLE IF NOT EXISTS compras_documentos (
  uid TEXT PRIMARY KEY,

  -- 1..25: columnas del Libro de Compras
  nro                    INTEGER,
  fecha                  DATE,
  rif                    TEXT NOT NULL DEFAULT '',
  nombre_razon           TEXT NOT NULL DEFAULT '',
  nro_factura            TEXT NOT NULL DEFAULT '',
  nro_control            TEXT NOT NULL DEFAULT '',
  nro_nota_debito        TEXT NOT NULL DEFAULT '',
  nro_nota_credito       TEXT NOT NULL DEFAULT '',
  tipo_transaccion       TEXT NOT NULL DEFAULT '01 -Reg',
  nro_factura_afectada   TEXT NOT NULL DEFAULT '',
  total_compras_iva      NUMERIC(14,2) NOT NULL DEFAULT 0,
  no_gravadas            NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_nacional          NUMERIC(14,2) NOT NULL DEFAULT 0,
  alicuota_nac           NUMERIC(6,2) NOT NULL DEFAULT 16,
  credito_fiscal_nac     NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_importacion       NUMERIC(14,2) NOT NULL DEFAULT 0,
  alicuota_imp           NUMERIC(6,2) NOT NULL DEFAULT 16,
  credito_fiscal_imp     NUMERIC(14,2) NOT NULL DEFAULT 0,
  num_expediente         TEXT NOT NULL DEFAULT '',
  num_planilla           TEXT NOT NULL DEFAULT '',
  fecha_planilla         DATE,
  ret_iva                NUMERIC(14,4) NOT NULL DEFAULT 0,
  comprobante_iva        TEXT NOT NULL DEFAULT '',
  fecha_iva              DATE,
  igtf                   NUMERIC(14,4) NOT NULL DEFAULT 0,

  -- Datos internos (no forman parte del libro exportado)
  tipo_documento         TEXT NOT NULL DEFAULT 'factura',
  porcentaje_contribucion NUMERIC(5,2),
  condicion              TEXT NOT NULL DEFAULT '',
  proveedor_rif          TEXT,
  codigo_cuenta          TEXT,
  dias_credito           INTEGER NOT NULL DEFAULT 0,
  concepto_islr          TEXT NOT NULL DEFAULT '',
  estado                 TEXT NOT NULL DEFAULT 'BORRADOR',
  origen                 TEXT NOT NULL DEFAULT 'ocr',
  origen_archivo         TEXT NOT NULL DEFAULT '',
  motor_ocr              TEXT NOT NULL DEFAULT '',
  notas                  TEXT NOT NULL DEFAULT '',
  numero_maquina_fiscal  TEXT NOT NULL DEFAULT '',
  -- Enlace opcional: una fila de retencion (Ret IVA) puede apuntar a
  -- la fila de la factura a la que se retuvo.
  documento_padre_uid    TEXT REFERENCES compras_documentos(uid) ON DELETE SET NULL,
  payload                JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT compras_documentos_estado_chk
    CHECK (estado IN ('BORRADOR', 'VALIDADO', 'ENVIADO', 'ANULADO'))
);

CREATE INDEX IF NOT EXISTS idx_compras_documentos_fecha ON compras_documentos(fecha);
CREATE INDEX IF NOT EXISTS idx_compras_documentos_rif ON compras_documentos(rif);
CREATE INDEX IF NOT EXISTS idx_compras_documentos_proveedor ON compras_documentos(proveedor_rif);
CREATE INDEX IF NOT EXISTS idx_compras_documentos_estado ON compras_documentos(estado);
CREATE INDEX IF NOT EXISTS idx_compras_documentos_control ON compras_documentos(nro_control);
CREATE INDEX IF NOT EXISTS idx_compras_documentos_padre ON compras_documentos(documento_padre_uid);
CREATE INDEX IF NOT EXISTS idx_compras_documentos_updated ON compras_documentos(updated_at);

DROP TRIGGER IF EXISTS update_compras_documentos_updated_at ON compras_documentos;
CREATE TRIGGER update_compras_documentos_updated_at
  BEFORE UPDATE ON compras_documentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Extensión del maestro de proveedores con los datos que el
-- paso 1 necesita para auto-completar una compra.
-- ============================================================
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS dias_credito INTEGER NOT NULL DEFAULT 0;

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS direccion_fiscal TEXT NOT NULL DEFAULT '';
