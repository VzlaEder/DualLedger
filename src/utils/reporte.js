// ============================================================
// DualLedger - Utilidades compartidas de reportes de Compras
// ============================================================
// Centralizan el formato de moneda/fecha, la descarga de CSV y la
// ventana de impresión que antes estaba repetida en Activos Fijos,
// CxP y Relación de gastos.
// ============================================================

import { showToast } from './dialog.js'

export function dinero(v) {
  const n = Number(v)
  if (!isFinite(n)) return '0,00'
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fechaMostrar(iso, defecto = '—') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || defecto
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

export function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function descargarCsv(nombreArchivo, contenido, mensaje) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
  if (mensaje) showToast(mensaje)
}

function celda(v) {
  if (v && typeof v === 'object' && 'valor' in v) {
    return `<td${v.numero ? ' class="num"' : ''}>${esc(v.valor)}</td>`
  }
  return `<td>${esc(v)}</td>`
}

// filas: array de arrays. Cada celda puede ser un valor simple o
// { valor, numero: true } para alinearla a la derecha.
export function imprimirReporte({
  titulo,
  subtitulo = '',
  resumen = [],
  encabezados = [],
  filas = [],
  nota = ''
}) {
  const resumenHtml = resumen.length
    ? `<table class="resumen"><tr>${resumen.map((r) => `<th>${esc(r.label)}</th>`).join('')}</tr>
<tr>${resumen.map((r) => `<td class="num">${esc(r.valor)}</td>`).join('')}</tr></table>`
    : ''
  const encabezadoHtml = encabezados.map((h) => `<th>${esc(h)}</th>`).join('')
  const filasHtml = filas.map((f) => `<tr>${f.map(celda).join('')}</tr>`).join('')
  const notaHtml = nota ? `<p class="nota">${esc(nota)}</p>` : ''
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(titulo)}</title>
<style>
body{font-family:Arial,sans-serif;color:#222;margin:24px;font-size:12px}
h1{font-size:17px;text-align:center;margin:0 0 4px}
.sub{text-align:center;color:#555;margin:0 0 18px}
table{border-collapse:collapse;width:100%;margin-bottom:14px}
th,td{border:1px solid #aaa;padding:6px 7px;text-align:left}
th{background:#eee;font-size:11px}.num{text-align:right;font-variant-numeric:tabular-nums}
.resumen td{width:25%}.resumen th{font-size:10px}
.nota{font-size:10px;color:#555;margin-top:18px;border-top:1px solid #aaa;padding-top:8px}
@page{size:landscape;margin:12mm}
</style></head><body>
<h1>${esc(titulo)}</h1>
<p class="sub">${esc(subtitulo)}</p>
${resumenHtml}
<table><thead><tr>${encabezadoHtml}</tr></thead><tbody>${filasHtml}</tbody></table>
${notaHtml}
</body></html>`

  const w = window.open('', '_blank')
  if (!w) {
    showToast('El navegador bloqueó la ventana de impresión.', { type: 'warning' })
    return
  }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}
