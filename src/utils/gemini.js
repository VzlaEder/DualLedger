import { PRINT_EXTRACTION_PROMPT, INVOICE_EXTRACTION_PROMPT } from './prompts'
import { getApiKey } from './apiKey'
import { createEmptyRecord } from './parse'

const GEMINI_MODEL = 'gemini-3.1-flash-lite'
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 3000

export async function testCredential(key) {
  const credential = (key || getApiKey()).trim()
  if (!credential) {
    return { ok: false, message: 'No hay credencial' }
  }
  const body = { contents: [{ parts: [{ text: 'responde OK' }] }] }
  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${encodeURIComponent(credential)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(body),
      cache: 'no-store'
    })
    if (res.ok) {
      return { ok: true, message: 'Credencial válida' }
    }
    const errBody = await res.text()
    let motivo = `Error ${res.status}`
    const info = JSON.parse(errBody)
    if (info && info.error && info.error.message) motivo = info.error.message
    return { ok: false, message: motivo, status: res.status }
  } catch (e) {
    return { ok: false, message: e.message || 'Error de red' }
  }
}

export async function recognizeWithGemini(imageFile, onProgress, options = {}) {
  const credential = getApiKey()
  if (!credential) {
    throw new Error('No hay credencial de Gemini configurada')
  }

  const prompt = options.handwritten ? INVOICE_EXTRACTION_PROMPT : PRINT_EXTRACTION_PROMPT

  if (onProgress) {
    onProgress({ status: 'convirtiendo imagen', progress: 0.1 })
  }

  const base64 = await fileToBase64(imageFile)
  const mimeType = imageFile.type || 'image/jpeg'

  if (onProgress) {
    onProgress({ status: 'enviando a Gemini', progress: 0.3 })
  }

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      max_output_tokens: 1024
    }
  }

  const apiUrl = `${GEMINI_API_URL}?key=${encodeURIComponent(credential)}`
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  }

  let response
  let lastError = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
      if (onProgress) onProgress({ status: `reintentando con Gemini (intento ${attempt + 1})`, progress: 0.3 })
    }
    response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      cache: 'no-store'
    })

    if (response.status === 503) {
      lastError = 'El modelo de Gemini está saturado temporalmente. Reintentando...'
      continue
    }
    break
  }

  if (!onProgress) {
    onProgress = () => {}
  }

  if (!response.ok) {
    const errorBody = await response.text()
    let serverMsg = ''
    try {
      const info = JSON.parse(errorBody)
      if (info && info.error && info.error.message) serverMsg = ` (${info.error.message})`
    } catch (e) { /* noop */ }
    if (response.status === 400) {
      throw new Error('Gemini rechazó la solicitud (posible imagen muy grande o formato inválido)' + serverMsg)
    }
    if (response.status === 401) {
      throw new Error('Credencial no autorizada o expirada. El token "AQ" caduca, genera uno nuevo en Google AI Studio.' + serverMsg)
    }
    if (response.status === 403) {
      throw new Error('Sin permisos para esta credencial. Verifica tu cuenta/API en Google AI Studio.' + serverMsg)
    }
    if (response.status === 429) {
      throw new Error('Límite de requests alcanzado. Intenta de nuevo en unos minutos.' + serverMsg)
    }
    if (response.status === 404) {
      throw new Error(`Modelo no disponible: ${errorBody}` + serverMsg)
    }
    throw new Error(`Error de la API de Gemini (${response.status})${serverMsg}`)
  }

  onProgress({ status: 'procesando respuesta', progress: 0.8 })

  const data = await response.json()

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Respuesta vacía de la API de Gemini')
  }

  const textResponse = data.candidates[0].content.parts
    .map(p => p.text)
    .join('')
    .trim()

  onProgress({ status: 'parseando datos', progress: 0.9 })

  const parsed = parseGeminiResponse(textResponse)
  parsed.handwritten = !!options.handwritten

  const rawText = formatAsText(parsed)

  return {
    rawText,
    lines: rawText.split('\n'),
    parsedData: [parsed],
    engine: 'gemini'
  }
}

export async function transcribeCaptchaWithGemini(base64Image, { signal } = {}) {
  const credential = getApiKey()
  if (!credential) {
    throw new Error('No hay credencial de Gemini configurada')
  }

  const requestBody = {
    contents: [{
      parts: [
        { text: 'Esto es una imagen CAPTCHA. Transcribe EXACTAMENTE los caracteres visibles (letras y/o números), sin espacios, sin signos, sin texto adicional. Responde SOLO con los caracteres, máximo 10.' },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Image
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0,
      max_output_tokens: 20
    }
  }

  const apiUrl = `${GEMINI_API_URL}?key=${encodeURIComponent(credential)}`
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify(requestBody),
    cache: 'no-store',
    signal
  })

  if (!res.ok) {
    const errorBody = await res.text()
    let serverMsg = ''
    try {
      const info = JSON.parse(errorBody)
      if (info && info.error && info.error.message) serverMsg = ` (${info.error.message})`
    } catch (e) { /* noop */ }
    throw new Error(`Error de Gemini al transcribir el captcha (${res.status})${serverMsg}`)
  }

  const data = await res.json()
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Respuesta vacía de Gemini para el captcha')
  }

  return data.candidates[0].content.parts.map(p => p.text).join('').trim()
}

function parseGeminiResponse(text) {
  let cleaned = text.trim()

  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
  cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '')

  let json
  try {
    json = JSON.parse(cleaned)
  } catch (e) {
    console.warn('[Gemini] Error parseando JSON, intentando extraer:', e)
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      json = JSON.parse(match[0])
    } else {
      throw new Error('No se pudo parsear la respuesta de Gemini como JSON')
    }
  }

  return mapToRecord(json)
}

function mapToRecord(json) {
  const record = createEmptyRecord()

  const confidencias = {}
  Object.keys(json).forEach(key => {
    if (key.startsWith('confianza_')) {
      confidencias[key.replace('confianza_', '')] = json[key]
    }
  })
  record.confidencias = confidencias

  record.tipoDocumento = json.tipoDocumento || ''
  record.rif = json.rif || ''
  record.nombreRazon = json.nombreRazon || ''
  record.fecha = json.fecha || ''
  record.nroFactura = cleanDocNumber(json.nroFactura)
  record.nroControl = cleanDocNumber(json.nroControl)
  record.nroNotaCredito = cleanDocNumber(json.nroNotaCredito)
  record.nroNotaDebito = cleanDocNumber(json.nroNotaDebito)
  record.totalComprasIVA = parseNumber(json.totalComprasIVA)
  record.baseNacional = parseNumber(json.baseImponible)
  record.igtf = parseNumber(json.igtf)
  record.retIVA = parseNumber(json.retIVA)

  if (json.tipoTransaccion) {
    record.tipoTransaccion = json.tipoTransaccion
  }

  if (record.totalComprasIVA > 0 && !record.baseNacional) {
    record.baseNacional = Math.round((record.totalComprasIVA / 1.16) * 100) / 100
  }
  if (record.baseNacional > 0) {
    record.creditoFiscalNac = Math.round(record.baseNacional * 0.16 * 100) / 100
  }

  return record
}

function cleanDocNumber(value) {
  if (!value) return ''
  let out = ''
  for (const ch of String(value)) {
    if (/[0-9]/.test(ch)) {
      out += ch
    }
  }
  return out
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return value
  const cleaned = String(value)
    .replace(/[^\d.,\-]/g, '')
    .replace(/\./g, match => match)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return parseFloat(cleaned.replace(/,/g, '')) || 0
  }
  if (cleaned.includes(',')) {
    const asDot = cleaned.replace(',', '.')
    return parseFloat(asDot) || 0
  }
  return parseFloat(cleaned) || 0
}

function formatAsText(record) {
  const lines = []
  if (record.rif) lines.push(`RIF: ${record.rif}`)
  if (record.nombreRazon) lines.push(`RAZON: ${record.nombreRazon}`)
  if (record.fecha) lines.push(`FECHA: ${record.fecha}`)
  if (record.nroFactura) lines.push(`FACTURA: ${record.nroFactura}`)
  if (record.nroControl) lines.push(`CONTROL: ${record.nroControl}`)
  if (record.nroNotaCredito) lines.push(`NOTA DE CREDITO: ${record.nroNotaCredito}`)
  if (record.nroNotaDebito) lines.push(`NOTA DE DEBITO: ${record.nroNotaDebito}`)
  if (record.totalComprasIVA) lines.push(`TOTAL: ${record.totalComprasIVA}`)
  if (record.baseNacional) lines.push(`BASE: ${record.baseNacional}`)
  if (record.igtf) lines.push(`IGTF: ${record.igtf}`)
  if (record.retIVA) lines.push(`RET IVA: ${record.retIVA}`)
  return lines.join('\n')
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
