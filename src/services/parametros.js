import { getParametro, setParametro } from '../stores/maestrosDb.js'

// Parámetros globales del módulo de compras.
// Empresa por defecto: GRUPO HIERROCA, C.A. / J500821484 (también hardcodeada
// en excelTemplate.js; aquí pasa a ser configurable).
export const PARAMETROS_DEFECTO = {
  empresa: {
    razonSocial: 'GRUPO HIERROCA, C.A.',
    rif: 'J500821484',
    direccion: '',
    telefono: '',
    actividadEconomica: ''
  },
  unidadTributaria: 0,
  tasaIVA: 16,
  tasaIGTF: 3
}

function merge(defaults, guardado) {
  const merged = { ...defaults }
  for (const key of Object.keys(merged)) {
    const val = guardado ? guardado[key] : undefined
    if (val === undefined) continue
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      merged[key] = { ...(merged[key] && typeof merged[key] === 'object' ? merged[key] : {}), ...val }
    } else {
      merged[key] = val
    }
  }
  return merged
}

export function mergeConDefecto(guardado) {
  return merge(PARAMETROS_DEFECTO, guardado)
}

export async function cargarParametros() {
  const guardado = await getParametro('configuracion')
  return guardado ? mergeConDefecto(guardado) : mergeConDefecto({})
}

export async function guardarParametros(parametros) {
  await setParametro('configuracion', parametros)
  return parametros
}

export function parametrosAArray(parametros) {
  return [{ clave: 'configuracion', valor: { ...parametros } }]
}