import Tesseract from 'tesseract.js'

export async function processImage(imageFile, onProgress) {
  const result = await Tesseract.recognize(imageFile, 'spa', {
    logger: (m) => {
      if (onProgress && m.status) {
        onProgress({ status: m.status, progress: m.progress || 0 })
      }
    }
  })

  const text = result.data.text
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  return {
    rawText: text,
    lines,
    parsedData: parseReportData(lines, text)
  }
}

function parseReportData(lines, fullText) {
  const records = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1] || ''
    const combined = line + ' ' + nextLine

    const record = tryParseLine(line, nextLine, i, lines)
    if (record) {
      records.push(record)
    }
  }

  if (records.length === 0) {
    const fallback = tryParseFallback(fullText)
    if (fallback.length > 0) records.push(...fallback)
  }

  return records
}

function tryParseLine(line, nextLine, index, allLines) {
  const rifMatch = line.match(/[JVjvEeGgPp]-?\d[\d.-]{6,12}/i)
  const dateMatch = line.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/)
  const controlMatch = line.match(/\d{2}-\d{7,10}/)
  const amounts = extractAmounts(line)

  const hasInvoiceNum = /[A-Za-z]?\d{6,12}/.test(line) && !line.match(/^(Nro|N\u00fam|N\u00famero|Fecha|Rif|Tipo)/i)

  if (!rifMatch && !dateMatch && amounts.length === 0) return null

  let razonSocial = ''
  const nameMatch = line.match(/[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,.\-&(]+(?:C\.?A\.?|S\.?R\.?L\.?|S\.?A\.?|LIMITED|CORP|INC)/i)
  if (nameMatch) {
    razonSocial = nameMatch[0].trim()
  } else {
    const words = line.split(/\s+/)
    const capWords = words.filter(w => w.length > 2 && /^[A-ZÁÉÍÓÚÑ]/.test(w))
    if (capWords.length >= 2) {
      razonSocial = capWords.join(' ')
    }
  }

  let nroFactura = ''
  const invoiceMatch = line.match(/(?:Fact(?:ura)?|FAC|Fc?)\s*[:.]?\s*([A-Za-z]?\d{6,12})/i)
  if (invoiceMatch) {
    nroFactura = invoiceMatch[1]
  } else if (amounts.length > 0) {
    const possibleInv = line.match(/(?:^|\s)([A-Za-z]?\d{6,10})(?:\s|$)/)
    if (possibleInv && !possibleInv[1].match(/^\d{2}-/)) {
      nroFactura = possibleInv[1]
    }
  }

  const totalCompras = amounts.length > 0 ? amounts[0] : 0
  const baseNac = totalCompras > 0 ? Math.round((totalCompras / 1.16) * 100) / 100 : 0
  const credFiscal = baseNac > 0 ? Math.round(baseNac * 0.16 * 100) / 100 : 0

  let baseImp = 0
  let credFiscalImp = 0
  if (amounts.length >= 2) {
    baseImp = amounts[1]
    credFiscalImp = Math.round(baseImp * 0.16 * 100) / 100
  }

  let igtf = 0
  const igtfMatch = line.match(/IGTF\s*[:.]?\s*([\d.,]+)/i)
  if (igtfMatch) {
    igtf = parseAmount(igtfMatch[1])
  }

  let retIVA = 0
  const retMatch = line.match(/Ret(?:enci[oó]n)?\s*IVA\s*[:.]?\s*([\d.,]+)/i)
  if (retMatch) {
    retIVA = parseAmount(retMatch[1])
  }

  let tipoTransaccion = '01 -Reg'
  if (line.match(/importaci[oó]n|imp/i)) {
    tipoTransaccion = '01 -Reg'
  }

  return {
    nro: index + 1,
    fecha: dateMatch ? dateMatch[0] : '',
    rif: rifMatch ? rifMatch[0] : '',
    nombreRazon: razonSocial,
    nroFactura,
    nroControl: controlMatch ? controlMatch[0] : '',
    nroNotaDebito: '',
    nroNotaCredito: line.match(/cr[eé]dito|NC/i) ? nroFactura : '',
    tipoTransaccion,
    nroFacturaAfectada: '',
    totalComprasIVA: totalCompras,
    noGravadas: 0,
    baseNacional: baseNac,
    alicuotaNac: 16,
    creditoFiscalNac: credFiscal,
    baseImportacion: baseImp,
    alicuotaImp: 16,
    creditoFiscalImp: credFiscalImp,
    numExpediente: '',
    numPlanilla: '',
    fechaPlanilla: '',
    retIVA,
    comprobanteIVA: '',
    fechaIVA: '',
    igtf
  }
}

function tryParseFallback(fullText) {
  const records = []
  const allRifs = [...new Set(fullText.match(/[JVjvEeGgPp]-?\d[\d.-]{6,12}/gi) || [])]
  const allDates = [...new Set(fullText.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/g) || [])]
  const allAmounts = extractAmounts(fullText)

  if (allRifs.length === 0 && allDates.length === 0) return records

  const maxEntries = Math.max(allRifs.length, allDates.length, 1)

  for (let i = 0; i < maxEntries; i++) {
    const totalCompras = allAmounts[i] || 0
    const baseNac = totalCompras > 0 ? Math.round((totalCompras / 1.16) * 100) / 100 : 0
    const credFiscal = baseNac > 0 ? Math.round(baseNac * 0.16 * 100) / 100 : 0

    records.push({
      nro: i + 1,
      fecha: allDates[i] || '',
      rif: allRifs[i] || '',
      nombreRazon: '',
      nroFactura: '',
      nroControl: '',
      nroNotaDebito: '',
      nroNotaCredito: '',
      tipoTransaccion: '01 -Reg',
      nroFacturaAfectada: '',
      totalComprasIVA: totalCompras,
      noGravadas: 0,
      baseNacional: baseNac,
      alicuotaNac: 16,
      creditoFiscalNac: credFiscal,
      baseImportacion: 0,
      alicuotaImp: 16,
      creditoFiscalImp: 0,
      numExpediente: '',
      numPlanilla: '',
      fechaPlanilla: '',
      retIVA: 0,
      comprobanteIVA: '',
      fechaIVA: '',
      igtf: 0
    })
  }

  return records
}

function extractAmounts(text) {
  const matches = text.match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g) || []
  return matches
    .map(m => parseAmount(m))
    .filter(v => v > 0)
    .sort((a, b) => b - a)
}

function parseAmount(str) {
  if (!str) return 0
  let cleaned = str.replace(/\s/g, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.')
  }
  return parseFloat(cleaned) || 0
}

export function getFieldSuggestions(rawText) {
  return {
    rifs: [...new Set(rawText.match(/[JVjvEeGgPp]-?\d[\d.-]{6,12}/gi) || [])],
    dates: [...new Set(rawText.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/g) || [])],
    amounts: [...new Set((rawText.match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g) || []).slice(0, 20))],
    controlNumbers: [...new Set(rawText.match(/\d{2}-\d{7,10}/g) || [])]
  }
}
