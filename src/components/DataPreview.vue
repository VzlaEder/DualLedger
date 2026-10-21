<template>
  <div class="preview">
    <div class="section-header">
      <h2>&#128203; Datos Extraídos</h2>
      <div class="header-actions">
        <span class="record-count">{{ records.length }} registro(s)</span>
        <span v-if="pendientesSync > 0" class="sync-tag pendiente" title="Documentos sin sincronizar">
          &#9203; {{ pendientesSync }}
        </span>
        <button
          v-if="records.length > 0"
          class="btn-save"
          @click="guardarTodos"
          :disabled="guardando"
          title="Guardar los registros en la base de datos"
        >
          {{ guardando ? '&#9203; Guardando...' : '&#128190; Guardar en BD' }}
        </button>
        <button v-if="records.length > 0" class="btn-clear" @click="$emit('clear-records')">
          &#128465; Limpiar
        </button>
      </div>
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
            <span v-if="record.engine" class="engine-tag" :class="record.engine">
              {{ record.engine === 'gemini' ? '&#9889; AI' : '&#128269; Tesseract' }}
            </span>
            <span v-if="record.tipoDocumento && record.tipoDocumento !== 'otro'" class="doc-type-tag">
              {{ docTypeLabel(record.tipoDocumento) }}
            </span>
          </div>
          <div class="record-actions">
            <span
              v-if="estadoSync(record)"
              class="sync-tag"
              :class="estadoSync(record)"
              :title="estadoSync(record) === 'guardado' ? 'Guardado en la base de datos' : 'Pendiente de sincronizar'"
            >
              {{ estadoSync(record) === 'guardado' ? '&#10003; BD' : '&#9203;' }}
            </span>
            <button
              class="icon-btn save"
              @click.stop="guardarRegistro(index)"
              title="Guardar en la base de datos"
            >
              &#128190;
            </button>
            <button
              v-if="seniatBusy[index]"
              class="seniat-cancel"
              @click.stop="cancelarSENIAT(index)"
              title="Cancelar la verificación en curso"
            >
              &#10005; Cancelar
            </button>
            <button
              v-else-if="normalizeRif(record.rif) && hasPorcentaje(record)"
              class="seniat-btn revalidated"
              disabled
              title="RIF verificado en el SENIAT"
            >
              &#10003; Verificado
            </button>
            <button
              v-else-if="normalizeRif(record.rif)"
              class="seniat-btn"
              @click.stop="verificarSENIAT(index)"
              title="Consultar nombre real y % contribución en el SENIAT"
            >
              &#127963; Verificar SENIAT
            </button>
            <button class="icon-btn edit" @click="toggleEdit(index)" :title="editingIndex === index ? 'Guardar' : 'Editar'">
              {{ editingIndex === index ? '&#10003;' : '&#9998;' }}
            </button>
            <button class="icon-btn delete" @click="handleDelete(index)" title="Eliminar">&#128465;</button>
          </div>
        </div>
        <div v-if="seniatBusy[index]" class="seniat-loading">
          &#128190; Verificando en el SENIAT...
        </div>
        <div v-if="seniatError[index]" class="seniat-error">
          &#9888; {{ seniatError[index] }}
        </div>
        <div v-if="record.note" class="engine-warning">
          &#9888; {{ record.note }}
        </div>
        <div v-if="record.handwritten" class="handwritten-banner">
          &#9997; Factura manuscrita: revisa los campos marcados en naranja
        </div>

        <div class="record-body" v-if="editingIndex !== index">
          <div class="field-row" :class="{ doubtful: isDoubtful(record, 'fecha') }">
            <span class="field-label">Fecha:</span>
            <span class="field-value">{{ record.fecha || '-' }}</span>
          </div>
          <div class="field-row" :class="{ doubtful: isDoubtful(record, 'rif') }">
            <span class="field-label">RIF:</span>
            <span class="field-value">{{ record.rif || '-' }}</span>
          </div>
          <div class="field-row" :class="{ doubtful: isDoubtful(record, 'nombreRazon') }">
            <span class="field-label">Nombre/Razón Social:</span>
            <span class="field-value">{{ record.nombreRazon || '-' }}</span>
          </div>
          <div class="field-row" :class="{ doubtful: isDoubtful(record, 'porcentajeContribucion') }">
            <span class="field-label">% Contribución:</span>
            <span class="field-value">{{ hasPorcentaje(record) ? record.porcentajeContribucion + '%' : '-' }}</span>
          </div>
          <div class="field-row" v-if="record.condicion">
            <span class="field-label">Condición:</span>
            <span class="field-value">{{ record.condicion }}</span>
          </div>
          <div class="field-row" v-if="datosProveedor(record)">
            <span class="field-label">Proveedor (maestro):</span>
            <span class="field-value">
              {{ datosProveedor(record).nombre }}
              <span class="field-note" v-if="record.diasCredito">· {{ record.diasCredito }} días de crédito</span>
              <span class="field-note" v-if="record.codigoCuenta">· Cta. {{ record.codigoCuenta }}</span>
              <span class="field-note" v-if="record.conceptoIslr">· ISLR {{ record.conceptoIslr }}</span>
            </span>
          </div>
          <div class="field-row" v-if="puedeAutoCompletar(record)">
            <span class="field-label">Datos del maestro:</span>
            <span class="field-value">
              <button class="mini-btn" @click="aplicarDatosProveedor(index)">
                &#9889; Completar con {{ datosProveedor(record).nombre }}
              </button>
            </span>
          </div>
          <div
            class="field-row"
            v-if="record.tipoDocumento !== 'nota_credito' && record.tipoDocumento !== 'nota_debito'"
            :class="{ doubtful: isDoubtful(record, 'nroFactura') }"
          >
            <span class="field-label">Nro. Factura:</span>
            <span class="field-value">{{ record.nroFactura || '-' }}</span>
          </div>
          <div class="field-row" :class="{ doubtful: isDoubtful(record, 'nroControl') }">
            <span class="field-label">Nro. Control:</span>
            <span class="field-value">{{ record.nroControl || '-' }}</span>
          </div>
          <div class="field-row" v-if="record.numeroMaquinaFiscal">
            <span class="field-label">Nro. Máquina Fiscal:</span>
            <span class="field-value">{{ record.numeroMaquinaFiscal }}</span>
          </div>
          <div class="field-row" v-if="record.nroNotaCredito">
            <span class="field-label">Nro. Nota de Crédito:</span>
            <span class="field-value">{{ record.nroNotaCredito }}</span>
          </div>
          <div class="field-row" v-if="record.nroNotaDebito">
            <span class="field-label">Nro. Nota de Débito:</span>
            <span class="field-value">{{ record.nroNotaDebito }}</span>
          </div>
          <div class="field-row" v-if="record.nroFacturaAfectada">
            <span class="field-label">Nro. Factura Afectada:</span>
            <span class="field-value">{{ record.nroFacturaAfectada }}</span>
          </div>
          <div class="field-row highlight" :class="{ doubtful: isDoubtful(record, 'totalComprasIVA') }">
            <span class="field-label">Total Compras (IVA incl.):</span>
            <span class="field-value amount">{{ formatAmount(record.totalComprasIVA) }}</span>
          </div>
          <div class="field-row" :class="{ doubtful: isDoubtful(record, 'baseNacional') }">
            <span class="field-label">Base Imponible:</span>
            <span class="field-value">{{ formatAmount(record.baseNacional) }}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Crédito Fiscal:</span>
            <span class="field-value">{{ formatAmount(record.creditoFiscalNac) }}</span>
          </div>
          <div class="field-row ret-iva" v-if="retIvaSugerido(record) !== null">
            <span class="field-label">Ret IVA sugerida ({{ record.porcentajeContribucion }}%):</span>
            <span class="field-value">
              {{ formatAmount(retIvaSugerido(record)) }}
              <button
                v-if="!Number(record.retIVA)"
                class="mini-btn"
                @click="aplicarRetIva(index)"
                title="Usar el importe calculado como retención de IVA"
              >
                Aplicar
              </button>
              <span v-else class="field-note">registrada: {{ formatAmount(record.retIVA) }}</span>
            </span>
          </div>
        </div>

        <div class="record-edit" v-else>
          <div class="edit-grid">
            <div class="edit-field full">
              <label>Proveedor (maestro)</label>
              <select v-model="editForm.proveedorRif" @change="onProveedorChange">
                <option value="">— Sin asignar —</option>
                <option v-for="p in proveedores" :key="p.rif" :value="p.rif">
                  {{ p.nombre }} ({{ p.rif }})
                </option>
              </select>
              <small v-if="editForm.diasCredito || editForm.codigoCuenta" class="edit-hint">
                <span v-if="editForm.diasCredito">{{ editForm.diasCredito }} días de crédito</span>
                <span v-if="editForm.codigoCuenta">· Cuenta {{ editForm.codigoCuenta }}</span>
                <span v-if="editForm.conceptoIslr">· ISLR {{ editForm.conceptoIslr }}</span>
              </small>
            </div>
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
              <label>% Contribución</label>
              <input v-model="editForm.porcentajeContribucion" type="number" step="1" min="0" max="100" />
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
              <label>Comprobante Ret IVA</label>
              <input v-model="editForm.comprobanteIVA" type="text" placeholder="AAAAMM########" />
            </div>
            <div class="edit-field">
              <label>Fecha Comprobante</label>
              <input v-model="editForm.fechaIVA" type="text" placeholder="DD/MM/AAAA" />
            </div>
            <div class="edit-field">
              <label>Cuenta Contable</label>
              <input v-model="editForm.codigoCuenta" type="text" placeholder="5.1.1.01.001" />
            </div>
            <div class="edit-field">
              <label>Días de Crédito</label>
              <input v-model.number="editForm.diasCredito" type="number" step="1" min="0" />
            </div>
            <div class="edit-field">
              <label>Concepto ISLR</label>
              <input v-model="editForm.conceptoIslr" type="text" placeholder="01" />
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

    <CaptchaModal
      v-if="captchaModalVisible"
      :image-base64="captchaImage"
      @submit="onCaptchaSubmit"
      @cancel="onCaptchaCancel"
    />
  </div>
</template>

<script>
import { verificarRifEnSeniat, lookupSharedCache } from '../utils/seniat.js'
import CaptchaModal from './CaptchaModal.vue'
import { showConfirm, showToast } from '../utils/dialog.js'
import { playErrorSound } from '../utils/sound.js'
import {
  cargarProveedores,
  buscarProveedorEnLista,
  autoCompletarProveedor,
  calcularRetIva,
  guardarDocumentos
} from '../services/compras.js'
import { getDocumentosLocales } from '../stores/comprasDb.js'

export default {
  name: 'DataPreview',
  components: { CaptchaModal },
  props: {
    records: { type: Array, default: () => [] },
    rawTexts: { type: Array, default: () => [] }
  },
  emits: ['update-record', 'delete-record', 'add-record', 'go-upload', 'clear-records', 'saved'],
  data() {
    return {
      editingIndex: -1,
      editForm: {},
      showRawText: false,
      seniatBusy: {},
      seniatError: {},
      seniatControllers: {},
      captchaModalVisible: false,
      captchaImage: '',
      captchaPromiseResolve: null,
      captchaPromiseReject: null,
      autoLookupPending: new Set(),
      proveedores: [],
      guardando: false,
      syncEstado: {}
    }
  },
  async mounted() {
    await this.cargarMaestroProveedores()
    await this.refrescarEstadoSync()
    this.autoLookupAll()
  },
  watch: {
    records: {
      handler() { this.autoLookupAll() },
      deep: true
    },
    'editForm.rif'(value, oldValue) {
      if (this.editingIndex < 0) return
      if (this.normalizeRif(value) === this.normalizeRif(oldValue)) return
      this.seniatError = { ...this.seniatError, [this.editingIndex]: '' }
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
    },
    pendientesSync() {
      return Object.values(this.syncEstado).filter(s => s !== 'guardado').length
    }
  },
  methods: {
    normalizeRif(rif) {
      return String(rif || '').replace(/[\s-]/g, '').toUpperCase()
    },

    // === Maestro de proveedores (auto-completado) ===

    async cargarMaestroProveedores() {
      try {
        this.proveedores = await cargarProveedores({ force: true })
      } catch (e) {
        this.proveedores = []
      }
    },

    datosProveedor(record) {
      if (!record) return null
      const rif = this.normalizeRif(record.proveedorRif || record.rif)
      if (!rif) return null
      return buscarProveedorEnLista(this.proveedores, rif)
    },

    puedeAutoCompletar(record) {
      const prov = this.datosProveedor(record)
      if (!prov) return false
      const vacio = (v) => v === undefined || v === null || v === '' || (typeof v === 'number' && v === 0)
      if (!record.proveedorRif) return true
      return vacio(record.nombreRazon) || vacio(record.condicion) ||
        vacio(record.diasCredito) || vacio(record.codigoCuenta) ||
        vacio(record.porcentajeContribucion)
    },

    aplicarDatosProveedor(index) {
      const record = this.records[index]
      const prov = this.datosProveedor(record)
      if (!record || !prov) return
      const cambios = autoCompletarProveedor(record, prov)
      if (!Object.keys(cambios).length) {
        showToast('El registro ya tiene los datos del maestro')
        return
      }
      this.$emit('update-record', index, { ...record, ...cambios })
      showToast('Datos del proveedor aplicados')
    },

    onProveedorChange() {
      const rif = this.editForm.proveedorRif
      const prov = buscarProveedorEnLista(this.proveedores, rif)
      if (!prov) return
      const cambios = autoCompletarProveedor(this.editForm, prov, { forzar: true })
      this.editForm = { ...this.editForm, ...cambios }
    },

    // === Retención de IVA ===

    retIvaSugerido(record) {
      if (!record) return null
      if (!record.porcentajeContribucion) return null
      return calcularRetIva(record)
    },

    aplicarRetIva(index) {
      const record = this.records[index]
      if (!record) return
      const valor = calcularRetIva(record)
      if (valor === null) return
      this.$emit('update-record', index, { ...record, retIVA: valor })
      showToast('Retención de IVA aplicada')
    },

    // === Persistencia en base de datos ===

    async refrescarEstadoSync() {
      try {
        const locales = await getDocumentosLocales()
        const estado = {}
        for (const d of locales) {
          estado[d.uid] = d.sincronizado === 1 ? 'guardado' : 'pendiente'
        }
        this.syncEstado = estado
      } catch (e) {
        this.syncEstado = {}
      }
    },

    estadoSync(record) {
      if (!record || !record.uid) return ''
      return this.syncEstado[record.uid] || ''
    },

    async guardarRegistro(index) {
      const record = this.records[index]
      if (!record) return
      this.guardando = true
      try {
        const res = await guardarDocumentos([record])
        if (res.offline) {
          this.syncEstado = { ...this.syncEstado, [record.uid]: 'pendiente' }
          showToast('Sin conexión con la API: se guardó localmente y se sincronizará luego', { type: 'warning' })
        } else if (res.errores && res.errores.length) {
          this.syncEstado = { ...this.syncEstado, [record.uid]: 'error' }
          showToast('No se pudo guardar el registro', { type: 'error' })
        } else {
          this.syncEstado = { ...this.syncEstado, [record.uid]: 'guardado' }
          showToast('Registro guardado en la base de datos')
          this.$emit('saved')
        }
      } catch (e) {
        this.syncEstado = { ...this.syncEstado, [record.uid]: 'error' }
        showToast('Error al guardar: ' + (e.message || e), { type: 'error' })
      } finally {
        this.guardando = false
      }
    },

    async guardarTodos() {
      if (!this.records.length) return
      this.guardando = true
      try {
        const res = await guardarDocumentos(this.records)
        const estado = { ...this.syncEstado }
        if (res.offline) {
          for (const r of this.records) estado[r.uid] = 'pendiente'
          showToast(`API no disponible: ${this.records.length} registro(s) en cola local`, { type: 'warning' })
        } else {
          for (const r of this.records) estado[r.uid] = 'guardado'
          const err = res.errores ? res.errores.length : 0
          if (err) {
            showToast(`${res.guardados} guardados, ${err} con error`, { type: 'warning' })
          } else {
            showToast(`${res.guardados} registro(s) guardados en la base de datos`)
          }
          this.$emit('saved')
        }
        this.syncEstado = estado
      } catch (e) {
        showToast('Error al guardar: ' + (e.message || e), { type: 'error' })
      } finally {
        this.guardando = false
      }
    },

    autoLookupAll() {
      this.records.forEach((record, index) => {
        const rif = this.normalizeRif(record.rif)
        const busy = !!this.seniatBusy[index]
        if (rif && !busy && !this.autoLookupPending.has(rif)) {
          this.autoLookupSeniat(index)
        }
      })
    },

    async autoLookupSeniat(index) {
      const record = this.records[index]
      if (!record) return
      const rif = this.normalizeRif(record.rif)
      if (!rif || this.autoLookupPending.has(rif)) return
      if (this.hasPorcentaje(record)) return

      this.autoLookupPending.add(rif)
      try {
        const cached = await lookupSharedCache(rif)
        if (!cached || !cached.ok || !cached.hit) return
        const current = this.records[index]
        if (!current || this.normalizeRif(current.rif) !== rif) return
        const nombreRazon = cached.nombreRazon || current.nombreRazon
        const porcentajeContribucion = cached.porcentajeContribucion
        const condicion = cached.condicion || current.condicion
        if (
          nombreRazon === current.nombreRazon &&
          porcentajeContribucion === current.porcentajeContribucion &&
          condicion === current.condicion
        ) return
        this.seniatError = { ...this.seniatError, [index]: '' }
        this.$emit('update-record', index, {
          ...current,
          nombreRazon,
          porcentajeContribucion,
          condicion
        })
      } catch (e) {
        // Silencioso
      } finally {
        this.autoLookupPending.delete(rif)
      }
    },

    hasSeniatData(record) {
      return !!(record.nombreRazon || this.hasPorcentaje(record))
    },

    hasPorcentaje(record) {
      return record.porcentajeContribucion !== undefined &&
        record.porcentajeContribucion !== null &&
        record.porcentajeContribucion !== ''
    },

    async verificarSENIAT(index) {
      const record = this.records[index]
      const rif = this.normalizeRif(record.rif)
      if (!rif) return

      const ERROR_NAME = /no\s+coincide|el\s+c[dó]digo|la\s+imagen|rechazad|no\s+es\s+correcto/i
      if (record.nombreRazon && ERROR_NAME.test(record.nombreRazon)) {
        const cleaned = { ...record, nombreRazon: '' }
        this.$emit('update-record', index, cleaned)
      }

      const controller = new AbortController()
      this.seniatControllers = { ...this.seniatControllers, [index]: controller }
      this.seniatBusy = { ...this.seniatBusy, [index]: true }
      this.seniatError = { ...this.seniatError, [index]: '' }
      try {
        const res = await verificarRifEnSeniat(rif, {
          forceRefresh: true,
          signal: controller.signal,
          onCaptchaNeeded: (captcha) => this.requestManualCaptcha(controller.signal, captcha)
        })
        const current = this.records[index]
        if (!current || this.normalizeRif(current.rif) !== rif) return
        this.$emit('update-record', index, {
          ...current,
          nombreRazon: res.nombreRazon || current.nombreRazon,
          porcentajeContribucion: res.porcentajeContribucion,
          condicion: res.condicion || current.condicion
        })
        const nombre = (res.nombreRazon || current.nombreRazon || '').trim()
        const suffix = nombre
          ? ': ' + (nombre.length > 40 ? nombre.slice(0, 40) + '\u2026' : nombre)
          : ''
        showToast('RIF verificado' + suffix)
      } catch (e) {
        const cancelled = e && (e.name === 'AbortError' ||
          (e.message && e.message.startsWith('Verificación cancelada')))
        if (cancelled) {
          this.seniatError = { ...this.seniatError, [index]: '' }
          playErrorSound()
          showToast('Verificación cancelada', { type: 'warning' })
        } else {
          this.seniatError = {
            ...this.seniatError,
            [index]: (e && e.message) || 'No se pudo verificar el RIF'
          }
        }
      } finally {
        this.seniatBusy = { ...this.seniatBusy, [index]: false }
        const c = this.seniatControllers[index]
        if (c && !c.signal.aborted) c.abort()
        this.seniatControllers = { ...this.seniatControllers, [index]: null }
        this.closeCaptchaModal()
      }
    },

    requestManualCaptcha(signal, captcha) {
      return new Promise((resolve, reject) => {
        this.captchaImage = captcha.imageBase64
        this.captchaModalVisible = true
        this.captchaPromiseResolve = resolve
        this.captchaPromiseReject = reject
        if (signal) {
          const onAbort = () => {
            this.closeCaptchaModal()
            const err = new Error('Verificación cancelada')
            err.name = 'AbortError'
            reject(err)
          }
          signal.addEventListener('abort', onAbort, { once: true })
        }
      })
    },

    onCaptchaSubmit(codigo) {
      const resolve = this.captchaPromiseResolve
      this.closeCaptchaModal()
      if (resolve) resolve(codigo)
    },

    onCaptchaCancel() {
      const reject = this.captchaPromiseReject
      this.closeCaptchaModal()
      if (reject) {
        const err = new Error('Verificación cancelada por el usuario')
        err.name = 'AbortError'
        reject(err)
      }
    },

    closeCaptchaModal() {
      this.captchaModalVisible = false
      this.captchaImage = ''
      this.captchaPromiseResolve = null
      this.captchaPromiseReject = null
    },

    cancelarSENIAT(index) {
      const c = this.seniatControllers[index]
      if (c) c.abort()
    },

    toggleEdit(index) {
      if (this.editingIndex === index) {
        const original = this.records[index] || {}
        const updated = { ...this.editForm }
        if (this.normalizeRif(updated.rif) !== this.normalizeRif(original.rif)) {
          updated.nombreRazon = ''
          updated.porcentajeContribucion = null
          updated.condicion = ''
          this.seniatError = { ...this.seniatError, [index]: '' }
        }
        const changed = Object.keys(updated).some((k) => updated[k] !== original[k])
        this.$emit('update-record', index, updated)
        if (changed) showToast('Registro actualizado')
        this.editingIndex = -1
      } else {
        this.editForm = { ...this.records[index] }
        this.editingIndex = index
      }
    },

    async handleDelete(index) {
      const confirmed = await showConfirm('¿Eliminar este registro?', {
        confirmText: 'Eliminar',
        danger: true
      })
      if (confirmed) {
        this.$emit('delete-record', index)
        if (this.editingIndex === index) this.editingIndex = -1
      }
    },

    formatAmount(val) {
      if (!val || val === 0) return '-'
      return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(val))
    },

    docTypeLabel(type) {
      const labels = {
        factura: 'Factura',
        nota_credito: 'Nota Crédito',
        nota_debito: 'Nota Débito',
        reporte_z: 'Reporte Z'
      }
      return labels[type] || type
    },

    isDoubtful(record, campo) {
      if (!record.handwritten) return false
      const c = record.confidencias && record.confidencias[campo]
      return c === 'media' || c === 'baja'
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.record-count {
  background: var(--primary);
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.btn-clear {
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error);
  border: 1px solid rgba(var(--error-rgb), 0.2);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-clear:hover { background: rgba(var(--error-rgb), 0.12); }

.btn-save {
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
  border: 1px solid rgba(var(--primary-rgb), 0.25);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-save:hover:not(:disabled) { background: rgba(var(--primary-rgb), 0.18); }
.btn-save:disabled { opacity: 0.55; cursor: not-allowed; }

.sync-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.sync-tag.guardado { background: rgba(var(--success-rgb, 34, 197, 94), 0.14); color: #16a34a; }
.sync-tag.pendiente { background: rgba(var(--warning-rgb, 245, 158, 11), 0.16); color: #b45309; }
.sync-tag.error { background: rgba(var(--error-rgb), 0.12); color: var(--error); }

.mini-btn {
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
  border: 1px solid rgba(var(--primary-rgb), 0.25);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  margin-left: 6px;
  transition: all 0.2s;
}

.mini-btn:hover { background: rgba(var(--primary-rgb), 0.2); }

.field-note {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  margin-left: 4px;
}

.field-row.ret-iva {
  background: rgba(var(--warning-rgb, 245, 158, 11), 0.06);
  border-radius: 4px;
  padding: 6px 4px;
}

.edit-hint {
  color: var(--text-secondary);
  font-size: 0.72rem;
  margin-top: 4px;
}

.source-summary { margin-bottom: 12px; }
.source-label { font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 6px; }
.source-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.source-chip {
  background: rgba(var(--primary-rgb), 0.08);
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
  background: rgba(var(--primary-rgb), 0.04);
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
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.engine-tag {
  font-size: 0.68rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.engine-tag.gemini {
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success);
}

.engine-tag.tesseract {
  background: var(--tesseract-bg);
  color: var(--text-secondary);
}

.doc-type-tag {
  font-size: 0.68rem;
  background: rgba(var(--primary-rgb), 0.08);
  color: var(--primary);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.engine-warning {
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent);
  font-size: 0.75rem;
  padding: 6px 14px;
  border-left: 3px solid var(--accent);
  margin: 0;
}

.handwritten-banner {
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(var(--accent-rgb), 0.2);
  margin: 0;
}

.field-row.doubtful {
  background: rgba(var(--accent-rgb), 0.08);
  border-bottom: 1px solid rgba(var(--accent-rgb), 0.3);
  border-radius: 4px;
  padding: 6px 6px;
}

.field-row.doubtful .field-value {
  color: var(--accent);
  font-weight: 700;
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

.btn-outline:hover { background: rgba(var(--primary-rgb), 0.05); }

.records-list { display: flex; flex-direction: column; gap: 10px; }

.record-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.record-actions { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }

.seniat-btn {
  background: var(--surface);
  border: 1px solid var(--primary);
  color: var(--primary);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.seniat-btn:hover:not(:disabled) { background: rgba(var(--primary-rgb), 0.08); }

.seniat-btn.revalidated {
  background: rgba(var(--success-rgb), 0.1);
  border-color: var(--success);
  color: var(--success);
}

.seniat-cancel {
  background: rgba(var(--error-rgb), 0.08);
  border: 1px solid var(--error);
  color: var(--error);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.seniat-cancel:hover { background: rgba(var(--error-rgb), 0.15); }

.seniat-loading {
  background: rgba(var(--primary-rgb), 0.06);
  color: var(--primary);
  font-size: 0.75rem;
  padding: 6px 14px;
  border-left: 3px solid var(--primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.seniat-error {
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error);
  font-size: 0.75rem;
  padding: 6px 14px;
  border-left: 3px solid var(--error);
}

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

.icon-btn.edit { background: rgba(var(--primary-rgb), 0.08); color: var(--primary); }
.icon-btn.edit:hover { background: rgba(var(--primary-rgb), 0.15); }
.icon-btn.delete { background: rgba(var(--error-rgb), 0.08); color: var(--error); }
.icon-btn.delete:hover { background: rgba(var(--error-rgb), 0.15); }

.record-body { padding: 12px 14px; }

.field-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px solid var(--divider-weak);
  font-size: 0.82rem;
}

.field-label { color: var(--text-secondary); font-weight: 500; }
.field-value { color: var(--text); font-weight: 400; text-align: right; max-width: 60%; }
.field-value.amount { color: var(--primary); font-weight: 700; font-size: 0.9rem; }

.field-row.highlight { background: rgba(var(--primary-rgb), 0.03); border-radius: 4px; padding: 8px 4px; }

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

.btn-add:hover { border-color: var(--primary); background: rgba(var(--primary-rgb), 0.02); }

@media (max-width: 480px) {
  .edit-grid { grid-template-columns: 1fr; }
  .edit-field.full { grid-column: 1; }
}
</style>
