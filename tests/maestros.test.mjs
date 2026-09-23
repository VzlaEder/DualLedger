import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CONCEPTOS_ISLR_SEED } from '../src/services/conceptosIslr.js'
import { extraerJson } from '../src/services/sanearCatalogo.js'
import { PARAMETROS_DEFECTO, mergeConDefecto, parametrosAArray } from '../src/services/parametros.js'

test('seed de conceptos ISLR consistente y editables', () => {
  assert.ok(CONCEPTOS_ISLR_SEED.length >= 8, 'hay varios conceptos')

  const codes = new Set(CONCEPTOS_ISLR_SEED.map(c => c.codigo))
  assert.equal(codes.size, CONCEPTOS_ISLR_SEED.length, 'códigos únicos')

  const names = new Set(CONCEPTOS_ISLR_SEED.map(c => c.nombre))
  assert.equal(names.size, CONCEPTOS_ISLR_SEED.length, 'nombres únicos')

  for (const c of CONCEPTOS_ISLR_SEED) {
    assert.ok(c.nombre && c.nombre.trim().length, `nombre de ${c.codigo}`)
    assert.ok(c.porcentaje >= 0 && c.porcentaje <= 100, `% en rango de ${c.codigo}`)
    assert.ok(c.sustraendoUt >= 0, `sustraendo no negativo de ${c.codigo}`)
    assert.ok(c.baseMinimaUt >= 0, `base mínima no negativa de ${c.codigo}`)
    assert.equal(typeof c.activo, 'boolean', `activo de ${c.codigo}`)
  }
})

test('extraerJson tolera fences y texto alrededor', () => {
  assert.deepEqual(extraerJson('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(extraerJson('Aquí va: {"a":[1,2]} fin.'), { a: [1, 2] })
  assert.equal(extraerJson('sin json'), null)
  assert.equal(extraerJson(''), null)
})

test('parámetros por defecto y merge preservan la empresa', () => {
  assert.equal(PARAMETROS_DEFECTO.empresa.razonSocial, 'GRUPO HIERROCA, C.A.')
  assert.equal(PARAMETROS_DEFECTO.empresa.rif, 'J500821484')

  const conCambios = mergeConDefecto({ empresa: { direccion: 'Valencia, Edo. Carabobo' } })
  assert.equal(conCambios.empresa.razonSocial, 'GRUPO HIERROCA, C.A.', 'razón social no se pierde')
  assert.equal(conCambios.empresa.direccion, 'Valencia, Edo. Carabobo', 'nuevo campo se agrega')
  assert.equal(conCambios.tasaIVA, 16)
  assert.equal(conCambios.tasaIGTF, 3)

  const arr = parametrosAArray(conCambios)
  assert.equal(arr.length, 1)
  assert.equal(arr[0].clave, 'configuracion')
  assert.equal(arr[0].valor.empresa.rif, 'J500821484')
})