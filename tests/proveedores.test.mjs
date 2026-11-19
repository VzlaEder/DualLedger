import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLASIFICACIONES_SUGERIDAS,
  RETENCIONES_IVA,
  codigoProveedor,
  normalizarProveedor,
  proveedorVacio,
  validarProveedor
} from '../src/services/proveedores.js'

test('proveedorVacio trae los valores por defecto del manual', () => {
  const p = proveedorVacio()
  assert.equal(p.porcentajeRetIva, 75)
  assert.equal(p.creditoFiscalNoDeducible, false)
  assert.equal(p.extranjero, false)
  assert.equal(p.diasCredito, 0)
  assert.equal(p.rif, '')
})

test('RETENCIONES_IVA solo ofrece 75% y 100%', () => {
  assert.deepEqual(RETENCIONES_IVA, [75, 100])
  assert.ok(CLASIFICACIONES_SUGERIDAS.length > 0)
})

test('codigoProveedor genera códigos de 8 dígitos', () => {
  assert.equal(codigoProveedor(0), '00000001')
  assert.equal(codigoProveedor(13), '00000014')
  assert.equal(codigoProveedor(-5), '00000001')
})

test('normalizarProveedor limpia texto y normaliza el RIF', () => {
  const p = normalizarProveedor({
    rif: ' j-5008214-84 ',
    nombre: '  GRUPO HIERROCA, C.A.  ',
    direccion: '  Valencia  ',
    telefono: '  0414-1234567 ',
    porcentajeRetIva: 100,
    diasCredito: '15.9',
    creditoFiscalNoDeducible: true,
    extranjero: true
  })

  assert.equal(p.rif, 'J500821484')
  assert.equal(p.nombre, 'GRUPO HIERROCA, C.A.')
  assert.equal(p.direccion, 'Valencia')
  assert.equal(p.telefono, '0414-1234567')
  assert.equal(p.porcentajeRetIva, 100)
  assert.equal(p.diasCredito, 15)
  assert.equal(p.creditoFiscalNoDeducible, true)
  assert.equal(p.extranjero, true)
})

test('normalizarProveedor fuerza 75% ante valores fuera de la lista', () => {
  assert.equal(normalizarProveedor({ porcentajeRetIva: 50 }).porcentajeRetIva, 75)
  assert.equal(normalizarProveedor({ diasCredito: -3 }).diasCredito, 0)
})

test('validarProveedor rechaza RIF inválido, nombre vacío y duplicados', () => {
  const bueno = { rif: 'J500821484', nombre: 'GRUPO HIERROCA, C.A.' }

  assert.equal(validarProveedor(bueno), '')
  assert.match(validarProveedor({ ...bueno, rif: 'J500821480' }), /Dígito verificador/)
  assert.match(validarProveedor({ ...bueno, nombre: '   ' }), /nombre o razón social/)
  assert.match(
    validarProveedor(bueno, { existentes: [bueno], esNuevo: true }),
    /Ya existe un proveedor/
  )
  assert.equal(validarProveedor(bueno, { existentes: [bueno], esNuevo: false }), '')
})
