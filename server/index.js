import express from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env') })

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 8787
const SENIAT_BASE = 'http://contribuyente.seniat.gob.ve'
const FORM_URL = `${SENIAT_BASE}/BuscaRif/BuscaRif.jsp`
const CAPTCHA_URL = `${SENIAT_BASE}/BuscaRif/Captcha.jpg`
const SENIAT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
let supabase = null

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey)
  console.log('[Supabase] Conectado a', supabaseUrl)
} else {
  console.warn('[Supabase] No configurado - cache deshabilitado')
}

function decodeHtml(buf) {
  const bytes = new Uint8Array(buf)
  let text = ''
  for (let i = 0; i < bytes.length; i++) {
    text += String.fromCharCode(bytes[i])
  }
  return text
}

function stripCookieParts(cookies) {
  return cookies
    .map(c => c.split(';')[0].trim())
    .filter(c => c && c.includes('=') && !c.startsWith('HttpOnly') && !c.startsWith('Secure'))
}

function readCookies(headers) {
  const raw = headers.getSetCookie ? headers.getSetCookie() : []
  if (raw.length > 0) return raw
  const single = headers.get('set-cookie')
  return single ? [single] : []
}

function parseResult(html) {
  // Pattern 1: "J070080752 SIDERURGICA ZULIANA, C.A. (SIDERURGICA ZULIANA, C.A.  )"
  const nameMatch = html.match(/<b><font[^>]*>[A-Z0-9]\d{9}&nbsp;([^<]+)<\/b><\/font>/i)
    || html.match(/Raz[oó]n\s+Social[:\s]*<\/[^>]+>\s*<[^>]+>\s*<[^>]+>([^<]+)/i)
    || html.match(/ Raz[oó]n Social\s*<\/b>\s*<\/td>\s*<td[^>]*>\s*([^<]+)/i)
    || html.match(/<b>\s*Raz[oó]n\s+Social\s*<\/b>\s*<\/td>\s*<td[^>]*>\s*([^<]+)/i)
  let name = nameMatch ? nameMatch[1].trim() : null
  if (name) {
    name = name.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    const openParens = (name.match(/\(/g) || []).length
    const closeParens = (name.match(/\)/g) || []).length
    if (openParens > closeParens) name += ')'
  }

  // Pattern: "retención del 75%" or "retencion del 75%"
  const pctMatch = html.match(/retenci[oó]n\s+del\s+(\d{1,3})\s*%/i)
    || html.match(/(\d{1,3})\s*%\s*de\s*contribuci[oó]n/i)
    || html.match(/contribuci[oó]n[:\s]*(\d{1,3})\s*%/i)
    || html.match(/porcentaje[:\s]*(\d{1,3})\s*%/i)
  const pct = pctMatch ? parseInt(pctMatch[1], 10) : null

  // Pattern: "Condición: Contribuyente Ordinario del IVA..."
  const condMatch = html.match(/Condici[oó]n:\s*([^<\n]+)/i)
    || html.match(/Condici[oó]n[:\s]*<\/[^>]+>\s*<[^>]+>\s*<[^>]+>([^<]+)/i)
    || html.match(/ Condici[oó]n\s*<\/b>\s*<\/td>\s*<td[^>]*>\s*([^<]+)/i)
  const condicion = condMatch ? condMatch[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : null

  return { name, pct, condicion }
}

function looksLikeRetry(html) {
  const ERROR_PATTERNS = /(no\s+coincide|rechazad|intento|no\s+es\s+correcto)/i
  return ERROR_PATTERNS.test(html)
}

function isErrorMessageLike(value) {
  return /no\s+coincide|el\s+c[dó]digo|la\s+imagen|rechazad|no\s+es\s+correcto/i.test(String(value || ''))
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
}

async function fetchWithRetry(fn, attempts = 2, delayMs = 2000) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return Buffer.from(binary, 'binary').toString('base64')
}

async function lookupCache(rif) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('rif_cache')
      .select('rif, nombre_razon, porcentaje_contribucion, condicion')
      .eq('rif', rif)
      .single()
    if (error || !data) return null
    return {
      rif: data.rif,
      nombreRazon: data.nombre_razon,
      porcentajeContribucion: data.porcentaje_contribucion,
      condicion: data.condicion
    }
  } catch (e) {
    console.error('[Supabase] Lookup error:', e.message)
    return null
  }
}

async function saveCache(rif, data) {
  if (!supabase) return
  try {
    await supabase
      .from('rif_cache')
      .upsert({
        rif,
        nombre_razon: data.nombreRazon || '',
        porcentaje_contribucion: data.porcentajeContribucion,
        condicion: data.condicion || ''
      }, { onConflict: 'rif' })
  } catch (e) {
    console.error('[Supabase] Save error:', e.message)
  }
}

// === Rutas ===

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'dualledger-proxy',
    message: 'Proxy local DualLedger. Usa /verify, /lookup, /captcha.',
    supabase: !!supabase
  })
})

app.post('/captcha', async (req, res) => {
  try {
    const result = await fetchWithRetry(async () => {
      const formRes = await fetchWithTimeout(FORM_URL, {
        redirect: 'follow',
        headers: { 'User-Agent': SENIAT_UA }
      })
      const formCookies = stripCookieParts(readCookies(formRes.headers))
      const cookieHeader = formCookies.join('; ')

      const captchaRes = await fetchWithTimeout(CAPTCHA_URL, {
        headers: {
          'User-Agent': SENIAT_UA,
          ...(cookieHeader ? { Cookie: cookieHeader, Referer: FORM_URL } : { Referer: FORM_URL })
        }
      })
      const captchaCookies = stripCookieParts(readCookies(captchaRes.headers))
      const cookies = [...formCookies, ...captchaCookies.reduce((acc, c) => {
        const name = c.split('=')[0]
        if (acc.some(x => x.split('=')[0] === name)) return acc
        acc.push(c)
        return acc
      }, [])]

      const buf = await captchaRes.arrayBuffer()
      if (!buf || buf.byteLength === 0) throw new Error('SENIAT no devolvió imagen de captcha')
      return { cookies, imageBase64: arrayBufferToBase64(buf) }
    })

    res.json({ ok: true, imageBase64: result.imageBase64, cookies: result.cookies })
  } catch (e) {
    console.error('[Captcha] Error:', e.message)
    res.status(502).json({ ok: false, error: 'No se pudo contactar el SENIAT', detail: String(e.message) })
  }
})

app.post('/lookup', async (req, res) => {
  const rif = String(req.body.rif || '').replace(/[\s-]/g, '').toUpperCase().trim()
  if (!rif) return res.status(400).json({ ok: false, error: 'Falta rif' })

  const cached = await lookupCache(rif)
  if (cached) {
    return res.json({ ...cached, ok: true, hit: true, fromCache: true })
  }
  res.json({ ok: false, hit: false })
})

app.post('/verify', async (req, res) => {
  const rif = String(req.body.rif || '').replace(/[\s-]/g, '').toUpperCase().trim()
  const codigo = String(req.body.codigo || '').trim()
  const cookieHeader = (req.body.cookies || []).join('; ')
  const forceRefresh = !!req.body.forceRefresh

  if (!rif || !codigo) return res.status(400).json({ ok: false, error: 'Faltan rif o codigo' })

  if (!forceRefresh) {
    const cached = await lookupCache(rif)
    if (cached) return res.json({ ...cached, ok: true, fromCache: true })
  }

  try {
    const form = new URLSearchParams()
    form.set('p_rif', rif)
    form.set('p_cedula', '')
    form.set('codigo', codigo)
    form.set('busca', 'Buscar')

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': SENIAT_UA,
      Referer: FORM_URL,
      Origin: SENIAT_BASE
    }
    if (cookieHeader) headers.Cookie = cookieHeader

    const postRes = await fetchWithRetry(() =>
      fetchWithTimeout(FORM_URL, {
        method: 'POST',
        headers,
        body: form.toString(),
        redirect: 'follow'
      })
    )

    const html = decodeHtml(await postRes.arrayBuffer())
    const parsed = parseResult(html)
    const { name, pct, condicion } = parsed

    if (looksLikeRetry(html)) {
      return res.json({ ok: false, captchaError: true, retryHint: 3 })
    }

    if (!name && !pct) {
      return res.json({ ok: false, error: 'No se encontraron datos para ese RIF' })
    }

    const data = {
      rif,
      nombreRazon: name || '',
      porcentajeContribucion: pct,
      condicion: condicion || ''
    }

    if (isErrorMessageLike(data.nombreRazon)) {
      return res.json({ ok: false, captchaError: true, retryHint: 3 })
    }

    await saveCache(rif, data)
    return res.json({ ...data, ok: true })
  } catch (e) {
    console.error('[Verify] Error:', e.message)
    res.status(502).json({ ok: false, error: 'Falló la consulta al SENIAT', detail: String(e.message) })
  }
})

app.listen(PORT, () => {
  console.log(`[DualLedger] Proxy local corriendo en http://127.0.0.1:${PORT}`)
  console.log(`[DualLedger] Supabase: ${supabase ? 'Conectado' : 'Deshabilitado'}`)
})
