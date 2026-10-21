// ============================================================
// DualLedger - Inicialización automática de la base de datos
// ============================================================
// Se ejecuta antes de `npm run dev` y `npm start` (hooks predev /
// prestart). Aplica las migraciones pendientes de server/migrations/
// (idempotente: se puede correr todas las veces que quieras).
//
// Si no hay DATABASE_URL o PostgreSQL no responde, avisa y termina
// con código 0: la app sigue funcionando, solo sin base de datos.
// ============================================================

import { config } from 'dotenv'
import pg from 'pg'
import { readEnvUrl, ROOT_DIR } from './dbAdmin.mjs'
import { runMigrations } from './migrate.mjs'
import { join } from 'path'

config({ path: join(ROOT_DIR, 'server', '.env') })
config({ path: join(ROOT_DIR, '.env') })

const url = readEnvUrl() || process.env.DATABASE_URL
if (!url) {
  console.warn('[init-db] DATABASE_URL no definido - se omite la inicialización (sin base de datos)')
  process.exit(0)
}

const pool = new pg.Pool({ connectionString: url, max: 1 })

try {
  await runMigrations(pool)
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM rif_cache')
  console.log(`[init-db] ✔ Base de datos lista (rif_cache: ${rows[0].n} fila(s))`)
} catch (e) {
  console.warn(`[init-db] No se pudo inicializar la BD (${e.message}). La app seguirá sin base de datos.`)
} finally {
  await pool.end().catch(() => {})
}
