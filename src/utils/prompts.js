const BASE_INSTRUCTIONS = `
Eres un extractor de datos de documentos fiscales venezolanos. Analiza esta imagen y extrae TODOS los campos visibles en formato JSON.

TIPOS DE DOCUMENTO POSIBLES:
- Factura
- Nota de Crédito
- Nota de Débito
- Reporte Z
- Cualquier otro documento fiscal venezolano

CAMPOS A EXTRAER (usa null si no se encuentra el campo):

{
  "tipoDocumento": "factura | nota_credito | nota_debito | reporte_z | otro",
  "rif": "RIF del emisor (formato: J-12345678-0, V-12345678, E-12345678, etc)",
  "nombreRazon": "Razón social o nombre completo del emisor",
  "fecha": "Fecha en formato DD/MM/AAAA",
  "nroFactura": "Número de factura (solo dígitos)",
  "nroControl": "Número de control. En tickets de máquina fiscal busca prefijos COO:, COD: o NRO CONTROL: (ej: COO:005367 -> 005367). Si no aparece ninguno, usa 00-0. NUNCA uses códigos tipo ZZP... o Z7C... aquí.",
  "numeroMaquinaFiscal": "Serial de la máquina fiscal (tickets de máquina fiscal y Reportes Z). Incluye lo que sigue a '#CONTROL/SERIAL IF:' y cadenas tipo ZZP0023685 o Z7C7023199. No aplica a facturas de imprenta/notas normales.",
  "nroNotaCredito": "Número de nota de crédito (solo dígitos)",
  "nroNotaDebito": "Número de nota de débito (solo dígitos)",
  "nroFacturaAfectada": "Número de la factura afectada (solo dígitos; solo en notas de crédito/débito, ej: HFAC)",
  "totalComprasIVA": "Monto total con IVA incluido (número decimal, sin símbolo de moneda)",
  "baseImponible": "Base imponible (monto antes de IVA, si es visible)",
  "igtf": "Monto IGTF (si aparece)",
  "retIVA": "Monto de retención de IVA (si aparece)",
  "tipoTransaccion": "tipo de transacción (si es visible)"
}

REGLAS CRÍTICAS:
1. Para montos: extrae SOLO el número, sin "Bs.", sin "$", sin separador de miles. Usa punto decimal, nunca coma decimal y nunca punto para miles (ej: 80637.89, NUNCA 80.637,89).
2. Para fechas: siempre en formato DD/MM/AAAA.
3. Para RIF: incluye el guión y dígito verificador (ej: J-12345678-0).
4. Para nroFactura: solo dígitos (limpia letras y guiones). Para nroControl: si el ticket trae un prefijo explícito COO:, COD: o NRO CONTROL:, extrae solo los dígitos (ej: COO:005367 -> 005367); si no lo trae, usa "00-0". NUNCA pongas seriales tipo ZZP... o Z7C... en nroControl.
5. Si el documento tiene múltiples registros (ej: reporte Z con varias líneas), extrae el PRIMER registro visible.
6. El IVA en Venezuela es 16%. Si ves el total y la base, verifica que total ≈ base * 1.16.
7. Responde SOLO con el JSON, sin texto adicional, sin markdown, sin bloques de código.
8. DETECCIÓN DE TIPO: Clasifica el documento como "factura", "nota_credito", "nota_debito", "reporte_z" (cierre Z de máquina fiscal) u "otro".
9. Las facturas de máquina fiscal (tickets) y los Reportes Z por lo general NO traen Número de Control impreso. El código al pie del ticket (ej: ZZP0023685, Z7C7023199, o lo que siga a "#CONTROL/SERIAL IF:") es el Serial de la Máquina Fiscal, NO el número de control.
10. En tickets de máquina fiscal y Reportes Z sin prefijo de control explícito (COO:, COD:, NRO CONTROL:): asigna "00-0" a nroControl y guarda el serial del pie del ticket en numeroMaquinaFiscal. En facturas de imprenta y notas normales, numeroMaquinaFiscal debe ser null.
11. NOTAS DE CRÉDITO/DÉBITO: si el documento es una nota, coloca su número propio en nroNotaCredito o nroNotaDebito, y el número de la factura que afecta (HFAC, "Factura Afectada" o "Documento Afectado") en nroFacturaAfectada. En ese caso deja nroFactura en null. Los montos de la nota van en POSITIVO (el signo lo aplica el sistema).`

const CONFIDENCE_INSTRUCTIONS = `

MODO ESPECIAL: este documento está ESCRITO A MANO (manuscrito).

Reglas adicionales para el texto manuscrito:
- Sé especialmente cuidadoso con los números (RIF, montos, nro factura/control, fechas). La caligrafía manual es más ambigua que la impresa.
- Es PREFERIBLE devolver null (campo vacío) que adivinar un valor del que no estás seguro.
- Para cada campo, agrega una clave "confianza_<campo>" cuyo valor sea "alta", "media" o "baja", según lo seguro que estés de la lectura:
  - "alta": estás seguro del valor
  - "media": tienes dudas pero crees que es correcto
  - "baja": no pudiste leerlo bien o hay varias interpretaciones posibles
- IMPORTANTE: la clave de confianza usa el MISMO nombre del campo precedido por "confianza_". Ejemplo: para "rif" -> "confianza_rif"; para "totalComprasIVA" -> "confianza_totalComprasIVA".`

export const INVOICE_EXTRACTION_PROMPT = BASE_INSTRUCTIONS + CONFIDENCE_INSTRUCTIONS

export const PRINT_EXTRACTION_PROMPT = BASE_INSTRUCTIONS
