-- ============================================================
-- DualLedger - Schema de base de datos para Supabase
-- ============================================================
-- Ejecutar este SQL en el SQL Editor de Supabase:
-- https://supabase.com/dashboard → tu proyecto → SQL Editor → New query
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
-- RLS (Row Level Security) - Deshabilitado por ahora
-- Habilitar si se necesita autenticación por empresa
-- ============================================================
ALTER TABLE rif_cache ENABLE ROW LEVEL SECURITY;

-- Policy: permitir todo a usuarios autenticados (ajustar según necesidad)
CREATE POLICY "Allow all for authenticated users" ON rif_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Datos de ejemplo (opcional, para probar)
-- ============================================================
INSERT INTO rif_cache (rif, nombre_razon, porcentaje_contribucion, condicion)
VALUES
  ('J070080752', 'SIDERURGICA ZULIANA, C.A.', 75, 'Contribuyente Ordinario del IVA y Agente de Retención del IVA')
ON CONFLICT (rif) DO NOTHING;
