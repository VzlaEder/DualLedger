<template>
  <div class="cxp-view">
    <ReportHeader
      title="Cuentas por pagar (CxP)"
      icon="&#128176;"
      badge="Reporte · solo lectura"
      accent="#2563eb"
      subtitle="Saldos y vencimientos derivados de las facturas del Libro de Compras. El vencimiento se toma de Compras diarias o del crédito del proveedor; el saldo es el total más IGTF menos las retenciones. No registra pagos ni abonos."
    >
      <template #actions>
        <button class="btn" :disabled="cargando" @click="cargar">Recargar</button>
        <button class="btn" :disabled="!filtradas.length" @click="exportar">Exportar Excel (CSV)</button>
        <button class="btn btn-primary" :disabled="!filtradas.length" @click="imprimir">Imprimir</button>
      </template>
    </ReportHeader>

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
      <SummaryCards :metrics="metricas" accent="#2563eb" />

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
import ReportHeader from './ReportHeader.vue'
import SummaryCards from './SummaryCards.vue'
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
import { descargarCsv, dinero, fechaMostrar, imprimirReporte } from '../utils/reporte.js'

export default {
  name: 'CxpView',
  components: { ReportHeader, SummaryCards },
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
    metricas() {
      const r = this.resumen
      return [
        { label: 'Saldo pendiente', value: `Bs ${this.dinero(r.saldo)}` },
        { label: 'Saldo vencido', value: `Bs ${this.dinero(r.saldoVencido)}` },
        { label: 'Por vencer', value: `Bs ${this.dinero(r.saldoPorVencer)}` },
        { label: 'Sin vencimiento', value: `Bs ${this.dinero(r.saldoSinVencimiento)}` },
        { label: 'Documentos pendientes', value: r.vencidas + r.porVencer + r.sinVencimiento },
        { label: 'Retenciones descontadas', value: `Bs ${this.dinero(r.retenciones)}` }
      ]
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
    dinero,
    fechaMostrar,
    etiquetaEstado(estado) {
      return etiquetaEstadoCxp(estado)
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
      descargarCsv('cuentas-por-pagar.csv', csvCxp(this.filtradas), 'Cuentas por pagar exportadas a Excel (CSV).')
    },
    imprimir() {
      if (!this.filtradas.length) {
        showToast('No hay cuentas por pagar para imprimir con los filtros actuales.', { type: 'warning' })
        return
      }
      const r = this.resumen
      imprimirReporte({
        titulo: 'CUENTAS POR PAGAR',
        subtitulo: `Desde: ${this.filtros.desde || 'inicio'} · Hasta: ${this.filtros.hasta || 'última fecha'}`,
        resumen: [
          { label: 'Saldo pendiente', valor: this.dinero(r.saldo) },
          { label: 'Saldo vencido', valor: this.dinero(r.saldoVencido) },
          { label: 'Por vencer', valor: this.dinero(r.saldoPorVencer) },
          { label: 'Retenciones', valor: this.dinero(r.retenciones) }
        ],
        encabezados: ['Fecha', 'Vencimiento', 'Documento', 'Proveedor', 'Estado', 'Antigüedad', 'Total', 'Retenciones', 'Saldo'],
        filas: this.filtradas.map((l) => [
          this.fechaMostrar(l.fecha),
          this.fechaMostrar(l.vencimiento),
          l.numero,
          l.proveedor || '—',
          this.etiquetaEstado(l.estado),
          l.antiguedad,
          { valor: this.dinero(l.total), numero: true },
          { valor: this.dinero(l.retenciones), numero: true },
          { valor: this.dinero(l.saldo), numero: true }
        ]),
        nota: 'Saldos derivados del Libro de Compras. No se registran pagos ni abonos. Reporte de solo lectura.'
      })
    }
  }
}
</script>

<style scoped>
.cxp-view { display: flex; flex-direction: column; gap: 16px; }
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
.tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--divider-weak); margin-bottom: 12px; flex-wrap: wrap; }
.tab {
  border: 0; background: transparent; color: var(--text-secondary);
  padding: 9px 12px; font-size: 0.85rem; cursor: pointer; font-family: inherit;
  border-bottom: 2px solid transparent;
}
.tab.activa { color: #2563eb; border-bottom-color: #2563eb; font-weight: 600; }
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
@media (max-width: 980px) { .filtros-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .filtros-grid { grid-template-columns: 1fr; } }
</style>
