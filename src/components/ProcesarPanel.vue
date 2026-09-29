<template>
  <div class="procesar-panel">
    <div class="records-badge" v-if="records.length > 0">
      {{ records.length }} registro(s) acumulados
    </div>

    <nav class="nav-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['nav-tab', { active: currentTab === tab.id }]"
        @click="currentTab = tab.id"
      >
        <span class="tab-icon" v-html="tab.icon"></span>
        {{ tab.label }}
        <span v-if="tab.id === 'preview' && records.length" class="tab-badge">{{ records.length }}</span>
      </button>
    </nav>

    <main class="app-main">
      <ImageUploader
        v-if="currentTab === 'upload'"
        ref="uploaderRef"
        @process-start="handleProcessStart"
      />

      <DataPreview
        v-if="currentTab === 'preview'"
        :records="records"
        :raw-texts="rawTexts"
        @update-record="handleUpdateRecord"
        @delete-record="handleDeleteRecord"
        @add-record="handleAddRecord"
        @go-upload="currentTab = 'upload'"
        @clear-records="handleClearRecords"
      />

      <ExcelExport
        v-if="currentTab === 'export'"
        :records="records"
        @exported="handleExported"
      />

      <History
        v-if="currentTab === 'history'"
        ref="historyRef"
      />

      <MaestrosTab
        v-if="currentTab === 'maestros'"
      />
    </main>

    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingMessage }}</p>
      <div class="progress-bar" v-if="progress > 0">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <button class="loading-cancel" @click="cancelProcessing">&#10005; Cancelar</button>
    </div>
  </div>
</template>

<script>
import ImageUploader from './ImageUploader.vue'
import DataPreview from './DataPreview.vue'
import ExcelExport from './ExcelExport.vue'
import History from './History.vue'
import MaestrosTab from './MaestrosTab.vue'
import { processImage, expandFile } from '../utils/ocr.js'
import { showConfirm, showToast } from '../utils/dialog.js'
import { unlockAudio, playCompletionSound, playErrorSound } from '../utils/sound.js'

function emptyRecord(nro) {
  return {
    nro,
    tipoDocumento: 'factura',
    fecha: '',
    rif: '',
    nombreRazon: '',
    porcentajeContribucion: '',
    nroFactura: '',
    nroControl: '',
    numeroMaquinaFiscal: '',
    nroNotaDebito: '',
    nroNotaCredito: '',
    tipoTransaccion: '01 -Reg',
    nroFacturaAfectada: '',
    totalComprasIVA: 0,
    noGravadas: 0,
    baseNacional: 0,
    alicuotaNac: 16,
    creditoFiscalNac: 0,
    baseImportacion: 0,
    alicuotaImp: 16,
    creditoFiscalImp: 0,
    numExpediente: '',
    numPlanilla: '',
    fechaPlanilla: '',
    retIVA: 0,
    comprobanteIVA: '',
    fechaIVA: '',
    igtf: 0
  }
}

export default {
  name: 'ProcesarPanel',
  components: { ImageUploader, DataPreview, ExcelExport, History, MaestrosTab },
  data() {
    return {
      currentTab: 'upload',
      tabs: [
        { id: 'upload', label: 'Subir', icon: '&#128228;' },
        { id: 'preview', label: 'Datos', icon: '&#128203;' },
        { id: 'export', label: 'Exportar', icon: '&#128229;' },
        { id: 'history', label: 'Historial', icon: '&#128218;' },
        { id: 'maestros', label: 'Maestros', icon: '&#128220;' }
      ],
      records: [],
      rawTexts: [],
      loading: false,
      loadingMessage: '',
      progress: 0,
      processingAbortController: null
    }
  },
  methods: {
    async handleProcessStart(pendingItems) {
      const controller = new AbortController()
      this.processingAbortController = controller

      try {
        unlockAudio()
        this.loading = true
        this.progress = 0
        let failCount = 0

        for (let i = 0; i < pendingItems.length; i++) {
          const item = pendingItems[i]
          this.loadingMessage = `Procesando "${item.file.name}" (${i + 1}/${pendingItems.length})...`

          if (this.$refs.uploaderRef) {
            const queueIndex = this.$refs.uploaderRef.queue.indexOf(item)
            this.$refs.uploaderRef.updateItemStatus(queueIndex, 'processing')
          }

          try {
            await this.handleImageLoaded(item.file, item.file.name, item.handwritten, controller.signal)
            if (this.$refs.uploaderRef) {
              const queueIndex = this.$refs.uploaderRef.queue.indexOf(item)
              this.$refs.uploaderRef.updateItemStatus(queueIndex, 'done')
            }
          } catch (e) {
            if (e && e.name === 'AbortError') throw e
            failCount++
            if (this.$refs.uploaderRef) {
              const queueIndex = this.$refs.uploaderRef.queue.indexOf(item)
              this.$refs.uploaderRef.updateItemStatus(queueIndex, 'error')
            }
          }

          if (controller.signal.aborted) break
        }

        if (controller.signal.aborted) {
          this.loadingMessage = 'Procesamiento cancelado'
          if (this.$refs.uploaderRef) {
            this.$refs.uploaderRef.resetProcessing()
          }
          return
        }

        this.loading = false
        this.progress = 0

        if (this.$refs.uploaderRef) {
          this.$refs.uploaderRef.resetProcessing()
        }

        this.currentTab = 'preview'
        if (failCount === 0) {
          playCompletionSound()
          showToast('Procesamiento completado')
        } else if (failCount >= pendingItems.length) {
          playErrorSound()
          showToast('El procesamiento falló', { type: 'error' })
        } else {
          playErrorSound()
          showToast(`Procesamiento completado con ${failCount} error(es)`, { type: 'warning' })
        }
      } catch (e) {
        if (e && e.name === 'AbortError') {
          this.loadingMessage = 'Procesamiento cancelado'
        }
      } finally {
        this.loading = false
        this.progress = 0
        this.processingAbortController = null
      }
    },

    cancelProcessing() {
      if (this.processingAbortController) {
        this.processingAbortController.abort()
      }
      this.loading = false
      this.progress = 0
      if (this.$refs.uploaderRef) {
        this.$refs.uploaderRef.resetProcessing()
      }
    },

    async handleImageLoaded(file, fileName, handwritten = false, signal = null) {
      this.progress = 0

      const pages = await expandFile(file)

      for (let p = 0; p < pages.length; p++) {
        if (signal && signal.aborted) {
          const err = new Error('Operación cancelada')
          err.name = 'AbortError'
          throw err
        }

        const page = pages[p]
        const pageName = pages.length > 1
          ? `${fileName} (pág. ${p + 1}/${pages.length})`
          : fileName

        const result = await processImage(page.blob, (pr) => {
          this.loadingMessage = pr.status === 'recognizing text'
            ? `Reconociendo texto en "${pageName}"... ${Math.round(pr.progress * 100)}%`
            : pr.status === 'loading language traineddata'
            ? 'Cargando modelo de idioma...'
            : pr.status === 'enviando a Gemini'
            ? 'Enviando a Gemini AI...'
            : pr.status === 'convirtiendo imagen'
            ? 'Preparando imagen...'
            : pr.status === 'procesando respuesta'
            ? 'Analizando documento con Gemini...'
            : pr.status === 'parseando datos'
            ? 'Estructurando datos...'
            : pr.status === 'gemini-fallback'
            ? 'Gemini falló; usando Tesseract (OCR local)...'
            : `Procesando "${pageName}"...`
          this.progress = Math.round((pr.progress || 0) * 100)
        }, { handwritten, signal })

        if (signal && signal.aborted) {
          const err = new Error('Operación cancelada')
          err.name = 'AbortError'
          throw err
        }

        this.rawTexts.push({
          fileName: pageName || 'Imagen',
          text: result.rawText,
          engine: result.engine || 'tesseract',
          note: result.geminiNote || '',
          handwritten
        })

        let newRecords = result.parsedData

        if (newRecords.length === 0 && result.lines.length > 0) {
          newRecords = [emptyRecord(1)]
          newRecords[0].rawText = result.rawText
        }

        newRecords.forEach(r => {
          r.source = pageName || 'Imagen'
          r.engine = result.engine || 'tesseract'
          r.note = result.geminiNote || ''
          if (handwritten) r.handwritten = true
          if (r.confidencias && Object.keys(r.confidencias).length > 0) r.handwritten = true
        })

        this.records.push(...newRecords)
        this.renumberRecords()
      }
    },

    handleUpdateRecord(index, updatedRecord) {
      this.records[index] = { ...updatedRecord }
      this.recalculate(index)
    },

    handleDeleteRecord(index) {
      this.records.splice(index, 1)
      this.renumberRecords()
      showToast('Registro eliminado')
    },

    async handleClearRecords() {
      const confirmed = await showConfirm('¿Limpiar todos los registros de la sesión actual?', {
        confirmText: 'Limpiar',
        danger: true
      })
      if (confirmed) {
        this.records = []
        this.rawTexts = []
        showToast('Registros de la sesión limpiados')
      }
    },

    handleAddRecord() {
      this.records.push(emptyRecord(this.records.length + 1))
    },

    recalculate(index) {
      const r = this.records[index]
      if (r.totalComprasIVA > 0 && (!r.baseNacional || r.baseNacional === 0)) {
        r.baseNacional = Math.round((r.totalComprasIVA / 1.16) * 100) / 100
      }
      if (r.baseNacional > 0 && (!r.creditoFiscalNac || r.creditoFiscalNac === 0)) {
        r.creditoFiscalNac = Math.round(r.baseNacional * 0.16 * 100) / 100
      }
    },

    renumberRecords() {
      this.records.forEach((r, i) => { r.nro = i + 1 })
    },

    handleExported(info) {
      this.currentTab = 'history'
      setTimeout(() => {
        if (this.$refs.historyRef) {
          this.$refs.historyRef.loadRecords()
        }
      }, 100)
    }
  }
}
</script>

<style scoped>
.records-badge {
  text-align: center;
  font-size: 0.72rem;
  background: rgba(26, 86, 219, 0.12);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: 12px;
  margin: 6px auto 8px;
  display: table;
}

.nav-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px;
  margin-bottom: 16px;
}

.nav-tab {
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  white-space: nowrap;
  position: relative;
}

.nav-tab.active {
  color: var(--primary);
  background: rgba(26, 86, 219, 0.1);
  font-weight: 600;
}

.nav-tab:hover { background: rgba(26, 86, 219, 0.06); }

.tab-icon { font-size: 1rem; margin-right: 4px; }

.tab-badge {
  background: var(--accent);
  color: white;
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 10px;
  margin-left: 4px;
  font-weight: 700;
}

.app-main {
  flex: 1;
}

.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.loading-spinner {
  width: 56px;
  height: 56px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-text {
  color: white;
  margin-top: 16px;
  font-size: 0.9rem;
  text-align: center;
  max-width: 300px;
}

.progress-bar {
  width: 260px;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  margin-top: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.loading-cancel {
  margin-top: 16px;
  padding: 10px 22px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.loading-cancel:hover {
  background: rgba(255, 255, 255, 0.25);
}

@media (max-width: 480px) {
  .nav-tab { font-size: 0.72rem; padding: 8px 6px; }
}
</style>