// ============================================================
// DualLedger - Exportación/importación de datos (sin dependencias)
// ============================================================
// Funciones puras usadas por las rutas /api/admin/export y /import:
//   - filas -> CSV (RFC 4180)
//   - filas -> JSON
//   - filas -> script SQL de INSERTs portables (CONFLICT DO NOTHING)
//   - catálogo completo -> script SQL (CREATE TABLE IF NOT EXISTS + INSERTs)
// ============================================================

// --- CSV (RFC 4180) ---

export function csvField(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

export function csvEscape(value) {
  const field = csvField(value)
  if (/[",\r\n]/.test(field)) {
    return '"' + field.replace(/"/g, '""') + '"'
  }
  return field
}

export function rowsToCsv(columns, rows) {
  const names = columns.map((c) => (typeof c === 'string' ? c : c.name))
  const header = names.map((n) => csvEscape(n)).join(',')
  const lines = rows.map((row) => names.map((n) => csvEscape(row[n])).join(','))
  return [header, ...lines].join('\r\n')
}

// --- JSON ---

export function rowsToJson(rows, pretty = true) {
  return JSON.stringify(rows, (k, v) => (v instanceof Date ? v.toISOString() : v), pretty ? 2 : 0)
}

// --- SQL literals ---

export function sqlLiteral(value, dataType) {
  if (value === null || value === undefined) return 'NULL'
  const t = String(dataType || '').toUpperCase()
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Valor numérico no válido')
    return String(value)
  }
  if (value instanceof Date) return `'${value.toISOString()}'`
  if (typeof value === 'object') {
    if (t.includes('JSON') || t.includes('BYTE')) {
      return `'${escapeSqlString(JSON.stringify(value))}'::${t.includes('BYTE') ? 'bytea' : 'jsonb'}`
    }
    return `'${escapeSqlString(JSON.stringify(value))}'::jsonb`
  }
  const s = String(value)
  if (t.includes('BOOL')) {
    const low = s.toLowerCase()
    if (['true', 't', '1', 'yes', 'y', 'on'].includes(low)) return 'TRUE'
    if (['false', 'f', '0', 'no', 'n', 'off'].includes(low)) return 'FALSE'
  }
  if (t.includes('JSON')) return `'${escapeSqlString(s)}'::jsonb`
  if (t.includes('TIMESTAMP') || t.includes('DATE')) return `'${escapeSqlString(s)}'`
  return `'${escapeSqlString(s)}'`
}

export function escapeSqlString(s) {
  return String(s).replace(/'/g, "''")
}

// --- INSERTs ---

export function rowsToInserts(table, columns, rows) {
  const names = columns.map((c) => (typeof c === 'string' ? c : c.name))
  const types = columns.map((c) => (typeof c === 'string' ? '' : c.dataType || c.udt_name || ''))
  if (!names.length) return `-- Tabla ${table} sin columnas`

  const colList = names.join(', ')
  const chunks = rows.map((row) => {
    const values = names.map((n, i) => sqlLiteral(row[n], types[i])).join(', ')
    return `(${values})`
  })
  if (!chunks.length) return `-- Tabla ${table}: sin filas para exportar`

  const blocks = []
  const BATCH = 200
  for (let i = 0; i < chunks.length; i += BATCH) {
    const values = chunks.slice(i, i + BATCH).join(',\n  ')
    blocks.push(`INSERT INTO ${table} (${colList}) VALUES\n  ${values}\nON CONFLICT DO NOTHING;`)
  }
  return blocks.join('\n\n')
}

// --- Catálogo completo ---

export function catalogToSql(tables) {
  const parts = [
    '-- ============================================================',
    '-- DualLedger - Exportación completa de la base de datos',
    '-- Generado: ' + new Date().toISOString(),
    '-- Compatible con PostgreSQL. Idempotente (re-ejecutable).',
    '-- ============================================================',
    ''
  ]
  for (const t of tables) {
    parts.push(columnsToCreate(t))
    parts.push('')
    parts.push(rowsToInserts(t.name, t.columns, t.rows))
    parts.push('')
  }
  return parts.join('\n')
}

export function columnsToCreate(table) {
  const t = table.name
  if (!table.columns || !table.columns.length) return `-- Tabla ${t}: sin columnas (se omite el CREATE)`

  const lines = table.columns.map((c) => {
    let def = `  "${c.name}" ${sqlDataType(c)}`
    if (!c.isNullable) def += ' NOT NULL'
    if (c.isPk) def += ' PRIMARY KEY'
    return def
  })
  return `CREATE TABLE IF NOT EXISTS ${t} (\n${lines.join(',\n')}\n);`
}

function sqlDataType(c) {
  const d = String(c.dataType || c.udt_name || '').toUpperCase()
  const map = {
    TEXT: 'TEXT',
    CHARACTER: 'TEXT',
    CHARACTER_VARYING: 'TEXT',
    'CHARACTER VARYING': 'TEXT',
    'VARCHAR': 'TEXT',
    INTEGER: 'INTEGER',
    BIGINT: 'BIGINT',
    SMALLINT: 'SMALLINT',
    NUMERIC: 'NUMERIC',
    DECIMAL: 'NUMERIC',
    REAL: 'REAL',
    DOUBLE_PRECISION: 'DOUBLE PRECISION',
    BOOLEAN: 'BOOLEAN',
    TIMESTAMPTZ: 'TIMESTAMPTZ',
    TIMESTAMP: 'TIMESTAMP',
    DATE: 'DATE',
    JSONB: 'JSONB',
    JSON: 'JSON',
    UUID: 'UUID',
    BYTEA: 'BYTEA'
  }
  if (map[d]) return map[d]
  if (d.includes('TIMESTAMP')) return 'TIMESTAMPTZ'
  if (d.includes('CHAR')) return 'TEXT'
  if (d.includes('INT')) return 'BIGINT'
  if (d.includes('NUMERIC') || d.includes('MONETARY')) return 'NUMERIC'
  if (d.includes('BOOL')) return 'BOOLEAN'
  if (d.includes('JSON')) return 'JSONB'
  return 'TEXT'
}

// --- CSV/JSON parsing para importación ---

export function parseCsv(content) {
  const text = String(content)
  // Quita un BOM si lo hay y normaliza fin de línea
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = []
  let cur = ''
  let inQuotes = false
  let lineStart = true
  const push = () => { lines.push(cur); cur = ''; }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cur += '\u0000'
    } else if (ch === '\n') {
      if (lineStart && cur === '' && i === src.length - 1) break
      push()
      lineStart = true
    } else {
      cur += ch
      lineStart = false
    }
  }
  if (cur !== '' || lines.length === 0) push()
  const rows = lines
    .filter((l) => l.trim() !== '')
    .map((l) => l.split('\u0000').map((f) => f.trim()))
  if (!rows.length) return { columns: [], rows: [] }
  const columns = rows.shift()
  return { columns, rows }
}

export function parseJsonContent(content, asArrayOfTables) {
  const parsed = JSON.parse(String(content))
  if (Array.isArray(parsed)) return { table: null, rows: parsed }
  if (parsed && typeof parsed === 'object') {
    if (asArrayOfTables) {
      const out = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v)) out[k] = v
      }
      return { table: null, tables: out }
    }
    if (Array.isArray(parsed.rows)) return { table: null, rows: parsed.rows }
  }
  throw new Error('Formato JSON no reconocido: se esperaba un arreglo de objetos')
}