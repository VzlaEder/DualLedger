import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  csvEscape,
  rowsToCsv,
  sqlLiteral,
  escapeSqlString,
  rowsToInserts,
  columnsToCreate,
  catalogToSql,
  parseCsv,
  parseJsonContent
} from '../server/exportData.mjs'
import { coerceValue, validName } from '../server/dbAdmin.mjs'

test('csvEscape maneja separadores, comillas, saltos y nulos', () => {
  assert.equal(csvEscape('simple'), 'simple')
  assert.equal(csvEscape('con, coma'), '"con, coma"')
  assert.equal(csvEscape('con "comillas"'), '"con ""comillas"""')
  assert.equal(csvEscape('linea1\nlinea2'), '"linea1\nlinea2"')
  assert.equal(csvEscape(null), '')
  assert.equal(csvEscape(true), 'true')
  assert.equal(csvEscape({ a: 1 }), '"{""a"":1}"')
})

test('rowsToCsv genera encabezado y filas en CRLF', () => {
  const csv = rowsToCsv([{ name: 'rif' }, { name: 'nombre' }], [
    { rif: 'J500821484', nombre: 'GRUPO HIERROCA, C.A.' },
    { rif: null, nombre: 'Otro "x"' }
  ])
  assert.equal(csv, 'rif,nombre\r\nJ500821484,"GRUPO HIERROCA, C.A."\r\n,"Otro ""x"""')
})

test('sqlLiteral serializa números, booleanos, nulos y cadenas con escape', () => {
  assert.equal(sqlLiteral(123, 'BIGINT'), '123')
  assert.equal(sqlLiteral(12.5, 'NUMERIC'), '12.5')
  assert.equal(sqlLiteral(true, 'BOOLEAN'), 'TRUE')
  assert.equal(sqlLiteral(null, ''), 'NULL')
  assert.equal(sqlLiteral(undefined, ''), 'NULL')
  assert.equal(sqlLiteral("O'Brien", ''), "'O''Brien'")
  assert.equal(sqlLiteral('{a:1}', 'JSONB'), "'{a:1}'::jsonb")
  assert.equal(sqlLiteral({ a: [1] }, 'JSONB'), "'{\"a\":[1]}'::jsonb")
  assert.equal(sqlLiteral('2024-01-31', 'DATE'), "'2024-01-31'")
})

test('escapeSqlString duplica comillas simples', () => {
  assert.equal(escapeSqlString("it's"), "it''s")
  assert.equal(escapeSqlString('nada'), 'nada')
})

test('rowsToInserts genera INSERT con ON CONFLICT DO NOTHING en bloques', () => {
  const cols = [
    { name: 'rif', dataType: 'TEXT' },
    { name: 'pct', dataType: 'NUMERIC' },
    { name: 'activo', dataType: 'BOOLEAN' },
    { name: 'meta', dataType: 'JSONB' }
  ]
  const rows = [
    { rif: 'J1', pct: 75, activo: true, meta: { a: 1 } },
    { rif: "O'Reilly", pct: 0, activo: false, meta: null }
  ]
  const sql = rowsToInserts('proveedores', cols, rows)
  assert.match(sql, /INSERT INTO proveedores \(rif, pct, activo, meta\) VALUES/)
  assert.match(sql, /O''Reilly/)
  assert.match(sql, /TRUE/)
  assert.match(sql, /ON CONFLICT DO NOTHING;/)
  assert.equal(sql.split('ON CONFLICT DO NOTHING;').length - 1, 1)
})

test('rowsToInserts sin filas devuelve comentario', () => {
  const sql = rowsToInserts('rif_cache', [{ name: 'rif', dataType: 'TEXT' }], [])
  assert.match(sql, /sin filas para exportar/)
})

test('columnsToCreate genera DDL idempotente con PK y NOT NULL', () => {
  const sql = columnsToCreate({
    name: 'rif_cache',
    columns: [
      { name: 'rif', dataType: 'text', isNullable: false, isPk: true },
      { name: 'nombre', dataType: 'character varying', isNullable: false, isPk: false }
    ]
  })
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rif_cache \(/)
  assert.match(sql, /"rif" TEXT NOT NULL PRIMARY KEY/)
  assert.match(sql, /"nombre" TEXT NOT NULL/)
})

test('catalogToSql combina DDL y datos por tabla', () => {
  const sql = catalogToSql([
    {
      name: 'rif_cache',
      columns: [{ name: 'rif', dataType: 'text', isNullable: false, isPk: true }],
      rows: [{ rif: 'J070080752' }]
    }
  ])
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rif_cache/)
  assert.match(sql, /INSERT INTO rif_cache \(rif\) VALUES/)
  assert.match(sql, /'J070080752'/)
})

test('parseCsv respeta comillas, saltos internos y BOM', () => {
  const { columns, rows } = parseCsv('\uFEFFrif,nombre\r\nJ1,"Linea1\nLinea2"\r\nJ2,"a, b"\r\n')
  assert.deepEqual(columns, ['rif', 'nombre'])
  assert.deepEqual(rows, [['J1', 'Linea1\nLinea2'], ['J2', 'a, b']])
})

test('parseJsonContent acepta arreglos y {tabla: filas}', () => {
  assert.deepEqual(parseJsonContent('[{"a":1}]', false).rows, [{ a: 1 }])
  const asTables = parseJsonContent('{"proveedores":[{"rif":"J1"}]}', true)
  assert.deepEqual(asTables.tables.proveedores, [{ rif: 'J1' }])
  assert.throws(() => parseJsonContent('{"clave":42}', false))
  assert.throws(() => parseJsonContent('no es json', false))
})

test('coerceValue convierte según el tipo de columna', () => {
  assert.equal(coerceValue(null, 'TEXT'), null)
  assert.equal(coerceValue('true', 'BOOLEAN'), true)
  assert.equal(coerceValue(0, 'BOOLEAN'), false)
  assert.equal(coerceValue('3,5', 'NUMERIC'), 3.5)
  assert.equal(coerceValue('12.9', 'INTEGER'), 12)
  assert.equal(coerceValue('{"a":1}', 'JSONB').a, 1)
  assert.deepEqual(coerceValue({ b: 2 }, 'JSONB'), { b: 2 })
  assert.throws(() => coerceValue('no-numero', 'NUMERIC'))
  assert.throws(() => coerceValue('{invalido', 'JSONB'))
  assert.equal(coerceValue('hola', 'TEXT'), 'hola')
})

test('validName acepta solo identificadores Postgres seguros', () => {
  assert.ok(validName('rif_cache'))
  assert.ok(validName('proveedores'))
  assert.ok(!validName('tabla; drop'))
  assert.ok(!validName('Tabla'))
  assert.ok(!validName('tabla-uno'))
  assert.ok(!validName('tabla.uno'))
  assert.ok(!validName(''))
  assert.ok(!validName(null))
  assert.ok(!validName('SELECT'))
})