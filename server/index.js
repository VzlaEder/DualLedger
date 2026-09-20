import express from 'express'
import cors from 'cors'
import pg from 'pg'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env') })

const app = express()
const router = express.Router()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 8787
const SENIAT_BASE = 'http://contribuyente.seniat.gob.ve'
const FORM_URL = `${SENIAT_BASE}/BuscaRif/BuscaRif.jsp`
const CAPTCHA_URL = `${SENIAT_BASE}/BuscaRif/Captcha.jpg`
const SENIAT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
let pool = null

if (databaseUrl) {
  pool = new Pool({ connectionString: databaseUrl, max: 5 })
  console.log('[Postgres] Conectado a la base de datos local')
} else {
  console.warn('[Postgres] No configurado (falta DATABASE_URL) - cache deshabilitado')
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

function isNotFoundLike(value) {
  return /no\s+existe|no\s+se\s+encontr/i.test(String(value || ''))
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
  if (!pool) return null
  try {
    const { rows } = await pool.query(
      'SELECT rif, nombre_razon, porcentaje_contribucion, condicion FROM rif_cache WHERE rif = $1',
      [rif]
    )
    if (!rows.length) return null
    const data = rows[0]
    return {
      rif: data.rif,
      nombreRazon: data.nombre_razon,
      porcentajeContribucion: data.porcentaje_contribucion,
      condicion: data.condicion
    }
  } catch (e) {
    console.error('[Postgres] Lookup error:', e.message)
    return null
  }
}

async function saveCache(rif, data) {
  if (!pool) return
  try {
    await pool.query(
      `INSERT INTO rif_cache (rif, nombre_razon, porcentaje_contribucion, condicion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (rif) DO UPDATE SET
         nombre_razon = EXCLUDED.nombre_razon,
         porcentaje_contribucion = EXCLUDED.porcentaje_contribucion,
         condicion = EXCLUDED.condicion`,
      [rif, data.nombreRazon || '', data.porcentajeContribucion, data.condicion || '']
    )
  } catch (e) {
    console.error('[Postgres] Save error:', e.message)
  }
}

// === Rutas ===

router.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'dualledger-proxy',
    message: 'Proxy local DualLedger. Usa /verify, /lookup, /captcha.',
    postgres: !!pool
  })
})

router.post('/captcha', async (req, res) => {
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

router.post('/lookup', async (req, res) => {
  const rif = String(req.body.rif || '').replace(/[\s-]/g, '').toUpperCase().trim()
  if (!rif) return res.status(400).json({ ok: false, error: 'Falta rif' })

  const cached = await lookupCache(rif)
  if (cached && !isNotFoundLike(cached.nombreRazon)) {
    return res.json({ ...cached, ok: true, hit: true, fromCache: true })
  }
  res.json({ ok: false, hit: false })
})

router.post('/verify', async (req, res) => {
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

    if (isNotFoundLike(data.nombreRazon)) {
      return res.json({ ok: false, notFound: true, rif })
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

app.use('/api', router)

// === Servido del build de producción (dist/) ===
// Solo cuando el proceso se ejecuta de forma independiente (no como middleware de Vite):
// node index.js sirve la app estática + /api + PostgreSQL desde el mismo origen.
const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/index.js')

if (isDirectRun) {
  const distDir = join(__dirname, '..', 'dist')
  if (existsSync(distDir)) {
    app.use(express.static(distDir))
    // SPA fallback: cualquier GET que no sea /api ni un asset vuelve a index.html
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || /\.[a-z0-9]+$/i.test(req.path)) {
        return next()
      }
      res.sendFile(join(distDir, 'index.html'))
    })
    console.log(`[DualLedger] Sirviendo build estático de ${distDir}`)
  } else {
    console.warn('[DualLedger] No existe dist/ - sirviendo solo /api. Ejecuta antes: npm run build')
  }
}

export { app }

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`[DualLedger] Servidor corriendo en http://127.0.0.1:${PORT}`)
    console.log(`[DualLedger] PostgreSQL: ${pool ? 'Conectado' : 'Deshabilitado'}`)
  })
}
