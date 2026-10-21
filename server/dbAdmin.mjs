// ============================================================
// DualLedger - Administración de la base de datos (provisional)
// ============================================================
// Centraliza las operaciones administrativas usadas por /api/admin:
//   - creación del pool en caliente (sin reiniciar el servidor)
//   - lectura/escritura de la DATABASE_URL en el .env de la raíz
//   - levantar/detener el PostgreSQL local vía Docker
//   - aplicar server/schema.sql (idempotente)
//   - introspección de tablas (information_schema)
//   - lectura, inserción, actualización y borrado de filas
// ============================================================

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = join(__dirname, '..')
export const ENV_PATH = join(ROOT_DIR, '.env')
export const SCHEMA_PATH = join(__dirname, 'schema.sql')
export const DEFAULT_LOCAL_URL = 'postgres://dualledger:dualledger@localhost:5432/dualledger'

const execFileP = promisify(execFile)

// --- Pool ---

// pg entrega DATE/TIMESTAMP como objetos Date (hora local), lo que obliga a
// conversiones en cada consulta. Se devuelven como texto ISO sin sorpresas.
pg.types.setTypeParser(1082, (v) => v)  // DATE
pg.types.setTypeParser(1114, (v) => v)  // TIMESTAMP WITHOUT TIME ZONE

export function createPool(url) {
  const { Pool } = pg
  return new Pool({ connectionString: url, max: 5 })
}

// --- .env ---

export function readEnvUrl() {
  try {
    const content = readFileSync(ENV_PATH, 'utf8')
    const m = content.match(/^\s*DATABASE_URL\s*=\s*(.*?)\s*$/m)
    if (!m) return null
    let v = m[1].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    return v || null
  } catch {
    return null
  }
}

export function writeEnvUrl(url) {
  const line = `DATABASE_URL=${url}`
  let content = ''
  try {
    content = readFileSync(ENV_PATH, 'utf8')
  } catch {
    content = ''
  }
  if (/^\s*DATABASE_URL\s*=/m.test(content)) {
    content = content.replace(/^\s*DATABASE_URL\s*=.*$/m, line)
  } else {
    content = (content.trimEnd() ? content.trimEnd() + '\n' : '') + line + '\n'
  }
  return writeEnv(content)
}

function writeEnv(content) {
  writeFileSync(ENV_PATH, content, 'utf8')
  return content
}

// --- Conexión de prueba y schema ---

export async function testConnection(url) {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 8000 })
  try {
    await client.connect()
    await client.query('SELECT 1')
  } finally {
    await client.end().catch(() => {})
  }
}

export async function applySchema(db) {
  // Aplica las migraciones versionadas de server/migrations/.
  const { runMigrations } = await import('./migrate.mjs')
  return runMigrations(db, { log: () => {} })
}

// --- Docker ---

export async function dockerAvailable() {
  try {
    await execFileP('docker', ['--version'], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

export async function dockerComposeUp(timeoutMs = 120000) {
  return execFileP(
    'docker',
    ['compose', 'up', '-d', '--wait'],
    { cwd: ROOT_DIR, windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }
  )
}

export async function dockerComposeDown(timeoutMs = 60000) {
  return execFileP(
    'docker',
    ['compose', 'down'],
    { cwd: ROOT_DIR, windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 }
  )
}

// --- Validación de identificadores (anti SQL injection) ---

export function validName(name) {
  return typeof name === 'string' && /^[a-z_][a-z0-9_]*$/.test(name)
}

// --- Introspección ---

export async function listTables(pool) {
  const { rows } = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  )
  const out = []
  for (const r of rows) {
    const name = r.table_name
    if (!validName(name)) continue
    const c = await pool.query(`SELECT count(*)::int AS n FROM ${name}`)
    out.push({ name, rows: c.rows[0].n })
  }
  return out
}

export async function tableInfo(pool, name) {
  if (!validName(name)) throw new Error(`Nombre de tabla no válido: ${name}`)
  const cols = await pool.query(
    `SELECT column_name, data_type, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [name]
  )
  const pks = await pool.query(
    `SELECT a.attname AS column_name
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary`,
    [name]
  )
  const pkSet = new Set(pks.rows.map((r) => r.column_name))
  return {
    name,
    columns: cols.rows.map((c) => ({
      name: c.column_name,
      dataType: c.data_type,
      udtName: c.udt_name,
      isNullable: c.is_nullable === 'YES',
      isPk: pkSet.has(c.column_name)
    })),
    pk: pks.rows.map((r) => r.column_name)
  }
}

export async function totalRows(pool, name) {
  if (!validName(name)) throw new Error(`Nombre de tabla no válido: ${name}`)
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${name}`)
  return rows[0].n
}

export async function fetchRows(pool, name, { limit = 100, offset = 0, order } = {}) {
  if (!validName(name)) throw new Error(`Nombre de tabla no válido: ${name}`)
  const l = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500)
  const o = Math.max(parseInt(offset, 10) || 0, 0)
  const col = order && validName(order) ? order : null
  const sql = `SELECT * FROM ${name}${col ? ` ORDER BY ${col}` : ' ORDER BY 1'} LIMIT ${l} OFFSET ${o}`
  const { rows } = await pool.query(sql)
  return rows
}

export async function selectAll(pool, name) {
  if (!validName(name)) throw new Error(`Nombre de tabla no válido: ${name}`)
  const { rows } = await pool.query(`SELECT * FROM ${name} LIMIT 200000`)
  return rows
}

// --- Coerción de valores según el tipo de columna ---

export function coerceValue(value, dataType) {
  if (value === null || value === undefined || value === '') return null
  const t = String(dataType || '').toUpperCase()
  if (t.includes('BOOL')) {
    if (typeof value === 'boolean') return value
    const s = String(value).toLowerCase()
    return ['true', 't', '1', 'yes', 'y', 'on'].includes(s)
      ? true
      : ['false', 'f', '0', 'no', 'n', 'off'].includes(s)
        ? false
        : Boolean(value)
  }
  if (t.includes('JSON')) {
    if (typeof value === 'string') {
      try { return JSON.parse(value) } catch {
        throw new Error(`Valor JSON no válido para la columna (${String(value).slice(0, 60)})`)
      }
    }
    return value
  }
  if (t.includes('INT') || t.includes('NUMERIC') || t.includes('DOUBLE') || t.includes('REAL')) {
    if (typeof value === 'number') return value
    const s = String(value).replace(/,/g, '.')
    const n = Number(s)
    if (Number.isNaN(n)) throw new Error(`Valor numérico no válido: ${value}`)
    return t.includes('INT') ? Math.trunc(n) : n
  }
  return String(value)
}

// --- CRUD sobre filas ---

export async function insertRow(pool, info, row) {
  const known = new Set(info.columns.map((c) => c.name))
  const entries = Object.entries(row)
    .filter(([k, v]) => known.has(k) && !(v === null && (k === 'created_at' || k === 'updated_at')))
  if (!entries.length) throw new Error('No hay columnas reconocidas para insertar')
  const cols = []
  const vals = []
  for (const [k, v] of entries) {
    const col = info.columns.find((c) => c.name === k)
    cols.push(`"${col.name}"`)
    vals.push(coerceValue(v, col.dataType))
  }
  const ph = vals.map((_, i) => `$${i + 1}`).join(', ')
  const { rows } = await pool.query(
    `INSERT INTO ${info.name} (${cols.join(', ')}) VALUES (${ph}) RETURNING *`,
    vals
  )
  return rows[0]
}

export async function updateRow(pool, info, keyVals, newRow) {
  const pkSet = new Set(info.pk)
  const known = new Set(info.columns.map((c) => c.name))
  const setVals = []
  const params = []
  for (const [k, v] of Object.entries(newRow)) {
    if (!known.has(k) || pkSet.has(k)) continue
    const col = info.columns.find((c) => c.name === k)
    setVals.push(`"${col.name}" = $${++params.length}`)
    params.push(coerceValue(v, col.dataType))
  }
  if (!setVals.length) throw new Error('No hay columnas para actualizar')
  const where = []
  for (const pk of info.pk) {
    if (keyVals[pk] === undefined) throw new Error(`Falta la clave primaria "${pk}"`)
    where.push(`"${pk}" = $${++params.length}`)
    params.push(coerceValue(keyVals[pk], info.columns.find((c) => c.name === pk)?.dataType || ''))
  }
  const { rows } = await pool.query(
    `UPDATE ${info.name} SET ${setVals.join(', ')} WHERE ${where.join(' AND ')} RETURNING *`,
    params
  )
  return rows[0] || null
}

export async function deleteRows(pool, info, keys) {
  if (!Array.isArray(keys) || !keys.length) throw new Error('Sin llaves para eliminar')
  const whereParts = []
  const params = []
  for (const key of keys) {
    const conds = []
    for (const pk of info.pk) {
      const v = key && key[pk]
      if (v === undefined || v === null) throw new Error(`Falta la clave primaria "${pk}"`)
      conds.push(`"${pk}" = $${++params.length}`)
      params.push(coerceValue(v, info.columns.find((c) => c.name === pk)?.dataType || ''))
    }
    whereParts.push(`(${conds.join(' AND ')})`)
  }
  const { rowCount } = await pool.query(
    `DELETE FROM ${info.name} WHERE ${whereParts.join(' OR ')}`,
    params
  )
  return rowCount || 0
}

export async function upsertRows(pool, info, rows) {
  if (!Array.isArray(rows) || !rows.length) return 0
  const pkSet = new Set(info.pk)
  const colNames = info.columns.filter((c) => !/serial/i.test(c.dataType) || pkSet.has(c.name)).map((c) => c.name)
  const entries = rows
    .map((row) => {
      const e = {}
      for (const c of colNames) {
        if (row[c] !== undefined && row[c] !== null) e[c] = coerceValue(row[c], info.columns.find((cc) => cc.name === c).dataType)
        else if ((c === 'created_at' || c === 'updated_at')) continue
      }
      return e
    })
    .filter((e) => Object.keys(e).length)

  if (!entries.length) throw new Error('No hay filas con columnas reconocidas')

  const conflict = info.pk.length ? ` ON CONFLICT (${info.pk.join(', ')}) DO UPDATE SET ` : ''
  let total = 0
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH)
    const allCols = new Set()
    batch.forEach((e) => Object.keys(e).forEach((k) => allCols.add(k)))
    const sorted = info.columns.filter((c) => allCols.has(c.name)).map((c) => c.name)
    const values = []
    const rowsPh = batch.map((e) => `(${sorted.map((c) => {
      values.push(coerceValue(e[c], info.columns.find((cc) => cc.name === c).dataType))
      return `$${values.length}`
    }).join(', ')})`)
    let sql = `INSERT INTO ${info.name} (${sorted.map((c) => `"${c}"`).join(', ')}) VALUES ${rowsPh.join(', ')}`
    if (conflict) {
      const setCols = sorted.filter((c) => !pkSet.has(c.name) && c !== 'created_at' && c !== 'updated_at')
      if (setCols.length) {
        sql += conflict + setCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
      } else {
        sql += ` ON CONFLICT (${info.pk.join(', ')}) DO NOTHING`
      }
    }
    const { rowCount } = await pool.query(sql, values)
    total += rowCount || 0
  }
  return total
}