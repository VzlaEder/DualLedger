import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATEGORIAS_ACTIVO_FIJO,
  ESTADOS_ACTIVO_FIJO,
  METODOS_DEPRECIACION,
  activoFijoVacio,
  baseDepreciable,
  codigoActivoFijo,
  costoTotal,
  csvActivosFijos,
  depreciacionAcumulada,
  depreciacionMensual,
  filtrarActivosFijos,
  filtrosActivosFijosVacios,
  mesesTranscurridos,
  normalizarActivoFijo,
  resumenActivosFijos,
  tablaDepreciacion,
  tasaAnual,
  validarActivoFijo,
  valorNeto,
  valoresUnicosActivos
} from '../src/services/activosFijos.js'

const basico = {
  codigo: 'AF-000001',
  descripcion: 'Computador',
  categoria: 'Equipos de oficina',
  fechaAdquisicion: '2025-01-01',
  fechaPuestaEnServicio: '2025-01-01',
  costoAdquisicion: 1000,
  gastosCapitalizables: 100,
  valorResidual: 100,
  vidaUtilAnos: 10,
  metodoDepreciacion: 'Linea recta',
  estado: 'Activo'
}

test('activoFijoVacio trae los valores por defecto', () => {
  const a = activoFijoVacio()
  assert.equal(a.categoria, 'Equipos de oficina')
  assert.equal(a.metodoDepreciacion, 'Linea recta')
  assert.equal(a.estado, 'Activo')
  assert.equal(a.costoAdquisicion, 0)
  assert.equal(a.vidaUtilAnos, 10)
  assert.equal(a.cuentaActivo, '')
})

test('catálogos del activo fijo', () => {
  assert.ok(CATEGORIAS_ACTIVO_FIJO.includes('Terrenos'))
  assert.ok(CATEGORIAS_ACTIVO_FIJO.includes('Maquinaria'))
  assert.deepEqual(METODOS_DEPRECIACION, ['Linea recta', 'Saldo decreciente', 'No deprecia'])
  assert.deepEqual(ESTADOS_ACTIVO_FIJO, ['Activo', 'En mantenimiento', 'Dado de baja'])
})

test('codigoActivoFijo genera códigos de 6 dígitos', () => {
  assert.equal(codigoActivoFijo(0), 'AF-000001')
  assert.equal(codigoActivoFijo(41), 'AF-000042')
})

test('normalizarActivoFijo limpia texto, números y fechas', () => {
  const a = normalizarActivoFijo({
    ...basico,
    uid: ' af-1 ',
    descripcion: '  Computador  ',
    categoria: 'Inexistente',
    fechaPuestaEnServicio: 'fecha mal',
    metodoDepreciacion: 'Raro',
    estado: 'Raro',
    costoAdquisicion: '1234.567',
    vidaUtilAnos: '5.9',
    tasaDepreciacionAnual: '-3',
    ubicacion: '  Almacén  '
  })

  assert.equal(a.uid, 'af-1')
  assert.equal(a.descripcion, 'Computador')
  assert.equal(a.categoria, 'Otros')
  assert.equal(a.fechaPuestaEnServicio, '2025-01-01')
  assert.equal(a.metodoDepreciacion, 'Linea recta')
  assert.equal(a.estado, 'Activo')
  assert.equal(a.costoAdquisicion, 1234.57)
  assert.equal(a.vidaUtilAnos, 5)
  assert.equal(a.tasaDepreciacionAnual, 0)
  assert.equal(a.ubicacion, 'Almacén')
})

test('validarActivoFijo exige los campos obligatorios', () => {
  assert.match(validarActivoFijo({}), /código/)
  assert.match(validarActivoFijo({ codigo: 'AF-1' }), /descripción/)
  assert.match(validarActivoFijo({ ...basico, fechaAdquisicion: '' }), /fecha de adquisición/)
  assert.match(validarActivoFijo({ ...basico, costoAdquisicion: 0 }), /costo de adquisición/)
})

test('validarActivoFijo detecta duplicados, residual inválido y vida útil faltante', () => {
  assert.match(
    validarActivoFijo(basico, { existentes: [basico] }),
    /Ya existe un activo/
  )
  assert.match(
    validarActivoFijo({ ...basico, valorResidual: 2000 }),
    /valor residual/
  )
  assert.match(
    validarActivoFijo({ ...basico, vidaUtilAnos: 0 }),
    /vida útil/
  )
  assert.equal(validarActivoFijo(basico), '')
})

test('costoTotal y baseDepreciable', () => {
  assert.equal(costoTotal(basico), 1100)
  assert.equal(baseDepreciable(basico), 1000)
  assert.equal(baseDepreciable({ ...basico, valorResidual: 5000 }), 0)
})

test('tasaAnual se deriva de la vida útil y respeta la tasa explícita', () => {
  assert.equal(tasaAnual(basico), 10)
  assert.equal(tasaAnual({ ...basico, metodoDepreciacion: 'Saldo decreciente' }), 20)
  assert.equal(tasaAnual({ ...basico, tasaDepreciacionAnual: 15 }), 15)
  assert.equal(tasaAnual({ ...basico, metodoDepreciacion: 'No deprecia' }), 0)
  assert.equal(tasaAnual({ ...basico, categoria: 'Terrenos' }), 0)
})

test('mesesTranscurridos calcula meses completos y nunca es negativo', () => {
  assert.equal(mesesTranscurridos(basico, '2025-01-01'), 0)
  assert.equal(mesesTranscurridos(basico, '2025-07-01'), 6)
  assert.equal(mesesTranscurridos(basico, '2026-01-01'), 12)
  assert.equal(mesesTranscurridos(basico, '2024-01-01'), 0)
  assert.equal(mesesTranscurridos({ ...basico, fechaPuestaEnServicio: 'fecha mal' }, '2026-01-01'), 0)
})

test('depreciación en línea recta y valor neto', () => {
  assert.equal(depreciacionAcumulada(basico, '2026-01-01'), 100)
  assert.equal(depreciacionMensual(basico), 8.33)
  assert.equal(valorNeto(basico, '2026-01-01'), 1000)
  assert.equal(valorNeto(basico, '2035-01-01'), 100)
})

test('la depreciación se topa con la base y respeta la vida útil', () => {
  const corto = { ...basico, vidaUtilAnos: 2 }
  assert.equal(depreciacionAcumulada(corto, '2027-01-01'), 1000)
  assert.equal(valorNeto(corto, '2030-01-01'), 100)
})

test('saldo decreciente deprecia más al inicio pero nunca supera la base', () => {
  const decreciente = { ...basico, metodoDepreciacion: 'Saldo decreciente' }
  const acum = depreciacionAcumulada(decreciente, '2026-01-01')
  assert.ok(acum > 100, `se esperaba más de 100, se obtuvo ${acum}`)
  assert.ok(acum < 1000)
  // El saldo decreciente puro no llega a cero al final de la vida útil;
  // además, la depreciación se detiene al cumplirse la vida útil.
  assert.equal(
    depreciacionAcumulada(decreciente, '2035-01-01'),
    depreciacionAcumulada(decreciente, '2100-01-01')
  )
})

test('terrenos y método "No deprecia" no generan depreciación', () => {
  const terreno = { ...basico, categoria: 'Terrenos' }
  const sinDep = { ...basico, metodoDepreciacion: 'No deprecia' }
  assert.equal(depreciacionAcumulada(terreno, '2030-01-01'), 0)
  assert.equal(depreciacionAcumulada(sinDep, '2030-01-01'), 0)
  assert.equal(valorNeto(terreno, '2030-01-01'), 1100)
  assert.deepEqual(tablaDepreciacion(terreno), [])
})

test('tablaDepreciacion genera un renglón por año', () => {
  const tabla = tablaDepreciacion(basico)
  assert.equal(tabla.length, 10)
  assert.equal(tabla[0].anio, 1)
  assert.equal(tabla[0].depreciacion, 100)
  assert.equal(tabla[0].acumulada, 100)
  assert.equal(tabla[0].valorNeto, 1000)
  assert.equal(tabla[9].acumulada, 1000)
  assert.equal(tabla[9].valorNeto, 100)
})

test('filtrarActivosFijos aplica búsqueda, categoría, estado y cuenta', () => {
  const lista = [
    { ...basico },
    { ...basico, codigo: 'AF-000002', descripcion: 'Impresora', categoria: 'Maquinaria', estado: 'Dado de baja', cuentaActivo: '1.2.01' },
    { ...basico, codigo: 'AF-000003', descripcion: 'Camión', categoria: 'Equipos de transporte', proveedor: 'Autos C.A.' }
  ]
  assert.equal(filtrarActivosFijos(lista, filtrosActivosFijosVacios()).length, 3)
  assert.equal(filtrarActivosFijos(lista, { busqueda: 'impresora' }).length, 1)
  assert.equal(filtrarActivosFijos(lista, { busqueda: 'autos' })[0].codigo, 'AF-000003')
  assert.equal(filtrarActivosFijos(lista, { categoria: 'Maquinaria' }).length, 1)
  assert.equal(filtrarActivosFijos(lista, { estado: 'Dado de baja' }).length, 1)
  assert.equal(filtrarActivosFijos(lista, { cuenta: '1.2.01' }).length, 1)
  assert.deepEqual(valoresUnicosActivos(lista, 'categoria'), [
    'Equipos de oficina', 'Equipos de transporte', 'Maquinaria'
  ])
})

test('resumenActivosFijos totaliza costo, depreciación y valor neto', () => {
  const lista = [
    { ...basico },
    { ...basico, codigo: 'AF-000002', estado: 'Dado de baja', costoAdquisicion: 500, gastosCapitalizables: 0, valorResidual: 0 }
  ]
  const r = resumenActivosFijos(lista, '2026-01-01')
  assert.equal(r.cantidad, 2)
  assert.equal(r.activos, 1)
  assert.equal(r.dadosDeBaja, 1)
  assert.equal(r.costo, 1600)
  assert.equal(r.depreciacion, 150)
  assert.equal(r.valorNeto, 1450)
})

test('csvActivosFijos genera encabezado y una fila por activo', () => {
  const csv = csvActivosFijos([basico], '2026-01-01')
  const lineas = csv.split('\r\n')
  assert.equal(lineas.length, 2)
  assert.match(lineas[0], /Codigo,Descripcion,Categoria/)
  assert.match(lineas[1], /AF-000001,Computador/)
  assert.match(lineas[1], /100/)
})
