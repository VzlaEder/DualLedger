<template>
  <div class="cxp-view">
    <div class="cxp-head">
      <div>
        <h2>Cuentas por pagar (CxP)</h2>
        <p class="sub">
          Saldos y vencimientos derivados de las facturas del Libro de Compras. El vencimiento se
          toma de Compras diarias o del crédito del proveedor; el saldo es el total más IGTF menos
          las retenciones. Es un reporte de solo lectura: no registra pagos ni abonos.
        </p>
      </div>
      <div class="head-actions">
        <button class="btn" :disabled="cargando" @click="cargar">Recargar</button>
        <button class="btn" :disabled="!filtradas.length" @click="exportar">Exportar Excel (CSV)</button>
        <button class="btn btn-primary" :disabled="!filtradas.length" @click="imprimir">Imprimir</button>
      </div>
    </div>

    <div class="card filtros">
      <div class="filtros-grid">
        <div class="field">
          <label>Desde (fecha del documento)</label>
          <input v-model="filtros.desde" class="input" type="date" />
        </div>
        <div class="field">
          <label>Hasta (fecha del documento)</label>
          <input v-model="filtros.hasta" class="input" type="date" />
        </div>
        <div class="field">
          <label>Proveedor</label>
          <select v-model="filtros.rif" class="input">
            <option value="">Todos los proveedores</option>
            <option v-for="p in opcionesProveedores" :key="p.rif" :value="p.rif">
              {{ p.nombre }} — {{ p.rif }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>Estado del saldo</label>
          <select v-model="filtros.estado" class="input">
            <option v-for="e in estados" :key="e.value" :value="e.value">{{ e.label }}</option>
          </select>
        </div>
        <div class="field field-wide">
          <label>Buscar</label>
          <input
            v-model="filtros.busqueda"
            class="input"
            type="search"
            placeholder="Número, proveedor, RIF, cuenta o condición…"
          />
        </div>
      </div>
      <div class="atajos">
        <span class="atajos-label">Atajos:</span>
        <button class="btn btn-small" @click="soloVencidas">Solo vencidas</button>
        <button class="btn btn-small" @click="aplicarMes">Este mes</button>
        <button class="btn btn-small" @click="limpiarFiltros">Limpiar filtros</button>
        <span class="resultado">{{ filtradas.length }} de {{ lineas.length }} documentos</span>
      </div>
    </div>

    <div v-if="cargando" class="card empty-state">Cargando cuentas por pagar…</div>

    <template v-else>
      <div class="resumen">
        <div class="metrica destacada">
          <span>Saldo pendiente</span>
          <strong>Bs {{ dinero(resumen.saldo) }}</strong>
        </div>
        <div class="metrica">
          <span>Saldo vencido</span>
          <strong>Bs {{ dinero(resumen.saldoVencido) }}</strong>
        </div>
        <div class="metrica">
          <span>Por vencer</span>
          <strong>Bs {{ dinero(resumen.saldoPorVencer) }}</strong>
        </div>
        <div class="metrica">
          <span>Sin vencimiento</span>
          <strong>Bs {{ dinero(resumen.saldoSinVencimiento) }}</strong>
        </div>
        <div class="metrica">
          <span>Documentos pendientes</span>
          <strong>{{ resumen.vencidas + resumen.porVencer + resumen.sinVencimiento }}</strong>
        </div>
        <div class="metrica">
          <span>Retenciones descontadas</span>
          <strong>Bs {{ dinero(resumen.retenciones) }}</strong>
        </div>
      </div>

      <div class="card">
        <div class="tabs">
          <button class="tab" :class="{ activa: tab === 'detalle' }" @click="tab = 'detalle'">
            Detalle ({{ filtradas.length }})
          </button>
          <button class="tab" :class="{ activa: tab === 'proveedor' }" @click="tab = 'proveedor'">
            Por proveedor ({{ porProveedor.length }})
          </button>
          <button class="tab" :class="{ activa: tab === 'vencimiento' }" @click="tab = 'vencimiento'">
            Por vencimiento
          </button>
          <button class="tab" :class="{ activa: tab === 'mes' }" @click="tab = 'mes'">
            Por mes ({{ porMes.length }})
          </button>
        </div>

        <div v-if="!filtradas.length" class="empty-state">
          <p v-if="lineas.length">No hay cuentas por pagar que coincidan con los filtros.</p>
          <p v-else>
            Todavía no hay facturas pendientes. Registra compras en
            <strong>Compras diarias</strong> para ver aquí sus saldos y vencimientos.
          </p>
        </div>

        <div v-else-if="tab === 'detalle'" class="table-scroll">
          <table class="cxp-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vencimiento</th>
                <th class="num">Días</th>
                <th>Estado</th>
                <th>Antigüedad</th>
                <th>Documento</th>
                <th>Proveedor</th>
                <th class="num">Total factura</th>
                <th class="num">Retenciones</th>
                <th class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in filtradas" :key="l.uid">
                <td class="mono">{{ fechaMostrar(l.fecha) }}</td>
                <td class="mono">{{ fechaMostrar(l.vencimiento) }}</td>
                <td class="num">{{ l.dias || '—' }}</td>
                <td><span class="tag" :class="l.estado">{{ etiquetaEstado(l.estado) }}</span></td>
                <td>{{ l.antiguedad }}</td>
                <td class="mono fuerte">{{ l.numero }}</td>
                <td>
                  {{ l.proveedor || '—' }}
                  <small v-if="l.rif" class="rif">{{ l.rif }}</small>
                </td>
                <td class="num">{{ dinero(l.total) }}</td>
                <td class="num">{{ dinero(l.retenciones) }}</td>
                <td class="num fuerte">{{ dinero(l.saldo) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="7">Totales del filtro ({{ filtradas.length }} documentos)</td>
                <td class="num">{{ dinero(resumen.total) }}</td>
                <td class="num">{{ dinero(resumen.retenciones) }}</td>
                <td class="num">{{ dinero(resumen.saldo) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div v-else-if="tab === 'proveedor'" class="table-scroll">
          <table class="cxp-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>RIF</th>
                <th class="num">Documentos</th>
                <th class="num">Vencidas</th>
                <th class="num">Total facturas</th>
                <th class="num">Retenciones</th>
                <th class="num">Saldo</th>
                <th class="num">Saldo vencido</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in porProveedor" :key="g.clave">
                <td class="fuerte">{{ g.proveedor }}</td>
                <td class="mono">{{ g.rif || '—' }}</td>
                <td class="num">{{ g.documentos }}</td>
                <td class="num">{{ g.vencidas }}</td>
                <td class="num">{{ dinero(g.total) }}</td>
                <td class="num">{{ dinero(g.retenciones) }}</td>
                <td class="num fuerte">{{ dinero(g.saldo) }}</td>
                <td class="num">{{ dinero(g.saldoVencido) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="tab === 'vencimiento'" class="table-scroll">
          <table class="cxp-table">
            <thead>
              <tr>
                <th>Antigüedad</th>
                <th class="num">Documentos</th>
                <th class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in porAging" :key="g.antiguedad">
                <td class="fuerte">{{ g.antiguedad }}</td>
                <td class="num">{{ g.documentos }}</td>
                <td class="num fuerte">{{ dinero(g.saldo) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td class="num">{{ filtradas.length }}</td>
                <td class="num">{{ dinero(resumen.saldo) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div v-else class="table-scroll">
          <table class="cxp-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th class="num">Documentos</th>
                <th class="num">Total facturas</th>
                <th class="num">Retenciones</th>
                <th class="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in porMes" :key="g.periodo">
                <td class="mono fuerte">{{ g.periodo }}</td>
                <td class="num">{{ g.documentos }}</td>
                <td class="num">{{ dinero(g.total) }}</td>
                <td class="num">{{ dinero(g.retenciones) }}</td>
                <td class="num fuerte">{{ dinero(g.saldo) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="nota">
        Los documentos con condición «Pagado», «Cancelado» o «Liquidado» se muestran con saldo cero.
        Las notas de crédito conservan el signo con el que están guardadas en el Libro (normalmente
        negativo). Si el proveedor no tiene fecha de
        vencimiento en la factura, se calculan los días de crédito del documento o del maestro de
        proveedores; sin esos datos se lista como «Sin vencimiento».
      </p>
    </template>
  </div>
</template>

<script>
import { cargarProveedores, listarDocumentos } from '../services/compras.js'
import {
  ESTADOS_CXP,
  agruparCxpPorAging,
  agruparCxpPorMes,
  agruparCxpPorProveedor,
  construirLineasCxp,
  csvCxp,
  etiquetaEstadoCxp,
  filtrosCxpVacios,
  filtrarLineasCxp,
  normalizarRifCxp,
  resumenCxp
} from '../services/cxp.js'
import { rangoMes } from '../services/relacionGastos.js'
import { showToast } from '../utils/dialog.js'

export default {
  name: 'CxpView',
  data() {
    return {
      documentos: [],
      proveedores: [],
      cargando: false,
      hoy: new Date(),
      filtros: filtrosCxpVacios(),
      tab: 'detalle'
    }
  },
  computed: {
    estados() {
      return ESTADOS_CXP
    },
    opcionesProveedores() {
      return [...(this.proveedores || [])]
        .map((p) => ({ rif: p.rif || '', nombre: p.nombre || 'Proveedor sin nombre' }))
        .filter((p) => p.rif)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    },
    lineas() {
      return construirLineasCxp(this.documentos, this.proveedores, { hoy: this.hoy })
    },
    filtradas() {
      return filtrarLineasCxp(this.lineas, this.filtros)
    },
    resumen() {
      return resumenCxp(this.filtradas)
    },
    porProveedor() {
      return agruparCxpPorProveedor(this.filtradas)
    },
    porAging() {
      return agruparCxpPorAging(this.filtradas)
    },
    porMes() {
      return agruparCxpPorMes(this.filtradas)
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    dinero(v) {
      const n = Number(v)
      if (!isFinite(n)) return '0,00'
      return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    fechaMostrar(iso) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '—'
      return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    },
    etiquetaEstado(estado) {
      return etiquetaEstadoCxp(estado)
    },
    esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    },
    async cargar() {
      this.cargando = true
      this.hoy = new Date()
      try {
        const [docs, proveedores] = await Promise.allSettled([
          listarDocumentos(),
          cargarProveedores({ force: true })
        ])
        this.documentos = docs.status === 'fulfilled' ? (docs.value.documentos || []) : []
        this.proveedores = proveedores.status === 'fulfilled' ? (proveedores.value || []) : []
        // El maestro remoto no siempre trae el RIF sin formatear.
        this.proveedores = this.proveedores.map((p) => ({
          ...p,
          rif: p.rif || p.proveedorRif || ''
        })).filter((p) => normalizarRifCxp(p.rif))
      } finally {
        this.cargando = false
      }
    },
    soloVencidas() {
      this.filtros = { ...this.filtros, estado: 'vencido', desde: '', hasta: '' }
    },
    aplicarMes() {
      const rango = rangoMes(new Date(), 0)
      this.filtros = { ...this.filtros, desde: rango.desde, hasta: rango.hasta, estado: 'todos' }
    },
    limpiarFiltros() {
      this.filtros = filtrosCxpVacios()
    },
    exportar() {
      if (!this.filtradas.length) {
        showToast('No hay cuentas por pagar para exportar con los filtros actuales.', { type: 'warning' })
        return
      }
      const blob = new Blob([csvCxp(this.filtradas)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cuentas-por-pagar.csv'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Cuentas por pagar exportadas a Excel (CSV).')
    },
    imprimir() {
      if (!this.filtradas.length) {
        showToast('No hay cuentas por pagar para imprimir con los filtros actuales.', { type: 'warning' })
        return
      }
      const filas = this.filtradas.map((l) => `<tr>
        <td>${this.esc(this.fechaMostrar(l.fecha))}</td>
        <td>${this.esc(this.fechaMostrar(l.vencimiento))}</td>
        <td>${this.esc(l.numero)}</td>
        <td>${this.esc(l.proveedor || '—')}</td>
        <td>${this.esc(this.etiquetaEstado(l.estado))}</td>
        <td>${this.esc(l.antiguedad)}</td>
        <td class="num">${this.esc(this.dinero(l.total))}</td>
        <td class="num">${this.esc(this.dinero(l.retenciones))}</td>
        <td class="num">${this.esc(this.dinero(l.saldo))}</td>
      </tr>`).join('')
      const r = this.resumen
      const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Cuentas por pagar</title>
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
<h1>CUENTAS POR PAGAR</h1>
<p class="sub">Desde: ${this.esc(this.filtros.desde || 'inicio')} &nbsp; Hasta: ${this.esc(this.filtros.hasta || 'última fecha')}</p>
<table class="resumen">
<tr><th>Saldo pendiente</th><th>Saldo vencido</th><th>Por vencer</th><th>Retenciones</th></tr>
<tr><td class="num">${this.esc(this.dinero(r.saldo))}</td>
<td class="num">${this.esc(this.dinero(r.saldoVencido))}</td>
<td class="num">${this.esc(this.dinero(r.saldoPorVencer))}</td>
<td class="num">${this.esc(this.dinero(r.retenciones))}</td></tr>
</table>
<table><thead><tr>
<th>Fecha</th><th>Vencimiento</th><th>Documento</th><th>Proveedor</th>
<th>Estado</th><th>Antigüedad</th><th>Total</th><th>Retenciones</th><th>Saldo</th>
</tr></thead><tbody>${filas}</tbody></table>
<p class="nota">Saldos derivados del Libro de Compras. No se registran pagos ni abonos. Reporte de solo lectura.</p>
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
  }
}
</script>

<style scoped>
.cxp-view { display: flex; flex-direction: column; gap: 16px; }
.cxp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.cxp-head h2 { margin: 0 0 4px; font-size: 1.35rem; }
.sub { margin: 0; color: var(--text-secondary); font-size: 0.88rem; max-width: 700px; }
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}
.filtros-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-wide { grid-column: 1 / -1; }
.field label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
.input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 9px 11px;
  font-size: 0.88rem;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}
.atajos { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.atajos-label { font-size: 0.78rem; color: var(--text-secondary); }
.resultado { margin-left: auto; font-size: 0.8rem; color: var(--text-secondary); }
.btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.82rem;
  cursor: pointer;
  font-family: inherit;
}
.btn:hover:not(:disabled) { border-color: var(--primary); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-small { padding: 6px 10px; font-size: 0.78rem; }
.btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
.resumen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.metrica {
  display: flex; flex-direction: column; gap: 4px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 14px 16px;
}
.metrica span { font-size: 0.76rem; color: var(--text-secondary); }
.metrica strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.metrica.destacada { border-color: var(--primary); }
.metrica.destacada strong { color: var(--primary); }
.tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--divider-weak); margin-bottom: 12px; flex-wrap: wrap; }
.tab {
  border: 0; background: transparent; color: var(--text-secondary);
  padding: 9px 12px; font-size: 0.85rem; cursor: pointer; font-family: inherit;
  border-bottom: 2px solid transparent;
}
.tab.activa { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.table-scroll { overflow-x: auto; }
.cxp-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.cxp-table th, .cxp-table td {
  text-align: left; padding: 9px 10px;
  border-bottom: 1px solid var(--divider-weak); white-space: nowrap;
}
.cxp-table th { color: var(--text-secondary); font-weight: 600; font-size: 0.75rem; }
.cxp-table tr:last-child td { border-bottom: 0; }
.cxp-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.cxp-table tfoot td { font-weight: 700; background: var(--surface-alt, transparent); border-top: 2px solid var(--border); }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.fuerte { font-weight: 600; }
.rif { display: block; font-size: 0.7rem; color: var(--text-secondary); }
.tag { padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
.tag.vencido { background: rgba(var(--error-rgb), 0.14); color: var(--error); }
.tag.por_vencer { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
.tag.sin_vencimiento { background: rgba(128, 128, 128, 0.14); color: var(--text-secondary); }
.tag.pagado { background: rgba(var(--success-rgb), 0.14); color: var(--success); }
.empty-state { padding: 28px 12px; text-align: center; color: var(--text-secondary); font-size: 0.88rem; }
.nota { margin: 0; color: var(--text-secondary); font-size: 0.78rem; line-height: 1.5; }
@media (max-width: 980px) {
  .cxp-head { flex-direction: column; }
  .filtros-grid, .resumen { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  .filtros-grid, .resumen { grid-template-columns: 1fr; }
}
</style>
