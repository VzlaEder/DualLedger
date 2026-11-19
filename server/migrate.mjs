// ============================================================ 
// DualLedger - Migraciones versionadas (API)
// ============================================================
// Uso:
//   node migrate.mjs            aplica las migraciones pendientes
//   node migrate.mjs --status   solo muestra el estado
//
// Cada archivo en server/migrations/ se aplica una sola vez, dentro
// de su propia transacción, y queda registrado en schema_migrations.
// ============================================================

import { readdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

config({ path: join(__dirname, '.env') })
config({ path: join(__dirname, '..', '.env') })

const MIGRATION_TABLE = 'schema_migrations'
const ADVISORY_LOCK_ID = 724_113_001

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      version    TEXT PRIMARY KEY,
      checksum   TEXT NOT NULL DEFAULT '',
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

async function appliedVersions(client) {
  const { rows } = await client.query(
    `SELECT version, checksum, applied_at FROM ${MIGRATION_TABLE} ORDER BY version`
  )
  return rows
}

function checksum(text) {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return h.toString(16)
}

// Acepta un Pool o un Client de pg.
async function withClient(db, fn) {
  if (db && typeof db.end === 'function') {
    const client = await db.connect()
    try {
      return await fn(client)
    } finally {
      client.release()
    }
  }
  return fn(db)
}

export async function runMigrations(db, { log = console.log } = {}) {
  const files = listMigrationFiles()
  const result = { applied: [], skipped: [], changed: [] }

  await withClient(db, async (client) => {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID])
    try {
      await ensureMigrationTable(client)

      const done = await appliedVersions(client)
      const doneMap = new Map(done.map((r) => [r.version, r.checksum]))

      for (const file of files) {
        const version = file.replace(/\.sql$/, '')
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
        const sum = checksum(sql)

        if (doneMap.has(version)) {
          if (doneMap.get(version) !== sum) {
            result.changed.push(version)
            log(`[migrate] AVISO: ${version} ya aplicada pero su contenido cambió`)
          } else {
            result.skipped.push(version)
          }
          continue
        }

        try {
          await client.query('BEGIN')
          await client.query(sql)
          await client.query(
            `INSERT INTO ${MIGRATION_TABLE} (version, checksum) VALUES ($1, $2)`,
            [version, sum]
          )
          await client.query('COMMIT')
          result.applied.push(version)
          log(`[migrate] aplicada ${version}`)
        } catch (e) {
          await client.query('ROLLBACK')
          throw new Error(`Falló la migración ${version}: ${e.message}`)
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => {})
    }
  })

  if (!result.applied.length) {
    log(`[migrate] Sin migraciones pendientes (${result.skipped.length} ya aplicadas)`)
  }
  return result
}

export async function migrationStatus(db, { log = console.log } = {}) {
  return withClient(db, async (client) => {
    await ensureMigrationTable(client)
    const done = await appliedVersions(client)
    const files = listMigrationFiles()
    const doneMap = new Map(done.map((r) => [r.version, r]))
    for (const file of files) {
      const version = file.replace(/\.sql$/, '')
      const row = doneMap.get(version)
      log(`  ${row ? '✓' : '·'} ${version}${row ? ` (${new Date(row.applied_at).toISOString()})` : ' - pendiente'}`)
    }
    return done
  })
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('[migrate] Falta DATABASE_URL')
    process.exit(1)
  }
  const { Pool } = pg
  const pool = new Pool({ connectionString: url, max: 1 })
  try {
    if (process.argv.includes('--status')) {
      await migrationStatus(pool)
    } else {
      await runMigrations(pool)
    }
  } catch (e) {
    console.error('[migrate] Error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/migrate.mjs')
if (invokedDirectly) main()
