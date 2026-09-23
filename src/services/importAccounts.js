import * as XLSX_NS from 'xlsx'

// Interop con el CJS de SheetJS: en navegador (Vite) y en Node (tests)
// el objeto real queda en `default`; con fallback al namespace.
const XLSX = XLSX_NS.default || XLSX_NS

// El .xls original guarda ciertos caracteres con codepage dañado (¢ = ó).
const REEMPLAZOS_ENC = { '¢': 'ó' }

export function normalizarNombre(input) {
  let s = String(input == null ? '' : input)
  for (const [de, a] of Object.entries(REEMPLAZOS_ENC)) {
    s = s.split(de).join(a)
  }
  return s.replace(/\s+/g, ' ').trim()
}

export function parseCodigoCuenta(raw) {
  const c = String(raw == null ? '' : raw).trim()
  if (!c) return null
  // Ej: "1. ACTIVO", "6.1.1.01. GASTOS DEL PERSONAL", "1.1.1.01.001 Cajas Y Bancos"
  const m = c.match(/^(\d[\d.]*)[.\s]+(.+)$/)
  if (!m) return null
  const codigo = m[1].replace(/\.+$/, '')
  return { codigo, nivel: codigo.split('.').length, nombre: normalizarNombre(m[2]) }
}

export function parsePlanDeCuentasBuf(buf) {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const crudas = []
  for (const row of rows) {
    const celda = String(row[0] == null ? '' : row[0]).trim()
    if (!celda) continue
    if (/^cuenta\s+contable/i.test(celda)) continue
    const parsed = parseCodigoCuenta(celda)
    if (!parsed) continue
    crudas.push({
      codigo: parsed.codigo,
      nombre: parsed.nombre,
      nivel: parsed.nivel,
      saldoInicial: Number(row[1]) || 0,
      debe: Number(row[2]) || 0,
      haber: Number(row[3]) || 0,
      saldoFinal: Number(row[4]) || 0
    })
  }

  // Resolución de jerarquía: cada cuenta cuelga de la última vista de nivel n-1.
  const ultimoPorNivel = new Map()
  for (const a of crudas) {
    const padre = a.nivel > 1 ? ultimoPorNivel.get(a.nivel - 1) : null
    for (const k of [...ultimoPorNivel.keys()]) {
      if (k >= a.nivel) ultimoPorNivel.delete(k)
    }
    ultimoPorNivel.set(a.nivel, a)
    a.codigoPadre = padre ? padre.codigo : ''
    a.grupo = a.codigo.split('.')[0]
  }

  // Grupo (raíz de nivel 1) y hoja (cuenta sin hijos)
  const raices = new Map()
  for (const c of crudas) {
    if (c.nivel === 1) raices.set(c.codigo, c.nombre)
  }
  const grupos = new Set()
  for (const c of crudas) {
    grupos.add(c.grupo)
    c.grupoNombre = raices.get(c.grupo) || ''
  }
  const codigosPadre = new Set(crudas.filter(c => c.codigoPadre).map(c => c.codigoPadre))
  for (const c of crudas) {
    c.esMovimiento = !codigosPadre.has(c.codigo)
  }

  const porNivel = {}
  for (const c of crudas) porNivel[c.nivel] = (porNivel[c.nivel] || 0) + 1

  const resumen = {
    total: crudas.length,
    porNivel,
    grupos: grupos.size,
    hojas: crudas.filter(c => c.esMovimiento).length
  }

  return { cuentas: crudas, resumen }
}