import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TIPOS_DOCUMENTO_NO_FISCAL,
  codigoDocumentoNoFiscal,
  documentoNoFiscalVacio,
  formatearRifOpcional,
  normalizarDocumentoNoFiscal,
  totalDocumentosNoFiscales,
  validarDocumentoNoFiscal
} from '../src/services/documentosNoFiscales.js'

test('documentoNoFiscalVacio trae los valores por defecto', () => {
  const d = documentoNoFiscalVacio()
  assert.equal(d.tipo, 'Recibo')
  assert.equal(d.monto, 0)
  assert.equal(d.noDeducible, true)
  assert.equal(d.rif, '')
})

test('TIPOS_DOCUMENTO_NO_FISCAL incluye los comprobantes habituales', () => {
  assert.ok(TIPOS_DOCUMENTO_NO_FISCAL.includes('Recibo'))
  assert.ok(TIPOS_DOCUMENTO_NO_FISCAL.includes('Ticket'))
  assert.ok(TIPOS_DOCUMENTO_NO_FISCAL.includes('Factura no fiscal'))
})

test('codigoDocumentoNoFiscal genera códigos NF- de 6 dígitos', () => {
  assert.equal(codigoDocumentoNoFiscal(0), 'NF-000001')
  assert.equal(codigoDocumentoNoFiscal(24), 'NF-000025')
  assert.equal(codigoDocumentoNoFiscal(-3), 'NF-000001')
})

test('normalizarDocumentoNoFiscal limpia texto, RIF, monto y fecha', () => {
  const d = normalizarDocumentoNoFiscal({
    numero: '  R-001 ',
    fecha: '2026-11-18',
    tipo: 'Recibo',
    rif: ' j-5008214-84 ',
    proveedor: '  GRUPO HIERROCA  ',
    concepto: '  Servicio de mantenimiento  ',
    monto: '1234.567',
    codigoCuenta: '  513.01  ',
    noDeducible: false,
    notas: '  Sin factura fiscal  '
  })

  assert.equal(d.numero, 'R-001')
  assert.equal(d.fecha, '2026-11-18')
  assert.equal(d.rif, 'J500821484')
  assert.equal(d.proveedor, 'GRUPO HIERROCA')
  assert.equal(d.concepto, 'Servicio de mantenimiento')
  assert.equal(d.monto, 1234.57)
  assert.equal(d.codigoCuenta, '513.01')
  assert.equal(d.noDeducible, false)
  assert.equal(d.notas, 'Sin factura fiscal')
})

test('normalizarDocumentoNoFiscal descarta fecha inválida y tipo desconocido', () => {
  const d = normalizarDocumentoNoFiscal({ fecha: '31/02/2026', tipo: 'Otro tipo raro', monto: -5 })
  assert.equal(d.fecha, '')
  assert.equal(d.tipo, 'Otro')
  assert.equal(d.monto, 0)
})

test('validarDocumentoNoFiscal exige número, fecha, concepto y monto', () => {
  const valido = { numero: 'R-001', fecha: '2026-11-18', concepto: 'Mantenimiento', monto: 10 }
  assert.equal(validarDocumentoNoFiscal(valido), '')
  assert.match(validarDocumentoNoFiscal({ ...valido, numero: '' }), /número/)
  assert.match(validarDocumentoNoFiscal({ ...valido, fecha: '' }), /fecha/)
  assert.match(validarDocumentoNoFiscal({ ...valido, concepto: '' }), /concepto/)
  assert.match(validarDocumentoNoFiscal({ ...valido, monto: 0 }), /mayor que cero/)
  assert.match(
    validarDocumentoNoFiscal({ ...valido, rif: 'J500821480' }),
    /Dígito verificador/
  )
})

test('totales y RIF opcional', () => {
  assert.equal(totalDocumentosNoFiscales([{ monto: 10.5 }, { monto: 2 }, {}]), 12.5)
  assert.equal(formatearRifOpcional(''), '—')
  assert.equal(formatearRifOpcional('J500821484'), 'J-50082148-4')
})
