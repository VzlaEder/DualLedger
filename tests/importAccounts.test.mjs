import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePlanDeCuentasBuf, parseCodigoCuenta, normalizarNombre } from '../src/services/importAccounts.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DOC = join(__dirname, '..', 'Plan de Cuentas contables.xls')

test('parseCodigoCuenta reconoce códigos jerárquicos', () => {
  assert.deepEqual(parseCodigoCuenta('1. ACTIVO'), { codigo: '1', nivel: 1, nombre: 'ACTIVO' })
  assert.deepEqual(parseCodigoCuenta('1.1.1.01.001 Cajas Y Bancos'), { codigo: '1.1.1.01.001', nivel: 5, nombre: 'Cajas Y Bancos' })
  assert.deepEqual(parseCodigoCuenta('6.1.1.01. GASTOS DEL PERSONAL'), { codigo: '6.1.1.01', nivel: 4, nombre: 'GASTOS DEL PERSONAL' })
  assert.equal(parseCodigoCuenta(''), null)
  assert.equal(parseCodigoCuenta('Cuenta Contable'), null)
})

test('normalizarNombre corrige ¢→ó y espacios', () => {
  assert.equal(normalizarNombre('  Gastos De Representaci¢n  '), 'Gastos De Representación')
})

test('el plan de cuentas se parsea completo y consistente', () => {
  const buf = readFileSync(DOC)
  const { cuentas, resumen } = parsePlanDeCuentasBuf(buf)

  assert.equal(cuentas.length, 179, 'total de cuentas')
  assert.equal(resumen.grupos, 7, 'grupos raíz')
  assert.equal(resumen.hojas, 132, 'cuentas de movimiento')
  assert.deepEqual(resumen.porNivel, { 1: 7, 2: 10, 3: 10, 4: 20, 5: 132 })

  const codes = new Set(cuentas.map(c => c.codigo))
  assert.equal(codes.size, cuentas.length, 'códigos únicos')

  for (const c of cuentas.filter(c => c.nivel === 5)) {
    assert.match(c.codigo, /^\d\.\d\.\d\.\d{2}\.\d{3}$/, `patrón nivel 5: ${c.codigo}`)
  }

  for (const c of cuentas.filter(c => c.nivel > 1)) {
    assert.ok(c.codigoPadre, `padre de ${c.codigo}`)
    const padre = cuentas.find(p => p.codigo === c.codigoPadre)
    assert.ok(padre, `padre existe para ${c.codigo}`)
    assert.equal(padre.nivel, c.nivel - 1, `jerarquía de ${c.codigo}`)
    assert.ok(c.codigo.startsWith(padre.codigo + '.'), `prefijo de ${c.codigo}`)
  }

  assert.deepEqual(
    cuentas.filter(c => c.nivel === 1).map(c => c.nombre),
    ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESOS', 'COSTOS', 'EGRESOS', 'OTROS INGRESOS Y EGRESOS']
  )

  const repr = cuentas.find(c => c.codigo === '6.1.1.02.002')
  assert.equal(repr.nombre, 'Gastos De Representación', 'normalización de encoding aplicada')

  const grupoMov = cuentas.find(c => c.codigo === '1.1.1.01.005')
  assert.equal(grupoMov.grupo, '1', 'grupo de la cuenta')
  assert.equal(grupoMov.grupoNombre, 'ACTIVO', 'nombre del grupo')
  const padre = cuentas.find(c => c.codigo === '1.1.1.01')
  assert.equal(padre.esMovimiento, false, 'grupo no es movimiento')
  assert.equal(grupoMov.esMovimiento, true, 'cuenta de nivel 5 es movimiento')
})