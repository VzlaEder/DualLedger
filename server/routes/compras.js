// ============================================================
// DualLedger API - Libro de Compras (compras/documentos)
// ============================================================
// Rutas:
//   GET    /compras/documentos            listado con filtros
//   GET    /compras/documentos/resumen    totales del libro
//   GET    /compras/documentos/:uid       detalle
//   POST   /compras/documentos            alta/edición (upsert por uid)
//   PUT    /compras/documentos/:uid       edición
//   DELETE /compras/documentos/:uid       baja
//   POST   /compras/documentos/sync       sincronización por lote
//
// Reglas fiscales verificadas contra el Libro de Compras real del
// cliente (96 filas, 2da quincena 2026):
//   Total de Compras = Base Nac + Cred.Fiscal Nac + No Gravadas
//                      + Base Imp + Cred.Fiscal Imp
//   Credito Fiscal Nac = Base Imponible Nac × Alicuota
//   Ret IVA = Base Imponible Nac × Alicuota × %Contribucion
//             (16% × 75% = 12% de la base; ver 43 retenciones reales)
// ============================================================

import { Router } from 'express'

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const TOLERANCIA = 0.02

// --- Utilidades de formato ---

export function toNum(value, def = 0) {
  if (value === null || value === undefined || value === '') return def
  if (typeof value === 'number') return isFinite(value) ? value : def
  let s = String(value).trim()
  if (!s || s === '-') return def
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma > -1) {
    s = s.replace(',', '.')
  }
  s = s.replace(/[^\d.\-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? def : n
}

export function parseFecha(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10)
  const s = String(value).trim()
  if (!s) return null

  // Serial de Excel (días desde 1899-12-30)
  if (/^\d{4,6}$/.test(s)) {
    const serial = parseInt(s, 10)
    if (serial > 20000 && serial < 80000) {
      const d = new Date(EXCEL_EPOCH_UTC + serial * 86400000)
      return d.toISOString().slice(0, 10)
    }
  }

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`

  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (m) {
    let year = m[3]
    if (year.length === 2) year = String(2000 + parseInt(year, 10))
    else if (year.length === 3) year = String(2000 + parseInt(year, 10))
    return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }

  const parsed = new Date(s)
  if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10)
  return null
}

// Convierte a ISO (YYYY-MM-DD) lo que devuelve el driver.
// pg entrega DATE como objeto Date en hora local; el parser de tipo se
// ajusta en dbAdmin, pero aquí se cubre también el caso por si cambia.
function isoFecha(value) {
  if (!value) return ''
  if (value instanceof Date) {
    if (isNaN(value)) return ''
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value).slice(0, 10)
}

export function formatFecha(value) {
  const iso = isoFecha(value)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

function texto(value, def = '') {
  if (value === null || value === undefined) return def
  return String(value).trim()
}

// Formatos de RIF válidos en Venezuela (verificados contra el Libro real
// del cliente, que incluye J, G y el RIF de importación):
//   J-00007702-9  -> J + 8 dígitos + dígito verificador (o J + 8/9 dígitos)
//   G-200163151   -> organismos del Estado
//   V / E         -> personas naturales y extranjeros
//   20265004/C25350 -> RIF de importación (número de expediente/comprobante)
function rifValido(rif) {
  const s = String(rif || '').toUpperCase().replace(/[\s-]/g, '')
  if (!s) return false
  if (/^J\d{8,9}$/.test(s)) return true
  if (/^G\d{8,9}$/.test(s)) return true
  if (/^V\d{7,8}$/.test(s)) return true
  if (/^E\d{7,9}$/.test(s)) return true
  if (/^\d{8}\/C\d{4,5}$/.test(s)) return true
  return false
}

const RE_COMPROBANTE = /^\d{6}\d{8}$/

// --- Mapeo front (camelCase) <-> BD (snake_case) ---

function toRow(doc) {
  const totalComprasIVA = toNum(doc.totalComprasIVA)
  const noGravadas = toNum(doc.noGravadas)
  const baseNacional = toNum(doc.baseNacional)
  const alicuotaNac = toNum(doc.alicuotaNac, 16)
  const creditoFiscalNac = toNum(doc.creditoFiscalNac)
  const baseImportacion = toNum(doc.baseImportacion)
  const alicuotaImp = toNum(doc.alicuotaImp, 16)
  const creditoFiscalImp = toNum(doc.creditoFiscalImp)
  const retIVA = toNum(doc.retIVA)
  const igtf = toNum(doc.igtf)
  const nro = toNum(doc.nro, 0)

  return {
    uid: texto(doc.uid),
    nro: nro || null,
    fecha: parseFecha(doc.fecha),
    rif: texto(doc.rif),
    nombre_razon: texto(doc.nombreRazon),
    nro_factura: texto(doc.nroFactura),
    nro_control: texto(doc.nroControl),
    nro_nota_debito: texto(doc.nroNotaDebito),
    nro_nota_credito: texto(doc.nroNotaCredito),
    tipo_transaccion: texto(doc.tipoTransaccion, '01 -Reg') || '01 -Reg',
    nro_factura_afectada: texto(doc.nroFacturaAfectada),
    total_compras_iva: totalComprasIVA,
    no_gravadas: noGravadas,
    base_nacional: baseNacional,
    alicuota_nac: alicuotaNac,
    credito_fiscal_nac: creditoFiscalNac,
    base_importacion: baseImportacion,
    alicuota_imp: alicuotaImp,
    credito_fiscal_imp: creditoFiscalImp,
    num_expediente: texto(doc.numExpediente),
    num_planilla: texto(doc.numPlanilla),
    fecha_planilla: parseFecha(doc.fechaPlanilla),
    ret_iva: retIVA,
    comprobante_iva: texto(doc.comprobanteIVA),
    fecha_iva: parseFecha(doc.fechaIVA),
    igtf,
    tipo_documento: texto(doc.tipoDocumento, 'factura') || 'factura',
    porcentaje_contribucion: doc.porcentajeContribucion === '' || doc.porcentajeContribucion === null || doc.porcentajeContribucion === undefined
      ? null
      : toNum(doc.porcentajeContribucion),
    condicion: texto(doc.condicion),
    proveedor_rif: texto(doc.proveedorRif) || null,
    codigo_cuenta: texto(doc.codigoCuenta) || null,
    dias_credito: Math.trunc(toNum(doc.diasCredito, 0)),
    concepto_islr: texto(doc.conceptoIslr),
    estado: texto(doc.estado, 'BORRADOR') || 'BORRADOR',
    origen: texto(doc.origen, 'ocr') || 'ocr',
    origen_archivo: texto(doc.origenArchivo),
    motor_ocr: texto(doc.motorOcr),
    notas: texto(doc.notas),
    numero_maquina_fiscal: texto(doc.numeroMaquinaFiscal),
    documento_padre_uid: texto(doc.documentoPadreUid) || null,
    payload: JSON.stringify(doc.payload || {})
  }
}

function toDoc(row) {
  return {
    uid: row.uid,
    nro: row.nro,
    tipoDocumento: row.tipo_documento,
    fecha: formatFecha(row.fecha),
    fechaIso: isoFecha(row.fecha),
    rif: row.rif,
    nombreRazon: row.nombre_razon,
    porcentajeContribucion: row.porcentaje_contribucion === null ? '' : Number(row.porcentaje_contribucion),
    condicion: row.condicion,
    nroFactura: row.nro_factura,
    nroControl: row.nro_control,
    numeroMaquinaFiscal: row.numero_maquina_fiscal,
    nroNotaDebito: row.nro_nota_debito,
    nroNotaCredito: row.nro_nota_credito,
    tipoTransaccion: row.tipo_transaccion,
    nroFacturaAfectada: row.nro_factura_afectada,
    totalComprasIVA: Number(row.total_compras_iva),
    noGravadas: Number(row.no_gravadas),
    baseNacional: Number(row.base_nacional),
    alicuotaNac: Number(row.alicuota_nac),
    creditoFiscalNac: Number(row.credito_fiscal_nac),
    baseImportacion: Number(row.base_importacion),
    alicuotaImp: Number(row.alicuota_imp),
    creditoFiscalImp: Number(row.credito_fiscal_imp),
    numExpediente: row.num_expediente,
    numPlanilla: row.num_planilla,
    fechaPlanilla: formatFecha(row.fecha_planilla),
    retIVA: Number(row.ret_iva),
    comprobanteIVA: row.comprobante_iva,
    fechaIVA: formatFecha(row.fecha_iva),
    igtf: Number(row.igtf),
    proveedorRif: row.proveedor_rif || '',
    codigoCuenta: row.codigo_cuenta || '',
    diasCredito: row.dias_credito,
    conceptoIslr: row.concepto_islr,
    estado: row.estado,
    origen: row.origen,
    origenArchivo: row.origen_archivo,
    motorOcr: row.motor_ocr,
    notas: row.notas,
    documentoPadreUid: row.documento_padre_uid || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

// --- Validación fiscal ---

export function validarDocumento(doc) {
  const avisos = []
  const add = (nivel, campo, mensaje) => avisos.push({ nivel, campo, mensaje })

  if (!doc.fecha) add('error', 'fecha', 'Falta la fecha del documento')
  if (!doc.rif) add('error', 'rif', 'Falta el RIF del proveedor')
  else if (!rifValido(doc.rif)) add('aviso', 'rif', 'El RIF no tiene un formato válido')

  const baseNac = toNum(doc.baseNacional)
  const cfNac = toNum(doc.creditoFiscalNac)
  const noGrav = toNum(doc.noGravadas)
  const baseImp = toNum(doc.baseImportacion)
  const cfImp = toNum(doc.creditoFiscalImp)
  const total = toNum(doc.totalComprasIVA)
  const ret = toNum(doc.retIVA)

  const totalEsperado = baseNac + cfNac + noGrav + baseImp + cfImp
  if (Math.abs(total - totalEsperado) > TOLERANCIA) {
    add('aviso', 'totalComprasIVA',
      `El total (${total.toFixed(2)}) no coincide con base + crédito fiscal + no gravadas (${totalEsperado.toFixed(2)})`)
  }

  const alicuota = toNum(doc.alicuotaNac, 16)
  if (baseNac > 0) {
    const cfEsperado = baseNac * alicuota / 100
    if (Math.abs(cfNac - cfEsperado) > TOLERANCIA) {
      add('aviso', 'creditoFiscalNac',
        `El crédito fiscal (${cfNac.toFixed(2)}) no coincide con ${baseNac.toFixed(2)} × ${alicuota}% (${cfEsperado.toFixed(2)})`)
    }
  }

  const pct = toNum(doc.porcentajeContribucion, 0)
  if (baseNac > 0 && pct > 0) {
    const retEsperado = baseNac * alicuota / 100 * pct / 100
    if (Math.abs(ret - retEsperado) > TOLERANCIA) {
      add('aviso', 'retIVA',
        `La retención (${ret.toFixed(2)}) no coincide con base × ${alicuota}% × ${pct}% (${retEsperado.toFixed(2)})`)
    }
  }

  if (doc.comprobanteIVA) {
    if (!RE_COMPROBANTE.test(String(doc.comprobanteIVA))) {
      add('error', 'comprobanteIVA', 'El comprobante de retención debe tener el formato AAAAMM + 8 dígitos')
    }
    if (!doc.fechaIVA) add('aviso', 'fechaIVA', 'Falta la fecha del comprobante de retención')
  }

  if (total === 0 && ret === 0) {
    add('aviso', 'totalComprasIVA', 'El documento no tiene importes ni retención')
  }

  return avisos
}

const SELECT_COLS = `
  uid, nro, tipo_documento, fecha, rif, nombre_razon, porcentaje_contribucion, condicion,
  nro_factura, nro_control, nro_nota_debito, nro_nota_credito, tipo_transaccion,
  nro_factura_afectada, total_compras_iva, no_gravadas, base_nacional, alicuota_nac,
  credito_fiscal_nac, base_importacion, alicuota_imp, credito_fiscal_imp,
  num_expediente, num_planilla, fecha_planilla, ret_iva, comprobante_iva, fecha_iva, igtf,
  proveedor_rif, codigo_cuenta, dias_credito, concepto_islr, estado, origen, origen_archivo,
  motor_ocr, notas, numero_maquina_fiscal, documento_padre_uid, created_at, updated_at
`

const INSERT_SQL = `
  INSERT INTO compras_documentos (
    uid, nro, fecha, rif, nombre_razon, nro_factura, nro_control, nro_nota_debito,
    nro_nota_credito, tipo_transaccion, nro_factura_afectada, total_compras_iva,
    no_gravadas, base_nacional, alicuota_nac, credito_fiscal_nac, base_importacion,
    alicuota_imp, credito_fiscal_imp, num_expediente, num_planilla, fecha_planilla,
    ret_iva, comprobante_iva, fecha_iva, igtf, tipo_documento, porcentaje_contribucion,
    condicion, proveedor_rif, codigo_cuenta, dias_credito, concepto_islr, estado, origen,
    origen_archivo, motor_ocr, notas, numero_maquina_fiscal, documento_padre_uid, payload
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
    $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41
  )
  ON CONFLICT (uid) DO UPDATE SET
    nro = EXCLUDED.nro, fecha = EXCLUDED.fecha, rif = EXCLUDED.rif,
    nombre_razon = EXCLUDED.nombre_razon, nro_factura = EXCLUDED.nro_factura,
    nro_control = EXCLUDED.nro_control, nro_nota_debito = EXCLUDED.nro_nota_debito,
    nro_nota_credito = EXCLUDED.nro_nota_credito, tipo_transaccion = EXCLUDED.tipo_transaccion,
    nro_factura_afectada = EXCLUDED.nro_factura_afectada,
    total_compras_iva = EXCLUDED.total_compras_iva, no_gravadas = EXCLUDED.no_gravadas,
    base_nacional = EXCLUDED.base_nacional, alicuota_nac = EXCLUDED.alicuota_nac,
    credito_fiscal_nac = EXCLUDED.credito_fiscal_nac,
    base_importacion = EXCLUDED.base_importacion, alicuota_imp = EXCLUDED.alicuota_imp,
    credito_fiscal_imp = EXCLUDED.credito_fiscal_imp,
    num_expediente = EXCLUDED.num_expediente, num_planilla = EXCLUDED.num_planilla,
    fecha_planilla = EXCLUDED.fecha_planilla, ret_iva = EXCLUDED.ret_iva,
    comprobante_iva = EXCLUDED.comprobante_iva, fecha_iva = EXCLUDED.fecha_iva,
    igtf = EXCLUDED.igtf, tipo_documento = EXCLUDED.tipo_documento,
    porcentaje_contribucion = EXCLUDED.porcentaje_contribucion, condicion = EXCLUDED.condicion,
    proveedor_rif = EXCLUDED.proveedor_rif, codigo_cuenta = EXCLUDED.codigo_cuenta,
    dias_credito = EXCLUDED.dias_credito, concepto_islr = EXCLUDED.concepto_islr,
    estado = EXCLUDED.estado, origen = EXCLUDED.origen,
    origen_archivo = EXCLUDED.origen_archivo, motor_ocr = EXCLUDED.motor_ocr,
    notas = EXCLUDED.notas, numero_maquina_fiscal = EXCLUDED.numero_maquina_fiscal,
    documento_padre_uid = EXCLUDED.documento_padre_uid, payload = EXCLUDED.payload
  RETURNING *
`

function insertParams(row) {
  return [
    row.uid, row.nro, row.fecha, row.rif, row.nombre_razon, row.nro_factura, row.nro_control,
    row.nro_nota_debito, row.nro_nota_credito, row.tipo_transaccion, row.nro_factura_afectada,
    row.total_compras_iva, row.no_gravadas, row.base_nacional, row.alicuota_nac,
    row.credito_fiscal_nac, row.base_importacion, row.alicuota_imp, row.credito_fiscal_imp,
    row.num_expediente, row.num_planilla, row.fecha_planilla, row.ret_iva, row.comprobante_iva,
    row.fecha_iva, row.igtf, row.tipo_documento, row.porcentaje_contribucion, row.condicion,
    row.proveedor_rif, row.codigo_cuenta, row.dias_credito, row.concepto_islr, row.estado,
    row.origen, row.origen_archivo, row.motor_ocr, row.notas, row.numero_maquina_fiscal,
    row.documento_padre_uid, row.payload
  ]
}

// --- Router ---

export function createComprasRouter({ getPool }) {
  const router = Router()

  const requirePool = (res) => {
    const pool = getPool()
    if (pool) return pool
    res.status(503).json({ ok: false, code: 'DB_DOWN', error: 'La base de datos no está disponible' })
    return null
  }

  router.get('/compras/documentos', async (req, res) => {
    const pool = requirePool(res)
    if (!pool) return
    const q = req.query || {}
    const where = []
    const params = []

    const desde = parseFecha(q.desde)
    if (desde) { params.push(desde); where.push(`fecha >= $${params.length}`) }
    const hasta = parseFecha(q.hasta)
    if (hasta) { params.push(hasta); where.push(`fecha <= $${params.length}`) }
    if (q.rif) { params.push(String(q.rif).toUpperCase().replace(/[\s-]/g, '')); where.push(`UPPER(REPLACE(rif, '-', '')) LIKE $${params.length}`) }
    if (q.proveedor) { params.push(String(q.proveedor).toUpperCase().replace(/[\s-]/g, '')); where.push(`UPPER(REPLACE(COALESCE(proveedor_rif, rif), '-', '')) LIKE $${params.length}`) }
    if (q.estado) { params.push(String(q.estado)); where.push(`estado = $${params.length}`) }
    if (q.q) {
      params.push(`%${String(q.q).trim()}%`)
      where.push(`(nombre_razon ILIKE $${params.length} OR rif ILIKE $${params.length} OR nro_factura ILIKE $${params.length} OR nro_control ILIKE $${params.length} OR comprobante_iva ILIKE $${params.length})`)
    }

    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 500, 1), 5000)
    const offset = Math.max(parseInt(q.offset, 10) || 0, 0)
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    try {
      const { rows: totalRows } = await pool.query(`SELECT count(*)::int AS n FROM compras_documentos ${whereSql}`, params)
      const { rows } = await pool.query(
        `SELECT ${SELECT_COLS} FROM compras_documentos ${whereSql} ORDER BY fecha NULLS LAST, nro NULLS LAST, created_at LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      )
      const documentos = rows.map((r) => {
        const doc = toDoc(r)
        doc.validacion = validarDocumento(doc)
        return doc
      })
      res.json({ ok: true, documentos, total: totalRows[0].n, limit, offset })
    } catch (e) {
      console.error('[Compras] list error:', e.message)
      res.status(500).json({ ok: false, error: String(e.message) })
    }
  })

  router.get('/compras/documentos/resumen', async (req, res) => {
    const pool = requirePool(res)
    if (!pool) return
    const q = req.query || {}
    const params = []
    const where = []
    const desde = parseFecha(q.desde)
    if (desde) { params.push(desde); where.push(`fecha >= $${params.length}`) }
    const hasta = parseFecha(q.hasta)
    if (hasta) { params.push(hasta); where.push(`fecha <= $${params.length}`) }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    try {
      const { rows } = await pool.query(
        `SELECT
           count(*)::int AS documentos,
           count(*) FILTER (WHERE total_compras_iva > 0)::int AS filas_factura,
           count(*) FILTER (WHERE ret_iva > 0)::int AS filas_retencion,
           COALESCE(sum(total_compras_iva), 0) AS total_compras_iva,
           COALESCE(sum(no_gravadas), 0) AS no_gravadas,
           COALESCE(sum(base_nacional), 0) AS base_nacional,
           COALESCE(sum(credito_fiscal_nac), 0) AS credito_fiscal_nac,
           COALESCE(sum(base_importacion), 0) AS base_importacion,
           COALESCE(sum(credito_fiscal_imp), 0) AS credito_fiscal_imp,
           COALESCE(sum(ret_iva), 0) AS ret_iva,
           COALESCE(sum(igtf), 0) AS igtf,
           count(DISTINCT rif)::int AS proveedores
         FROM compras_documentos ${whereSql}`,
        params
      )
      const r = rows[0]
      res.json({
        ok: true,
        resumen: {
          documentos: r.documentos,
          filasFactura: r.filas_factura,
          filasRetencion: r.filas_retencion,
          proveedores: r.proveedores,
          totalComprasIVA: Number(r.total_compras_iva),
          noGravadas: Number(r.no_gravadas),
          baseNacional: Number(r.base_nacional),
          creditoFiscalNac: Number(r.credito_fiscal_nac),
          baseImportacion: Number(r.base_importacion),
          creditoFiscalImp: Number(r.credito_fiscal_imp),
          retIVA: Number(r.ret_iva),
          igtf: Number(r.igtf)
        }
      })
    } catch (e) {
      console.error('[Compras] resumen error:', e.message)
      res.status(500).json({ ok: false, error: String(e.message) })
    }
  })

  router.get('/compras/documentos/:uid', async (req, res) => {
    const pool = requirePool(res)
    if (!pool) return
    try {
      const { rows } = await pool.query(
        `SELECT ${SELECT_COLS} FROM compras_documentos WHERE uid = $1`,
        [String(req.params.uid)]
      )
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Documento no encontrado' })
      const doc = toDoc(rows[0])
      doc.validacion = validarDocumento(doc)
      res.json({ ok: true, documento: doc })
    } catch (e) {
      console.error('[Compras] get error:', e.message)
      res.status(500).json({ ok: false, error: String(e.message) })
    }
  })

  async function upsert(pool, doc) {
    const row = toRow(doc)
    if (!row.uid) {
      const err = new Error('El documento necesita un uid')
      err.status = 400
      throw err
    }
    const { rows } = await pool.query(INSERT_SQL, insertParams(row))
    const saved = toDoc(rows[0])
    saved.validacion = validarDocumento(saved)
    return saved
  }

  router.post('/compras/documentos', async (req, res) => {
    const pool = requirePool(res)
    if (!pool) return
    const body = req.body || {}
    const doc = body.documento || body
    if (!doc || typeof doc !== 'object') {
      return res.status(400).json({ ok: false, error: 'Body inválido' })
    }
    try {
      const saved = await upsert(pool, doc)
      res.json({ ok: true, documento: saved })
    } catch (e) {
      console.error('[Compras] save error:', e.message)
      res.status(e.status || 500).json({ ok: false, error: String(e.message) })
    }
  })

  router.put('/compras/documentos/:uid', async (req, res) => {
    const pool = requirePool(res)
    if (!pool) return
    const body = req.body || {}
    const doc = { ...(body.documento || body), uid: String(req.params.uid) }
    try {
      const saved = await upsert(pool, doc)
      res.json({ ok: true, documento: saved })
    } catch (e) {
      console.error('[Compras] update error:', e.message)
      res.status(e.status || 500).json({ ok: false, error: String(e.message) })
    }
  })

  router.delete('/compras/documentos/:uid', async (req, res) => {
    const pool = requirePool(res)
    if (!pool) return
    try {
      const { rowCount } = await pool.query('DELETE FROM compras_documentos WHERE uid = $1', [String(req.params.uid)])
      if (!rowCount) return res.status(404).json({ ok: false, error: 'Documento no encontrado' })
      res.json({ ok: true, eliminado: 1 })
    } catch (e) {
      console.error('[Compras] delete error:', e.message)
      res.status(500).json({ ok: false, error: String(e.message) })
    }
  })

  router.post('/compras/documentos/sync', async (req, res) => {
    const pool = requirePool(res)
    if (!pool) return
    const body = req.body || {}
    const docs = Array.isArray(body) ? body : (Array.isArray(body.documentos) ? body.documentos : null)
    if (!docs) {
      return res.status(400).json({ ok: false, error: 'Sin documentos para sincronizar' })
    }
    const guardados = []
    const errores = []
    for (const doc of docs) {
      try {
        guardados.push(await upsert(pool, doc))
      } catch (e) {
        errores.push({ uid: doc && doc.uid, error: String(e.message) })
      }
    }
    res.json({ ok: true, guardados: guardados.length, documentos: guardados, errores })
  })

  return router
}
