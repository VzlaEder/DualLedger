<template>
  <div class="dnf-view">
    <div class="dnf-head">
      <div>
        <h2>Documentos no fiscales</h2>
        <p class="sub">
          Comprobantes de gastos sin factura fiscal (recibos, tickets, contratos, etc.).
          <strong>No se incluyen en el Libro de Compras</strong> ni generan retenciones.
        </p>
      </div>
      <div class="head-actions">
        <button class="btn" :disabled="cargando" @click="cargar">Recargar</button>
        <button class="btn btn-primary" @click="nuevo">+ Nuevo</button>
      </div>
    </div>

    <div v-if="!editando" class="card">
      <div class="toolbar">
        <input
          v-model="busqueda"
          class="search-input"
          type="search"
          placeholder="Buscar por número, tipo, RIF, proveedor o concepto…"
        />
        <span class="count">{{ filtrados.length }} de {{ documentos.length }}</span>
        <span class="total">Total Bs {{ dinero(totalFiltrado) }}</span>
      </div>

      <div v-if="filtrados.length" class="table-scroll">
        <table class="dnf-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Número</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>RIF</th>
              <th>Proveedor</th>
              <th>Concepto</th>
              <th class="num">Monto</th>
              <th>Cuenta</th>
              <th>Deducible</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, i) in filtrados" :key="d.uid">
              <td class="mono">{{ codigoDocumentoNoFiscal(i) }}</td>
              <td class="mono fuerte">{{ d.numero }}</td>
              <td>{{ d.fecha }}</td>
              <td>{{ d.tipo }}</td>
              <td class="mono">{{ formatearRifOpcional(d.rif) }}</td>
              <td>{{ d.proveedor || '—' }}</td>
              <td class="concepto">{{ d.concepto }}</td>
              <td class="num fuerte">{{ dinero(d.monto) }}</td>
              <td class="mono">{{ d.codigoCuenta || '—' }}</td>
              <td>
                <span class="tag" :class="d.noDeducible ? 'no' : 'si'">
                  {{ d.noDeducible ? 'No deducible' : 'Deducible' }}
                </span>
              </td>
              <td class="row-actions">
                <button class="btn" @click="editar(d)">Editar</button>
                <button class="btn btn-danger" @click="eliminar(d)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <p v-if="cargando">Cargando documentos…</p>
        <p v-else-if="documentos.length">No hay documentos que coincidan con la búsqueda.</p>
        <p v-else>
          No hay documentos no fiscales registrados. Pulsa «+ Nuevo» para registrar el primero.
        </p>
      </div>
    </div>

    <!-- ===== Ficha del documento ===== -->
    <div v-else class="card ficha">
      <div class="ficha-head">
        <div>
          <h3>{{ esNuevo ? 'Nuevo documento no fiscal' : 'Editar documento no fiscal' }}</h3>
          <p class="muted">
            {{ esNuevo ? 'Ficha nueva' : codigoDocumentoNoFiscal(indiceEditando) }} ·
            los campos con * son obligatorios
          </p>
        </div>
        <div class="ficha-actions">
          <button class="btn btn-primary" :disabled="guardando" @click="guardar">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
          <button v-if="!esNuevo" class="btn btn-danger" :disabled="guardando" @click="eliminar(editando)">
            Eliminar
          </button>
          <button class="btn" :disabled="guardando" @click="cancelar">Cancelar</button>
          <button class="btn" :disabled="guardando" @click="salir">Salir</button>
        </div>
      </div>

      <div class="aviso">
        Este comprobante queda fuera del Libro de Compras; no se calculan retenciones de IVA ni ISLR.
      </div>

      <div class="grid">
        <div class="field">
          <label>Número *</label>
          <input v-model="editando.numero" class="input" placeholder="Ej. R-001" />
        </div>

        <div class="field">
          <label>Tipo</label>
          <select v-model="editando.tipo" class="input">
            <option v-for="t in tipos" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="field">
          <label>Fecha *</label>
          <input v-model="editando.fecha" class="input" type="date" />
        </div>

        <div class="field">
          <label>RIF / Cédula (opcional)</label>
          <div class="rif-row">
            <input
              v-model="editando.rif"
              class="input mono"
              placeholder="J500821484"
              @keyup.enter="verificar"
            />
            <button class="btn" :disabled="verificando || !editando.rif" @click="verificar">
              {{ verificando ? 'Consultando…' : 'Consultar' }}
            </button>
          </div>
          <small class="hint">Si se indica, se valida contra el SENIAT y rellena el proveedor.</small>
        </div>

        <div class="field field-wide">
          <label>Proveedor (opcional)</label>
          <input v-model="editando.proveedor" class="input" placeholder="Nombre o razón social" />
        </div>

        <div class="field field-wide">
          <label>Concepto *</label>
          <input v-model="editando.concepto" class="input" placeholder="Ej. Mantenimiento de la oficina" />
        </div>

        <div class="field">
          <label>Monto (Bs) *</label>
          <input v-model.number="editando.monto" class="input" type="number" min="0" step="0.01" />
        </div>

        <div class="field">
          <label>Archivo adjunto (opcional)</label>
          <input class="input" type="file" @change="elegirArchivo" />
          <small class="hint">
            {{ editando.archivoNombre ? `Seleccionado: ${editando.archivoNombre}` : 'Solo se guarda el nombre; el contenido se adjuntará en un avance posterior.' }}
          </small>
        </div>

        <div class="field field-wide">
          <label>Cuenta contable asignada</label>
          <AccountSelector
            v-model="editando.codigoCuenta"
            :cuentas="cuentas"
            placeholder="Seleccionar cuenta contable…"
          />
        </div>

        <div class="field field-wide">
          <label>Notas</label>
          <textarea v-model="editando.notas" class="input" rows="3" placeholder="Observaciones internas"></textarea>
        </div>
      </div>

      <label class="check-line">
        <input v-model="editando.noDeducible" type="checkbox" />
        No deducible (no genera crédito fiscal)
      </label>
    </div>
  </div>
</template>

<script>
import AccountSelector from './AccountSelector.vue'
import { getJson, postJson } from '../utils/api.js'
import { showAlert, showConfirm, showToast } from '../utils/dialog.js'
import { validarRif } from '../services/rif.js'
import { verificarRifEnSeniat } from '../utils/seniat.js'
import { agregarPendiente, getCuentas } from '../stores/maestrosDb.js'
import {
  borrarDocumentoNoFiscal,
  getDocumentosNoFiscales,
  saveDocumentosNoFiscales
} from '../stores/documentosNoFiscalesDb.js'
import { generarUid } from '../stores/comprasDb.js'
import {
  TIPOS_DOCUMENTO_NO_FISCAL,
  codigoDocumentoNoFiscal,
  documentoNoFiscalVacio,
  formatearRifOpcional,
  normalizarDocumentoNoFiscal,
  totalDocumentosNoFiscales,
  validarDocumentoNoFiscal
} from '../services/documentosNoFiscales.js'

export default {
  name: 'DocumentosNoFiscalesView',
  components: { AccountSelector },
  data() {
    return {
      documentos: [],
      cuentas: [],
      cargando: false,
      guardando: false,
      verificando: false,
      busqueda: '',
      editando: null,
      esNuevo: false
    }
  },
  computed: {
    tipos() {
      return TIPOS_DOCUMENTO_NO_FISCAL
    },
    filtrados() {
      const f = String(this.busqueda || '').trim().toLowerCase()
      if (!f) return this.documentos
      return this.documentos.filter((d) =>
        [d.numero, d.tipo, d.rif, formatearRifOpcional(d.rif), d.proveedor, d.concepto]
          .some((v) => String(v || '').toLowerCase().includes(f))
      )
    },
    totalFiltrado() {
      return totalDocumentosNoFiscales(this.filtrados)
    },
    indiceEditando() {
      if (!this.editando) return 0
      return Math.max(0, this.documentos.findIndex((d) => d.uid === this.editando.uid))
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    formatearRifOpcional,
    codigoDocumentoNoFiscal,
    dinero(v) {
      const n = Number(v)
      if (!isFinite(n)) return '0,00'
      return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    hoy() {
      const d = new Date()
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    },
    async cargar() {
      this.cargando = true
      try {
        const [locales, cuentas] = await Promise.all([
          getDocumentosNoFiscales().catch(() => []),
          getCuentas().catch(() => [])
        ])
        this.cuentas = cuentas || []
        if (locales && locales.length) {
          this.documentos = locales
        } else {
          try {
            const res = await getJson('/documentos-no-fiscales')
            this.documentos = (res && res.documentos) || []
          } catch (e) {
            this.documentos = []
          }
          if (this.documentos.length) await saveDocumentosNoFiscales(this.documentos).catch(() => {})
        }
      } finally {
        this.cargando = false
      }
    },
    nuevo() {
      this.editando = { ...documentoNoFiscalVacio(), uid: generarUid('nf'), fecha: this.hoy() }
      this.esNuevo = true
    },
    editar(d) {
      this.editando = { ...documentoNoFiscalVacio(), ...d }
      this.esNuevo = false
    },
    cancelar() {
      this.editando = null
      this.esNuevo = false
    },
    salir() {
      this.cancelar()
    },
    elegirArchivo(e) {
      const file = e.target.files && e.target.files[0]
      this.editando.archivoNombre = file ? file.name : ''
    },
    async verificar() {
      const chequeo = validarRif(this.editando.rif)
      if (!chequeo.valido) {
        await showAlert(chequeo.error, { type: 'warning', title: 'RIF inválido' })
        return
      }
      this.verificando = true
      try {
        const data = await verificarRifEnSeniat(chequeo.rif)
        if (data.nombreRazon) this.editando.proveedor = data.nombreRazon
        showToast(`RIF verificado: ${data.nombreRazon || formatearRifOpcional(chequeo.rif)}`)
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo verificar el RIF', {
          type: 'error',
          title: 'Consulta SENIAT'
        })
      } finally {
        this.verificando = false
      }
    },
    async guardar() {
      const mensaje = validarDocumentoNoFiscal(this.editando)
      if (mensaje) {
        await showAlert(mensaje, { type: 'warning', title: 'Revisa el documento' })
        return
      }

      const record = normalizarDocumentoNoFiscal(this.editando)
      if (!record.uid) record.uid = generarUid('nf')
      const lista = [...this.documentos]
      const idx = lista.findIndex((d) => d.uid === record.uid)
      if (idx >= 0) lista[idx] = record
      else lista.push(record)

      this.guardando = true
      try {
        await saveDocumentosNoFiscales(lista)
        this.documentos = lista
        showToast(`Documento guardado: ${record.numero}`)
        await this.sincronizar(lista)
        this.editando = null
        this.esNuevo = false
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo guardar el documento', {
          type: 'error',
          title: 'Documentos no fiscales'
        })
      } finally {
        this.guardando = false
      }
    },
    async sincronizar(lista) {
      try {
        const res = await postJson('/documentos-no-fiscales/sync', { documentos: lista })
        showToast(
          `Sincronizado (${res.inserted || 0} nuevos, ${res.updated || 0} actualizados).`
        )
      } catch (e) {
        await agregarPendiente(
          'documentos_no_fiscales',
          { documentos: lista },
          { motivo: 'sync_documentos_no_fiscales' }
        )
        showToast('Guardado localmente; sincronización pendiente.', { type: 'warning' })
      }
    },
    async eliminar(d) {
      const ok = await showConfirm(
        `¿Eliminar el documento ${d.numero} (${d.concepto})?`,
        { title: 'Eliminar documento', confirmText: 'Eliminar', danger: true }
      )
      if (!ok) return

      const lista = this.documentos.filter((x) => x.uid !== d.uid)
      try {
        await saveDocumentosNoFiscales(lista)
        await borrarDocumentoNoFiscal(d.uid)
        this.documentos = lista
        if (this.editando && this.editando.uid === d.uid) this.cancelar()
        showToast(`Documento eliminado: ${d.numero}`)
        try {
          await postJson('/documentos-no-fiscales/delete', { uid: [d.uid] })
        } catch (e) {
          await agregarPendiente(
            'documentos_no_fiscales_delete',
            { uid: [d.uid] },
            { motivo: 'delete_documento_no_fiscal' }
          )
          showToast('Eliminación pendiente de sincronizar.', { type: 'warning' })
        }
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo eliminar el documento', {
          type: 'error',
          title: 'Documentos no fiscales'
        })
      }
    }
  }
}
</script>

<style scoped>
.dnf-view { display: flex; flex-direction: column; gap: 16px; }
.dnf-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.dnf-head h2 { margin: 0 0 4px; font-size: 1.35rem; }
.sub { margin: 0; color: var(--text-secondary); font-size: 0.88rem; max-width: 640px; }
.head-actions, .ficha-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}
.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.search-input, .input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 9px 11px;
  font-size: 0.88rem;
  font-family: inherit;
}
.search-input { flex: 1; }
.count, .total { color: var(--text-secondary); font-size: 0.8rem; white-space: nowrap; }
.total { font-weight: 700; color: var(--primary); }
.table-scroll { overflow-x: auto; }
.dnf-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.dnf-table th, .dnf-table td {
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--divider-weak);
  white-space: nowrap;
}
.dnf-table th { color: var(--text-secondary); font-weight: 600; font-size: 0.76rem; }
.dnf-table tr:last-child td { border-bottom: 0; }
.dnf-table .num { text-align: right; }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.fuerte { font-weight: 600; }
.concepto { max-width: 230px; overflow: hidden; text-overflow: ellipsis; }
.tag { padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
.tag.no { background: rgba(var(--accent-rgb), 0.14); color: var(--accent); }
.tag.si { background: rgba(var(--success-rgb), 0.14); color: var(--success); }
.row-actions { display: flex; gap: 6px; }
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
.btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
.btn-danger { color: var(--error); border-color: rgba(var(--error-rgb), 0.4); }
.empty-state { padding: 28px 12px; text-align: center; color: var(--text-secondary); font-size: 0.88rem; }
.ficha-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.ficha-head h3 { margin: 0 0 4px; font-size: 1.1rem; }
.muted { margin: 0; color: var(--text-secondary); font-size: 0.82rem; }
.aviso {
  margin-top: 14px;
  padding: 9px 12px;
  border-radius: 8px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent);
  font-size: 0.8rem;
}
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-wide { grid-column: 1 / -1; }
.field label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
.rif-row { display: flex; gap: 8px; }
.rif-row .input { flex: 1; }
.hint { color: var(--text-secondary); font-size: 0.73rem; }
.check-line { display: flex; align-items: center; gap: 7px; margin-top: 18px; font-size: 0.84rem; }
@media (max-width: 720px) {
  .dnf-head, .ficha-head { flex-direction: column; }
  .grid { grid-template-columns: 1fr; }
}
</style>
