<template>
  <div class="history">
    <div class="section-header">
      <h2>&#128218; Historial de Excels Generados</h2>
      <span class="record-count">{{ records.length }}</span>
    </div>

    <div v-if="records.length === 0" class="empty-state">
      <div class="empty-icon">&#128218;</div>
      <p>No hay Excels generados aún</p>
      <p class="empty-hint">Los archivos que exportes aparecerán aquí</p>
    </div>

    <div v-else class="history-list">
      <div v-for="record in records" :key="record.id" class="history-card">
        <div class="card-icon">&#128206;</div>
        <div class="card-body">
          <p class="file-name">{{ record.fileName }}</p>
          <div class="card-meta">
            <span>{{ record.recordCount }} registro(s)</span>
            <span v-if="record.totalCompras">
              Total: {{ formatAmount(record.totalCompras) }}
            </span>
          </div>
          <div class="card-dates" v-if="record.dateFrom || record.dateTo">
            <span>Período: {{ record.dateFrom || 'N/A' }} - {{ record.dateTo || 'N/A' }}</span>
          </div>
          <p class="card-date">{{ formatDate(record.fecha) }}</p>
        </div>
        <button class="icon-btn delete" @click="handleDelete(record.id)" title="Eliminar registro">
          &#128465;
        </button>
      </div>
    </div>

    <button v-if="records.length > 0" class="btn btn-clear" @click="clearAll">
      &#128465; Limpiar Historial
    </button>
  </div>
</template>

<script>
import { getAllRecords, deleteRecord } from '../stores/db.js'

export default {
  name: 'History',
  data() {
    return { records: [] }
  },
  mounted() {
    this.loadRecords()
  },
  methods: {
    async loadRecords() {
      try {
        this.records = await getAllRecords()
      } catch (err) {
        console.error('Error loading history:', err)
      }
    },

    async handleDelete(id) {
      if (confirm('¿Eliminar este registro del historial?')) {
        await deleteRecord(id)
        this.records = this.records.filter(r => r.id !== id)
      }
    },

    async clearAll() {
      if (confirm('¿Eliminar todo el historial?')) {
        for (const r of this.records) {
          await deleteRecord(r.id)
        }
        this.records = []
      }
    },

    formatDate(iso) {
      if (!iso) return ''
      const d = new Date(iso)
      return d.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    },

    formatAmount(val) {
      if (!val) return 'Bs. 0,00'
      return 'Bs. ' + new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(val))
    }
  }
}
</script>

<style scoped>
.history { max-width: 800px; margin: 0 auto; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h2 { font-size: 1.1rem; color: var(--text); }

.record-count {
  background: var(--primary);
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

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

.history-list { display: flex; flex-direction: column; gap: 8px; }

.history-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px;
}

.card-icon { font-size: 1.8rem; flex-shrink: 0; }

.card-body { flex: 1; min-width: 0; }
.file-name { font-weight: 600; font-size: 0.85rem; color: var(--text); word-break: break-all; }

.card-meta {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.card-dates { font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px; }
.card-date { font-size: 0.72rem; color: var(--text-secondary); margin-top: 6px; opacity: 0.9; }

.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-btn.delete { background: rgba(var(--error-rgb), 0.08); color: var(--error); }
.icon-btn.delete:hover { background: rgba(var(--error-rgb), 0.15); }

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
}

.btn-clear {
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error);
  border: 1px solid rgba(var(--error-rgb), 0.2);
}

.btn-clear:hover { background: rgba(var(--error-rgb), 0.12); }
</style>
