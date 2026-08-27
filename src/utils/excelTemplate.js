import * as XLSX from 'xlsx'

const HEADER_CONFIG = {
  companyName: 'GRUPO HIERROCA, C.A.',
  companyRif: 'J500821484',
  companyAddress: 'Av 2 San Juan, entre calle 4 y 3 local nro s/n sector frente al teatro municipal Municipio Carache Edo Trujillo',
  title: 'LIBRO DE COMPRAS'
}

const COLUMN_HEADERS = [
  'Nro.',
  'Fecha',
  'Rif',
  'Nombre o Razon Social',
  'Nro. Factura',
  'Nro. Control',
  'Nro. Nota de Debito',
  'Nro. Nota de Credito',
  'Tipo de Transaccion',
  'Nro. Factura Afectada',
  'Total de Compras Incluyendo IVA',
  'No Gravadas',
  'Base Imponible Nac.',
  'Alicuota Nac.',
  'Credito Fiscal Nac.',
  'Base Imponible Imp.',
  'Alicuota Imp.',
  'Credito Fiscal Imp.',
  'Numero Expediente Import.',
  'Numero Planilla Import.',
  'Fecha Planilla Import.',
  'Ret IVA',
  'Comprobante IVA',
  'Fecha IVA',
  '(3%) IGTF'
]

export function generateExcel(records, dateRange = {}) {
  const wb = XLSX.utils.book_new()

  const wsData = []

  wsData.push([`${HEADER_CONFIG.companyRif} ${HEADER_CONFIG.companyName}`])
  wsData.push([HEADER_CONFIG.companyAddress])
  wsData.push([`${HEADER_CONFIG.title} Desde el ${dateRange.from || '__/__/____'} Al ${dateRange.to || '__/__/____'}`])
  wsData.push([])
  wsData.push(COLUMN_HEADERS)

  records.forEach((r, i) => {
    wsData.push([
      r.nro || (i + 1),
      r.fecha || '',
      r.rif || '',
      r.nombreRazon || '',
      r.nroFactura || '',
      r.nroControl || '',
      r.nroNotaDebito || '',
      r.nroNotaCredito || '',
      r.tipoTransaccion || '01 -Reg',
      r.nroFacturaAfectada || '',
      r.totalComprasIVA || 0,
      r.noGravadas || 0,
      r.baseNacional || 0,
      r.alicuotaNac || 16,
      r.creditoFiscalNac || 0,
      r.baseImportacion || 0,
      r.alicuotaImp || 16,
      r.creditoFiscalImp || 0,
      r.numExpediente || '',
      r.numPlanilla || '',
      r.fechaPlanilla || '',
      r.retIVA || 0,
      r.comprobanteIVA || '',
      r.fechaIVA || '',
      r.igtf || 0
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 16 }, { wch: 35 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 16 },
    { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
    { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 10 }
  ]

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 24 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 24 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 24 } }
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')

  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const fileName = `Libro_Compras_${dateStr}_${now.getTime()}.xlsx`

  XLSX.writeFile(wb, fileName)

  return {
    fileName,
    recordCount: records.length,
    generatedAt: now.toISOString()
  }
}

export { COLUMN_HEADERS, HEADER_CONFIG }
