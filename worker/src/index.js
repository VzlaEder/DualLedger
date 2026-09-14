const SENIAT_BASE = 'http://contribuyente.seniat.gob.ve'
const FORM_URL = `${SENIAT_BASE}/BuscaRif/BuscaRif.jsp`
const CAPTCHA_URL = `${SENIAT_BASE}/BuscaRif/Captcha.jpg`
const SENIAT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const CF_API = 'https://api.cloudflare.com/client/v4'
const WORKER_NAME = 'dual-ledger-seniat'
const KV_BINDING = 'RIF_CACHE'
const DEPLOY_COMPATIBILITY_DATE = '2025-06-01'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

const MAX_RETRY_HINT = 3
const FETCH_ATTEMPTS = 1
const FETCH_RETRY_DELAY_MS = 1200

async function cfRequest(token, path, options = {}) {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })
  let payload = null
  try {
    payload = await res.json()
  } catch (e) {
    payload = null
  }
  if (!res.ok) {
    const e0 = payload && payload.errors && payload.errors[0]
    const code = e0 && e0.code
    const msg = (e0 && e0.message) || `HTTP ${res.status}`
    if (code === 9109 && /location/i.test(msg)) {
      throw new Error(
        'El API Token tiene restricción de IP: el despliegue se hace desde la IP del Worker. ' +
          'Quita "Client IP Address Filtering" al crear el token o crea uno nuevo sin restricciones.'
      )
    }
    if (code === 10000 || /authentication/i.test(msg)) {
      throw new Error(
        'El API Token no es válido: cópialo completo al crearlo (empieza por cfat_ y termina sin saltos ni espacios) y asegúrate de haber elegido tu cuenta en "Account Resources" → "Include".'
      )
    }
    if (code === 10005 || /invalid account/i.test(msg)) {
      throw new Error('El Account ID no existe o no pertenece al token. Verifícalo en Cloudflare (My Profile → Account ID).')
    }
    throw new Error(msg)
  }
  return payload
}

async function verifyCfToken(token) {
  const data = await cfRequest(token, '/accounts')
  return !!(data.result && data.result.length)
}

async function resolveAccount(token) {
  const data = await cfRequest(token, '/accounts')
  const accounts = (data.result || []).filter((a) => a && a.id)
  if (!accounts.length) throw new Error('El token no tiene acceso a ninguna cuenta')
  return accounts[0].id
}

async function ensureNamespace(token, accountId) {
  const list = await cfRequest(token, `/accounts/${accountId}/storage/kv/namespaces?per_page=50`)
  const existing = (list.result || []).find((n) => n && n.title === KV_BINDING)
  if (existing) return existing.id
  const created = await cfRequest(token, `/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    body: JSON.stringify({ title: KV_BINDING })
  })
  return created.result.id
}

async function deployWorkerScript(token, accountId, kvId, script) {
  const metadata = JSON.stringify({
    main_module: 'index.js',
    bindings: [
      { type: 'kv_namespace', name: KV_BINDING, namespace_id: kvId }
    ],
    compatibility_date: DEPLOY_COMPATIBILITY_DATE
  })

  const form = new FormData()
  form.append('metadata', metadata)
  form.append(
    'index.js',
    new Blob([script], { type: 'application/javascript+module' }),
    'index.js'
  )

  const res = await fetch(`${CF_API}/accounts/${accountId}/workers/scripts/${WORKER_NAME}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })

  let payload = null
  try {
    payload = await res.json()
  } catch (e) {
    payload = null
  }
  if (!res.ok) {
    const msg = (payload && payload.errors && payload.errors[0] && payload.errors[0].message) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return (payload.result && payload.result.id) || WORKER_NAME
}

async function resolveSubdomain(token, accountId) {
  try {
    const data = await cfRequest(token, `/accounts/${accountId}/workers/subdomain`)
    return (data.result && data.result.subdomain) || null
  } catch (e) {
    return null
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  })
}

function readCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie()
  const val = headers.get('set-cookie')
  return val ? [val] : []
}

function normalizeCookies(cookies) {
  if (Array.isArray(cookies)) return cookies
  if (typeof cookies === 'string') return [cookies]
  return []
}

function stripCookieParts(cookies) {
  return (cookies || [])
    .filter((c) => typeof c === 'string')
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .filter((c) => c.includes('='))
}

function decodeHtml(bytes) {
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (!utf8.includes('\uFFFD')) return utf8
  } catch (e) {}
  return new TextDecoder('windows-1252').decode(bytes)
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
}

async function fetchWithRetry(fn, attempts = FETCH_ATTEMPTS, delayMs = FETCH_RETRY_DELAY_MS) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

function extractField(html, labelRe, valueRe, flags = 'i') {
  const m = html.match(labelRe)
  if (!m) return null
  const after = html.slice(m.index + m[0].length)
  const v = after.match(valueRe)
  if (!v) return null
  const out = v[1].replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim()
  return out || null
}

function nameBeforeActivity(text) {
  const m = text.match(/Actividad\s+Econ[o\u00f3]mica[^<\n]{0,40}[:<]/i)
  if (!m) return null
  const before = text.slice(0, m.index)
  const lines = before.split(/\r?\n/).map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean)
  if (!lines.length) return null
  const out = lines[lines.length - 1].replace(/\s{2,}/g, ' ')
  return cleanName(out)
}

const ERROR_PATTERNS = /(no\s+coincide|rechazad|intento|no\s+es\s+correcto)/i

function looksLikeRetry(html) {
  const norm = html.toLowerCase()
  return ERROR_PATTERNS.test(norm)
}

function isErrorMessageLike(s) {
  return !!s && ERROR_PATTERNS.test(String(s))
}

function cleanName(s) {
  if (!s) return null
  let out = s.replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' ').trim()
  out = out.replace(/^[vejpgVJPG]\d{6,10}\s+/, '')
  out = out.replace(/\s{2,}/g, ' ').trim()
  if (isErrorMessageLike(out)) return null
  return out || null
}

function parseResult(html, debug = false) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')

  let name = extractField(text, /(?:raz\u00f3n social|razon social|nombre\s*del\s*contribuyente|denominaci\u00f3n)\s*[:.<\s]*/i, /([^<\n]{2,120})/)
  || (() => {
    const bolds = [...text.matchAll(/\s*<b>\s*<font[^>]*>\s*([^<]{2,150}?)\s*<\/b>\s*<\/font>|\s*<b>\s*<font[^>]*>\s*([^<]{2,150}?)\s*<\/font>\s*<\/b>/ig)]
    for (const m of bolds) {
      const candidate = cleanName(m[1] || m[2])
      if (candidate) return candidate
    }
    return null
  })()
  || nameBeforeActivity(text)

  if (isErrorMessageLike(name)) {
    name = null
  }

  let pct = null
  const pctRet = text.match(/retenci[o\u00f3]n\s*(?:del|de\s+un)\s+(\d{2,3}(?:[.,]\d{1,2})?)\s*%/i)
  if (pctRet) pct = pctRet[1]
  if (pct === null) {
    const pctM = text.match(/(\d{2,3}(?:[.,]\d{1,2})?)\s*%\s*(?:de\s*)?contribuci[o\u00f3]n/i)
    if (pctM) pct = pctM[1]
  }
  if (pct === null) {
    const pctM2 = text.match(/contribuci[o\u00f3]n[^%]*?(\d{2,3}(?:[.,]\d{1,2})?)\s*%/i)
    if (pctM2) pct = pctM2[1]
  }

  let condicion = null
  const condBlock = text.match(/condici[o\u00f3]n\s*[:.<\s]*\s*([\s\S]{4,200}?)(?:\n\s*\n|La\s+condici[o\u00f3]n|<table|<br\s*\/?>\s*<br)/i)
  if (condBlock) {
    condicion = condBlock[1].replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
  } else {
    const condM = text.match(/condici[o\u00f3]n(?:\s*del\s*contribuyente)?\s*[:.<\s]*/i)
    if (condM) {
      const after = text.slice(condM.index + condM[0].length).match(/([A-Z\u00c0-\u017f][^<]{2,120})/)
      if (after) condicion = after[1].replace(/\s{2,}/g, ' ').trim()
    }
  }
  if (condicion) condicion = condicion.replace(/\s+/g, ' ').trim()
  if (condicion && /^\s*(Contribuyente|Agente|No|Sujeto|Acredita)/i.test(condicion) === false) {
    condicion = null
  }

  const result = { name, pct, condicion }
  if (debug) {
    result.rawHtml = html.slice(0, 4000)
    result.rawLength = html.length
  }
  return result
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (url.pathname === '/captcha' && request.method === 'POST') {
      try {
        const { cookies, imageBase64 } = await fetchWithRetry(async () => {
          const formRes = await fetchWithTimeout(FORM_URL, { redirect: 'follow', headers: { 'User-Agent': SENIAT_UA } })
          const formCookies = stripCookieParts(readCookies(formRes.headers))
          const cookieHeader = formCookies.join('; ')
          const captchaRes = await fetchWithTimeout(CAPTCHA_URL, {
            headers: { 'User-Agent': SENIAT_UA, ...(cookieHeader ? { Cookie: cookieHeader, Referer: FORM_URL } : { Referer: FORM_URL }) }
          })
          const captchaCookies = stripCookieParts(readCookies(captchaRes.headers))
          const cookies = [...formCookies, ...captchaCookies.reduce((acc, c) => {
            const name = c.split('=')[0]
            if (acc.some((x) => x.split('=')[0] === name)) return acc
            acc.push(c)
            return acc
          }, [])]
          const buf = await captchaRes.arrayBuffer()
          if (!buf || buf.byteLength === 0) throw new Error('SENIAT no devolvi\u00f3 imagen de captcha')
          return { cookies, imageBase64: arrayBufferToBase64(buf) }
        })
        return json({ ok: true, imageBase64, cookies })
      } catch (e) {
        return json({ ok: false, error: 'No se pudo contactar el SENIAT', detail: String((e && e.message) || e) }, 502)
      }
    }

    if (url.pathname === '/lookup' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch (e) {
        return json({ ok: false, error: 'JSON inv\u00e1lido' }, 400)
      }
      const rif = String(body.rif || '').trim().toUpperCase()
      if (!rif) return json({ ok: false, error: 'Falta rif' }, 400)
      if (!env.RIF_CACHE) return json({ ok: false, hit: false })

      const cached = await env.RIF_CACHE.get(rif)
      if (!cached) return json({ ok: false, hit: false })
      try {
        return json({ ...JSON.parse(cached), ok: true, hit: true, fromCache: true })
      } catch (e) {
        return json({ ok: false, hit: false })
      }
    }

    if (url.pathname === '/verify' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch (e) {
        return json({ ok: false, error: 'JSON inv\u00e1lido' }, 400)
      }

      const rif = String(body.rif || '').trim().toUpperCase()
      const codigo = String(body.codigo || '').trim()
      const cookieHeader = stripCookieParts(normalizeCookies(body.cookies)).join('; ')
      const forceRefresh = !!body.forceRefresh
      const debug = !!body.debug

      if (!rif || !codigo) {
        return json({ ok: false, error: 'Faltan rif o codigo' }, 400)
      }

      try {
        if (!forceRefresh && env.RIF_CACHE) {
          const cached = await env.RIF_CACHE.get(rif)
          if (cached) {
            const data = JSON.parse(cached)
            if (debug) {
              return json({ ...data, ok: true, fromCache: true, rawHtml: '(en cache)', rawLength: 0 })
            }
            return json({ ...data, ok: true, fromCache: true })
          }
        }

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
        const parsed = parseResult(html, debug)
        const { name, pct } = parsed

        if (looksLikeRetry(html)) {
          const resp = { ok: false, captchaError: true, retryHint: MAX_RETRY_HINT }
          if (debug) {
            resp.rawHtml = html.slice(0, 8000)
            resp.rawLength = html.length
            resp.parsed = parsed
            resp.meta = {
              status: postRes.status,
              headers: Object.fromEntries(postRes.headers.entries())
            }
          }
          return json(resp)
        }

        if (!name && !pct) {
          const resp = { ok: false, error: 'No se encontraron datos para ese RIF', rawLength: html.length }
          if (debug) {
            resp.rawHtml = html.slice(0, 4000)
            resp.parsed = parsed
            resp.meta = {
              status: postRes.status,
              headers: Object.fromEntries(postRes.headers.entries())
            }
          }
          return json(resp)
        }

        const data = {
          rif,
          nombreRazon: name || '',
          porcentajeContribucion: pct === null ? null : Number(pct.replace(',', '.')),
          condicion: parsed.condicion || ''
        }

        if (env.RIF_CACHE) {
          await env.RIF_CACHE.put(rif, JSON.stringify(data))
        }

        if (debug) {
          return json({ ...data, ok: true, fromCache: false, rawHtml: html.slice(0, 4000), rawLength: html.length, meta: { status: postRes.status, headers: Object.fromEntries(postRes.headers.entries()) } })
        }
        return json({ ...data, ok: true, fromCache: false })
      } catch (e) {
        return json({ ok: false, error: 'Fall\u00f3 la consulta al SENIAT', detail: String((e && e.message) || e) }, 502)
      }
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return json(
        {
          ok: true,
          service: 'dual-ledger-seniat',
          message: 'Worker activo. Usa /verify, /lookup, /captcha o /deploy desde la app.'
        },
        200
      )
    }

    if (url.pathname === '/deploy' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch (e) {
        return json({ ok: false, error: 'JSON inv\u00e1lido' }, 400)
      }
      const token = String(body.token || '').trim()
      const accountId = String(body.accountId || '').trim()
      const script = String(body.script || '')
      if (!token) return json({ ok: false, error: 'Falta el API Token de Cloudflare' }, 400)
      if (!script) return json({ ok: false, error: 'Falta el c\u00f3digo del Worker' }, 400)

      try {
        const valid = await verifyCfToken(token)
        if (!valid) return json({ ok: false, error: 'El API Token no es v\u00e1lido o est\u00e1 inactivo' }, 401)

        const resolvedAccount = accountId || (await resolveAccount(token))
        const kvId = await ensureNamespace(token, resolvedAccount)
        const scriptName = await deployWorkerScript(token, resolvedAccount, kvId, script)
        const subdomain = await resolveSubdomain(token, resolvedAccount)
        const workerUrl = subdomain
          ? `https://${scriptName}.${subdomain}.workers.dev`
          : `https://${scriptName}.workers.dev`

        return json({ ok: true, workerUrl, accountId: resolvedAccount })
      } catch (e) {
        return json(
          { ok: false, error: 'Fall\u00f3 el despliegue: ' + String((e && e.message) || e) },
          502
        )
      }
    }

    return json({ ok: false, error: 'Ruta no encontrada' }, 404)
  }
}