<template>
  <div class="rg-view">
    <div class="rg-head">
      <div>
        <h2>Relación de gastos</h2>
        <p class="sub">
          Consolidado de gastos deducibles y no deducibles. Las facturas se toman del Libro de
          Compras (incluidas las de Compras diarias) y los recibos/tickets de Documentos no
          fiscales. Este reporte es de solo lectura.
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
      <div class="resumen">
        <div class="metrica destacada">
          <span>Gasto deducible</span>
          <strong>Bs {{ dinero(resumen.gastoDeducible) }}</strong>
        </div>
        <div class="metrica">
          <span>Gasto no deducible</span>
          <strong>Bs {{ dinero(resumen.gastoNoDeducible) }}</strong>
        </div>
        <div class="metrica">
          <span>Total general</span>
          <strong>Bs {{ dinero(resumen.total) }}</strong>
        </div>
        <div class="metrica">
          <span>Crédito fiscal acreditable</span>
          <strong>Bs {{ dinero(resumen.creditoFiscalDeducible) }}</strong>
        </div>
        <div class="metrica">
          <span>Crédito fiscal no acreditable</span>
          <strong>Bs {{ dinero(resumen.creditoFiscalNoDeducible) }}</strong>
        </div>
        <div class="metrica">
          <span>Retenciones</span>
          <strong>Bs {{ dinero(resumen.retenciones) }}</strong>
        </div>
      </div>

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
import { listarDocumentos } from '../services/compras.js'
import { getDocumentosNoFiscales, saveDocumentosNoFiscales } from '../stores/documentosNoFiscalesDb.js'
import { getCuentas } from '../stores/maestrosDb.js'
import { getJson } from '../utils/api.js'
import { showToast } from '../utils/dialog.js'
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
    dinero(v) {
      const n = Number(v)
      if (!isFinite(n)) return '0,00'
      return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    fechaMostrar(iso) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return iso || '—'
      return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    },
    esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    },
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
      const blob = new Blob([csvGastos(this.filtradas)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'relacion-de-gastos.csv'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Relación de gastos exportada a Excel (CSV).')
    },
    imprimir() {
      if (!this.filtradas.length) {
        showToast('No hay gastos para imprimir con los filtros actuales.', { type: 'warning' })
        return
      }
      const filas = this.filtradas.map((l) => `<tr>
        <td>${this.esc(this.fechaMostrar(l.fecha))}</td>
        <td>${this.esc(l.origen === 'no_fiscal' ? 'No fiscal' : 'Factura')}</td>
        <td>${this.esc(l.numero)}</td>
        <td>${this.esc(l.proveedor || '—')}</td>
        <td>${this.esc(l.cuenta || '—')}</td>
        <td>${this.esc(l.concepto)}</td>
        <td class="num">${this.esc(this.dinero(l.base))}</td>
        <td class="num">${this.esc(this.dinero(l.total))}</td>
        <td>${l.deducible ? 'Sí' : 'No'}</td>
      </tr>`).join('')
      const r = this.resumen
      const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Relación de gastos</title>
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
<h1>RELACIÓN DE GASTOS</h1>
<p class="sub">Desde: ${this.esc(this.filtros.desde || 'inicio')} &nbsp; Hasta: ${this.esc(this.filtros.hasta || 'última fecha')}</p>
<table class="resumen">
<tr><th>Gasto deducible</th><th>Gasto no deducible</th><th>Crédito fiscal acreditable</th><th>Retenciones</th></tr>
<tr><td class="num">${this.esc(this.dinero(r.gastoDeducible))}</td>
<td class="num">${this.esc(this.dinero(r.gastoNoDeducible))}</td>
<td class="num">${this.esc(this.dinero(r.creditoFiscalDeducible))}</td>
<td class="num">${this.esc(this.dinero(r.retenciones))}</td></tr>
</table>
<table><thead><tr>
<th>Fecha</th><th>Origen</th><th>Documento</th><th>Proveedor</th><th>Cuenta</th>
<th>Concepto</th><th>Base</th><th>Total</th><th>Deducible</th>
</tr></thead><tbody>${filas}</tbody></table>
<p class="nota">El IVA no acreditable se incluye en el gasto deducible; los documentos no fiscales se contabilizan según su marcador de deducibilidad. Reporte de solo lectura.</p>
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
.rg-view { display: flex; flex-direction: column; gap: 16px; }
.rg-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.rg-head h2 { margin: 0 0 4px; font-size: 1.35rem; }
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
.tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--divider-weak); margin-bottom: 12px; }
.tab {
  border: 0; background: transparent; color: var(--text-secondary);
  padding: 9px 12px; font-size: 0.85rem; cursor: pointer; font-family: inherit;
  border-bottom: 2px solid transparent;
}
.tab.activa { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
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
@media (max-width: 980px) {
  .rg-head { flex-direction: column; }
  .filtros-grid, .resumen { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  .filtros-grid, .resumen { grid-template-columns: 1fr; }
}
</style>
