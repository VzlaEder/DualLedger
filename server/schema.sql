-- ============================================================
-- DualLedger - Schema de base de datos (PostgreSQL)
-- ============================================================
-- Ejecutar contra cualquier PostgreSQL (local, VPS o Docker):
--
--   Opción A (Docker, ver docker-compose.yml en la raíz):
--     docker compose up -d
--     # el schema se aplica automáticamente en el primer arranque
--
--   Opción B (Postgres instalado localmente):
--     createdb dualledger
--     psql -d dualledger -f server/schema.sql
--
-- ============================================================

-- Tabla de cache de RIFs verificados en el SENIAT
CREATE TABLE IF NOT EXISTS rif_cache (
  rif TEXT PRIMARY KEY,
  nombre_razon TEXT NOT NULL DEFAULT '',
  porcentaje_contribucion INTEGER,
  condicion TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por RIF (ya es PRIMARY KEY, pero por si acaso)
CREATE INDEX IF NOT EXISTS idx_rif_cache_rif ON rif_cache(rif);

-- Índice para limpieza de cachés antiguos
CREATE INDEX IF NOT EXISTS idx_rif_cache_updated ON rif_cache(updated_at);

-- ============================================================
-- Función para actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en cada UPDATE
DROP TRIGGER IF EXISTS update_rif_cache_updated_at ON rif_cache;
CREATE TRIGGER update_rif_cache_updated_at
  BEFORE UPDATE ON rif_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Datos de ejemplo (opcional, para probar)
-- ============================================================
INSERT INTO rif_cache (rif, nombre_razon, porcentaje_contribucion, condicion)
VALUES
  ('J070080752', 'SIDERURGICA ZULIANA, C.A.', 75, 'Contribuyente Ordinario del IVA y Agente de Retención del IVA')
ON CONFLICT (rif) DO NOTHING;

-- ============================================================
-- Maestros contables (Fase 1: módulo de compras)
-- ============================================================

-- Plan de cuentas contables (jerárquico hasta nivel 5, ej. 1.1.1.01.001)
CREATE TABLE IF NOT EXISTS cuentas_contables (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  nivel SMALLINT NOT NULL DEFAULT 1,
  codigo_padre TEXT,
  grupo TEXT,
  grupo_nombre TEXT NOT NULL DEFAULT '',
  es_movimiento BOOLEAN NOT NULL DEFAULT FALSE,
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  debe NUMERIC(14,2) NOT NULL DEFAULT 0,
  haber NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_final NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cuentas_nivel ON cuentas_contables(nivel);
CREATE INDEX IF NOT EXISTS idx_cuentas_padre ON cuentas_contables(codigo_padre);
CREATE INDEX IF NOT EXISTS idx_cuentas_grupo ON cuentas_contables(grupo);
CREATE INDEX IF NOT EXISTS idx_cuentas_movimiento ON cuentas_contables(es_movimiento);

DROP TRIGGER IF EXISTS update_cuentas_contables_updated_at ON cuentas_contables;
CREATE TRIGGER update_cuentas_contables_updated_at
  BEFORE UPDATE ON cuentas_contables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Conceptos de retención de ISLR (código SENIAT, %, sustraendo y base mínima en UT)
CREATE TABLE IF NOT EXISTS conceptos_islr (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  porcentaje NUMERIC(6,2) NOT NULL DEFAULT 0,
  sustraendo_ut NUMERIC(12,4) NOT NULL DEFAULT 0,
  base_minima_ut NUMERIC(12,4) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conceptos_islr_activo ON conceptos_islr(activo);

-- Maestro de proveedores (validación SENIAT, retenciones y cuenta contable asignada)
CREATE TABLE IF NOT EXISTS proveedores (
  rif TEXT PRIMARY KEY,
  nombre TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  porcentaje_ret_iva NUMERIC(5,2) NOT NULL DEFAULT 75,
  concepto_islr TEXT,
  codigo_cuenta TEXT,
  credito_fiscal_no_deducible BOOLEAN NOT NULL DEFAULT FALSE,
  condicion TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_proveedores_cuenta ON proveedores(codigo_cuenta);

DROP TRIGGER IF EXISTS update_proveedores_updated_at ON proveedores;
CREATE TRIGGER update_proveedores_updated_at
  BEFORE UPDATE ON proveedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Parámetros genéricos en JSONB (empresa, unidad tributaria, tasas, meta de importación)
CREATE TABLE IF NOT EXISTS parametros (
  clave TEXT PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}::jsonb',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_parametros_updated_at ON parametros;
CREATE TRIGGER update_parametros_updated_at
  BEFORE UPDATE ON parametros
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Numeradores de comprobantes fiscales (periodo AAAAMM + último correlativo)
CREATE TABLE IF NOT EXISTS numeradores_serie (
  tipo TEXT PRIMARY KEY,
  periodo TEXT NOT NULL,
  ultimo BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registros de compra sincronizados desde IndexedDB (offline-first, payload completo en JSONB)
CREATE TABLE IF NOT EXISTS compras (
  uid TEXT PRIMARY KEY,
  fecha TEXT NOT NULL DEFAULT '',
  rif TEXT NOT NULL DEFAULT '',
  proveedor TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}::jsonb',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
CREATE INDEX IF NOT EXISTS idx_compras_rif ON compras(rif);
CREATE INDEX IF NOT EXISTS idx_compras_updated ON compras(updated_at);

DROP TRIGGER IF EXISTS update_compras_updated_at ON compras;
CREATE TRIGGER update_compras_updated_at
  BEFORE UPDATE ON compras
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();