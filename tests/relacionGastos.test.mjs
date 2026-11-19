import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparGastosPorCuenta,
  agruparGastosPorMes,
  construirLineasGastos,
  csvGastos,
  filtrosGastosVacios,
  filtrarLineasGastos,
  lineaGastoDesdeDocumento,
  lineaGastoDesdeNoFiscal,
  listarLineasGastos,
  rangoMes,
  resumenGastos
} from '../src/services/relacionGastos.js'

function docFactura(overrides = {}) {
  const factura = {
    nroFactura: '20FP7700056',
    proveedorNombre: 'GRUPO HIERROCA, C.A.',
    codigoCuenta: '6.1.07.00',
    creditoFiscalNoDeducible: false,
    detalles: [{ descripcion: 'Honorarios Contadores' }]
  }
  return {
    uid: 'doc-1',
    fecha: '2026-09-14',
    rif: 'J-500821484',
    proveedorRif: 'J500821484',
    nombreRazon: 'GRUPO HIERROCA, C.A.',
    nroFactura: '20FP7700056',
    nroControl: '000208926',
    codigoCuenta: '6.1.07.00',
    baseNacional: 40000,
    alicuotaNac: 16,
    creditoFiscalNac: 6400,
    totalComprasIVA: 46400,
    retIVA: 4800,
    estado: 'VALIDADO',
    payload: {
      origenModulo: 'compras_diarias',
      factura,
      totales: { baseImponible: 40000, iva: 6400, totalGeneral: 46400, exento: 0 },
      retenciones: { retIva: 4800, retIslr: 2000 }
    },
    ...overrides
  }
}

function docNoFiscal(overrides = {}) {
  return {
    uid: 'nf-1',
    numero: 'R-001',
    fecha: '2026-09-15',
    tipo: 'Recibo',
    rif: 'J123456789',
    proveedor: 'SERVIREF, C.A.',
    concepto: 'Mantenimiento de la oficina',
    monto: 1500,
    codigoCuenta: '6.1.02.00',
    noDeducible: false,
    ...overrides
  }
}

test('filtrosGastosVacios no trae filtros activos', () => {
  assert.deepEqual(filtrosGastosVacios(), {
    desde: '', hasta: '', deducibilidad: 'todas', origen: 'todos', cuenta: '', busqueda: ''
  })
})

test('una factura del Libro conserva base, crédito fiscal y retenciones', () => {
  const l = lineaGastoDesdeDocumento(docFactura())
  assert.equal(l.origen, 'factura')
  assert.equal(l.fecha, '2026-09-14')
  assert.equal(l.periodo, '2026-09')
  assert.equal(l.numero, '20FP7700056')
  assert.equal(l.concepto, 'Honorarios Contadores')
  assert.equal(l.base, 40000)
  assert.equal(l.creditoFiscal, 6400)
  assert.equal(l.creditoFiscalDeducible, 6400)
  assert.equal(l.creditoFiscalNoDeducible, 0)
  assert.equal(l.retenciones, 6800)
  assert.equal(l.total, 46400)
  assert.equal(l.deducible, true)
  assert.equal(l.gastoDeducible, 40000)
  assert.equal(l.gastoNoDeducible, 0)
})

test('crédito fiscal no deducible se separa del acreditable y entra al gasto', () => {
  const doc = docFactura()
  doc.payload.factura.creditoFiscalNoDeducible = true
  const l = lineaGastoDesdeDocumento(doc)
  assert.equal(l.creditoFiscalDeducible, 0)
  assert.equal(l.creditoFiscalNoDeducible, 6400)
  assert.equal(l.gastoDeducible, 46400)
  assert.equal(l.total, 46400)
})

test('documentos no fiscales se clasifican con su marcador noDeducible', () => {
  const deducible = lineaGastoDesdeNoFiscal(docNoFiscal())
  assert.equal(deducible.origen, 'no_fiscal')
  assert.equal(deducible.deducible, true)
  assert.equal(deducible.gastoDeducible, 1500)
  assert.equal(deducible.gastoNoDeducible, 0)

  const noDeducible = lineaGastoDesdeNoFiscal(docNoFiscal({ noDeducible: true }))
  assert.equal(noDeducible.deducible, false)
  assert.equal(noDeducible.gastoDeducible, 0)
  assert.equal(noDeducible.gastoNoDeducible, 1500)
})

test('se ignoran anulados y fechas inválidas, y se acepta DD/MM/AAAA', () => {
  assert.equal(lineaGastoDesdeDocumento(docFactura({ estado: 'ANULADO' })), null)
  assert.equal(lineaGastoDesdeDocumento(docFactura({ fecha: 'no-es-fecha' })), null)
  const l = lineaGastoDesdeDocumento(docFactura({ fecha: '14/09/2026' }))
  assert.equal(l.fecha, '2026-09-14')
})

test('los filtros combinan fecha, origen, cuenta, deducibilidad y búsqueda', () => {
  const lineas = construirLineasGastos(
    [
      docFactura(),
      docFactura({
        uid: 'doc-2', fecha: '2026-10-03', nroFactura: 'F-002',
        codigoCuenta: '6.2.01.00', baseNacional: 1000, creditoFiscalNac: 160,
        totalComprasIVA: 1160, estado: 'VALIDADO',
        payload: { factura: { detalles: [{ descripcion: 'Papelería' }] } }
      })
    ],
    [
      docNoFiscal(),
      docNoFiscal({
        uid: 'nf-2', numero: 'R-002', fecha: '2026-10-04', noDeducible: true,
        monto: 200, proveedor: 'OTRO PROVEEDOR', codigoCuenta: '6.1.02.01'
      })
    ]
  )
  assert.equal(lineas.length, 4)

  assert.equal(filtrarLineasGastos(lineas, { desde: '2026-10-01', hasta: '2026-10-31' }).length, 2)
  assert.equal(filtrarLineasGastos(lineas, { origen: 'no_fiscal' }).length, 2)
  assert.equal(filtrarLineasGastos(lineas, { deducibilidad: 'no_deducibles' }).length, 1)
  assert.equal(filtrarLineasGastos(lineas, { cuenta: '6.1.02' }).length, 2)
  assert.equal(filtrarLineasGastos(lineas, { busqueda: 'papelería' }).length, 1)
  assert.equal(filtrarLineasGastos(lineas, { busqueda: 'hierroca' }).length, 2)
  assert.equal(filtrarLineasGastos(lineas, {
    desde: '2026-10-01', origen: 'no_fiscal', deducibilidad: 'no_deducibles'
  }).length, 1)
})

test('listarLineasGastos aplica los filtros al consolidado', () => {
  const filtros = { ...filtrosGastosVacios(), origen: 'factura' }
  const lineas = listarLineasGastos({
    documentos: [docFactura()],
    noFiscales: [docNoFiscal()],
    filtros
  })
  assert.equal(lineas.length, 1)
  assert.equal(lineas[0].numero, '20FP7700056')
})

test('el resumen totaliza deducible, no deducible, crédito y retenciones', () => {
  const lineas = construirLineasGastos(
    [docFactura()],
    [docNoFiscal(), docNoFiscal({ uid: 'nf-2', numero: 'R-002', noDeducible: true, monto: 500 })]
  )
  const r = resumenGastos(lineas)
  assert.equal(r.documentos, 3)
  assert.equal(r.base, 42000)
  assert.equal(r.creditoFiscalDeducible, 6400)
  assert.equal(r.creditoFiscalNoDeducible, 0)
  assert.equal(r.retenciones, 6800)
  assert.equal(r.total, 48400)
  assert.equal(r.gastoDeducible, 41500)
  assert.equal(r.gastoNoDeducible, 500)
})

test('las agrupaciones por cuenta y por mes cuadran con el detalle', () => {
  const lineas = construirLineasGastos(
    [docFactura()],
    [docNoFiscal({ noDeducible: true }), docNoFiscal({
      uid: 'nf-2', numero: 'R-002', fecha: '2026-10-02', noDeducible: false, monto: 250
    })]
  )
  const cuentas = [{ codigo: '6.1.07.00', nombre: 'Honorarios' }]
  const porCuenta = agruparGastosPorCuenta(lineas, cuentas)
  assert.equal(porCuenta.length, 2)
  assert.equal(porCuenta[0].cuenta, '6.1.02.00')
  assert.equal(porCuenta[0].noDeducible, 1500)
  assert.equal(porCuenta[1].nombre, 'Honorarios')
  assert.equal(porCuenta[1].deducible, 40000)

  const porMes = agruparGastosPorMes(lineas)
  assert.deepEqual(porMes.map((g) => g.periodo), ['2026-10', '2026-09'])
  assert.equal(porMes[1].deducible, 40000)
  assert.equal(porMes[1].noDeducible, 1500)
})

test('el CSV trae BOM, cabeceras, comillas escapadas y valores Sí/No', () => {
  const lineas = construirLineasGastos(
    [],
    [docNoFiscal({ concepto: 'Reparación "urgente", oficina' })]
  )
  const csv = csvGastos(lineas)
  assert.ok(csv.startsWith('\uFEFF"Fecha";"Periodo";"Origen"'))
  assert.ok(csv.includes('"Reparación ""urgente"", oficina"'))
  assert.ok(csv.includes('"Sí"'))
  assert.ok(csv.endsWith('\r\n'))
})

test('rangoMes devuelve el mes completo, inclusive el anterior', () => {
  assert.deepEqual(rangoMes(new Date(2026, 9, 15)), {
    desde: '2026-10-01', hasta: '2026-10-31'
  })
  assert.deepEqual(rangoMes(new Date(2026, 9, 15), -1), {
    desde: '2026-09-01', hasta: '2026-09-30'
  })
})
