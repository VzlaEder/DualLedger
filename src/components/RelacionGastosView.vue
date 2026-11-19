<template>
  <div class="rg-view">
    <ReportHeader
      title="Relación de gastos"
      icon="&#128221;"
      badge="Reporte · solo lectura"
      accent="#7c3aed"
      subtitle="Consolidado de gastos deducibles y no deducibles. Las facturas se toman del Libro de Compras y los recibos/tickets de Documentos no fiscales. Este reporte es de solo lectura."
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
          <label>Desde</label>
          <input v-model="filtros.desde" class="input" type="date" />
        </div>
        <div class="field">
          <label>Hasta</label>
          <input v-model="filtros.hasta" class="input" type="date" />
        </div>
        <div class="field">
          <label>Origen</label>
          <select v-model="filtros.origen" class="input">
            <option v-for="o in origenes" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="field">
          <label>Deducibilidad</label>
          <select v-model="filtros.deducibilidad" class="input">
            <option v-for="d in deducibilidades" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </div>
        <div class="field">
          <label>Cuenta contable</label>
          <select v-model="filtros.cuenta" class="input">
            <option value="">Todas las cuentas</option>
            <option v-for="c in cuentas" :key="c.codigo" :value="c.codigo">
              {{ c.codigo }} — {{ c.nombre }}
            </option>
          </select>
        </div>
        <div class="field field-wide">
          <label>Buscar</label>
          <input
            v-model="filtros.busqueda"
            class="input"
            type="search"
            placeholder="Número, proveedor, RIF, cuenta o concepto…"
          />
        </div>
      </div>
      <div class="atajos">
        <span class="atajos-label">Atajos de fecha:</span>
        <button class="btn btn-small" @click="aplicarMes(0)">Este mes</button>
        <button class="btn btn-small" @click="aplicarMes(-1)">Mes anterior</button>
        <button class="btn btn-small" @click="limpiarFiltros">Limpiar filtros</button>
        <span class="resultado">{{ filtradas.length }} de {{ lineas.length }} registros</span>
      </div>
    </div>

    <div v-if="cargando" class="card empty-state">Cargando gastos…</div>

    <template v-else>
      <SummaryCards :metrics="metricas" accent="#7c3aed" />

      <div class="card">
        <div class="tabs">
          <button class="tab" :class="{ activa: tab === 'detalle' }" @click="tab = 'detalle'">
            Detalle ({{ filtradas.length }})
          </button>
          <button class="tab" :class="{ activa: tab === 'cuenta' }" @click="tab = 'cuenta'">
            Por cuenta ({{ porCuenta.length }})
          </button>
          <button class="tab" :class="{ activa: tab === 'mes' }" @click="tab = 'mes'">
            Por mes ({{ porMes.length }})
          </button>
        </div>

        <div v-if="!filtradas.length" class="empty-state">
          <p v-if="lineas.length">No hay gastos que coincidan con los filtros seleccionados.</p>
          <p v-else>
            Todavía no hay gastos registrados. Registra facturas en
            <strong>Compras diarias</strong> o comprobantes en <strong>Documentos no fiscales</strong>.
          </p>
        </div>

        <div v-else-if="tab === 'detalle'" class="table-scroll">
          <table class="rg-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Documento</th>
                <th>Proveedor</th>
                <th>Cuenta</th>
                <th>Concepto</th>
                <th class="num">Base</th>
                <th class="num">C.F. deducible</th>
                <th class="num">C.F. no deducible</th>
                <th class="num">Retenciones</th>
                <th class="num">Total</th>
                <th>Deducible</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in filtradas" :key="l.origen + '-' + l.uid">
                <td class="mono">{{ fechaMostrar(l.fecha) }}</td>
                <td>
                  <span class="tag" :class="l.origen">
                    {{ l.origen === 'no_fiscal' ? 'No fiscal' : 'Factura' }}
                  </span>
                </td>
                <td class="mono fuerte">{{ l.numero }}</td>
                <td>
                  {{ l.proveedor || '—' }}
                  <small v-if="l.rif" class="rif">{{ l.rif }}</small>
                </td>
                <td class="mono">{{ l.cuenta || '—' }}</td>
                <td class="concepto">{{ l.concepto }}</td>
                <td class="num">{{ dinero(l.base) }}</td>
                <td class="num">{{ dinero(l.creditoFiscalDeducible) }}</td>
                <td class="num">{{ dinero(l.creditoFiscalNoDeducible) }}</td>
                <td class="num">{{ dinero(l.retenciones) }}</td>
                <td class="num fuerte">{{ dinero(l.total) }}</td>
                <td>
                  <span class="tag" :class="l.deducible ? 'si' : 'no'">
                    {{ l.deducible ? 'Sí' : 'No' }}
                  </span>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="6">Totales del filtro ({{ filtradas.length }} documentos)</td>
                <td class="num">{{ dinero(resumen.base) }}</td>
                <td class="num">{{ dinero(resumen.creditoFiscalDeducible) }}</td>
                <td class="num">{{ dinero(resumen.creditoFiscalNoDeducible) }}</td>
                <td class="num">{{ dinero(resumen.retenciones) }}</td>
                <td class="num">{{ dinero(resumen.total) }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div v-else-if="tab === 'cuenta'" class="table-scroll">
          <table class="rg-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Descripción</th>
                <th class="num">Documentos</th>
                <th class="num">Deducible</th>
                <th class="num">No deducible</th>
                <th class="num">Total documentos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in porCuenta" :key="g.cuenta">
                <td class="mono fuerte">{{ g.cuenta }}</td>
                <td>{{ g.nombre || '—' }}</td>
                <td class="num">{{ g.documentos }}</td>
                <td class="num">{{ dinero(g.deducible) }}</td>
                <td class="num">{{ dinero(g.noDeducible) }}</td>
                <td class="num fuerte">{{ dinero(g.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="table-scroll">
          <table class="rg-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th class="num">Documentos</th>
                <th class="num">Deducible</th>
                <th class="num">No deducible</th>
                <th class="num">Total documentos</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in porMes" :key="g.periodo">
                <td class="mono fuerte">{{ g.periodo }}</td>
                <td class="num">{{ g.documentos }}</td>
                <td class="num">{{ dinero(g.deducible) }}</td>
                <td class="num">{{ dinero(g.noDeducible) }}</td>
                <td class="num fuerte">{{ dinero(g.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="nota">
        El IVA de proveedores con «crédito fiscal no deducible» no se acredita, pero se incluye
        dentro del gasto deducible. Los documentos no fiscales se contabilizan por su monto
        completo según su marcador de deducibilidad. La relación no modifica el Libro de Compras.
      </p>
    </template>
  </div>
</template>

<script>
import ReportHeader from './ReportHeader.vue'
import SummaryCards from './SummaryCards.vue'
import { listarDocumentos } from '../services/compras.js'
import { getDocumentosNoFiscales, saveDocumentosNoFiscales } from '../stores/documentosNoFiscalesDb.js'
import { getCuentas } from '../stores/maestrosDb.js'
import { getJson } from '../utils/api.js'
import { showToast } from '../utils/dialog.js'
import { descargarCsv, dinero, fechaMostrar, imprimirReporte } from '../utils/reporte.js'
import {
  DEDUCIBILIDADES,
  ORIGENES_GASTO,
  agruparGastosPorCuenta,
  agruparGastosPorMes,
  construirLineasGastos,
  csvGastos,
  filtrosGastosVacios,
  listarLineasGastos,
  rangoMes,
  resumenGastos
} from '../services/relacionGastos.js'

export default {
  name: 'RelacionGastosView',
  components: { ReportHeader, SummaryCards },
  data() {
    return {
      documentos: [],
      noFiscales: [],
      cuentas: [],
      cargando: false,
      filtros: filtrosGastosVacios(),
      tab: 'detalle'
    }
  },
  computed: {
    origenes() {
      return ORIGENES_GASTO
    },
    deducibilidades() {
      return DEDUCIBILIDADES
    },
    lineas() {
      return construirLineasGastos(this.documentos, this.noFiscales)
    },
    filtradas() {
      return listarLineasGastos({
        documentos: this.documentos,
        noFiscales: this.noFiscales,
        filtros: this.filtros
      })
    },
    resumen() {
      return resumenGastos(this.filtradas)
    },
    metricas() {
      const r = this.resumen
      return [
        { label: 'Gasto deducible', value: `Bs ${this.dinero(r.gastoDeducible)}` },
        { label: 'Gasto no deducible', value: `Bs ${this.dinero(r.gastoNoDeducible)}` },
        { label: 'Total general', value: `Bs ${this.dinero(r.total)}` },
        { label: 'Crédito fiscal acreditable', value: `Bs ${this.dinero(r.creditoFiscalDeducible)}` },
        { label: 'Crédito fiscal no acreditable', value: `Bs ${this.dinero(r.creditoFiscalNoDeducible)}` },
        { label: 'Retenciones', value: `Bs ${this.dinero(r.retenciones)}` }
      ]
    },
    porCuenta() {
      return agruparGastosPorCuenta(this.filtradas, this.cuentas)
    },
    porMes() {
      return agruparGastosPorMes(this.filtradas)
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    dinero,
    fechaMostrar,
    async cargarNoFiscales() {
      const locales = await getDocumentosNoFiscales().catch(() => [])
      if (locales && locales.length) return locales
      try {
        const res = await getJson('/documentos-no-fiscales')
        const lista = (res && res.documentos) || []
        if (lista.length) await saveDocumentosNoFiscales(lista).catch(() => {})
        return lista
      } catch (e) {
        return []
      }
    },
    async cargar() {
      this.cargando = true
      try {
        const [docs, noFiscales, cuentas] = await Promise.allSettled([
          listarDocumentos(),
          this.cargarNoFiscales(),
          getCuentas()
        ])
        this.documentos = docs.status === 'fulfilled' ? (docs.value.documentos || []) : []
        this.noFiscales = noFiscales.status === 'fulfilled' ? (noFiscales.value || []) : []
        this.cuentas = cuentas.status === 'fulfilled' ? (cuentas.value || []) : []
      } finally {
        this.cargando = false
      }
    },
    aplicarMes(desplazamiento) {
      const rango = rangoMes(new Date(), desplazamiento)
      this.filtros.desde = rango.desde
      this.filtros.hasta = rango.hasta
    },
    limpiarFiltros() {
      this.filtros = filtrosGastosVacios()
    },
    exportar() {
      if (!this.filtradas.length) {
        showToast('No hay gastos para exportar con los filtros actuales.', { type: 'warning' })
        return
      }
      descargarCsv('relacion-de-gastos.csv', csvGastos(this.filtradas), 'Relación de gastos exportada a Excel (CSV).')
    },
    imprimir() {
      if (!this.filtradas.length) {
        showToast('No hay gastos para imprimir con los filtros actuales.', { type: 'warning' })
        return
      }
      const r = this.resumen
      imprimirReporte({
        titulo: 'RELACIÓN DE GASTOS',
        subtitulo: `Desde: ${this.filtros.desde || 'inicio'} · Hasta: ${this.filtros.hasta || 'última fecha'}`,
        resumen: [
          { label: 'Gasto deducible', valor: this.dinero(r.gastoDeducible) },
          { label: 'Gasto no deducible', valor: this.dinero(r.gastoNoDeducible) },
          { label: 'Crédito fiscal acreditable', valor: this.dinero(r.creditoFiscalDeducible) },
          { label: 'Retenciones', valor: this.dinero(r.retenciones) }
        ],
        encabezados: ['Fecha', 'Origen', 'Documento', 'Proveedor', 'Cuenta', 'Concepto', 'Base', 'Total', 'Deducible'],
        filas: this.filtradas.map((l) => [
          this.fechaMostrar(l.fecha),
          l.origen === 'no_fiscal' ? 'No fiscal' : 'Factura',
          l.numero,
          l.proveedor || '—',
          l.cuenta || '—',
          l.concepto,
          { valor: this.dinero(l.base), numero: true },
          { valor: this.dinero(l.total), numero: true },
          l.deducible ? 'Sí' : 'No'
        ]),
        nota: 'El IVA no acreditable se incluye en el gasto deducible; los documentos no fiscales se contabilizan según su marcador de deducibilidad. Reporte de solo lectura.'
      })
    }
  }
}
</script>

<style scoped>
.rg-view { display: flex; flex-direction: column; gap: 16px; }
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
.tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--divider-weak); margin-bottom: 12px; }
.tab {
  border: 0; background: transparent; color: var(--text-secondary);
  padding: 9px 12px; font-size: 0.85rem; cursor: pointer; font-family: inherit;
  border-bottom: 2px solid transparent;
}
.tab.activa { color: #7c3aed; border-bottom-color: #7c3aed; font-weight: 600; }
.table-scroll { overflow-x: auto; }
.rg-table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
.rg-table th, .rg-table td {
  text-align: left; padding: 9px 10px;
  border-bottom: 1px solid var(--divider-weak); white-space: nowrap;
}
.rg-table th { color: var(--text-secondary); font-weight: 600; font-size: 0.75rem; }
.rg-table tr:last-child td { border-bottom: 0; }
.rg-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.rg-table tfoot td { font-weight: 700; background: var(--surface-alt, transparent); border-top: 2px solid var(--border); }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.fuerte { font-weight: 600; }
.rif { display: block; font-size: 0.7rem; color: var(--text-secondary); }
.concepto { max-width: 230px; overflow: hidden; text-overflow: ellipsis; }
.tag { padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
.tag.si { background: rgba(var(--success-rgb), 0.14); color: var(--success); }
.tag.no { background: rgba(var(--accent-rgb), 0.14); color: var(--accent); }
.tag.factura { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
.tag.no_fiscal { background: rgba(var(--accent-rgb), 0.14); color: var(--accent); }
.empty-state { padding: 28px 12px; text-align: center; color: var(--text-secondary); font-size: 0.88rem; }
.nota { margin: 0; color: var(--text-secondary); font-size: 0.78rem; line-height: 1.5; }
@media (max-width: 980px) { .filtros-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .filtros-grid { grid-template-columns: 1fr; } }
</style>
