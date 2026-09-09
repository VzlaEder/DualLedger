import { setCfToken, getCfToken, setCfAccountId, getCfAccountId, setWorkerUrl } from './settings'
import workerSource from '../../worker/src/index.js?raw'

export async function configureSeniatWorker({ token, accountId, workerUrl }, onStep) {
  const base = String(workerUrl || '').trim().replace(/\/+$/, '')
  if (!base) {
    throw new Error('Falta la URL del Worker. Despliega el Worker una vez por terminal (wrangler) y pega aquí la URL.')
  }

  if (onStep) onStep('Enviando despliegue al Worker...')

  let res
  try {
    res = await fetch(`${base}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: String(token || '').trim(),
        accountId: String(accountId || '').trim(),
        script: workerSource
      })
    })
  } catch (e) {
    const reason = (e && (e.message === 'Failed to fetch' || e.name === 'TypeError'))
      ? 'no se pudo conectar con el Worker (red/CORS). Verifica la URL y que esté desplegado.'
      : (e && e.message) || 'error de red'
    throw new Error(`Despliegue: ${reason}`)
  }

  let payload = null
  try {
    payload = await res.json()
  } catch (e) {
    payload = null
  }
  if (!res.ok || !payload || !payload.ok) {
    throw new Error((payload && payload.error) || `HTTP ${res.status}`)
  }

  setCfToken(String(token || '').trim())
  setCfAccountId(payload.accountId || String(accountId || '').trim())
  setWorkerUrl(payload.workerUrl || base)

  if (onStep) onStep('¡Listo!')
  return payload.workerUrl || base
}

export function hasConfiguredWorker() {
  return !!getCfToken() && !!getCfAccountId() && !!getWorkerUrl()
}