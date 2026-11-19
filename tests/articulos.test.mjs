import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PESTANAS_ARTICULO,
  TIPOS_ARTICULO,
  articuloVacio,
  articulosDesdeCuentas,
  codigoArticulo,
  filtrarArticulos,
  normalizarArticulo,
  valoresUnicos,
  validarArticulo
} from '../src/services/articulos.js'

test('articuloVacio trae los valores del manual', () => {
  const a = articuloVacio()
  assert.equal(a.tipo, 'Servicio')
  assert.equal(a.iva, 'No aplica')
  assert.equal(a.factorConversion, 1)
  assert.equal(a.precioVenta, 0)
  assert.equal(a.centroCostoCompra, '')
})

test('TIPOS_ARTICULO y pestañas coinciden con las capturas', () => {
  assert.deepEqual(TIPOS_ARTICULO, ['Producto', 'Servicio'])
  assert.deepEqual(PESTANAS_ARTICULO.map(p => p.label), [
    'Producto', 'Análisis', 'Productos Compuestos', 'Lista de Precios', 'Avanzado'
  ])
})

test('codigoArticulo genera códigos de 8 dígitos', () => {
  assert.equal(codigoArticulo(0), '00000001')
  assert.equal(codigoArticulo(41), '00000042')
})

test('normalizarArticulo limpia texto y números', () => {
  const a = normalizarArticulo({
    codigo: '  ART-001 ',
    descripcion: '  Servicio de mantenimiento  ',
    nombre: ' Mantenimiento ',
    tipo: 'Producto',
    paraVenta: true,
    iva: '16%',
    grupoArticulos: ' Servicios ',
    presentacionModelo: ' Unidad ',
    almacenInicial: ' Principal ',
    medida: ' Und ',
    factorConversion: '2.5',
    marca: ' GENÉRICA ',
    precioVenta: '125.567',
    stockMaximo: '10.9',
    stockMinimo: '2',
    existencia: '7.456',
    centroCostoVenta: ' 4.1.01 ',
    centroCostoCompra: ' 5.1.01 '
  })

  assert.equal(a.codigo, 'ART-001')
  assert.equal(a.descripcion, 'Servicio de mantenimiento')
  assert.equal(a.nombre, 'Mantenimiento')
  assert.equal(a.tipo, 'Producto')
  assert.equal(a.paraVenta, true)
  assert.equal(a.iva, '16%')
  assert.equal(a.grupoArticulos, 'Servicios')
  assert.equal(a.presentacionModelo, 'Unidad')
  assert.equal(a.almacenInicial, 'Principal')
  assert.equal(a.medida, 'Und')
  assert.equal(a.factorConversion, 2.5)
  assert.equal(a.marca, 'GENÉRICA')
  assert.equal(a.precioVenta, 125.57)
  assert.equal(a.stockMaximo, 10.9)
  assert.equal(a.stockMinimo, 2)
  assert.equal(a.existencia, 7.46)
  assert.equal(a.centroCostoVenta, '4.1.01')
  assert.equal(a.centroCostoCompra, '5.1.01')
})

test('normalizarArticulo corrige valores inválidos', () => {
  const a = normalizarArticulo({ tipo: 'Raro', iva: '30%', precioVenta: -4, factorConversion: 0 })
  assert.equal(a.tipo, 'Servicio')
  assert.equal(a.iva, 'No aplica')
  assert.equal(a.precioVenta, 0)
  assert.equal(a.factorConversion, 1)
})

test('validarArticulo exige código y descripción y evita duplicados', () => {
  const valido = { codigo: 'A-1', nombre: 'Papel' }
  assert.equal(validarArticulo(valido), '')
  assert.match(validarArticulo({ ...valido, codigo: '' }), /código/)
  assert.match(validarArticulo({ ...valido, nombre: '' }), /descripción/)
  assert.match(
    validarArticulo(valido, { existentes: [{ codigo: 'A-1' }] }),
    /Ya existe/
  )
})

test('filtrarArticulos aplica los cinco filtros del manual', () => {
  const articulos = [
    { codigo: '1', nombre: 'Inventario de Mercancía', grupoArticulos: 'Activo', presentacionModelo: 'Caja', almacenInicial: 'Principal', medida: 'Und', tipo: 'Servicio', marca: 'X' },
    { codigo: '2', nombre: 'Iva Retenido', grupoArticulos: 'Pasivo', presentacionModelo: 'Unidad', almacenInicial: 'Secundario', medida: 'Kg', tipo: 'Producto', marca: 'Y' }
  ]
  assert.equal(filtrarArticulos(articulos, { busqueda: 'inventario' }).length, 1)
  assert.equal(filtrarArticulos(articulos, { articulo: 'Iva' }).length, 1)
  assert.equal(filtrarArticulos(articulos, { grupoArticulos: 'Activo' }).length, 1)
  assert.equal(filtrarArticulos(articulos, { presentacionModelo: 'Caja' }).length, 1)
  assert.equal(filtrarArticulos(articulos, { almacenInicial: 'Secundario' }).length, 1)
  assert.equal(filtrarArticulos(articulos, { medida: 'Kg' }).length, 1)
})

test('valoresUnicos devuelve opciones ordenadas para los filtros', () => {
  assert.deepEqual(valoresUnicos([{ medida: 'Kg' }, { medida: 'Und' }, { medida: 'Kg' }], 'medida'), ['Kg', 'Und'])
})

test('articulosDesdeCuentas importa el plan de cuentas una sola vez', () => {
  const cuentas = [
    { codigo: '1.1.1.01.004', nombre: 'Inventario De Mercancía', esMovimiento: true },
    { codigo: '1.1.1.01.005', nombre: 'Iva Retenido Por Terceros', esMovimiento: true },
    { codigo: '1.1.1.01.004', nombre: 'Inventario De Mercancía', esMovimiento: true }
  ]
  const nuevos = articulosDesdeCuentas(cuentas, [{ codigo: '1.1.1.01.005' }])
  assert.equal(nuevos.length, 1)
  assert.equal(nuevos[0].codigo, '1.1.1.01.004')
  assert.equal(nuevos[0].nombre, 'Inventario De Mercancía')
  assert.equal(nuevos[0].tipo, 'Servicio')
  assert.equal(nuevos[0].centroCostoCompra, '1.1.1.01.004')
})
