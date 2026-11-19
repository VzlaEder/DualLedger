-- ============================================================
-- DualLedger - Migración 0006_activos_fijos
-- Maestro de Activos Fijos del módulo de compras.
-- La depreciación NO se guarda: se deriva del costo, gastos
-- capitalizables, valor residual, vida útil y método.
-- ============================================================

CREATE TABLE IF NOT EXISTS activos_fijos (
  uid                          TEXT PRIMARY KEY,
  codigo                       TEXT NOT NULL DEFAULT '',
  descripcion                  TEXT NOT NULL DEFAULT '',
  categoria                    TEXT NOT NULL DEFAULT 'Otros',
  fecha_adquisicion            TEXT NOT NULL DEFAULT '',
  fecha_puesta_en_servicio     TEXT NOT NULL DEFAULT '',
  rif_proveedor                TEXT NOT NULL DEFAULT '',
  proveedor                    TEXT NOT NULL DEFAULT '',
  numero_factura               TEXT NOT NULL DEFAULT '',
  costo_adquisicion            NUMERIC(14,2) NOT NULL DEFAULT 0,
  gastos_capitalizables        NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_residual               NUMERIC(14,2) NOT NULL DEFAULT 0,
  vida_util_anos               INTEGER NOT NULL DEFAULT 0,
  metodo_depreciacion          TEXT NOT NULL DEFAULT 'Linea recta',
  tasa_depreciacion_anual      NUMERIC(8,4) NOT NULL DEFAULT 0,
  cuenta_activo                TEXT NOT NULL DEFAULT '',
  cuenta_depreciacion_acumulada TEXT NOT NULL DEFAULT '',
  cuenta_gasto_depreciacion    TEXT NOT NULL DEFAULT '',
  centro_costo                 TEXT NOT NULL DEFAULT '',
  ubicacion                    TEXT NOT NULL DEFAULT '',
  responsable                  TEXT NOT NULL DEFAULT '',
  estado                       TEXT NOT NULL DEFAULT 'Activo',
  observaciones                TEXT NOT NULL DEFAULT '',
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activos_fijos_codigo ON activos_fijos(codigo);
CREATE INDEX IF NOT EXISTS idx_activos_fijos_categoria ON activos_fijos(categoria);
CREATE INDEX IF NOT EXISTS idx_activos_fijos_estado ON activos_fijos(estado);
CREATE INDEX IF NOT EXISTS idx_activos_fijos_fecha ON activos_fijos(fecha_adquisicion);

DROP TRIGGER IF EXISTS update_activos_fijos_updated_at ON activos_fijos;
CREATE TRIGGER update_activos_fijos_updated_at
  BEFORE UPDATE ON activos_fijos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
