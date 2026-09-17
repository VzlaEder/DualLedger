<template>
  <div class="export-view">
    <div class="section-header">
      <h2>&#128229; Exportar a Excel</h2>
    </div>

    <div v-if="records.length === 0" class="empty-state">
      <div class="empty-icon">&#128229;</div>
      <p>No hay datos para exportar</p>
      <p class="empty-hint">Primero sube una imagen y revisa los datos extraídos</p>
    </div>

    <div v-else class="export-card">
      <div class="export-info">
        <div class="info-row">
          <span class="info-label">Registros a exportar:</span>
          <span class="info-value">{{ records.length }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Formato:</span>
          <span class="info-value">Libro de Compras (.xlsx)</span>
        </div>
      </div>

      <div class="date-range">
        <h3>&#128197; Rango de Fechas del Libro</h3>
        <div class="date-inputs">
          <div class="date-field">
            <label>Desde</label>
            <input v-model="dateFrom" type="date" />
          </div>
          <div class="date-field">
            <label>Hasta</label>
            <input v-model="dateTo" type="date" />
          </div>
        </div>
      </div>

      <div class="summary-table">
        <h3>&#128202; Resumen</h3>
        <div class="summary-rows">
          <div class="summary-row">
            <span>Total Compras (IVA incl.):</span>
            <span class="amount">{{ formatAmount(totalCompras) }}</span>
          </div>
          <div class="summary-row">
            <span>Base Imponible Nacional:</span>
            <span>{{ formatAmount(totalBaseNac) }}</span>
          </div>
          <div class="summary-row">
            <span>Crédito Fiscal Nacional:</span>
            <span>{{ formatAmount(totalCreditoNac) }}</span>
          </div>
          <div class="summary-row" v-if="totalBaseImp > 0">
            <span>Base Imponible Importación:</span>
            <span>{{ formatAmount(totalBaseImp) }}</span>
          </div>
          <div class="summary-row" v-if="totalCreditoImp > 0">
            <span>Crédito Fiscal Importación:</span>
            <span>{{ formatAmount(totalCreditoImp) }}</span>
          </div>
        </div>
      </div>

      <button class="btn btn-export" @click="exportExcel" :disabled="exporting">
        <span v-if="!exporting">&#128230; Generar y Descargar Excel</span>
        <span v-else>Generando...</span>
      </button>
    </div>

    <div class="column-preview" v-if="records.length > 0">
      <h3>&#128203; Vista Previa de Columnas</h3>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="col in previewColumns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in records.slice(0, 5)" :key="i">
              <td>{{ r.nro }}</td>
              <td>{{ r.fecha }}</td>
              <td>{{ r.rif }}</td>
              <td>{{ r.nombreRazon }}</td>
              <td>{{ r.totalComprasIVA }}</td>
              <td>{{ r.baseNacional }}</td>
              <td>{{ r.creditoFiscalNac }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="table-note" v-if="records.length > 5">Mostrando 5 de {{ records.length }} registros</p>
    </div>
  </div>
</template>

<script>
import { generateExcel } from '../utils/excelTemplate.js'
import { saveExcelRecord } from '../stores/db.js'
import { showAlert } from '../utils/dialog.js'

export default {
  name: 'ExcelExport',
  props: {
    records: { type: Array, default: () => [] }
  },
  emits: ['exported'],
  data() {
    return {
      dateFrom: '',
      dateTo: '',
      exporting: false,
      previewColumns: ['Nro.', 'Fecha', 'RIF', 'Nombre', 'Total', 'Base', 'Cred. Fiscal']
    }
  },
  computed: {
    totalCompras() { return this.records.reduce((s, r) => s + (r.totalComprasIVA || 0), 0) },
    totalBaseNac() { return this.records.reduce((s, r) => s + (r.baseNacional || 0), 0) },
    totalCreditoNac() { return this.records.reduce((s, r) => s + (r.creditoFiscalNac || 0), 0) },
    totalBaseImp() { return this.records.reduce((s, r) => s + (r.baseImportacion || 0), 0) },
    totalCreditoImp() { return this.records.reduce((s, r) => s + (r.creditoFiscalImp || 0), 0) }
  },
  methods: {
    async exportExcel() {
      this.exporting = true
      try {
        const info = generateExcel(this.records, {
          from: this.dateFrom,
          to: this.dateTo
        })

        await saveExcelRecord({
          fileName: info.fileName,
          recordCount: info.recordCount,
          totalCompras: this.totalCompras,
          dateFrom: this.dateFrom,
          dateTo: this.dateTo
        })

        this.$emit('exported', info)
      } catch (err) {
        await showAlert('Error al exportar: ' + err.message, { type: 'error' })
      } finally {
        this.exporting = false
      }
    },

    formatAmount(val) {
      if (!val || val === 0) return 'Bs. 0,00'
      return 'Bs. ' + new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(val))
    }
  }
}
</script>

<style scoped>
.export-view { max-width: 800px; margin: 0 auto; }

.section-header { margin-bottom: 12px; }
.section-header h2 { font-size: 1.1rem; color: var(--text); }

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.empty-icon { font-size: 3rem; margin-bottom: 12px; }
.empty-state p { color: var(--text); }
.empty-hint { font-size: 0.82rem; color: var(--text-secondary); margin-top: 4px; }

.export-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
}

.export-info { margin-bottom: 16px; }

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
}

.info-label { color: var(--text-secondary); }
.info-value { font-weight: 600; color: var(--text); }

.date-range { margin-bottom: 16px; }
.date-range h3 { font-size: 0.9rem; margin-bottom: 8px; color: var(--text); }

.date-inputs { display: flex; gap: 12px; }

.date-field { flex: 1; }
.date-field label { display: block; font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600; }
.date-field input { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.85rem; background: var(--background); color: var(--text); }

.summary-table { margin-bottom: 20px; }
.summary-table h3 { font-size: 0.9rem; margin-bottom: 8px; color: var(--text); }

.summary-rows {
  background: rgba(var(--primary-rgb), 0.03);
  border-radius: 8px;
  padding: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--divider-weak);
}

.summary-row:last-child { border-bottom: none; }
.summary-row .amount { font-weight: 700; color: var(--primary); }

.btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-export {
  background: linear-gradient(135deg, var(--success), #388e3c);
  color: white;
}

.btn-export:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-export:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.column-preview {
  margin-top: 16px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}

.column-preview h3 { font-size: 0.9rem; margin-bottom: 8px; }

.table-scroll { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

th {
  background: var(--primary);
  color: white;
  padding: 8px 6px;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
}

td {
  padding: 6px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

tr:nth-child(even) { background: var(--divider-weak); }
.table-note { font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px; text-align: center; }
</style>
