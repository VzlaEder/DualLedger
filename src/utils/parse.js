export function parseReportData(lines, fullText) {
  const records = []
  const blocks = splitIntoBlocks(lines)
  let issuer = null

  for (const block of blocks) {
    if (!issuer) issuer = extractIssuer(block)
    const record = parseBlock(block)
    if (record) records.push(record)
  }

  for (const record of records) {
    if (issuer) {
      if (!record.rif) record.rif = issuer.rif
      if (!record.nombreRazon) record.nombreRazon = issuer.nombreRazon
      if (!record.nroControl) record.nroControl = issuer.control
    }
    if (record.totalComprasIVA > 0) {
      record.baseNacional = Math.round((record.totalComprasIVA / 1.16) * 100) / 100
      record.creditoFiscalNac = Math.round(record.baseNacional * 0.16 * 100) / 100
    }
  }

  if (records.length === 0) {
    const fallback = tryParseFallback(fullText)
    if (fallback.length > 0) records.push(...fallback)
  }

  return records
}

export function parseAmount(str) {
  if (!str) return 0
  let cleaned = String(str).replace(/\s/g, '')
  cleaned = cleaned.replace(/Bs\.?/gi, '').replace(/\$/g, '').trim()
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',') && /,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.')
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/,/g, '')
  }
  return parseFloat(cleaned) || 0
}

function splitIntoBlocks(lines) {
  const blocks = []
  let current = []

  for (const line of lines) {
    if (isRecordStart(line)) {
      if (current.length > 0) blocks.push(current)
      current = [line]
    } else if (current.length > 0) {
      current.push(line)
    }
  }

  if (current.length > 0) blocks.push(current)
  return blocks
}

function isRecordStart(line) {
  if (/[JVjvEeGg]-?\d[\d.-]{6,12}/i.test(line)) return true
  if (/RIF\/CI\s*[:.]?\s*\d+/i.test(line)) return true
  if (/NOTA DE (CRED|DÉB|DEB|CRIT|CR)/i.test(line)) return true
  if (/FACTURA\b/i.test(line)) return true
  if (/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(line) && !/FECHA/i.test(line)) return true
  return false
}

function parseBlock(blockLines) {
  const text = blockLines.join('\n')
  const record = createEmptyRecord()

  const totalMatch = text.match(/^(?:TOTAL|TOT)\b.*?(?:Bs\.?)?\s*[:.]?\s*([\d.,]+)/im)
  if (totalMatch) {
    record.totalComprasIVA = parseAmount(totalMatch[1])
  }

  const subtotalMatch = text.match(/^SUB\s*TTL\b.*?(?:Bs\.?)?\s*[:.]?\s*([\d.,]+)/im)
  if (record.totalComprasIVA === 0 && subtotalMatch) {
    record.totalComprasIVA = parseAmount(subtotalMatch[1])
  }

  if (record.totalComprasIVA === 0) {
    const amounts = extractAmounts(text)
    if (amounts.length > 0) {
      record.totalComprasIVA = amounts[0]
    }
  }

  const rifMatch = text.match(/[JVjvEeGg]-?\d[\d.-]{6,12}/i)
  if (rifMatch) {
    record.rif = rifMatch[0]
  } else {
    const ciMatch = text.match(/RIF\/CI\s*[:.]?\s*(\d[\d-]{6,12})/i)
    if (ciMatch) {
      record.rif = ciMatch[1]
    }
  }

  const dateMatch = text.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/)
  if (dateMatch) {
    record.fecha = normalizeDate(dateMatch[0])
  }

  const companyMatch = text.match(/[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.\-&(0-9]{0,60}?\s+(?:C\.?A\.?|S\.?R\.?L\.?|S\.?A\.?|LIMITED|CORP|INC)\b/i)
  if (companyMatch) {
    record.nombreRazon = cleanName(companyMatch[0])
  } else {
    const razonMatch = text.match(/RAZON\s*SOCIAL\s*[:.]?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s.,\-]*(?:\s|$))/i)
    if (razonMatch) {
      record.nombreRazon = cleanName(razonMatch[1])
    }
  }

  const creditNum = extractDocNumber(blockLines, /NOTA DE CR[\wÁÉÍÓÚÑ]+/i)
  if (creditNum) {
    record.nroNotaCredito = normalizeDocNumber(creditNum)
  } else {
    const debitNum = extractDocNumber(blockLines, /NOTA DE D[\wÁÉÍÓÚÑ]+/i)
    if (debitNum) {
      record.nroNotaDebito = normalizeDocNumber(debitNum)
    } else {
      const invoiceNum = extractDocNumber(blockLines, /FACTURA/i)
      if (invoiceNum) {
        record.nroFactura = normalizeDocNumber(invoiceNum)
      }
    }
  }

  const controlNum = extractDocNumber(blockLines, /CONTROL\b/i)
  if (controlNum) {
    record.nroControl = normalizeDocNumber(controlNum)
  }

  const igtfMatch = text.match(/IGTF\s*[:.]?\s*([\d.,]+)/i)
  if (igtfMatch) {
    record.igtf = parseAmount(igtfMatch[1])
  }

  const retMatch = text.match(/Ret(?:enci[oó]n)?\s*IVA\s*[:.]?\s*([\d.,]+)/i)
  if (retMatch) {
    record.retIVA = parseAmount(retMatch[1])
  }

  const hasDocNum = record.nroNotaCredito || record.nroNotaDebito || record.nroFactura || record.nroControl
  if (record.totalComprasIVA <= 0 && !hasDocNum) {
    return null
  }

  record.nro = 1
  return record
}

function extractDocNumber(blockLines, labelRe) {
  for (const line of blockLines) {
    const m = line.match(labelRe)
    if (!m) continue
    const after = line.slice(m.index + m[0].length)
    const vm = after.match(/[\s:.:\u2013\u2014\-]*([0-9A-Za-z\-]+)/)
    if (vm && /\d/.test(vm[1])) return vm[1]
  }
  return null
}

function extractIssuer(blockLines) {
  const text = blockLines.join('\n')
  const rifMatch = text.match(/[JVjvEeGg]-?\d[\d.-]{6,12}/i)
  const companyMatch = text.match(/[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ,.\-&(0-9]{0,60}?\s+(?:C\.?A\.?|S\.?R\.?L\.?|S\.?A\.?|LIMITED|CORP|INC)\b/i)
  if (!rifMatch && !companyMatch) return null
  let control = ''
  const c1 = text.match(/CONTROL\/SER\w*\s*1F\s*:?\s*([A-Z0-9-]+)/i)
  if (c1) {
    control = c1[1]
  } else {
    const c2 = text.match(/\d{2}[A-Z]\d{5,}|\b[A-Z]\d{7,}\b/)
    if (c2) control = c2[0]
  }
  return {
    rif: rifMatch ? rifMatch[0] : '',
    nombreRazon: companyMatch ? cleanName(companyMatch[0]) : '',
    control
  }
}

export function createEmptyRecord() {
  return {
    nro: 1,
    fecha: '',
    rif: '',
    nombreRazon: '',
    porcentajeContribucion: '',
    nroFactura: '',
    nroControl: '',
    nroNotaDebito: '',
    nroNotaCredito: '',
    tipoTransaccion: '01 -Reg',
    nroFacturaAfectada: '',
    totalComprasIVA: 0,
    noGravadas: 0,
    baseNacional: 0,
    alicuotaNac: 16,
    creditoFiscalNac: 0,
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
  }
}

function normalizeDate(input) {
  const m = String(input).match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/)
  if (!m) return input
  let [, dd, mm, yyyy] = m

  let ddN = parseInt(dd, 10)
  let mmN = parseInt(mm, 10)

  if (mmN > 12 || mmN === 0) {
    mm = mm.startsWith('8') ? '0' + mm[1] : mm.startsWith('9') ? '1' + mm[1] : mm
    mmN = parseInt(mm, 10)
  }
  if (ddN > 31 || ddN === 0) {
    dd = dd.startsWith('8') ? '0' + dd[1] : dd.startsWith('9') ? '1' + dd[1] : dd
    ddN = parseInt(dd, 10)
  }

  let yearStr = String(parseInt(yyyy, 10)).padStart(4, '0')
  const yearN = parseInt(yearStr, 10)
  if (yearN > 2100) {
    if (yearStr[1] === '8') yearStr = yearStr[0] + '0' + yearStr.slice(2)
    else if (yearStr[1] === '9') yearStr = yearStr[0] + '1' + yearStr.slice(2)
    if (yearStr[1] === '8') yearStr = yearStr[0] + '0' + yearStr.slice(2)
  }

  if (mmN === 0 || mmN > 12 || ddN === 0 || ddN > 31) {
    return input
  }

  return `${dd}/${mm}/${yearStr}`
}

function cleanName(name) {
  return name.replace(/[()]/g, '').replace(/\s{2,}/g, ' ').trim()
}

function normalizeDocNumber(value) {
  if (!value) return value
  let out = ''
  for (const ch of String(value)) {
    if (/[0-9]/.test(ch)) {
      out += ch
    } else if (/[A-Za-z]/i.test(ch)) {
      out += '0'
    }
  }
  return out
}

function tryParseFallback(fullText) {
  const records = []
  const allRifs = [...new Set(fullText.match(/[JVjvEeGgPp]-?\d[\d.-]{6,12}/gi) || [])]
  const allDates = [...new Set(fullText.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/g) || [])]
  const allAmounts = extractAmounts(fullText)

  if (allRifs.length === 0 && allDates.length === 0) return records

  const maxEntries = Math.max(allRifs.length, allDates.length, 1)

  for (let i = 0; i < maxEntries; i++) {
    const rec = createEmptyRecord()
    rec.nro = i + 1
    rec.fecha = allDates[i] ? normalizeDate(allDates[i]) : ''
    rec.rif = allRifs[i] || ''
    rec.totalComprasIVA = allAmounts[i] || 0
    if (rec.totalComprasIVA > 0) {
      rec.baseNacional = Math.round((rec.totalComprasIVA / 1.16) * 100) / 100
      rec.creditoFiscalNac = Math.round(rec.baseNacional * 0.16 * 100) / 100
    }
    records.push(rec)
  }

  return records
}

function extractAmounts(text) {
  const matches = text.match(/Bs\.?\s*[\d., ]+|\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?/g) || []
  const parsed = []

  for (const m of matches) {
    const cleaned = m.replace(/[^\d.,]/g, '')
    if (!cleaned) continue
    const amount = parseAmount(cleaned)
    if (amount >= 0.01 && amount <= 99999999999) {
      parsed.push(amount)
    }
  }

  return parsed.filter(v => v > 0).sort((a, b) => b - a)
}