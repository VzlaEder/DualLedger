import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparCxpPorAging,
  agruparCxpPorMes,
  agruparCxpPorProveedor,
  construirLineasCxp,
  csvCxp,
  filtrosCxpVacios,
  filtrarLineasCxp,
  lineaCxpDesdeDocumento,
  listarLineasCxp,
  resumenCxp
} from '../src/services/cxp.js'

function doc(overrides = {}) {
  const factura = {
    nroFactura: 'F-001',
    proveedorNombre: 'GRUPO HIERROCA, C.A.',
    status: 'PENDIENTE',
    fechaVence: '2026-10-14',
    detalles: [{ descripcion: 'Honorarios' }]
  }
  return {
    uid: 'doc-1',
    fecha: '2026-09-14',
    rif: 'J-500821484',
    proveedorRif: 'J500821484',
    nombreRazon: 'GRUPO HIERROCA, C.A.',
    nroFactura: 'F-001',
    codigoCuenta: '6.1.07.00',
    tipoDocumento: 'factura',
    totalComprasIVA: 46400,
    igtf: 0,
    retIVA: 4800,
    diasCredito: 0,
    condicion: 'PENDIENTE',
    estado: 'VALIDADO',
    payload: {
      origenModulo: 'compras_diarias',
      factura,
      totales: { totalGeneral: 46400, igtf: 0 },
      retenciones: { retIva: 4800, retIslr: 2000 }
    },
    ...overrides
  }
}

const HOY = '2026-11-19'

test('filtrosCxpVacios no trae filtros activos', () => {
  assert.deepEqual(filtrosCxpVacios(), {
    rif: '', estado: 'todos', desde: '', hasta: '', busqueda: ''
  })
})

test('el saldo es total + IGTF - retenciones de IVA e ISLR', () => {
  const l = lineaCxpDesdeDocumento(doc({ igtf: 1392 }), { hoy: HOY })
  assert.equal(l.vencimiento, '2026-10-14')
  assert.equal(l.estado, 'vencido')
  assert.equal(l.dias, 36)
  assert.equal(l.antiguedad, '31 - 60 días')
  assert.equal(l.total, 46400)
  assert.equal(l.igtf, 1392)
  assert.equal(l.retenciones, 6800)
  assert.equal(l.saldo, 40992)
})

test('un documento pagado no genera saldo', () => {
  const d = doc()
  d.payload.factura.status = 'PAGADO'
  const l = lineaCxpDesdeDocumento(d, { hoy: HOY })
  assert.equal(l.estado, 'pagado')
  assert.equal(l.antiguedad, 'Pagado')
  assert.equal(l.saldo, 0)
})

test('sin fecha de vencimiento se usa el crédito del maestro', () => {
  const d = doc()
  delete d.payload.factura.fechaVence
  delete d.nombreRazon
  delete d.payload.factura.proveedorNombre
  const proveedores = [{ rif: 'J-500821484', nombre: 'HIERROCA', diasCredito: 30 }]
  const l = lineaCxpDesdeDocumento(d, { hoy: HOY, proveedoresPorRif: new Map([['J500821484', proveedores[0]]]) })
  assert.equal(l.vencimiento, '2026-10-14')
  assert.equal(l.estado, 'vencido')
  assert.equal(l.proveedor, 'HIERROCA')
})

test('sin vencimiento ni crédito queda como Sin vencimiento', () => {
  const d = doc()
  delete d.payload.factura.fechaVence
  const l = lineaCxpDesdeDocumento(d, { hoy: HOY })
  assert.equal(l.vencimiento, '')
  assert.equal(l.estado, 'sin_vencimiento')
  assert.equal(l.antiguedad, 'Sin vencimiento')
})

test('una nota de crédito conserva el signo negativo del Libro', () => {
  const l = lineaCxpDesdeDocumento(doc({
    uid: 'nc-1',
    tipoDocumento: 'nota_credito',
    nroFactura: 'NC-001',
    totalComprasIVA: -1000,
    retIVA: 0,
    payload: { factura: { nroFactura: 'NC-001', status: 'PENDIENTE', fechaVence: '2026-10-14' } }
  }), { hoy: HOY })
  assert.equal(l.total, -1000)
  assert.equal(l.saldo, -1000)
})

test('se ignoran anulados y fechas inválidas', () => {
  assert.equal(lineaCxpDesdeDocumento(doc({ estado: 'ANULADO' }), { hoy: HOY }), null)
  assert.equal(lineaCxpDesdeDocumento(doc({ fecha: 'no-es-fecha' }), { hoy: HOY }), null)
  assert.equal(lineaCxpDesdeDocumento(doc({ fecha: '14/09/2026' }), { hoy: HOY }).fecha, '2026-09-14')
})

test('las líneas se ordenan por vencimiento y estado', () => {
  const vencida = doc()
  const porVencer = doc({
    uid: 'doc-2',
    nroFactura: 'F-002',
    payload: { factura: { nroFactura: 'F-002', status: 'PENDIENTE', fechaVence: '2026-12-01' } }
  })
  const sinVencimiento = doc({
    uid: 'doc-3',
    nroFactura: 'F-003',
    payload: { factura: { nroFactura: 'F-003', status: 'PENDIENTE' } }
  })
  const lineas = construirLineasCxp([sinVencimiento, porVencer, vencida], [], { hoy: HOY })
  assert.deepEqual(lineas.map((l) => l.estado), ['vencido', 'por_vencer', 'sin_vencimiento'])
  assert.equal(lineas[1].dias, 12)
})

test('los filtros combinan estado, proveedor, fecha y búsqueda', () => {
  const vencida = doc()
  const porVencer = doc({
    uid: 'doc-2',
    nroFactura: 'F-002',
    rif: 'J-999999999',
    proveedorRif: 'J999999999',
    nombreRazon: 'OTRO PROVEEDOR, C.A.',
    payload: { factura: { nroFactura: 'F-002', status: 'PENDIENTE', fechaVence: '2026-12-01' } }
  })
  const lineas = construirLineasCxp([vencida, porVencer], [], { hoy: HOY })
  assert.equal(filtrarLineasCxp(lineas, { estado: 'vencido' }).length, 1)
  assert.equal(filtrarLineasCxp(lineas, { estado: 'por_vencer' }).length, 1)
  assert.equal(filtrarLineasCxp(lineas, { rif: 'J-500-821484' }).length, 1)
  assert.equal(filtrarLineasCxp(lineas, { desde: '2026-10-01' }).length, 0)
  assert.equal(filtrarLineasCxp(lineas, { busqueda: 'hierroca' }).length, 1)
  assert.equal(filtrarLineasCxp(lineas, { busqueda: 'F-002' }).length, 1)
  assert.equal(listarLineasCxp({
    documentos: [vencida, porVencer], filtros: { estado: 'por_vencer' }, hoy: HOY
  }).length, 1)
})

test('el resumen y las agrupaciones cuadran con el detalle', () => {
  const vencida = doc()
  const pagada = doc({
    uid: 'doc-2',
    nroFactura: 'F-002',
    payload: { factura: { nroFactura: 'F-002', status: 'PAGADA', fechaVence: '2026-12-01' } }
  })
  const lineas = construirLineasCxp([vencida, pagada], [], { hoy: HOY })
  const r = resumenCxp(lineas)
  assert.equal(r.documentos, 2)
  assert.equal(r.total, 92800)
  assert.equal(r.retenciones, 11600)
  assert.equal(r.saldo, 39600)
  assert.equal(r.vencidas, 1)
  assert.equal(r.pagadas, 1)
  assert.equal(r.saldoVencido, 39600)

  const porProveedor = agruparCxpPorProveedor(lineas)
  assert.equal(porProveedor.length, 1)
  assert.equal(porProveedor[0].documentos, 2)
  assert.equal(porProveedor[0].saldo, 39600)
  assert.equal(porProveedor[0].vencidas, 1)

  const porAging = agruparCxpPorAging(lineas)
  assert.deepEqual(porAging.find((g) => g.antiguedad === '31 - 60 días').documentos, 1)
  assert.equal(porAging.find((g) => g.antiguedad === 'Pagado').documentos, 1)
  assert.equal(porAging.reduce((s, g) => s + g.saldo, 0), 39600)

  const porMes = agruparCxpPorMes(lineas)
  assert.deepEqual(porMes.map((g) => g.periodo), ['2026-09'])
  assert.equal(porMes[0].saldo, 39600)
})

test('el CSV trae BOM, cabeceras y valores escapados', () => {
  const csv = csvCxp([lineaCxpDesdeDocumento(doc({
    nombreRazon: 'HIERROCA "DEL SUR", C.A.'
  }), { hoy: HOY })])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"Vencimiento";"Días";"Estado";"Antigüedad"'))
  assert.ok(csv.includes('HIERROCA ""DEL SUR"", C.A.'))
  assert.ok(csv.includes('"Vencido"'))
  assert.ok(csv.endsWith('\r\n'))
})
