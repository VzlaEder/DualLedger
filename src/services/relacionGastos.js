// ============================================================
// DualLedger - Relación de gastos (Compras)
// Helpers puros: consolidan las facturas del Libro de Compras y
// los documentos no fiscales en una sola relación de gastos
// deducibles / no deducibles, con resúmenes y exportación CSV.
//
// El manual del módulo Compras no describe esta sección, así que
// no se inventan campos: se deriva todo de la información que ya
// guardan Compras diarias y Documentos no fiscales.
// ============================================================

export const ORIGENES_GASTO = [
  { value: 'todos', label: 'Todos' },
  { value: 'factura', label: 'Facturas del Libro' },
  { value: 'no_fiscal', label: 'Documentos no fiscales' }
]

export const DEDUCIBILIDADES = [
  { value: 'todas', label: 'Todas' },
  { value: 'deducibles', label: 'Deducibles' },
  { value: 'no_deducibles', label: 'No deducibles' }
]

export const COLUMNAS_CSV_GASTOS = [
  'Fecha', 'Periodo', 'Origen', 'Documento', 'Tipo', 'Proveedor', 'RIF',
  'Cuenta', 'Concepto', 'Base', 'No gravadas', 'Crédito fiscal deducible',
  'Crédito fiscal no deducible', 'Retenciones', 'IGTF', 'Total',
  'Deducible', 'Gasto deducible', 'Gasto no deducible'
]

export function filtrosGastosVacios() {
  return {
    desde: '',
    hasta: '',
    deducibilidad: 'todas',
    origen: 'todos',
    cuenta: '',
    busqueda: ''
  }
}

function num(v, def = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

function red(v) {
  return Math.round((num(v) + Number.EPSILON) * 100) / 100
}

function texto(v) {
  return String(v == null ? '' : v).trim()
}

function fechaIso(v) {
  const s = texto(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const parts = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (parts) return `${parts[3]}-${parts[2]}-${parts[1]}`
  return ''
}

function payloadDe(doc) {
  const p = doc && doc.payload
  if (!p) return {}
  if (typeof p === 'string') {
    try {
      const obj = JSON.parse(p)
      return obj && typeof obj === 'object' ? obj : {}
    } catch (e) {
      return {}
    }
  }
  return typeof p === 'object' && !Array.isArray(p) ? p : {}
}

function facturaDe(payload) {
  return payload.factura && typeof payload.factura === 'object' ? payload.factura : {}
}

function conceptoDe(doc, payload, factura) {
  const detalles = factura.detalles || payload.detalles || []
  const nombres = (Array.isArray(detalles) ? detalles : [])
    .map((l) => texto(l && l.descripcion))
    .filter(Boolean)
  if (nombres.length) {
    return nombres.slice(0, 3).join(', ') + (nombres.length > 3 ? '…' : '')
  }
  return texto(doc.notas) || texto(factura.comentarios) || 'Compra fiscal'
}

// Una factura del Libro de Compras (incluidas las de Compras diarias).
// El IVA de un proveedor con "crédito fiscal no deducible" se muestra
// aparte: no se acredita, pero sigue formando parte del gasto.
export function lineaGastoDesdeDocumento(doc) {
  if (!doc || typeof doc !== 'object') return null
  const fecha = fechaIso(doc.fecha)
  if (!fecha) return null
  const estado = texto(doc.estado).toUpperCase()
  if (estado === 'ANULADO' || estado === 'ANULADA') return null

  const payload = payloadDe(doc)
  const factura = facturaDe(payload)
  const totales = payload.totales && typeof payload.totales === 'object' ? payload.totales : {}
  const retenciones = payload.retenciones && typeof payload.retenciones === 'object'
    ? payload.retenciones
    : {}

  const base = red(num(doc.baseNacional) || num(totales.baseImponible))
  const noGravadas = red(num(doc.noGravadas) || num(totales.exento))
  const creditoFiscal = red(
    num(doc.creditoFiscalNac) + num(doc.creditoFiscalImp) || num(totales.iva)
  )
  const igtf = red(num(doc.igtf) || num(totales.igtf))
  const fletes = red(num(totales.fletes))
  const creditoNoDeducible =
    factura.creditoFiscalNoDeducible === true || payload.creditoFiscalNoDeducible === true
  const cfDeducible = creditoNoDeducible ? 0 : creditoFiscal
  const cfNoDeducible = creditoNoDeducible ? creditoFiscal : 0
  const totalCalculado = base + noGravadas + creditoFiscal + igtf + fletes
  const total = red(num(doc.totalComprasIVA) || num(totales.totalGeneral) || totalCalculado)
  const deducible = factura.noDeducible !== true && payload.noDeducible !== true
  const gasto = red(base + noGravadas + cfNoDeducible + igtf + fletes)

  return {
    uid: texto(doc.uid) || `factura-${fecha}-${texto(doc.nroFactura)}`,
    origen: 'factura',
    fecha,
    periodo: fecha.slice(0, 7),
    numero: texto(factura.nroFactura || doc.nroFactura || doc.nroControl || doc.numero) || '—',
    tipo: texto(doc.tipoDocumento) || 'factura',
    proveedor: texto(doc.nombreRazon || factura.proveedorNombre),
    rif: texto(doc.proveedorRif || doc.rif || factura.proveedorRif),
    cuenta: texto(doc.codigoCuenta || factura.codigoCuenta),
    concepto: conceptoDe(doc, payload, factura),
    base,
    noGravadas,
    creditoFiscal,
    creditoFiscalDeducible: red(cfDeducible),
    creditoFiscalNoDeducible: red(cfNoDeducible),
    retenciones: red((num(doc.retIVA) || num(retenciones.retIva)) + num(retenciones.retIslr)),
    igtf,
    total,
    deducible,
    gastoDeducible: deducible ? gasto : 0,
    gastoNoDeducible: deducible ? 0 : gasto
  }
}

// Un comprobante no fiscal: todo su monto es deducible o no deducible
// según el marcador que guarda Documentos no fiscales.
export function lineaGastoDesdeNoFiscal(doc) {
  if (!doc || typeof doc !== 'object') return null
  const fecha = fechaIso(doc.fecha)
  if (!fecha) return null
  const monto = red(Math.max(0, num(doc.monto)))
  const deducible = doc.noDeducible !== true

  return {
    uid: texto(doc.uid) || `no-fiscal-${fecha}-${texto(doc.numero)}`,
    origen: 'no_fiscal',
    fecha,
    periodo: fecha.slice(0, 7),
    numero: texto(doc.numero) || '—',
    tipo: texto(doc.tipo) || 'Recibo',
    proveedor: texto(doc.proveedor),
    rif: texto(doc.rif),
    cuenta: texto(doc.codigoCuenta),
    concepto: texto(doc.concepto) || 'Gasto no fiscal',
    base: monto,
    noGravadas: 0,
    creditoFiscal: 0,
    creditoFiscalDeducible: 0,
    creditoFiscalNoDeducible: 0,
    retenciones: 0,
    igtf: 0,
    total: monto,
    deducible,
    gastoDeducible: deducible ? monto : 0,
    gastoNoDeducible: deducible ? 0 : monto
  }
}

export function construirLineasGastos(documentos = [], noFiscales = []) {
  const lineas = []
  for (const doc of documentos || []) {
    const linea = lineaGastoDesdeDocumento(doc)
    if (linea) lineas.push(linea)
  }
  for (const doc of noFiscales || []) {
    const linea = lineaGastoDesdeNoFiscal(doc)
    if (linea) lineas.push(linea)
  }
  return lineas.sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
    return a.numero.localeCompare(b.numero)
  })
}

export function filtrarLineasGastos(lineas = [], filtros = {}) {
  const f = { ...filtrosGastosVacios(), ...(filtros || {}) }
  const q = texto(f.busqueda).toLowerCase()
  const cuenta = texto(f.cuenta)

  return (lineas || []).filter((l) => {
    if (f.desde && l.fecha < f.desde) return false
    if (f.hasta && l.fecha > f.hasta) return false
    if (f.origen === 'factura' && l.origen !== 'factura') return false
    if (f.origen === 'no_fiscal' && l.origen !== 'no_fiscal') return false
    if (f.deducibilidad === 'deducibles' && !l.deducible) return false
    if (f.deducibilidad === 'no_deducibles' && l.deducible) return false
    if (cuenta && l.cuenta !== cuenta && !l.cuenta.startsWith(cuenta)) return false
    if (q) {
      const campos = [l.numero, l.proveedor, l.rif, l.cuenta, l.concepto, l.tipo]
      if (!campos.some((v) => texto(v).toLowerCase().includes(q))) return false
    }
    return true
  })
}

export function listarLineasGastos({ documentos = [], noFiscales = [], filtros = {} } = {}) {
  return filtrarLineasGastos(construirLineasGastos(documentos, noFiscales), filtros)
}

export function resumenGastos(lineas = []) {
  const r = {
    documentos: 0,
    base: 0,
    noGravadas: 0,
    creditoFiscalDeducible: 0,
    creditoFiscalNoDeducible: 0,
    retenciones: 0,
    igtf: 0,
    total: 0,
    gastoDeducible: 0,
    gastoNoDeducible: 0
  }
  for (const l of lineas || []) {
    r.documentos += 1
    r.base += num(l.base)
    r.noGravadas += num(l.noGravadas)
    r.creditoFiscalDeducible += num(l.creditoFiscalDeducible)
    r.creditoFiscalNoDeducible += num(l.creditoFiscalNoDeducible)
    r.retenciones += num(l.retenciones)
    r.igtf += num(l.igtf)
    r.total += num(l.total)
    r.gastoDeducible += num(l.gastoDeducible)
    r.gastoNoDeducible += num(l.gastoNoDeducible)
  }
  for (const key of Object.keys(r)) {
    if (key !== 'documentos') r[key] = red(r[key])
  }
  return r
}

export function agruparGastosPorCuenta(lineas = [], cuentas = []) {
  const nombres = new Map((cuentas || []).map((c) => [texto(c.codigo), texto(c.nombre)]))
  const grupos = new Map()
  for (const l of lineas || []) {
    const codigo = l.cuenta || 'SIN CUENTA'
    if (!grupos.has(codigo)) {
      grupos.set(codigo, {
        cuenta: codigo,
        nombre: nombres.get(codigo) || '',
        documentos: 0,
        deducible: 0,
        noDeducible: 0,
        total: 0
      })
    }
    const g = grupos.get(codigo)
    g.documentos += 1
    g.deducible += num(l.gastoDeducible)
    g.noDeducible += num(l.gastoNoDeducible)
    g.total += num(l.total)
  }
  const resultado = [...grupos.values()].sort((a, b) => a.cuenta.localeCompare(b.cuenta))
  for (const g of resultado) {
    g.deducible = red(g.deducible)
    g.noDeducible = red(g.noDeducible)
    g.total = red(g.total)
  }
  return resultado
}

export function agruparGastosPorMes(lineas = []) {
  const grupos = new Map()
  for (const l of lineas || []) {
    const periodo = l.periodo || (l.fecha || '').slice(0, 7) || 'SIN FECHA'
    if (!grupos.has(periodo)) {
      grupos.set(periodo, { periodo, documentos: 0, deducible: 0, noDeducible: 0, total: 0 })
    }
    const g = grupos.get(periodo)
    g.documentos += 1
    g.deducible += num(l.gastoDeducible)
    g.noDeducible += num(l.gastoNoDeducible)
    g.total += num(l.total)
  }
  const resultado = [...grupos.values()].sort((a, b) => b.periodo.localeCompare(a.periodo))
  for (const g of resultado) {
    g.deducible = red(g.deducible)
    g.noDeducible = red(g.noDeducible)
    g.total = red(g.total)
  }
  return resultado
}

export function csvGastos(lineas = []) {
  const filas = (lineas || []).map((l) => [
    l.fecha,
    l.periodo,
    l.origen === 'no_fiscal' ? 'No fiscal' : 'Factura',
    l.numero,
    l.tipo,
    l.proveedor,
    l.rif,
    l.cuenta,
    l.concepto,
    l.base,
    l.noGravadas,
    l.creditoFiscalDeducible,
    l.creditoFiscalNoDeducible,
    l.retenciones,
    l.igtf,
    l.total,
    l.deducible ? 'Sí' : 'No',
    l.gastoDeducible,
    l.gastoNoDeducible
  ])
  const cuerpo = [COLUMNAS_CSV_GASTOS, ...filas]
    .map((fila) => fila.map((v) => `"${texto(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  return '\uFEFF' + cuerpo + '\r\n'
}

// Rango del mes actual / anterior para los atajos de la vista.
export function rangoMes(fecha = new Date(), desplazamiento = 0) {
  const d = fecha instanceof Date ? fecha : new Date(fecha)
  const anio = d.getFullYear()
  const mes = d.getMonth() + desplazamiento
  const inicio = new Date(anio, mes, 1)
  const fin = new Date(anio, mes + 1, 0)
  const iso = (x) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
  }
  return { desde: iso(inicio), hasta: iso(fin) }
}
