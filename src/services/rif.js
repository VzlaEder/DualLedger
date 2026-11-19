// Validación sintáctica de RIF venezolano (Módulo 11 SENIAT).
// Fuente: algoritmo público de cálculo del dígito verificador del RIF.
// La verificación AUTORITATIVA sigue siendo la consulta en línea al SENIAT
// (utils/seniat.js); esta validación es un chequeo previo de formato.

export const LETRAS_RIF = ['V', 'E', 'J', 'G', 'P', 'C']

const BASE_LETRA = { V: 4, E: 8, J: 12, P: 16, G: 20 }
const PESOS = [3, 2, 7, 6, 5, 4, 3, 2]

export function normalizarRif(rif) {
  return String(rif || '').replace(/[\s-]/g, '').toUpperCase()
}

export function calcularDigito(rif9) {
  // rif9: letra + 8 dígitos (sin el dígito verificador)
  const letra = rif9[0]
  let suma = BASE_LETRA[letra] || 0
  for (let i = 0; i < 8; i++) {
    suma += Number(rif9[i + 1]) * PESOS[i]
  }
  const digito = 11 - (suma % 11)
  return digito >= 10 ? 0 : digito
}

export function validarRif(rif) {
  const normalized = normalizarRif(rif)
  if (!normalized) return { valido: false, rif: '', error: 'Indica el RIF' }
  if (!LETRAS_RIF.includes(normalized[0])) {
    return { valido: false, rif: normalized, error: `El RIF debe comenzar por una de estas letras: ${LETRAS_RIF.join(', ')}` }
  }
  if (!/^\d{9}$/.test(normalized.slice(1))) {
    return { valido: false, rif: normalized, error: 'El RIF debe ser la letra seguida de 9 dígitos (p. ej. J500821484)' }
  }
  const esperado = calcularDigito(normalized.slice(0, 9))
  const real = Number(normalized[9])
  if (real !== esperado) {
    return { valido: false, rif: normalized, error: `Dígito verificador inválido (esperado ${esperado})` }
  }
  return { valido: true, rif: normalized, error: '' }
}

export function formatearRif(rif) {
  const normalized = normalizarRif(rif)
  if (!/^[A-Z]\d{9}$/.test(normalized)) return normalized
  return `${normalized[0]}-${normalized.slice(1, 9)}-${normalized[9]}`
}