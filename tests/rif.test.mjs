import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarRif, validarRif, calcularDigito, formatearRif } from '../src/services/rif.js'

test('RIF real de la empresa se valida (Módulo 11)', () => {
  const r = validarRif('J500821484')
  assert.equal(r.valido, true, 'dígito verificador correcto')
  assert.equal(r.rif, 'J500821484')
})

test('dígito verificador alterado se rechaza', () => {
  const r = validarRif('J500821480')
  assert.equal(r.valido, false)
  assert.match(r.error, /Dígito verificador inválido/)
})

test('formato y lettering', () => {
  assert.equal(validarRif('').valido, false)
  assert.equal(validarRif('A999999999').valido, false, 'letra inválida')
  assert.equal(validarRif('J1234567').valido, false, 'digíto insuficientes')
  assert.equal(validarRif('J50082148X').valido, false, 'dígito no numérico')
})

test('round-trip: dígito calculado se valida', () => {
  const letra = 'V'
  const base = '12345678'
  const check = calcularDigito(letra + base)
  const rif = `${letra}${base}${check}`
  assert.equal(validarRif(rif).valido, true, `V12345678${check} es válido`)
  const otro = `${letra}${base}${(check + 1) % 10}`
  if (otro !== rif) assert.equal(validarRif(otro).valido, false, 'dígito distinto se rechaza')
})

test('normalización y formato de presentación', () => {
  assert.equal(normalizarRif('  j-5008214-84 '), 'J500821484')
  assert.equal(normalizarRif(' j 500821484 '), 'J500821484')
  assert.equal(formatearRif('j500821484'), 'J-50082148-4')
})