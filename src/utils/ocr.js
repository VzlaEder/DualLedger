import Tesseract from 'tesseract.js'
import { deslashZeros } from './deslash'
import { parseReportData } from './parse'
import { recognizeWithGemini } from './gemini'
import { hasApiKey } from './apiKey'

export async function processImage(imageFile, onProgress) {
  if (hasApiKey()) {
    try {
      return await processWithGemini(imageFile, onProgress)
    } catch (geminiErr) {
      console.warn('[OCR] Gemini falló, usando Tesseract como fallback:', geminiErr)
      const note = geminiErr && geminiErr.message ? geminiErr.message : 'Gemini no disponible'
      return processWithTesseract(imageFile, onProgress, note)
    }
  }
  return processWithTesseract(imageFile, onProgress, 'No hay credencial de Gemini configurada')
}

async function processWithGemini(imageFile, onProgress) {
  return recognizeWithGemini(imageFile, onProgress)
}

async function processWithTesseract(imageFile, onProgress, geminiNote) {
  try {
    const img = await loadImage(imageFile)
    const preprocessed = preprocessImage(img)

    const result = await Tesseract.recognize(preprocessed, 'spa', {
      logger: (m) => {
        if (onProgress && m.status) {
          onProgress({ status: m.status, progress: m.progress || 0 })
        }
      },
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1'
    })

    let text = result.data.text
    const rawText = text

    const corrected = await reOcrNumberFields(result.data, preprocessed, onProgress)
    for (const fix of corrected) {
      const updated = applyNumberFix(text, fix.labelPrefix, fix.digits)
      if (updated !== text) {
        console.log('[OCR] Aplicado', fix.labelPrefix, '->', fix.digits)
        text = updated
      } else {
        console.warn('[OCR] No se pudo aplicar', fix.labelPrefix, fix.digits)
      }
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    return {
      rawText,
      lines,
      parsedData: parseReportData(lines, text),
      engine: 'tesseract',
      geminiNote
    }
  } catch (err) {
    console.error('OCR preprocessing error, falling back to raw:', err)
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
      parsedData: parseReportData(lines, text),
      engine: 'tesseract',
      geminiNote
    }
  }
}

function applyNumberFix(text, labelPrefix, digits) {
  if (!labelPrefix || !digits) return text
  const esc = labelPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(esc + '[ \\t]*[:.\\-–—]?[ \\t]*([0-9A-Za-z\\-]{1,40})', 'g')
  return text.replace(re, (m, val) => {
    const sep = m.slice(labelPrefix.length).replace(/[0-9A-Za-z\\-]/g, '')
    return labelPrefix + sep + digits
  })
}

async function reOcrNumberFields(resultData, sourceDataUrl, onProgress) {
  const fixes = []
  if (!resultData || !resultData.blocks) {
    console.warn('[OCR] Sin datos de bloques, no se puede re-leer números')
    return fixes
  }

  const candidates = []

  for (const block of resultData.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        if (!line || !line.text || !line.words || line.words.length === 0) continue
        const lineText = line.text
        let anchor = null
        let charset = '0123456789'

        if (/NOTA DE CR/i.test(lineText)) {
          anchor = line.words.find(w => /^C\w*[:.]?$/i.test(w.text))
        } else if (/NOTA DE D/i.test(lineText)) {
          anchor = line.words.find(w => /^D\w*[:.]?$/i.test(w.text))
        } else if (/FACTURA\b/i.test(lineText)) {
          anchor = line.words.find(w => /^FACTURA[:.]?$/i.test(w.text))
        } else if (/NRO\s*\.?\s*CONTROL/i.test(lineText)) {
          anchor = line.words.find(w => /^CONTROL[:.]?$/i.test(w.text))
        } else if (/CONTROL\b/i.test(lineText)) {
          anchor = line.words.find(w => /^CONTROL[:.]?$/i.test(w.text))
        } else if (/^RIF[:.]?\s*\d/i.test(lineText)) {
          anchor = line.words.find(w => /^RIF[:.]?$/i.test(w.text))
          charset = '0123456789-JVE'
        }

        if (anchor && anchor.bbox) {
          const anchorIdx = line.words.indexOf(anchor)
          const valueWords = line.words
            .slice(anchorIdx + 1)
            .filter((w) => w && w.bbox && (w.x0 || w.x0 === 0) && /[0-9A-Za-z]/.test(w.text || ''))
          const labelPrefix = getLabelPrefix(lineText)
          if (labelPrefix) {
            candidates.push({ line, anchor, charset, valueWords, labelPrefix })
          }
        }
      }
    }
  }

  console.log('[OCR] Re-lectura candidatos:', candidates.length)
  const limited = candidates.slice(0, 8)

  for (const { line, anchor, charset, valueWords, labelPrefix } of limited) {
    try {
      const cropUrl = await cropValueRegion(sourceDataUrl, line.bbox, valueWords.length ? null : anchor.bbox, valueWords)
      if (!cropUrl) {
        console.warn('[OCR] Crop vacío para', labelPrefix)
        continue
      }
      const sub = await Tesseract.recognize(cropUrl, 'spa', {
        logger: (m) => {
          if (onProgress && m.status) {
            onProgress({ status: 're-ocando número', progress: m.progress || 0 })
          }
        },
        tessedit_char_whitelist: charset,
        tessedit_pageseg_mode: '7'
      })

      const cleaned = cleanNumericField(sub.data.text || '')
      const digits = cleaned.replace(/[^0-9]/g, '')
      console.log('[OCR]', labelPrefix, '-> leyó', JSON.stringify(sub.data.text), '=>', digits)

      if (digits && digits.length >= 3) {
        fixes.push({ labelPrefix, digits })
      }
    } catch (e) {
      console.warn('[OCR] Re-OCR de campo numérico falló:', e)
    }
  }

  return fixes
}

function getLabelPrefix(lineText) {
  const m = lineText.match(/(NOTA DE C\w+|NOTA DE D\w+|NRO\s*\.?\s*CONTROL|FACTURA|CONTROL|RIF)/i)
  return m ? m[1] : null
}

function cleanNumericField(value) {
  let v = String(value || '').replace(/[^0-9A-Za-z]/g, '')
  let result = ''
  for (const ch of v) {
    if (/[0-9]/.test(ch)) {
      result += ch
    } else {
      result += '0'
    }
  }
  return result
}

function cropValueRegion(sourceDataUrl, lineBBox, anchorBBox, valueWords) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const pad = 6
      let x0 = anchorBBox ? anchorBBox.x1 + pad : null
      let x1 = lineBBox.x1
      let y0 = lineBBox.y0
      let y1 = lineBBox.y1

      if (valueWords && valueWords.length > 0) {
        let vx0 = Infinity
        let vx1 = -Infinity
        let vy0 = Infinity
        let vy1 = -Infinity
        for (const w of valueWords) {
          if (w.bbox.x0 < vx0) vx0 = w.bbox.x0
          if (w.bbox.x1 > vx1) vx1 = w.bbox.x1
          if (w.bbox.y0 < vy0) vy0 = w.bbox.y0
          if (w.bbox.y1 > vy1) vy1 = w.bbox.y1
        }
        x0 = vx0 - pad
        x1 = vx1 + pad
        y0 = vy0 - pad
        y1 = vy1 + pad
      }

      const sx = Math.max(0, Math.floor(x0))
      const sy = Math.max(0, Math.floor(y0))
      const sw = Math.max(10, Math.min(img.width, Math.ceil(x1)) - sx)
      const sh = Math.max(10, Math.min(img.height, Math.ceil(y1)) - sy)
      const ups = 3
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(sw * ups)
      canvas.height = Math.ceil(sh * ups)
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * ups, sh * ups)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = sourceDataUrl
  })
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo cargar la imagen'))
    }
    img.src = url
  })
}

function preprocessImage(img) {
  const scale = 3
  const width = img.naturalWidth * scale
  const height = img.naturalHeight * scale

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  let min = 255
  let max = 0
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
    if (gray < min) min = gray
    if (gray > max) max = gray
  }

  const range = max - min
  if (range > 0) {
    for (let i = 0; i < data.length; i += 4) {
      const stretched = ((data[i] - min) / range) * 255
      data[i] = stretched
      data[i + 1] = stretched
      data[i + 2] = stretched
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const grayCanvas = document.createElement('canvas')
  grayCanvas.width = width
  grayCanvas.height = height
  const gCtx = grayCanvas.getContext('2d')
  gCtx.drawImage(canvas, 0, 0)

  const sharpened = sharpen(grayCanvas, width, height)
  const threshold = otsuThreshold(sharpened.data)
  binarize(sharpened.data, threshold)

  deslashZeros(sharpened.data, width, height)

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const oCtx = out.getContext('2d')
  oCtx.putImageData(sharpened, 0, 0)

  return out.toDataURL('image/png')
}

function sharpen(imageData, width, height) {
  const data = imageData.data
  const out = new Uint8ClampedArray(data)
  const amount = 1.4

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      const center = data[idx]
      const left = data[idx - 4]
      const right = data[idx + 4]
      const top = data[idx - width * 4]
      const bottom = data[idx + width * 4]
      const val = center * (1 + amount * 4) - amount * (left + right + top + bottom)
      out[idx] = Math.max(0, Math.min(255, val))
      out[idx + 1] = out[idx]
      out[idx + 2] = out[idx]
    }
  }

  return { data: out, width, height }
}

function otsuThreshold(data) {
  const histogram = new Array(256).fill(0)
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++
    total++
  }

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]

  let sumB = 0
  let wB = 0
  let maxVariance = 0
  let threshold = 128

  for (let i = 0; i < 256; i++) {
    wB += histogram[i]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += i * histogram[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const variance = wB * wF * (mB - mF) * (mB - mF)
    if (variance > maxVariance) {
      maxVariance = variance
      threshold = i
    }
  }

  return threshold
}

function binarize(data, threshold) {
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] <= threshold ? 0 : 255
    data[i] = val
    data[i + 1] = val
    data[i + 2] = val
  }
}
export function getFieldSuggestions(rawText) {
  return {
    rifs: [...new Set(rawText.match(/[JVjvEeGgPp]-?\d[\d.-]{6,12}/gi) || [])],
    dates: [...new Set(rawText.match(/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/g) || [])],
    amounts: [...new Set((rawText.match(/[\d., ]{6,}/g) || []).slice(0, 20))],
    controlNumbers: [...new Set(rawText.match(/\d{2}-\d{7,10}/g) || [])]
  }
}
