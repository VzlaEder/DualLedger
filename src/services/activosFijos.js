// ============================================================
// DualLedger - Activos Fijos (Compras)
// Helpers puros, sin dependencias de Vue, IndexedDB ni de la API.
//
// El manual de Compras no describe este módulo: viene del diseño
// general de la app. Se implementa con el mismo patrón offline-first
// que Proveedores, Documentos no fiscales y Artículos.
//
// La depreciación se calcula en forma derivada (nunca se guarda como
// dato) a partir del costo, los gastos capitalizables, el valor
// residual, la vida útil y el método elegido.
// ============================================================

export const CATEGORIAS_ACTIVO_FIJO = [
  'Terrenos',
  'Edificios',
  'Maquinaria',
  'Equipos de oficina',
  'Equipos de transporte',
  'Muebles y enseres',
  'Herramientas',
  'Otros'
]

export const METODOS_DEPRECIACION = ['Linea recta', 'Saldo decreciente', 'No deprecia']

export const ESTADOS_ACTIVO_FIJO = ['Activo', 'En mantenimiento', 'Dado de baja']

// Los terrenos no se deprecian aunque el formulario diga otra cosa.
export const CATEGORIAS_NO_DEPRECIA = ['Terrenos']

export function activoFijoVacio() {
  return {
    uid: '',
    codigo: '',
    descripcion: '',
    categoria: 'Equipos de oficina',
    fechaAdquisicion: '',
    fechaPuestaEnServicio: '',
    rifProveedor: '',
    proveedor: '',
    numeroFactura: '',
    costoAdquisicion: 0,
    gastosCapitalizables: 0,
    valorResidual: 0,
    vidaUtilAnos: 10,
    metodoDepreciacion: 'Linea recta',
    tasaDepreciacionAnual: 0,
    cuentaActivo: '',
    cuentaDepreciacionAcumulada: '',
    cuentaGastoDepreciacion: '',
    centroCosto: '',
    ubicacion: '',
    responsable: '',
    estado: 'Activo',
    observaciones: ''
  }
}

// Código de presentación; el uid interno sigue siendo la clave real.
export function codigoActivoFijo(indice) {
  const n = Math.max(0, Math.floor(Number(indice) || 0)) + 1
  return `AF-${String(n).padStart(6, '0')}`
}

function texto(v) {
  return String(v == null ? '' : v).trim()
}

function num(v, decimales = 2) {
  const n = Number(v)
  if (!isFinite(n)) return 0
  const factor = Math.pow(10, decimales)
  return Math.max(0, Math.round(n * factor)) / factor
}

function fechaValida(fecha) {
  const f = texto(fecha)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false
  const d = new Date(`${f}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f
}

export function hoyISO() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function normalizarActivoFijo(form) {
  const base = activoFijoVacio()
  const v = { ...base, ...(form || {}) }
  const fechaAdquisicion = texto(v.fechaAdquisicion)
  const puestaEnServicio = texto(v.fechaPuestaEnServicio)
  const fechaPuestaEnServicio = fechaValida(puestaEnServicio) ? puestaEnServicio : fechaAdquisicion

  return {
    ...v,
    uid: texto(v.uid),
    codigo: texto(v.codigo),
    descripcion: texto(v.descripcion),
    categoria: CATEGORIAS_ACTIVO_FIJO.includes(v.categoria) ? v.categoria : 'Otros',
    fechaAdquisicion: fechaValida(fechaAdquisicion) ? fechaAdquisicion : '',
    fechaPuestaEnServicio: fechaValida(fechaPuestaEnServicio) ? fechaPuestaEnServicio : '',
    rifProveedor: texto(v.rifProveedor),
    proveedor: texto(v.proveedor),
    numeroFactura: texto(v.numeroFactura),
    costoAdquisicion: num(v.costoAdquisicion),
    gastosCapitalizables: num(v.gastosCapitalizables),
    valorResidual: num(v.valorResidual),
    vidaUtilAnos: Math.min(50, Math.max(0, Math.floor(Number(v.vidaUtilAnos) || 0))),
    metodoDepreciacion: METODOS_DEPRECIACION.includes(v.metodoDepreciacion)
      ? v.metodoDepreciacion
      : 'Linea recta',
    tasaDepreciacionAnual: num(v.tasaDepreciacionAnual, 4),
    cuentaActivo: texto(v.cuentaActivo),
    cuentaDepreciacionAcumulada: texto(v.cuentaDepreciacionAcumulada),
    cuentaGastoDepreciacion: texto(v.cuentaGastoDepreciacion),
    centroCosto: texto(v.centroCosto),
    ubicacion: texto(v.ubicacion),
    responsable: texto(v.responsable),
    estado: ESTADOS_ACTIVO_FIJO.includes(v.estado) ? v.estado : 'Activo',
    observaciones: texto(v.observaciones)
  }
}

// Devuelve '' cuando el formulario es válido; si no, el mensaje a mostrar.
export function validarActivoFijo(form, { existentes = [], esNuevo = true } = {}) {
  const a = normalizarActivoFijo(form)
  if (!a.codigo) return 'Indica el código del activo.'
  if (!a.descripcion) return 'Escribe la descripción del activo.'
  if (!a.categoria) return 'Selecciona la categoría del activo.'
  if (!a.fechaAdquisicion) return 'Indica una fecha de adquisición válida (AAAA-MM-DD).'
  if (a.costoAdquisicion <= 0) return 'El costo de adquisición debe ser mayor que cero.'
  if (a.valorResidual >= a.costoAdquisicion + a.gastosCapitalizables) {
    return 'El valor residual debe ser menor que el costo total del activo.'
  }
  if (esNuevo && existentes.some((x) => x.codigo === a.codigo)) {
    return `Ya existe un activo con el código ${a.codigo}.`
  }
  if (
    a.metodoDepreciacion !== 'No deprecia' &&
    !CATEGORIAS_NO_DEPRECIA.includes(a.categoria) &&
    a.vidaUtilAnos <= 0
  ) {
    return 'Indica la vida útil en años (mayor que cero) para calcular la depreciación.'
  }
  return ''
}

export function costoTotal(activo) {
  return num((Number(activo?.costoAdquisicion) || 0) + (Number(activo?.gastosCapitalizables) || 0))
}

export function baseDepreciable(activo) {
  return Math.max(0, num(costoTotal(activo) - (Number(activo?.valorResidual) || 0)))
}

export function depreciaActivo(activo) {
  return (
    activo?.metodoDepreciacion !== 'No deprecia' &&
    !CATEGORIAS_NO_DEPRECIA.includes(activo?.categoria)
  )
}

// Tasa anual efectiva. Si el usuario no indicó una, se deriva de la vida útil:
// línea recta = 100 / años; saldo decreciente = 200 / años.
export function tasaAnual(activo) {
  if (!depreciaActivo(activo)) return 0
  const explicit = Number(activo?.tasaDepreciacionAnual) || 0
  if (explicit > 0) return Math.min(100, explicit)
  const vida = Math.floor(Number(activo?.vidaUtilAnos) || 0)
  if (vida <= 0) return 0
  const factor = activo.metodoDepreciacion === 'Saldo decreciente' ? 2 : 1
  return Math.min(100, (100 * factor) / vida)
}

// Meses completos transcurridos desde la puesta en servicio (o la adquisición).
export function mesesTranscurridos(activo, hastaFecha) {
  const inicio = texto(activo?.fechaPuestaEnServicio || activo?.fechaAdquisicion)
  const fin = texto(hastaFecha || hoyISO())
  if (!fechaValida(inicio) || !fechaValida(fin) || fin < inicio) return 0
  const [iy, im] = inicio.split('-').map(Number)
  const [fy, fm] = fin.split('-').map(Number)
  return Math.max(0, (fy - iy) * 12 + (fm - im))
}

function acumuladaPorMeses(activo, mesesSolicitados) {
  const base = baseDepreciable(activo)
  if (!base || !depreciaActivo(activo)) return 0
  const vidaMeses = Math.floor(Number(activo?.vidaUtilAnos) || 0) * 12
  const meses = Math.max(0, Math.floor(Number(mesesSolicitados) || 0))
  const limite = vidaMeses > 0 ? Math.min(meses, vidaMeses) : meses
  if (!limite) return 0

  const tasaMensual = tasaAnual(activo) / 100 / 12
  if (activo.metodoDepreciacion === 'Saldo decreciente') {
    let saldo = base
    let acumulada = 0
    for (let m = 0; m < limite; m++) {
      const cuota = Math.min(saldo, saldo * tasaMensual)
      acumulada += cuota
      saldo -= cuota
    }
    return Math.min(base, num(acumulada))
  }

  return Math.min(base, num((base * tasaMensual * limite)))
}

export function depreciacionAcumulada(activo, hastaFecha) {
  return acumuladaPorMeses(activo, mesesTranscurridos(activo, hastaFecha))
}

export function depreciacionMensual(activo) {
  if (!depreciaActivo(activo)) return 0
  return num((baseDepreciable(activo) * tasaAnual(activo)) / 100 / 12)
}

export function valorNeto(activo, hastaFecha) {
  return Math.max(0, num(costoTotal(activo) - depreciacionAcumulada(activo, hastaFecha)))
}

// Tabla anual de depreciación, útil para el reporte del activo.
export function tablaDepreciacion(activo) {
  const vida = Math.floor(Number(activo?.vidaUtilAnos) || 0)
  if (vida <= 0 || !depreciaActivo(activo)) return []
  const filas = []
  let anterior = 0
  for (let anio = 1; anio <= vida; anio++) {
    const acumulada = acumuladaPorMeses(activo, anio * 12)
    const cuota = Math.max(0, num(acumulada - anterior))
    filas.push({
      anio,
      depreciacion: cuota,
      acumulada,
      valorNeto: Math.max(0, num(costoTotal(activo) - acumulada))
    })
    anterior = acumulada
  }
  return filas
}

export function filtrosActivosFijosVacios() {
  return { busqueda: '', categoria: '', estado: '', cuenta: '' }
}

export function filtrarActivosFijos(activos, filtros = {}) {
  const f = filtros || {}
  const q = texto(f.busqueda).toLowerCase()
  const campos = ['codigo', 'descripcion', 'proveedor', 'rifProveedor', 'numeroFactura', 'cuentaActivo', 'observaciones']

  return (activos || []).filter((a) => {
    if (q && !campos.some((k) => texto(a[k]).toLowerCase().includes(q))) return false
    if (texto(f.categoria) && a.categoria !== f.categoria) return false
    if (texto(f.estado) && a.estado !== f.estado) return false
    if (texto(f.cuenta) && a.cuentaActivo !== f.cuenta) return false
    return true
  })
}

export function valoresUnicosActivos(activos, campo) {
  return [...new Set((activos || []).map((a) => texto(a[campo])).filter(Boolean))]
    .sort((x, y) => x.localeCompare(y))
}

export function resumenActivosFijos(activos, hastaFecha) {
  const lista = (activos || []).map((a) => ({
    ...a,
    _costo: costoTotal(a),
    _acumulada: depreciacionAcumulada(a, hastaFecha)
  }))
  return {
    cantidad: lista.length,
    activos: lista.filter((a) => a.estado === 'Activo').length,
    enMantenimiento: lista.filter((a) => a.estado === 'En mantenimiento').length,
    dadosDeBaja: lista.filter((a) => a.estado === 'Dado de baja').length,
    costo: num(lista.reduce((s, a) => s + a._costo, 0)),
    depreciacion: num(lista.reduce((s, a) => s + a._acumulada, 0)),
    valorNeto: num(lista.reduce((s, a) => s + Math.max(0, a._costo - a._acumulada), 0))
  }
}

function csvCampo(v) {
  const s = texto(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvActivosFijos(activos, hastaFecha) {
  const columnas = [
    'Codigo', 'Descripcion', 'Categoria', 'Fecha adquisicion', 'Fecha puesta en servicio',
    'Proveedor', 'RIF', 'Factura', 'Costo', 'Gastos capitalizables', 'Valor residual',
    'Vida util (anos)', 'Metodo', 'Tasa anual %', 'Depreciacion acumulada', 'Valor neto',
    'Cuenta activo', 'Cuenta depreciacion acumulada', 'Cuenta gasto depreciacion',
    'Centro costo', 'Ubicacion', 'Responsable', 'Estado', 'Observaciones'
  ]
  const filas = (activos || []).map((a) => [
    a.codigo, a.descripcion, a.categoria, a.fechaAdquisicion, a.fechaPuestaEnServicio,
    a.proveedor, a.rifProveedor, a.numeroFactura, costoTotal(a), a.gastosCapitalizables,
    a.valorResidual, a.vidaUtilAnos, a.metodoDepreciacion, tasaAnual(a),
    depreciacionAcumulada(a, hastaFecha), valorNeto(a, hastaFecha),
    a.cuentaActivo, a.cuentaDepreciacionAcumulada, a.cuentaGastoDepreciacion,
    a.centroCosto, a.ubicacion, a.responsable, a.estado, a.observaciones
  ].map(csvCampo).join(','))
  return [columnas.join(','), ...filas].join('\r\n')
}
