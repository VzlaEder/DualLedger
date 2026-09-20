// ============================================================
// DualLedger - Inicialización automática de la base de datos
// ============================================================
// Se ejecuta automáticamente antes de `npm run dev` y `npm start`
// (hooks predev / prestart). Conecta con DATABASE_URL y aplica
// server/schema.sql si hace falta (es idempotente: se puede correr
// todas las veces que quieras).
//
// Si no hay DATABASE_URL o PostgreSQL no responde, avisa y termina
// con código 0: la app sigue funcionando, solo sin caché compartida.
// ============================================================

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Carga el .env de la raíz del proyecto
config({ path: join(__dirname, '..', '.env') })

const url = process.env.DATABASE_URL
if (!url) {
  console.warn('[init-db] DATABASE_URL no definido - se omite la inicialización (sin caché compartida)')
  process.exit(0)
}

const client = new pg.Client({ connectionString: url })

try {
  await client.connect()
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  await client.query(sql)
  console.log('[init-db] ✔ Esquema de PostgreSQL aplicado/verificado (tabla rif_cache)')

  const { rows } = await client.query('SELECT count(*)::int AS n FROM rif_cache')
  console.log(`[init-db] rif_cache: ${rows[0].n} fila(s)`)
} catch (e) {
  console.warn(`[init-db] No se pudo inicializar la BD (${e.message}). El caché compartido se deshabilitará.`)
} finally {
  await client.end().catch(() => {})
}