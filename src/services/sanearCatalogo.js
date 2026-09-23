import { getApiKey } from '../utils/apiKey.js'

// Integración de Gemini para "veracidad" de los maestros:
//  - sanearCuentasConGemini(): propone correcciones de nombres de cuentas
//    (typos, encoding perdido, mayúsculas de siglas) para que el usuario las
//    revise y acepte. Nunca aplica cambios por sí solo.
//  - auditarConceptosConGemini(): revisa consistencia interna del maestro de
//    conceptos ISLR (duplicados, % fuera de rango, sustraendos negativos,
//    nombres con typos/encoding). No genera cifras oficiales.
//
// Regla de oro: Gemini propone, el humano decide. No se edita el catálogo
// hasta que el usuario confirma fila por fila.

const MODEL = 'gemini-3.5-flash-lite'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2500

export function extraerJson(texto) {
  if (!texto) return null
  let t = texto.replace(/```json/gi, '```').replace(/```/g, '').trim()
  const inicio = t.indexOf('{')
  const fin = t.lastIndexOf('}')
  if (inicio === -1 || fin === -1 || fin <= inicio) return null
  try {
    return JSON.parse(t.slice(inicio, fin + 1))
  } catch {
    return null
  }
}

async function llamarGemini(prompt, temperature = 0.2) {
  const key = getApiKey()
  if (!key) throw new Error('No hay credencial de Gemini: ⌘ Herramientas → API Key')
  let lastErr = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    try {
      const res = await fetch(`${API_URL}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, max_output_tokens: 8192 }
        }),
        cache: 'no-store'
      })
      if (res.status === 503) {
        lastErr = new Error('Gemini sobrecargado, reintento pendiente')
        continue
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = data && data.error && data.error.message ? data.error.message : `HTTP ${res.status}`
        throw new Error(`Gemini (${res.status}): ${msg}`)
      }
      const texto = data && data.candidates && data.candidates[0] && data.candidates[0].content
        ? data.candidates[0].content.parts.map(p => p.text || '').join('').trim()
        : ''
      if (!texto) throw new Error('Gemini devolvió una respuesta vacía')
      return texto
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('Gemini no respondió')
}

const REGLAS_SANEAMIENTO = `
Eres un auditor contable venezolano experto en el Plan de Cuentas PCGA-PUCV.
Recibirás un arreglo de cuentas con "codigo" y "nombre".
Devuelve SOLO JSON sin texto adicional:
{"correcciones":[{"codigo":"...","nombre":"...","motivo":"...","certeza":"alta|media|baja"}]}

Reglas:
- Corrige SOLO nombres evidentemente defectuosos: caracteres corruptos de encoding
  (p. ej. "¢" donde va "ó"), typos ("Utencilios" -> "Utensilios", "GRESOS" -> "EGRESOS"),
  mayúsculas mal puestas en siglas ("I.s.l.r" -> "ISLR"), abreviaturas rotas y
  espacios/acentos perdidos.
- NO toques codigos, ni números, ni la estructura del catálogo.
- No agregues ni quites cuentas.
- Si un nombre está bien, NO lo incluyas.
- cerceza "baja" = cambio dudoso por valor oficial desconocido (no obligatorio).
- Si no hay nada que corregir devuelve {"correcciones":[]}.`

export async function sanearCuentasConGemini(cuentas) {
  if (!cuentas || !cuentas.length) return []
  const lista = cuentas.map(c => ({ codigo: c.codigo, nombre: c.nombre }))
  const prompt = `${REGLAS_SANEAMIENTO}\n\nCuentas (JSON):\n${JSON.stringify(lista)}`
  const texto = await llamarGemini(prompt)
  const json = extraerJson(texto)
  const correcciones = json && Array.isArray(json.correcciones) ? json.correcciones : []
  const porCodigo = new Map(
    correcciones
      .filter(c => c && typeof c.codigo === 'string' && typeof c.nombre === 'string' && c.nombre.trim())
      .map(c => [c.codigo, c])
  )
  const sugerencias = []
  for (const c of cuentas) {
    const corr = porCodigo.get(c.codigo)
    if (corr && corr.nombre.trim() !== c.nombre) {
      sugerencias.push({
        codigo: c.codigo,
        nombreOriginal: c.nombre,
        nombre: corr.nombre.trim(),
        motivo: corr.motivo || '',
        certeza: corr.certeza || 'media'
      })
    }
  }
  return sugerencias
}

const REGLAS_AUDITORIA = `
Eres un auditor fiscal venezolano experto en retenciones de ISLR (Impuesto sobre
la Renta) a proveedores.
Recibirás un arreglo de conceptos de retención: cada uno tiene "codigo", "nombre",
"porcentaje" (%), "sustraendoUt" y "baseMinimaUt" (en unidades tributarias).
Devuelve SOLO JSON sin texto adicional:
{"hallazgos":[{"nivel":"info|alerta","mensaje":"..."}]}

Revisa SOLO consistencia interna (no inventes cifras oficiales):
- códigos duplicados, nombres vacíos o duplicados
- porcentajes fuera del rango 0-100 o negativos que lucen erróneos (p. ej. >100)
- sustraendos/baseMinima negativos
- nombres con typos, encoding corrupto ("¢"), o palabras incompletas
- incoherencias obvias entre nombre y porcentaje (p. ej. "Honorarios" al 0%)
Si todo está bien devuelve {"hallazgos":[]}.`

export async function auditarConceptosConGemini(conceptos) {
  if (!conceptos || !conceptos.length) return []
  const prompt = `${REGLAS_AUDITORIA}\n\nConceptos (JSON):\n${JSON.stringify(conceptos)}`
  const texto = await llamarGemini(prompt)
  const json = extraerJson(texto)
  const hallazgos = json && Array.isArray(json.hallazgos) ? json.hallazgos : []
  return hallazgos.filter(h => h && typeof h.mensaje === 'string').map(h => ({
    nivel: h.nivel === 'info' ? 'info' : 'alerta',
    mensaje: h.mensaje.trim()
  }))
}