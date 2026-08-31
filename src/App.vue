<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-top">
        <div class="header-content">
          <h1 class="app-title">
            <span class="icon">&#128247;</span>
            Image Info
          </h1>
          <p class="app-subtitle">Libro de Compras - Extractor de Datos</p>
        </div>
        <button
          v-if="canInstall"
          class="install-btn"
          @click="installApp"
          title="Instalar app en escritorio"
        >
          &#128228; Instalar App
        </button>
      </div>
      <div class="records-badge" v-if="records.length > 0">
        {{ records.length }} registro(s) acumulados
      </div>
      <ApiKeySetup @key-saved="handleKeySaved" />
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
    </header>

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
    </main>

    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ loadingMessage }}</p>
      <div class="progress-bar" v-if="progress > 0">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
    </div>
  </div>
</template>

<script>
import ImageUploader from './components/ImageUploader.vue'
import DataPreview from './components/DataPreview.vue'
import ExcelExport from './components/ExcelExport.vue'
import History from './components/History.vue'
import ApiKeySetup from './components/ApiKeySetup.vue'
import { processImage } from './utils/ocr.js'
import { hasApiKey } from './utils/apiKey.js'

function emptyRecord(nro) {
  return {
    nro,
    fecha: '',
    rif: '',
    nombreRazon: '',
    nroFactura: '',
    nroControl: '',
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
  name: 'App',
  components: { ImageUploader, DataPreview, ExcelExport, History, ApiKeySetup },
  data() {
    return {
      currentTab: 'upload',
      tabs: [
        { id: 'upload', label: 'Subir', icon: '&#128228;' },
        { id: 'preview', label: 'Datos', icon: '&#128203;' },
        { id: 'export', label: 'Exportar', icon: '&#128229;' },
        { id: 'history', label: 'Historial', icon: '&#128218;' }
      ],
      records: [],
      rawTexts: [],
      loading: false,
      loadingMessage: '',
      progress: 0,
      canInstall: false,
      deferredPrompt: null,
      hasApiKey: hasApiKey()
    }
  },
  mounted() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.deferredPrompt = e
      this.canInstall = true
    })
    window.addEventListener('appinstalled', () => {
      this.canInstall = false
      this.deferredPrompt = null
    })
  },
  methods: {
    async handleProcessStart(pendingItems) {
      this.loading = true
      this.progress = 0

      for (let i = 0; i < pendingItems.length; i++) {
        const item = pendingItems[i]
        this.loadingMessage = `Procesando "${item.file.name}" (${i + 1}/${pendingItems.length})...`

        if (this.$refs.uploaderRef) {
          const queueIndex = this.$refs.uploaderRef.queue.indexOf(item)
          this.$refs.uploaderRef.updateItemStatus(queueIndex, 'processing')
        }

        try {
          await this.handleImageLoaded(item.file, item.file.name)
          if (this.$refs.uploaderRef) {
            const queueIndex = this.$refs.uploaderRef.queue.indexOf(item)
            this.$refs.uploaderRef.updateItemStatus(queueIndex, 'done')
          }
        } catch {
          if (this.$refs.uploaderRef) {
            const queueIndex = this.$refs.uploaderRef.queue.indexOf(item)
            this.$refs.uploaderRef.updateItemStatus(queueIndex, 'error')
          }
        }
      }

      this.loading = false
      this.progress = 0

      if (this.$refs.uploaderRef) {
        this.$refs.uploaderRef.resetProcessing()
      }

      this.currentTab = 'preview'
    },

    async handleImageLoaded(file, fileName) {
      this.progress = 0

      const result = await processImage(file, (p) => {
        this.loadingMessage = p.status === 'recognizing text'
          ? `Reconociendo texto en "${fileName}"... ${Math.round(p.progress * 100)}%`
          : p.status === 'loading language traineddata'
          ? 'Cargando modelo de idioma...'
          : p.status === 'enviando a Gemini'
          ? 'Enviando a Gemini AI...'
          : p.status === 'convirtiendo imagen'
          ? 'Preparando imagen...'
          : p.status === 'procesando respuesta'
          ? 'Analizando documento con Gemini...'
          : p.status === 'parseando datos'
          ? 'Estructurando datos...'
          : `Procesando "${fileName}"...`
        this.progress = Math.round((p.progress || 0) * 100)
      })

      this.rawTexts.push({
        fileName: fileName || 'Imagen',
        text: result.rawText,
        engine: result.engine || 'tesseract',
        note: result.geminiNote || ''
      })

      let newRecords = result.parsedData

      if (newRecords.length === 0 && result.lines.length > 0) {
        newRecords = [emptyRecord(1)]
        newRecords[0].rawText = result.rawText
      }

      newRecords.forEach(r => {
        r.source = fileName || 'Imagen'
        r.engine = result.engine || 'tesseract'
        r.note = result.geminiNote || ''
      })

      this.records.push(...newRecords)
      this.renumberRecords()
    },

    handleUpdateRecord(index, updatedRecord) {
      this.records[index] = { ...updatedRecord }
      this.recalculate(index)
    },

    handleDeleteRecord(index) {
      this.records.splice(index, 1)
      this.renumberRecords()
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
    },

    async installApp() {
      if (!this.deferredPrompt) return
      this.deferredPrompt.prompt()
      const { outcome } = await this.deferredPrompt.userChoice
      if (outcome === 'accepted') {
        this.canInstall = false
      }
      this.deferredPrompt = null
    },

    handleKeySaved() {
      this.hasApiKey = true
      this.loadingMessage = ''
    }
  }
}
</script>

<style>
:root {
  --primary: #1a237e;
  --primary-light: #534bae;
  --primary-dark: #000051;
  --accent: #ff6d00;
  --surface: #ffffff;
  --background: #f5f5f5;
  --error: #b00020;
  --success: #2e7d32;
  --text: #212121;
  --text-secondary: #757575;
  --border: #e0e0e0;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  --radius: 12px;
}

* { box-sizing: border-box; }

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
  padding: 12px 16px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.header-content { text-align: center; flex: 1; }

.app-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.icon { font-size: 1.2rem; }

.app-subtitle {
  font-size: 0.75rem;
  opacity: 0.85;
  margin-top: 2px;
}

.install-btn {
  background: var(--accent);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  animation: pulse 2s infinite;
  flex-shrink: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.records-badge {
  text-align: center;
  font-size: 0.72rem;
  background: rgba(255, 255, 255, 0.15);
  padding: 4px 12px;
  border-radius: 12px;
  margin: 6px auto 8px;
}

.nav-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 0;
}

.nav-tab {
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
  white-space: nowrap;
  position: relative;
}

.nav-tab.active {
  color: white;
  border-bottom-color: var(--accent);
  background: rgba(255, 255, 255, 0.1);
}

.nav-tab:hover { background: rgba(255, 255, 255, 0.08); }

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
  padding: 16px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
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

@media (max-width: 480px) {
  .nav-tab { font-size: 0.72rem; padding: 8px 6px; }
  .app-title { font-size: 1.25rem; }
  .install-btn { font-size: 0.68rem; padding: 6px 8px; }
}
</style>
