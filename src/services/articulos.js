// ============================================================
// DualLedger - Maestro de Artículos (Compras → Articulos)
// Helpers puros, sin dependencias de Vue, IndexedDB ni API.
//
// Según el manual (1.1): "ARTICULOS: Comprende las cuentas
// contables que serán seleccionadas de acuerdo al concepto de
// la factura a registrar." Por eso C.C Compra / C.C Venta
// apuntan al plan de cuentas contables.
// ============================================================

// La columna "Tipo" del listado del manual muestra "Servicio"
// para las cuentas importadas del plan de cuentas.
export const TIPOS_ARTICULO = ['Producto', 'Servicio']

// Opciones habituales del despliegue "IVA" de la ficha.
export const OPCIONES_IVA = ['No aplica', 'Exento', '8%', '16%']

// Pestañas visibles en la captura de "Agregar o modificar cuenta".
export const PESTANAS_ARTICULO = [
  { id: 'producto', label: 'Producto' },
  { id: 'analisis', label: 'Análisis' },
  { id: 'compuestos', label: 'Productos Compuestos' },
  { id: 'listaPrecios', label: 'Lista de Precios' },
  { id: 'avanzado', label: 'Avanzado' }
]

export function articuloVacio() {
  return {
    uid: '',
    codigo: '',
    descripcion: '',
    nombre: '',
    tipo: 'Servicio',
    paraVenta: false,
    iva: 'No aplica',
    grupoArticulos: '',
    presentacionModelo: '',
    almacenInicial: '',
    medida: '',
    factorConversion: 1,
    marca: '',
    precioVenta: 0,
    stockMaximo: 0,
    stockMinimo: 0,
    existencia: 0,
    centroCostoVenta: '',
    centroCostoCompra: ''
  }
}

// Código correlativo de presentación; el uid es la clave real.
export function codigoArticulo(indice) {
  const n = Math.max(0, Math.floor(Number(indice) || 0)) + 1
  return String(n).padStart(8, '0')
}

function num(v, decimales = 2) {
  const n = Number(v)
  if (!isFinite(n)) return 0
  const factor = Math.pow(10, decimales)
  return Math.round(Math.max(0, n) * factor) / factor
}

function texto(v) {
  return String(v == null ? '' : v).trim()
}

export function normalizarArticulo(form) {
  const base = articuloVacio()
  const v = { ...base, ...(form || {}) }
  const iva = OPCIONES_IVA.includes(v.iva) ? v.iva : 'No aplica'

  return {
    ...v,
    uid: texto(v.uid),
    codigo: texto(v.codigo),
    descripcion: texto(v.descripcion),
    nombre: texto(v.nombre),
    tipo: TIPOS_ARTICULO.includes(v.tipo) ? v.tipo : 'Servicio',
    paraVenta: v.paraVenta === true,
    iva,
    grupoArticulos: texto(v.grupoArticulos),
    presentacionModelo: texto(v.presentacionModelo),
    almacenInicial: texto(v.almacenInicial),
    medida: texto(v.medida),
    factorConversion: num(v.factorConversion === '' ? 1 : v.factorConversion, 4) || 1,
    marca: texto(v.marca),
    precioVenta: num(v.precioVenta),
    stockMaximo: num(v.stockMaximo),
    stockMinimo: num(v.stockMinimo),
    existencia: num(v.existencia),
    centroCostoVenta: texto(v.centroCostoVenta),
    centroCostoCompra: texto(v.centroCostoCompra)
  }
}

// Devuelve '' cuando el formulario es válido; si no, el mensaje a mostrar.
export function validarArticulo(form, { existentes = [], esNuevo = true } = {}) {
  const a = normalizarArticulo(form)
  if (!a.codigo) return 'Indica el código del artículo.'
  if (!a.nombre) return 'Escribe la descripción del artículo.'
  if (esNuevo && existentes.some((x) => x.codigo === a.codigo)) {
    return `Ya existe un artículo con el código ${a.codigo}.`
  }
  return ''
}

// Los filtros de la parte superior de la captura del manual.
export function filtrarArticulos(articulos, filtros = {}) {
  const f = filtros || {}
  const textoLibre = texto(f.busqueda).toLowerCase()
  const campos = ['codigo', 'nombre', 'descripcion', 'marca', 'tipo']

  const porTexto = (a) => !textoLibre || campos.some((k) => texto(a[k]).toLowerCase().includes(textoLibre))

  return (articulos || []).filter((a) => {
    if (!porTexto(a)) return false
    if (texto(f.articulo) && !texto(a.nombre).toLowerCase().includes(texto(f.articulo).toLowerCase())) return false
    if (texto(f.grupoArticulos) && a.grupoArticulos !== f.grupoArticulos) return false
    if (texto(f.presentacionModelo) && a.presentacionModelo !== f.presentacionModelo) return false
    if (texto(f.almacenInicial) && a.almacenInicial !== f.almacenInicial) return false
    if (texto(f.medida) && a.medida !== f.medida) return false
    return true
  })
}

export function valoresUnicos(articulos, campo) {
  return [...new Set((articulos || []).map((a) => texto(a[campo])).filter(Boolean))].sort((x, y) => x.localeCompare(y))
}

// Convierte cuentas del plan de cuentas en artículos de tipo Servicio.
// Es la acción del botón "Importar" de la ficha del manual.
export function articulosDesdeCuentas(cuentas, existentes = []) {
  const codigos = new Set((existentes || []).map((a) => a.codigo))
  const vistos = new Set()
  const resultado = []

  for (const c of cuentas || []) {
    const codigo = texto(c.codigo)
    if (!codigo || codigos.has(codigo) || vistos.has(codigo)) continue
    vistos.add(codigo)
    resultado.push(normalizarArticulo({
      codigo,
      descripcion: texto(c.nombre),
      nombre: texto(c.nombre),
      tipo: 'Servicio',
      iva: 'No aplica',
      centroCostoCompra: codigo
    }))
  }
  return resultado
}
