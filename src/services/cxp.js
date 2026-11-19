// ============================================================
// DualLedger - CxP / Cuentas por pagar (Compras)
// Helpers puros: derivan los saldos y vencimientos de las
// facturas del Libro de Compras y del maestro de proveedores.
//
// El manual del módulo Compras no describe esta sección. No se
// crean campos nuevos ni se registra lo pagado: el saldo es el
// neto de cada documento (total + IGTF - retenciones) y las
// fechas de vencimiento vienen de Compras diarias, del número
// de días de crédito del documento o del maestro del proveedor.
// ============================================================

export const ESTADOS_CXP = [
  { value: 'todos', label: 'Todos' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'por_vencer', label: 'Por vencer' },
  { value: 'sin_vencimiento', label: 'Sin vencimiento' },
  { value: 'pagado', label: 'Pagado' }
]

export const BUCKETS_AGING = [
  'Corriente',
  '1 - 30 días',
  '31 - 60 días',
  '61 - 90 días',
  'Más de 90 días',
  'Sin vencimiento',
  'Pagado'
]

export const COLUMNAS_CSV_CXP = [
  'Fecha', 'Vencimiento', 'Días', 'Estado', 'Antigüedad', 'Documento',
  'Proveedor', 'RIF', 'Cuenta', 'Condición', 'Total factura', 'IGTF',
  'Retenciones', 'Saldo'
]

export function filtrosCxpVacios() {
  return { rif: '', estado: 'todos', desde: '', hasta: '', busqueda: '' }
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

export function normalizarRifCxp(rif) {
  return texto(rif).replace(/[\s-]/g, '').toUpperCase()
}

function fechaIso(v) {
  const s = texto(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const partes = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (partes) return `${partes[3]}-${partes[2]}-${partes[1]}`
  return ''
}

function hoyIso(v) {
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0')
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
  }
  return fechaIso(v) || fechaIso(new Date())
}

function sumarDias(iso, dias) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '') || !dias) return ''
  const [a, m, d] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + Math.trunc(num(dias)))
  return fecha.toISOString().slice(0, 10)
}

function diasEntre(desde, hasta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(hasta || '')) return 0
  const a = Date.parse(desde + 'T00:00:00Z')
  const b = Date.parse(hasta + 'T00:00:00Z')
  return Math.round((b - a) / 86400000)
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

function bucketDe(estado, dias) {
  if (estado === 'pagado') return 'Pagado'
  if (estado === 'sin_vencimiento') return 'Sin vencimiento'
  if (estado === 'por_vencer') return 'Corriente'
  if (dias <= 30) return '1 - 30 días'
  if (dias <= 60) return '31 - 60 días'
  if (dias <= 90) return '61 - 90 días'
  return 'Más de 90 días'
}

// Convierte un documento del Libro de Compras en una fila de CxP.
// No se descuentan abonos porque la aplicación no registra pagos.
export function lineaCxpDesdeDocumento(doc, options = {}) {
  if (!doc || typeof doc !== 'object') return null
  const fecha = fechaIso(doc.fecha)
  if (!fecha) return null
  const estadoDoc = texto(doc.estado).toUpperCase()
  if (estadoDoc === 'ANULADO' || estadoDoc === 'ANULADA') return null

  const payload = payloadDe(doc)
  const factura = payload.factura && typeof payload.factura === 'object' ? payload.factura : {}
  const totales = payload.totales && typeof payload.totales === 'object' ? payload.totales : {}
  const retencionesPayload = payload.retenciones && typeof payload.retenciones === 'object'
    ? payload.retenciones
    : {}
  const proveedor = options.proveedoresPorRif
    ? options.proveedoresPorRif.get(normalizarRifCxp(doc.proveedorRif || doc.rif)) || null
    : null

  const rif = texto(doc.proveedorRif || doc.rif || factura.proveedorRif)
  const proveedorNombre = texto(doc.nombreRazon || factura.proveedorNombre || proveedor && proveedor.nombre)
  const condicion = texto(factura.status || doc.condicion)
  const pagado = /PAGAD|CANCEL|LIQUID/i.test(condicion)
  const diasCredito = Math.max(0, num(doc.diasCredito) || num(proveedor && proveedor.diasCredito))
  const vencimiento = texto(factura.fechaVence || payload.fechaVence || doc.fechaVence) ||
    sumarDias(fecha, diasCredito)
  const hoy = hoyIso(options.hoy)

  let estado = 'sin_vencimiento'
  let dias = 0
  if (pagado) {
    estado = 'pagado'
  } else if (vencimiento && vencimiento < hoy) {
    estado = 'vencido'
    dias = diasEntre(vencimiento, hoy)
  } else if (vencimiento) {
    estado = 'por_vencer'
    dias = diasEntre(hoy, vencimiento)
  }

  const tipo = texto(doc.tipoDocumento) || 'factura'
  // El Libro guarda las notas de crédito con su signo (negativo), así que
  // los importes se toman tal cual: no se invierte el signo dos veces.
  const total = red(num(doc.totalComprasIVA) || num(totales.totalGeneral))
  const igtf = red(num(doc.igtf) || num(totales.igtf))
  const retenciones = red(
    (num(doc.retIVA) || num(retencionesPayload.retIva)) + num(retencionesPayload.retIslr)
  )
  const neto = red(total + igtf - retenciones)
  const detalles = Array.isArray(factura.detalles || payload.detalles) ? (factura.detalles || payload.detalles) : []
  const concepto = detalles.map((l) => texto(l && l.descripcion)).filter(Boolean).slice(0, 3).join(', ') ||
    texto(doc.notas) || 'Compra fiscal'

  return {
    uid: texto(doc.uid) || `cxp-${fecha}-${texto(doc.nroFactura)}`,
    fecha,
    periodo: fecha.slice(0, 7),
    vencimiento,
    dias,
    estado,
    antiguedad: bucketDe(estado, dias),
    numero: texto(factura.nroFactura || doc.nroFactura || doc.nroControl || doc.numero) || '—',
    tipo,
    proveedor: proveedorNombre,
    rif,
    cuenta: texto(doc.codigoCuenta || factura.codigoCuenta),
    condicion,
    diasCredito,
    concepto,
    total,
    igtf,
    retenciones,
    saldo: pagado ? 0 : neto
  }
}

export function indiceProveedores(proveedores = []) {
  const mapa = new Map()
  for (const p of proveedores || []) {
    const rif = normalizarRifCxp(p && p.rif)
    if (rif) mapa.set(rif, p)
  }
  return mapa
}

export function construirLineasCxp(documentos = [], proveedores = [], options = {}) {
  const opts = { ...options, proveedoresPorRif: indiceProveedores(proveedores) }
  const lineas = []
  for (const doc of documentos || []) {
    const linea = lineaCxpDesdeDocumento(doc, opts)
    if (linea) lineas.push(linea)
  }
  const prioridad = { vencido: 0, por_vencer: 1, sin_vencimiento: 2, pagado: 3 }
  return lineas.sort((a, b) => {
    const pa = prioridad[a.estado] ?? 9
    const pb = prioridad[b.estado] ?? 9
    if (pa !== pb) return pa - pb
    const va = a.vencimiento || '9999-12-31'
    const vb = b.vencimiento || '9999-12-31'
    if (va !== vb) return va.localeCompare(vb)
    return b.fecha.localeCompare(a.fecha)
  })
}

export function filtrarLineasCxp(lineas = [], filtros = {}) {
  const f = { ...filtrosCxpVacios(), ...(filtros || {}) }
  const q = texto(f.busqueda).toLowerCase()
  const rif = normalizarRifCxp(f.rif)

  return (lineas || []).filter((l) => {
    if (f.estado && f.estado !== 'todos' && l.estado !== f.estado) return false
    if (f.desde && l.fecha < f.desde) return false
    if (f.hasta && l.fecha > f.hasta) return false
    if (rif && normalizarRifCxp(l.rif) !== rif) return false
    if (q) {
      const campos = [l.numero, l.proveedor, l.rif, l.cuenta, l.concepto, l.condicion, l.vencimiento]
      if (!campos.some((v) => texto(v).toLowerCase().includes(q))) return false
    }
    return true
  })
}

export function listarLineasCxp({ documentos = [], proveedores = [], filtros = {}, hoy } = {}) {
  return filtrarLineasCxp(construirLineasCxp(documentos, proveedores, { hoy }), filtros)
}

export function resumenCxp(lineas = []) {
  const r = {
    documentos: 0,
    total: 0,
    igtf: 0,
    retenciones: 0,
    saldo: 0,
    vencidas: 0,
    saldoVencido: 0,
    porVencer: 0,
    saldoPorVencer: 0,
    sinVencimiento: 0,
    saldoSinVencimiento: 0,
    pagadas: 0
  }
  for (const l of lineas || []) {
    r.documentos += 1
    r.total += num(l.total)
    r.igtf += num(l.igtf)
    r.retenciones += num(l.retenciones)
    r.saldo += num(l.saldo)
    if (l.estado === 'vencido') {
      r.vencidas += 1
      r.saldoVencido += num(l.saldo)
    } else if (l.estado === 'por_vencer') {
      r.porVencer += 1
      r.saldoPorVencer += num(l.saldo)
    } else if (l.estado === 'sin_vencimiento') {
      r.sinVencimiento += 1
      r.saldoSinVencimiento += num(l.saldo)
    } else if (l.estado === 'pagado') {
      r.pagadas += 1
    }
  }
  for (const clave of Object.keys(r)) {
    if (clave !== 'documentos' && clave !== 'vencidas' && clave !== 'porVencer' &&
        clave !== 'sinVencimiento' && clave !== 'pagadas') r[clave] = red(r[clave])
  }
  return r
}

export function agruparCxpPorProveedor(lineas = []) {
  const grupos = new Map()
  for (const l of lineas || []) {
    const clave = normalizarRifCxp(l.rif) || texto(l.proveedor) || 'SIN PROVEEDOR'
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        proveedor: l.proveedor || 'Proveedor sin nombre',
        rif: l.rif || '',
        documentos: 0,
        total: 0,
        retenciones: 0,
        saldo: 0,
        vencidas: 0,
        saldoVencido: 0
      })
    }
    const g = grupos.get(clave)
    g.documentos += 1
    g.total += num(l.total)
    g.retenciones += num(l.retenciones)
    g.saldo += num(l.saldo)
    if (l.estado === 'vencido') {
      g.vencidas += 1
      g.saldoVencido += num(l.saldo)
    }
  }
  const resultado = [...grupos.values()].sort((a, b) => b.saldo - a.saldo)
  for (const g of resultado) {
    g.total = red(g.total)
    g.retenciones = red(g.retenciones)
    g.saldo = red(g.saldo)
    g.saldoVencido = red(g.saldoVencido)
  }
  return resultado
}

export function agruparCxpPorAging(lineas = []) {
  const grupos = new Map(BUCKETS_AGING.map((nombre) => [nombre, {
    antiguedad: nombre, documentos: 0, saldo: 0
  }]))
  for (const l of lineas || []) {
    const g = grupos.get(l.antiguedad) || grupos.get('Sin vencimiento')
    g.documentos += 1
    g.saldo += num(l.saldo)
  }
  const resultado = [...grupos.values()]
  for (const g of resultado) g.saldo = red(g.saldo)
  return resultado
}

export function agruparCxpPorMes(lineas = []) {
  const grupos = new Map()
  for (const l of lineas || []) {
    const periodo = l.periodo || (l.fecha || '').slice(0, 7) || 'SIN FECHA'
    if (!grupos.has(periodo)) {
      grupos.set(periodo, { periodo, documentos: 0, total: 0, retenciones: 0, saldo: 0 })
    }
    const g = grupos.get(periodo)
    g.documentos += 1
    g.total += num(l.total)
    g.retenciones += num(l.retenciones)
    g.saldo += num(l.saldo)
  }
  const resultado = [...grupos.values()].sort((a, b) => b.periodo.localeCompare(a.periodo))
  for (const g of resultado) {
    g.total = red(g.total)
    g.retenciones = red(g.retenciones)
    g.saldo = red(g.saldo)
  }
  return resultado
}

export function etiquetaEstadoCxp(estado) {
  const encontrado = ESTADOS_CXP.find((e) => e.value === estado)
  return encontrado ? encontrado.label : 'Sin vencimiento'
}

export function csvCxp(lineas = []) {
  const filas = (lineas || []).map((l) => [
    l.fecha,
    l.vencimiento,
    l.dias,
    etiquetaEstadoCxp(l.estado),
    l.antiguedad,
    l.numero,
    l.proveedor,
    l.rif,
    l.cuenta,
    l.condicion,
    l.total,
    l.igtf,
    l.retenciones,
    l.saldo
  ])
  const cuerpo = [COLUMNAS_CSV_CXP, ...filas]
    .map((fila) => fila.map((v) => `"${texto(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n')
  return '\uFEFF' + cuerpo + '\r\n'
}
