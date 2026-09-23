<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-top">
        <div class="header-content">
          <div class="brand-row">
            <img :src="brandLogo" class="brand-logo" alt="DualLedger" />
            <div class="brand-text">
              <h1 class="app-title">DualLedger</h1>
              <p class="app-subtitle">Libro de Compras - Extractor de Datos</p>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button
            class="tools-toggle"
            @click="openHerramientas"
            title="Herramientas: servicio SENIAT y base de datos"
          >
            &#9881;
          </button>
          <button
            class="sound-toggle"
            @click="toggleSound"
            :title="soundOn ? 'Silenciar avisos' : 'Activar avisos'"
          >
            <svg v-if="soundOn" class="sound-icon" :class="{ solid: theme === 'dark' }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
            <svg v-else class="sound-icon" :class="{ solid: theme === 'dark' }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
          </button>
          <button
            class="theme-toggle"
            @click="toggleTheme"
            :title="theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          >
            <svg v-if="theme === 'dark'" class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg v-else class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <button
            v-if="canInstall"
            class="install-btn"
            @click="installApp"
            title="Instalar app en escritorio"
          >
            &#128228; Instalar App
          </button>
        </div>
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

    <HerramientasModal
      ref="toolsRef"
      @open-data="openDataExplorer"
    />

    <div v-if="dataExplorerOpen" class="de-overlay">
      <div class="de-overlay-bar">
        <span class="de-overlay-title">&#128451; Base de datos — Explorador</span>
        <button class="de-overlay-close" @click="closeDataExplorer">&#10005; Cerrar</button>
      </div>
      <DataExplorer @open-tools="openHerramientas" />
    </div>

    <DialogHost />
    <ToastHost />

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
import ImageUploader from './components/ImageUploader.vue'
import DataPreview from './components/DataPreview.vue'
import ExcelExport from './components/ExcelExport.vue'
import History from './components/History.vue'
import ApiKeySetup from './components/ApiKeySetup.vue'
import HerramientasModal from './components/HerramientasModal.vue'
import DataExplorer from './components/DataExplorer.vue'
import DialogHost from './components/DialogHost.vue'
import ToastHost from './components/ToastHost.vue'
import MaestrosTab from './components/MaestrosTab.vue'
import brandLogo from './assets/logo/DualLedger.svg'
import { processImage, expandFile } from './utils/ocr.js'
import { hasApiKey } from './utils/apiKey.js'
import { showConfirm, showToast } from './utils/dialog.js'
import { isSoundEnabled, setSoundEnabled, unlockAudio, playCompletionSound, playErrorSound } from './utils/sound.js'

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
  name: 'App',
  components: { ImageUploader, DataPreview, ExcelExport, History, ApiKeySetup, HerramientasModal, DataExplorer, DialogHost, ToastHost, MaestrosTab },
  data() {
    return {
      brandLogo,
      currentTab: 'upload',
      dataExplorerOpen: false,
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
      processingAbortController: null,
      canInstall: false,
      deferredPrompt: null,
      hasApiKey: hasApiKey(),
      theme: 'light',
      soundOn: isSoundEnabled()
    }
  },
  mounted() {
    this.applyInitialTheme()
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
    },

    applyInitialTheme() {
      const stored = localStorage.getItem('dualledger-theme')
      let theme = 'light'
      if (stored === 'dark' || stored === 'light') {
        theme = stored
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'dark'
      }
      this.theme = theme
      document.documentElement.setAttribute('data-theme', theme)
    },

    setTheme(theme) {
      this.theme = theme
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('dualledger-theme', theme)
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },

    toggleSound() {
      this.soundOn = !this.soundOn
      setSoundEnabled(this.soundOn)
      if (this.soundOn) {
        unlockAudio()
        playCompletionSound()
      }
    },

    openHerramientas() {
      if (this.$refs.toolsRef) {
        this.$refs.toolsRef.show()
      }
    },

    openDataExplorer() {
      this.dataExplorerOpen = true
    },

    closeDataExplorer() {
      this.dataExplorerOpen = false
    }
  }
}
</script>

<style>
:root {
  --primary: #1a56db;
  --primary-light: #3b82f6;
  --primary-dark: #0f3d9e;
  --accent: #f59e0b;
  --surface: #ffffff;
  --background: #f3f5f9;
  --error: #dc2626;
  --success: #16a34a;
  --text: #111827;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
  --shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.12);
  --radius: 12px;
  --primary-rgb: 26, 86, 219;
  --accent-rgb: 245, 158, 11;
  --error-rgb: 220, 38, 38;
  --success-rgb: 22, 163, 74;
  --divider-weak: rgba(0, 0, 0, 0.04);
  --tesseract-bg: rgba(33, 33, 33, 0.08);
  --badge-strong: #ffffff;
  --badge-text: #4b5563;
}

[data-theme="dark"] {
  --primary: #3b82f6;
  --primary-light: #60a5fa;
  --primary-dark: #2563eb;
  --accent: #fbbf24;
  --surface: #1f2937;
  --background: #111827;
  --error: #f87171;
  --success: #4ade80;
  --text: #f3f4f6;
  --text-secondary: #a9b2bd;
  --border: #374151;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.45);
  --primary-rgb: 59, 130, 246;
  --accent-rgb: 251, 191, 36;
  --error-rgb: 248, 113, 113;
  --success-rgb: 74, 222, 128;
  --divider-weak: rgba(255, 255, 255, 0.06);
  --tesseract-bg: rgba(255, 255, 255, 0.08);
  --badge-strong: #1f2937;
  --badge-text: #ffffff;
}

[data-theme="dark"] .app-header {
  background: linear-gradient(135deg, #1e40af, #2563eb);
}

[data-theme="dark"] input,
[data-theme="dark"] select,
[data-theme="dark"] textarea {
  color-scheme: dark;
}

* { box-sizing: border-box; }

html, body {
  color: var(--text);
  background: var(--background);
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: var(--text);
  background: var(--background);
}

.app-header {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
  padding: 12px 16px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.18);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.header-content { text-align: center; flex: 1; }

.brand-row {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
  object-fit: cover;
}

.brand-text { text-align: left; }

.app-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  line-height: 1;
}

.icon { font-size: 1.2rem; }

.app-subtitle {
  font-size: 0.75rem;
  opacity: 0.85;
  margin-top: 3px;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.theme-toggle {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}

.tools-toggle {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}

.tools-toggle:hover {
  background: rgba(255, 255, 255, 0.24);
}

.sound-toggle {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: white;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}

.sound-toggle:hover {
  background: rgba(255, 255, 255, 0.28);
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.28);
}

.theme-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.sound-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.sound-icon.solid polygon {
  fill: currentColor;
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
  background: rgba(255, 255, 255, 0.12);
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
  .app-title { font-size: 1.2rem; }
  .brand-logo { width: 38px; height: 38px; font-size: 1.2rem; }
  .install-btn { font-size: 0.68rem; padding: 6px 8px; }
}

.de-overlay {
  position: fixed;
  inset: 0;
  z-index: 9500;
  background: var(--background);
  overflow-y: auto;
  padding: 14px 18px 28px;
}

.de-overlay-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.de-overlay-title {
  font-size: 0.9rem;
  font-weight: 700;
}

.de-overlay-close {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.de-overlay-close:hover {
  border-color: var(--error);
  color: var(--error);
}
</style>
