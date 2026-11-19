import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aDocumentoLibro,
  calcularLinea,
  calcularRetenciones,
  calcularTotales,
  facturaVacia,
  generarComprobantes,
  lineaVacia,
  validarFacturaDiaria
} from '../src/services/comprasDiarias.js'

const conceptos = [
  { codigo: 'HON-PRO', nombre: 'Honorarios profesionales', porcentaje: 5, sustraendoUt: 0, baseMinimaUt: 50, activo: true },
  { codigo: 'SER-DIG', nombre: 'Servicios digitales', porcentaje: 5, sustraendoUt: 2, baseMinimaUt: 50, activo: true }
]

function facturaEjemplo() {
  return {
    ...facturaVacia(),
    proveedorRif: 'J500821484',
    proveedorNombre: 'GRUPO HIERROCA, C.A.',
    fechaEmision: '2026-09-14',
    fechaDeclaracion: '2026-09-14',
    nroFactura: '20FP7700056',
    nroControl: '000208926',
    codigoCuenta: '6.1.07.00',
    porcentajeContribucion: 75,
    conceptoIslr: 'HON-PRO',
    detalles: [
      { codigo: '6.1.07.00', descripcion: 'Honorarios Contadores', cantidad: 1, precio: 40000, alicuotaIVA: 16 }
    ]
  }
}

test('facturaVacia y lineaVacia traen los valores del manual', () => {
  const f = facturaVacia()
  assert.equal(f.tipoDocumento, 'factura')
  assert.equal(f.porcentajeContribucion, 75)
  assert.equal(f.status, 'PENDIENTE')
  assert.deepEqual(f.detalles, [])
  assert.equal(lineaVacia().alicuotaIVA, 16)
})

test('calcularLinea aplica cantidad, precio y alícuota', () => {
  const l = calcularLinea({ cantidad: 2, precio: 100, alicuotaIVA: 16 })
  assert.equal(l.subTotal, 200)
  assert.equal(l.montoIva, 32)
  assert.equal(l.total, 232)
  const exento = calcularLinea({ cantidad: 1, precio: 50, alicuotaIVA: 0 })
  assert.equal(exento.montoIva, 0)
  assert.equal(exento.total, 50)
})

test('calcularTotales separa exento, base imponible e IGTF', () => {
  const f = facturaEjemplo()
  f.detalles.push({ codigo: 'X', descripcion: 'Exento', cantidad: 1, precio: 1000, alicuotaIVA: 0 })
  const t = calcularTotales(f, 3)
  assert.equal(t.subtotal, 41000)
  assert.equal(t.exento, 1000)
  assert.equal(t.baseImponible, 40000)
  assert.equal(t.iva, 6400)
  assert.equal(t.totalGeneral, 47400)
  assert.equal(t.igtf, 0)

  f.aplicarIgtf = true
  assert.equal(calcularTotales(f, 3).igtf, 1422)
})

test('generarComprobantes usa AAAAMM + secuencia', () => {
  const c = generarComprobantes('2026-09-14', 41)
  assert.equal(c.comprobanteIVA, '20260900000041')
  assert.equal(c.comprobanteISLR, '0000000041')
})

test('calcularRetenciones genera IVA 75% e ISLR con UT', () => {
  const f = facturaEjemplo()
  const totales = calcularTotales(f)
  const r = calcularRetenciones(f, { totales, unidadTributaria: 100, conceptos, secuencia: 63 })

  // 40.000 × 16% × 75% = 4.800
  assert.equal(r.retIva, 4800)
  // 40.000 × 5% − 0 × 100 = 2.000
  assert.equal(r.retIslr, 2000)
  assert.equal(r.comprobanteIVA, '20260900000063')
  assert.equal(r.comprobanteISLR, '0000000063')
  assert.equal(r.fechaRetencion, '2026-09-14')
  assert.equal(r.detalleIslr.codigo, 'HON-PRO')

  f.conceptoIslr = 'SER-DIG'
  const r2 = calcularRetenciones(f, { totales, unidadTributaria: 100, conceptos })
  // 40.000 × 5% − 2 × 100 = 1.800
  assert.equal(r2.retIslr, 1800)
})

test('calcularRetenciones no retiene ISLR si no hay concepto o UT', () => {
  const f = facturaEjemplo()
  f.conceptoIslr = ''
  assert.equal(calcularRetenciones(f, { unidadTributaria: 100, conceptos }).retIslr, 0)
  f.conceptoIslr = 'HON-PRO'
  assert.equal(calcularRetenciones(f, { unidadTributaria: 0, conceptos }).retIslr, 0)
})

test('validarFacturaDiaria exige proveedor, fechas, cuenta y detalles', () => {
  const f = facturaEjemplo()
  assert.equal(validarFacturaDiaria(f), '')
  assert.match(validarFacturaDiaria({ ...f, proveedorRif: '' }), /proveedor/)
  assert.match(validarFacturaDiaria({ ...f, nroFactura: '' }), /factura/)
  assert.match(validarFacturaDiaria({ ...f, fechaEmision: '' }), /emisión/)
  assert.match(validarFacturaDiaria({ ...f, codigoCuenta: '' }), /cuenta contable/)
  assert.match(validarFacturaDiaria({ ...f, detalles: [] }), /Detalles/)
})

test('aDocumentoLibro mapea la ficha a las columnas del Libro', () => {
  const f = facturaEjemplo()
  const totales = calcularTotales(f)
  const retenciones = calcularRetenciones(f, { totales, unidadTributaria: 100, conceptos, secuencia: 63 })
  const doc = aDocumentoLibro(f, { totales, retenciones })

  assert.equal(doc.fecha, '2026-09-14')
  assert.equal(doc.rif, 'J-50082148-4')
  assert.equal(doc.nroFactura, '20FP7700056')
  assert.equal(doc.nroControl, '000208926')
  assert.equal(doc.baseNacional, 40000)
  assert.equal(doc.creditoFiscalNac, 6400)
  assert.equal(doc.totalComprasIVA, 46400)
  assert.equal(doc.retIVA, 4800)
  assert.equal(doc.comprobanteIVA, '20260900000063')
  assert.equal(doc.estado, 'VALIDADO')
  assert.equal(doc.origen, 'manual')
  assert.equal(doc.payload.retenciones.retIslr, 2000)
  assert.equal(doc.payload.detalles.length, 1)

  f.creditoFiscalNoDeducible = true
  assert.equal(aDocumentoLibro(f, { totales, retenciones }).creditoFiscalNac, 0)
})
