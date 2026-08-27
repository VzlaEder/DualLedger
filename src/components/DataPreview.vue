<template>
  <div class="preview">
    <div class="section-header">
      <h2>&#128203; Datos Extraídos</h2>
      <span class="record-count">{{ records.length }} registro(s)</span>
    </div>

    <div class="raw-text-toggle" v-if="rawTexts.length > 0">
      <button class="toggle-btn" @click="showRawText = !showRawText">
        {{ showRawText ? '&#128065; Ocultar texto OCR' : '&#128270; Ver texto OCR crudo' }}
      </button>
      <div v-if="showRawText" class="raw-sources">
        <div v-for="(src, i) in rawTexts" :key="i" class="raw-source-block">
          <p class="raw-source-name">{{ src.fileName }}</p>
          <div class="raw-text-box">
            <pre>{{ src.text }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div class="source-summary" v-if="sourceGroups.length > 0">
      <p class="source-label">Imágenes procesadas:</p>
      <div class="source-chips">
        <span v-for="src in sourceGroups" :key="src.name" class="source-chip">
          {{ src.name }} ({{ src.count }})
        </span>
      </div>
    </div>

    <div v-if="records.length === 0" class="empty-state">
      <div class="empty-icon">&#128196;</div>
      <p>No se encontraron registros</p>
      <p class="empty-hint">Sube imágenes para extraer datos automáticamente</p>
      <button class="btn btn-outline" @click="$emit('go-upload')">
        &#128228; Subir Imágenes
      </button>
      <button class="btn btn-outline" style="margin-top: 8px" @click="$emit('add-record')">
        &#10010; Agregar Registro Manual
      </button>
    </div>

    <div v-else class="records-list">
      <div v-for="(record, index) in records" :key="index" class="record-card">
        <div class="record-header">
          <div class="record-header-left">
            <span class="record-num">#{{ record.nro }}</span>
            <span v-if="record.source" class="record-source">{{ record.source }}</span>
          </div>
          <div class="record-actions">
            <button class="icon-btn edit" @click="toggleEdit(index)" :title="editingIndex === index ? 'Guardar' : 'Editar'">
              {{ editingIndex === index ? '&#10003;' : '&#9998;' }}
            </button>
            <button class="icon-btn delete" @click="handleDelete(index)" title="Eliminar">&#128465;</button>
          </div>
        </div>

        <div class="record-body" v-if="editingIndex !== index">
          <div class="field-row">
            <span class="field-label">Fecha:</span>
            <span class="field-value">{{ record.fecha || '-' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">RIF:</span>
            <span class="field-value">{{ record.rif || '-' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Nombre/Razón Social:</span>
            <span class="field-value">{{ record.nombreRazon || '-' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Nro. Factura:</span>
            <span class="field-value">{{ record.nroFactura || '-' }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Nro. Control:</span>
            <span class="field-value">{{ record.nroControl || '-' }}</span>
          </div>
          <div class="field-row highlight">
            <span class="field-label">Total Compras (IVA incl.):</span>
            <span class="field-value amount">{{ formatAmount(record.totalComprasIVA) }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Base Imponible:</span>
            <span class="field-value">{{ formatAmount(record.baseNacional) }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Crédito Fiscal:</span>
            <span class="field-value">{{ formatAmount(record.creditoFiscalNac) }}</span>
          </div>
        </div>

        <div class="record-edit" v-else>
          <div class="edit-grid">
            <div class="edit-field">
              <label>Fecha</label>
              <input v-model="editForm.fecha" type="text" placeholder="DD/MM/AAAA" />
            </div>
            <div class="edit-field">
              <label>RIF</label>
              <input v-model="editForm.rif" type="text" placeholder="J-12345678" />
            </div>
            <div class="edit-field full">
              <label>Nombre / Razón Social</label>
              <input v-model="editForm.nombreRazon" type="text" />
            </div>
            <div class="edit-field">
              <label>Nro. Factura</label>
              <input v-model="editForm.nroFactura" type="text" />
            </div>
            <div class="edit-field">
              <label>Nro. Control</label>
              <input v-model="editForm.nroControl" type="text" />
            </div>
            <div class="edit-field">
              <label>Total Compras (IVA incl.)</label>
              <input v-model.number="editForm.totalComprasIVA" type="number" step="0.01" />
            </div>
            <div class="edit-field">
              <label>Base Imponible Nac.</label>
              <input v-model.number="editForm.baseNacional" type="number" step="0.01" />
            </div>
            <div class="edit-field">
              <label>Alicuota Nac. (%)</label>
              <input v-model.number="editForm.alicuotaNac" type="number" />
            </div>
            <div class="edit-field">
              <label>Crédito Fiscal Nac.</label>
              <input v-model.number="editForm.creditoFiscalNac" type="number" step="0.01" />
            </div>
            <div class="edit-field">
              <label>No Gravadas</label>
              <input v-model.number="editForm.noGravadas" type="number" step="0.01" />
            </div>
            <div class="edit-field">
              <label>Nro. Nota de Débito</label>
              <input v-model="editForm.nroNotaDebito" type="text" />
            </div>
            <div class="edit-field">
              <label>Nro. Nota de Crédito</label>
              <input v-model="editForm.nroNotaCredito" type="text" />
            </div>
            <div class="edit-field">
              <label>Tipo Transacción</label>
              <select v-model="editForm.tipoTransaccion">
                <option value="01 -Reg">01 - Reg</option>
                <option value="02 - Affect">02 - Affect</option>
              </select>
            </div>
            <div class="edit-field">
              <label>Base Imponible Imp.</label>
              <input v-model.number="editForm.baseImportacion" type="number" step="0.01" />
            </div>
            <div class="edit-field">
              <label>Crédito Fiscal Imp.</label>
              <input v-model.number="editForm.creditoFiscalImp" type="number" step="0.01" />
            </div>
            <div class="edit-field">
              <label>Nro. Expediente Imp.</label>
              <input v-model="editForm.numExpediente" type="text" />
            </div>
            <div class="edit-field">
              <label>Nro. Planilla Imp.</label>
              <input v-model="editForm.numPlanilla" type="text" />
            </div>
            <div class="edit-field">
              <label>Ret IVA</label>
              <input v-model.number="editForm.retIVA" type="number" step="0.01" />
            </div>
            <div class="edit-field">
              <label>(3%) IGTF</label>
              <input v-model.number="editForm.igtf" type="number" step="0.01" />
            </div>
          </div>
        </div>
      </div>

      <button class="btn btn-add" @click="$emit('add-record')">
        &#10010; Agregar Registro
      </button>
      <button class="btn btn-add" @click="$emit('go-upload')">
        &#128247; Agregar Más Imágenes
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DataPreview',
  props: {
    records: { type: Array, default: () => [] },
    rawTexts: { type: Array, default: () => [] }
  },
  emits: ['update-record', 'delete-record', 'add-record', 'go-upload'],
  data() {
    return {
      editingIndex: -1,
      editForm: {},
      showRawText: false
    }
  },
  computed: {
    sourceGroups() {
      const map = {}
      this.records.forEach(r => {
        const name = r.source || 'Manual'
        map[name] = (map[name] || 0) + 1
      })
      return Object.entries(map).map(([name, count]) => ({ name, count }))
    }
  },
  methods: {
    toggleEdit(index) {
      if (this.editingIndex === index) {
        this.$emit('update-record', index, { ...this.editForm })
        this.editingIndex = -1
      } else {
        this.editForm = { ...this.records[index] }
        this.editingIndex = index
      }
    },

    handleDelete(index) {
      if (confirm('¿Eliminar este registro?')) {
        this.$emit('delete-record', index)
        if (this.editingIndex === index) this.editingIndex = -1
      }
    },

    formatAmount(val) {
      if (!val || val === 0) return '-'
      return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(val)
    }
  }
}
</script>

<style scoped>
.preview { max-width: 800px; margin: 0 auto; }

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

.source-summary { margin-bottom: 12px; }
.source-label { font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 6px; }
.source-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.source-chip {
  background: rgba(26, 35, 126, 0.08);
  color: var(--primary);
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 0.72rem;
  font-weight: 600;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(26, 35, 126, 0.04);
  border-bottom: 1px solid var(--border);
}

.record-header-left { display: flex; align-items: center; gap: 8px; }

.record-num {
  font-weight: 700;
  color: var(--primary);
  font-size: 0.9rem;
}

.record-source {
  font-size: 0.68rem;
  background: rgba(255, 109, 0, 0.1);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.toggle-btn {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.82rem;
  cursor: pointer;
  color: var(--primary);
  font-weight: 500;
}

.raw-sources { margin-top: 8px; }
.raw-source-block { margin-bottom: 10px; }
.raw-source-name { font-size: 0.78rem; font-weight: 600; color: var(--text); margin-bottom: 4px; }

.raw-text-box {
  margin-top: 8px;
  background: #263238;
  color: #b0bec5;
  padding: 12px;
  border-radius: 8px;
  max-height: 200px;
  overflow: auto;
}

.raw-text-box pre {
  font-size: 0.72rem;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.empty-icon { font-size: 3rem; margin-bottom: 12px; }
.empty-state p { font-size: 1rem; color: var(--text); margin-bottom: 4px; }
.empty-hint { font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 16px; }

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-outline {
  background: transparent;
  border: 2px solid var(--primary);
  color: var(--primary);
}

.btn-outline:hover { background: rgba(26, 35, 126, 0.05); }

.records-list { display: flex; flex-direction: column; gap: 10px; }

.record-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.record-actions { display: flex; gap: 4px; }

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
  transition: all 0.2s;
}

.icon-btn.edit { background: rgba(26, 35, 126, 0.08); color: var(--primary); }
.icon-btn.edit:hover { background: rgba(26, 35, 126, 0.15); }
.icon-btn.delete { background: rgba(176, 0, 32, 0.08); color: var(--error); }
.icon-btn.delete:hover { background: rgba(176, 0, 32, 0.15); }

.record-body { padding: 12px 14px; }

.field-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 0.82rem;
}

.field-label { color: var(--text-secondary); font-weight: 500; }
.field-value { color: var(--text); font-weight: 400; text-align: right; max-width: 60%; }
.field-value.amount { color: var(--primary); font-weight: 700; font-size: 0.9rem; }

.field-row.highlight { background: rgba(26, 35, 126, 0.03); border-radius: 4px; padding: 8px 4px; }

.record-edit { padding: 14px; }

.edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.edit-field { display: flex; flex-direction: column; }
.edit-field.full { grid-column: 1 / -1; }

.edit-field label {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: 3px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.edit-field input,
.edit-field select {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.85rem;
  background: var(--background);
  color: var(--text);
  transition: border-color 0.2s;
}

.edit-field input:focus,
.edit-field select:focus {
  outline: none;
  border-color: var(--primary);
}

.btn-add {
  width: 100%;
  margin-top: 12px;
  padding: 14px;
  background: var(--surface);
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add:hover { border-color: var(--primary); background: rgba(26, 35, 126, 0.02); }

@media (max-width: 480px) {
  .edit-grid { grid-template-columns: 1fr; }
  .edit-field.full { grid-column: 1; }
}
</style>
