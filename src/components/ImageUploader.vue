<template>
  <div class="uploader">
    <div class="upload-card">
      <div
        class="drop-zone"
        :class="{ dragover: isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <input
          ref="fileInput"
          type="file"
          accept="image/*,application/pdf"
          multiple
          @change="handleFileSelect"
          style="display: none"
        />

        <div class="upload-placeholder">
          <div class="upload-icon">&#128247;</div>
          <p class="upload-title">Sube imágenes o PDF de documentos</p>
          <p class="upload-hint">Selecciona uno o varios archivos a la vez</p>
          <p class="upload-formats">JPG, PNG - Max 10MB | PDF - Max 25MB</p>
        </div>
      </div>

      <div class="queue-section" v-if="queue.length > 0">
        <div class="queue-header">
          <h3>&#128206; Cola de imágenes ({{ queue.length }})</h3>
          <button class="clear-btn" @click="clearQueue">Limpiar todo</button>
        </div>

        <div class="queue-list">
          <div v-for="(item, index) in queue" :key="index" class="queue-item">
            <div class="queue-thumb-wrap" @click.stop="openPreview(item)">
              <img v-if="item.previewUrl" :src="item.previewUrl" class="queue-thumb" :alt="item.file.name" />
              <div v-else class="queue-thumb pdf-thumb">PDF</div>
              <span v-if="item.isPdf && item.pages" class="thumb-badge">{{ item.pages }}</span>
            </div>
            <div class="queue-info">
              <p class="queue-name">{{ item.file.name }}</p>
              <div class="queue-meta">
                <span class="queue-status" :class="item.status">
                  {{ statusLabel(item.status) }}
                </span>
                <span
                  class="handwritten-toggle"
                  :class="{ active: item.handwritten }"
                  @click.stop="toggleHandwritten(item)"
                  :title="item.handwritten ? 'Marcada como manuscrita - click para quitar' : 'Marcar como factura manuscrita'"
                >
                  <span>&#9997; Manuscrita</span>
                </span>
              </div>
            </div>
            <button class="remove-queue-btn" @click.stop="removeFromQueue(index)">&#10005;</button>
          </div>
        </div>

        <div class="queue-actions">
          <button
            class="btn btn-primary"
            @click="processAll"
            :disabled="processing || !hasPending"
          >
            <span v-if="!processing">
              &#9889; Procesar {{ pendingCount }} imagen(es)
            </span>
            <span v-else>Procesando... ({{ processedCount }}/{{ queue.length }})</span>
          </button>
        </div>
      </div>
    </div>

    <div class="tips-card" v-if="queue.length === 0">
      <h3 class="tips-title">&#128161; Consejos para mejor OCR</h3>
      <ul class="tips-list">
        <li>Asegurate de que el texto sea visible y nítido</li>
        <li>La imagen debe estar bien iluminada</li>
        <li>Evita sombras sobre el texto</li>
        <li>El documento debe estar recto, sin dobleces</li>
        <li>Puedes subir varios archivos de una sola vez</li>
        <li>En PDF, cada página se procesa por separado</li>
        <li>Formatos aceptados: facturas, reportes Z, notas de crédito/débito</li>
      </ul>
    </div>

    <div class="tips-card recent-types" v-if="queue.length === 0">
      <h3 class="tips-title">&#128196; Tipos de documento soportados</h3>
      <div class="type-chips">
        <span class="chip">Facturas</span>
        <span class="chip">Reportes Z</span>
        <span class="chip">Notas de Crédito</span>
        <span class="chip">Notas de Débito</span>
        <span class="chip">Libro de Compras</span>
      </div>
    </div>

    <div v-if="previewItem" class="preview-modal" @click="closePreview">
      <div class="preview-modal-inner" @click.stop>
        <button class="preview-close" @click="closePreview" title="Cerrar">&#10005;</button>
        <iframe
          v-if="previewItem.isPdf"
          :src="previewItem.pdfUrl"
          class="preview-frame"
          title="Vista previa del PDF"
        ></iframe>
        <img v-else :src="previewItem.previewUrl" class="preview-media" :alt="previewItem.file.name" />
        <p class="preview-name">{{ previewItem.file.name }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { renderPdfThumbnail } from '../utils/ocr.js'
import { showAlert } from '../utils/dialog.js'

export default {
  name: 'ImageUploader',
  emits: ['process-start'],
  data() {
    return {
      queue: [],
      isDragOver: false,
      processing: false,
      processedCount: 0,
      previewItem: null
    }
  },
  computed: {
    pendingCount() {
      return this.queue.filter(i => i.status === 'pending').length
    },
    hasPending() {
      return this.pendingCount > 0
    }
  },
  methods: {
    triggerFileInput() {
      this.$refs.fileInput.click()
    },

    handleFileSelect(e) {
      const files = Array.from(e.target.files)
      files.forEach(f => this.addToQueue(f))
      this.$refs.fileInput.value = ''
    },

    handleDrop(e) {
      this.isDragOver = false
      const files = Array.from(e.dataTransfer.files).filter(f =>
        (f.type || '').startsWith('image/') || f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')
      )
      files.forEach(f => this.addToQueue(f))
    },

    addToQueue(file) {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
      if (!isPdf && !(file.type || '').startsWith('image/')) {
        showAlert(`${file.name} no es una imagen ni un PDF.`, { type: 'warning' })
        return
      }
      const maxSize = isPdf ? 25 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > maxSize) {
        showAlert(`${file.name} es demasiado grande. Máximo ${isPdf ? '25MB' : '10MB'}.`, { type: 'warning' })
        return
      }
      const item = {
        file,
        previewUrl: isPdf ? '' : URL.createObjectURL(file),
        isPdf,
        pdfUrl: isPdf ? URL.createObjectURL(file) : '',
        pages: null,
        thumbLoading: isPdf,
        status: 'pending',
        handwritten: false
      }
      this.queue.push(item)
      if (isPdf) this.loadPdfThumb(item)
    },

    async loadPdfThumb(item) {
      try {
        const { url, numPages } = await renderPdfThumbnail(item.file)
        if (!this.queue.includes(item)) {
          URL.revokeObjectURL(url)
          return
        }
        item.previewUrl = url
        item.pages = numPages
      } catch (e) {
        console.warn('[PDF] No se pudo generar la miniatura:', e)
      } finally {
        item.thumbLoading = false
      }
    },

    openPreview(item) {
      this.previewItem = item
    },

    closePreview() {
      this.previewItem = null
    },

    revokeItem(item) {
      if (!item) return
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      if (item.pdfUrl) URL.revokeObjectURL(item.pdfUrl)
    },

    toggleHandwritten(item) {
      item.handwritten = !item.handwritten
    },

    removeFromQueue(index) {
      const item = this.queue[index]
      if (this.previewItem === item) this.previewItem = null
      this.revokeItem(item)
      this.queue.splice(index, 1)
    },

    clearQueue() {
      this.previewItem = null
      this.queue.forEach(i => this.revokeItem(i))
      this.queue = []
    },

    statusLabel(status) {
      const labels = {
        pending: 'Pendiente',
        processing: 'Procesando...',
        done: 'Completado',
        error: 'Error'
      }
      return labels[status] || status
    },

    async processAll() {
      this.processing = true
      this.processedCount = 0
      this.$emit('process-start', this.queue.filter(i => i.status === 'pending'))
    },

    updateItemStatus(index, status) {
      const item = this.queue[index]
      if (item) {
        item.status = status
        if (status === 'done' || status === 'error') this.processedCount++
      }
    },

    resetProcessing() {
      this.processing = false
      this.processedCount = 0
    }
  },

  beforeUnmount() {
    this.queue.forEach(i => this.revokeItem(i))
  }
}
</script>

<style scoped>
.uploader { max-width: 600px; margin: 0 auto; }

.upload-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.drop-zone {
  border: 3px dashed var(--border);
  margin: 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone.dragover {
  border-color: var(--primary);
  background: rgba(var(--primary-rgb), 0.04);
}

.upload-placeholder { text-align: center; padding: 24px; }
.upload-icon { font-size: 3rem; margin-bottom: 8px; }
.upload-title { font-size: 1.05rem; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.upload-hint { font-size: 0.82rem; color: var(--text-secondary); }
.upload-formats { font-size: 0.72rem; color: var(--text-secondary); margin-top: 6px; opacity: 0.7; }

.queue-section { padding: 0 16px 16px; }

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.queue-header h3 { font-size: 0.9rem; color: var(--text); }

.clear-btn {
  background: none;
  border: none;
  color: var(--error);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: var(--background);
  border-radius: 8px;
}

.queue-thumb-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  cursor: pointer;
}

.queue-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}

.pdf-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.thumb-badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  font-size: 0.62rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--surface);
  box-sizing: content-box;
}

.preview-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.preview-modal-inner {
  position: relative;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 12px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-close {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error);
  font-size: 0.9rem;
  cursor: pointer;
  z-index: 1;
}

.preview-frame,
.preview-media {
  max-width: 86vw;
  max-height: 78vh;
  width: 86vw;
  height: 78vh;
  border: none;
  border-radius: 6px;
  object-fit: contain;
}

.preview-media {
  width: auto;
  height: auto;
}

.preview-name {
  font-size: 0.82rem;
  color: var(--text-secondary);
  text-align: center;
  word-break: break-word;
}

.queue-info { flex: 1; min-width: 0; }

.queue-name {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-status {
  font-size: 0.7rem;
  font-weight: 600;
}

.queue-status.pending { color: var(--text-secondary); }
.queue-status.processing { color: var(--accent); }
.queue-status.done { color: var(--success); }
.queue-status.error { color: var(--error); }

.queue-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}

.handwritten-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 3px 10px;
  border-radius: 10px;
  user-select: none;
  transition: all 0.2s;
}

.handwritten-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.handwritten-toggle.active {
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(var(--accent-rgb), 0.2);
}

.remove-queue-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error);
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.queue-actions { margin-top: 12px; }

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

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
}

.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

.tips-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  margin-top: 12px;
}

.tips-title { font-size: 0.95rem; font-weight: 600; color: var(--text); margin-bottom: 10px; }

.tips-list { list-style: none; padding: 0; }

.tips-list li {
  padding: 6px 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}

.tips-list li:last-child { border-bottom: none; }

.type-chips { display: flex; flex-wrap: wrap; gap: 6px; }

.chip {
  background: rgba(var(--primary-rgb), 0.08);
  color: var(--primary);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 500;
}

@media (max-width: 600px) {
  .drop-zone {
    margin: 10px;
    min-height: 140px;
  }

  .upload-placeholder { padding: 18px; }
  .upload-icon { font-size: 2.4rem; }
  .queue-section { padding: 0 10px 12px; }
  .tips-card { padding: 14px; }
  .preview-modal { padding: 10px; }
  .preview-modal-inner { padding: 8px; }
}
</style>
