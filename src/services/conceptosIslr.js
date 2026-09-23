import { saveConceptos, getConceptos } from '../stores/maestrosDb.js'

// Maestro de conceptos de retención ISLR (para proveedores).
// El plan de cuentas + manual exigen: concepto, porcentaje y sustraendo (en UT)
// para calcular la retención: (base x % / 100) - (sustraendo x UT).
//
// Los conceptos siguientes son los de uso generalizado en el país; los
// porcentajes se siembran con los valores comúnmente citados, pero el maestro
// es EDITABLE y la tabla oficial SENIAT vigente debe confirmarse por el usuario
// (el Código de Verificación Geminis / auditoría marca inconsistencias, no
// inventa cifras oficiales).
export const CONCEPTOS_ISLR_SEED = [
  { codigo: 'HON-PRO', nombre: 'Honorarios profesionales', porcentaje: 5, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'HON-INT', nombre: 'Honorarios por intermediación', porcentaje: 5, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'ARR-ACT', nombre: 'Arrendamiento de bienes inmuebles', porcentaje: 5, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'ARR-OTR', nombre: 'Arrendamiento de otros bienes', porcentaje: 5, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'COM-VEN', nombre: 'Comisiones', porcentaje: 3, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'INT-BAN', nombre: 'Intereses y rendimientos', porcentaje: 3, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'REG-TEC', nombre: 'Regalías y tecnología', porcentaje: 5, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'SER-DIG', nombre: 'Servicios digitales y similares', porcentaje: 5, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'DIV-ACC', nombre: 'Dividendos y participaciones', porcentaje: 5, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' },
  { codigo: 'OTR-RET', nombre: 'Otros enriquecimientos', porcentaje: 3, sustraendoUt: 0, baseMinimaUt: 50, activo: true, notas: 'Confirmar código oficial SENIAT' }
]

export async function cargarConceptos() {
  const locales = await getConceptos()
  if (locales && locales.length) return locales
  await saveConceptos(CONCEPTOS_ISLR_SEED)
  return CONCEPTOS_ISLR_SEED
}