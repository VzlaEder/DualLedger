<template>
  <div class="prov-view">
    <div class="prov-head">
      <div>
        <h2>Proveedores</h2>
        <p class="sub">
          Registro de proveedores con validación de RIF en el SENIAT, retenciones de IVA e ISLR
          y cuenta contable asignada.
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
          placeholder="Buscar por código, RIF, nombre o clasificación…"
        />
        <span class="count">{{ proveedoresFiltrados.length }} de {{ proveedores.length }}</span>
      </div>

      <div v-if="proveedoresFiltrados.length" class="table-scroll">
        <table class="prov-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>RIF / Cédula</th>
              <th>Nombre</th>
              <th>Clasificación</th>
              <th>Ret. IVA</th>
              <th>Ret. ISLR</th>
              <th>Cuenta</th>
              <th>Días crédito</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in proveedoresFiltrados" :key="p.rif">
              <td class="mono">{{ codigoProveedor(i) }}</td>
              <td class="mono">{{ formatearRif(p.rif) }}</td>
              <td>
                <span class="fuerte">{{ p.nombre }}</span>
                <span v-if="p.condicion" class="cond">({{ p.condicion }})</span>
                <span v-if="p.extranjero" class="tag">Extranjero</span>
              </td>
              <td>{{ p.clasificacion || '—' }}</td>
              <td>{{ p.porcentajeRetIva }}%</td>
              <td>{{ conceptoNombre(p.conceptoIslr) }}</td>
              <td class="mono">{{ p.codigoCuenta || '—' }}</td>
              <td>{{ p.diasCredito || 0 }}</td>
              <td class="row-actions">
                <button class="btn" @click="editar(p)">Editar</button>
                <button class="btn btn-danger" @click="eliminar(p)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <p v-if="cargando">Cargando proveedores…</p>
        <p v-else-if="proveedores.length">No hay proveedores que coincidan con la búsqueda.</p>
        <p v-else>
          No hay proveedores registrados. Pulsa «+ Nuevo» para abrir la ficha y dar de alta el primero.
        </p>
      </div>
    </div>

    <!-- ===== Ficha del proveedor ===== -->
    <div v-else class="card ficha">
      <div class="ficha-head">
        <div>
          <h3>{{ esNuevo ? 'Nuevo proveedor' : 'Editar proveedor' }}</h3>
          <p class="muted">
            {{ esNuevo ? 'Ficha nueva' : `Código ${codigoProveedor(indiceEditando)}` }} ·
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

      <div class="tabs">
        <button
          v-for="t in pestañas"
          :key="t.id"
          type="button"
          class="tab"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Básicos -->
      <div v-if="tab === 'basicos'" class="tab-body">
        <div class="grid">
          <div class="field field-wide">
            <label>RIF / Cédula *</label>
            <div class="rif-row">
              <input
                v-model="editando.rif"
                class="input mono"
                placeholder="J500821484"
                :disabled="!esNuevo"
                @keyup.enter="verificar"
              />
              <button class="btn" :disabled="verificando || !esNuevo" @click="verificar">
                {{ verificando ? 'Consultando…' : 'Consultar' }}
              </button>
            </div>
            <small class="hint">El botón Consultar valida el RIF contra el portal del SENIAT.</small>
          </div>

          <div class="field">
            <label>Código de validación</label>
            <input v-model="editando.codigoValidacion" class="input" placeholder="Opcional" />
          </div>

          <div class="field">
            <label>Nombre / Razón social *</label>
            <input v-model="editando.nombre" class="input" />
          </div>

          <div class="field field-wide">
            <label>Dirección</label>
            <input v-model="editando.direccion" class="input" />
          </div>

          <div class="field field-wide">
            <label>Dirección fiscal</label>
            <input v-model="editando.direccionFiscal" class="input" />
          </div>

          <div class="field">
            <label>Teléfono</label>
            <input v-model="editando.telefono" class="input" />
          </div>

          <div class="field">
            <label>Condición (SENIAT)</label>
            <input v-model="editando.condicion" class="input" placeholder="Se llena al consultar" />
          </div>

          <div class="field">
            <label>Clasificación</label>
            <input
              v-model="editando.clasificacion"
              class="input"
              list="clasificaciones-proveedor"
              placeholder="Seleccione o escriba…"
            />
            <datalist id="clasificaciones-proveedor">
              <option v-for="c in clasificaciones" :key="c" :value="c"></option>
              <option v-for="c in conceptosActivos" :key="c.codigo" :value="c.nombre"></option>
            </datalist>
          </div>

          <div class="field">
            <label>Días de crédito</label>
            <input v-model.number="editando.diasCredito" class="input" type="number" min="0" step="1" />
          </div>

          <div class="field">
            <label>Retención de IVA</label>
            <select v-model.number="editando.porcentajeRetIva" class="input">
              <option v-for="r in retencionesIva" :key="r" :value="r">
                Retención de IVA {{ r }}%
              </option>
            </select>
            <small class="hint">Según la información que muestra el SENIAT al consultar.</small>
          </div>

          <div class="field">
            <label>Retención ISLR</label>
            <select v-model="editando.conceptoIslr" class="input">
              <option value="">— Sin retención —</option>
              <option v-for="c in conceptosActivos" :key="c.codigo" :value="c.codigo">
                {{ c.nombre }}
              </option>
            </select>
          </div>

          <div class="field field-wide">
            <label>Cuenta contable asignada</label>
            <AccountSelector
              v-model="editando.codigoCuenta"
              :cuentas="cuentas"
              placeholder="Seleccionar cuenta contable…"
            />
          </div>
        </div>

        <div class="checks">
          <label class="check-line">
            <input v-model="editando.extranjero" type="checkbox" />
            Proveedor extranjero
          </label>
          <label class="check-line">
            <input v-model="editando.creditoFiscalNoDeducible" type="checkbox" />
            Crédito fiscal no deducible
          </label>
        </div>
      </div>

      <div v-else class="tab-body pendiente">
        <p>
          La pestaña <strong>{{ nombrePestaña }}</strong> se construirá en el siguiente avance del
          módulo. Los datos de la pestaña Básicos ya se guardan correctamente.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import AccountSelector from './AccountSelector.vue'
import { getJson, postJson } from '../utils/api.js'
import { showAlert, showConfirm, showToast } from '../utils/dialog.js'
import { formatearRif } from '../services/rif.js'
import { verificarRifEnSeniat } from '../utils/seniat.js'
import { cargarConceptos } from '../services/conceptosIslr.js'
import {
  agregarPendiente,
  borrarProveedor,
  getCuentas,
  getProveedores,
  saveProveedores
} from '../stores/maestrosDb.js'
import {
  CLASIFICACIONES_SUGERIDAS,
  RETENCIONES_IVA,
  codigoProveedor,
  normalizarProveedor,
  proveedorVacio,
  validarProveedor
} from '../services/proveedores.js'

export default {
  name: 'ProveedoresView',
  components: { AccountSelector },
  data() {
    return {
      proveedores: [],
      cuentas: [],
      conceptos: [],
      cargando: false,
      guardando: false,
      verificando: false,
      busqueda: '',
      editando: null,
      esNuevo: false,
      tab: 'basicos',
      pestañas: [
        { id: 'basicos', label: 'Básicos' },
        { id: 'documentos', label: 'Documentos' },
        { id: 'contactos', label: 'Contactos' },
        { id: 'digitales', label: 'Documentos Digitales' },
        { id: 'log', label: 'Log' }
      ]
    }
  },
  computed: {
    proveedoresFiltrados() {
      const f = String(this.busqueda || '').trim().toLowerCase()
      if (!f) return this.proveedores
      return this.proveedores.filter((p) =>
        [p.rif, formatearRif(p.rif), p.nombre, p.clasificacion]
          .some((v) => String(v || '').toLowerCase().includes(f))
      )
    },
    conceptosActivos() {
      return (this.conceptos || []).filter((c) => c.activo !== false)
    },
    clasificaciones() {
      return CLASIFICACIONES_SUGERIDAS
    },
    retencionesIva() {
      return RETENCIONES_IVA
    },
    indiceEditando() {
      if (!this.editando) return 0
      return Math.max(0, this.proveedores.findIndex((p) => p.rif === this.editando.rif))
    },
    nombrePestaña() {
      const p = this.pestañas.find((t) => t.id === this.tab)
      return p ? p.label : ''
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    formatearRif,
    codigoProveedor,
    async cargar() {
      this.cargando = true
      try {
        const [locales, cuentas, conceptos] = await Promise.all([
          getProveedores().catch(() => []),
          getCuentas().catch(() => []),
          cargarConceptos().catch(() => [])
        ])
        this.cuentas = cuentas || []
        this.conceptos = conceptos || []

        if (locales && locales.length) {
          this.proveedores = locales
        } else {
          try {
            const res = await getJson('/proveedores')
            this.proveedores = (res && res.proveedores) || []
          } catch (e) {
            this.proveedores = []
          }
          if (this.proveedores.length) await saveProveedores(this.proveedores).catch(() => {})
        }
      } finally {
        this.cargando = false
      }
    },
    conceptoNombre(codigo) {
      if (!codigo) return '—'
      const c = this.conceptos.find((x) => x.codigo === codigo)
      return c ? c.nombre : codigo
    },
    nuevo() {
      this.editando = proveedorVacio()
      this.esNuevo = true
      this.tab = 'basicos'
    },
    editar(p) {
      this.editando = { ...proveedorVacio(), ...p }
      this.esNuevo = false
      this.tab = 'basicos'
    },
    cancelar() {
      this.editando = null
      this.esNuevo = false
    },
    salir() {
      this.cancelar()
    },
    async verificar() {
      const val = validarRif(this.editando.rif)
      if (!val.valido) {
        await showAlert(val.error, { type: 'warning', title: 'RIF inválido' })
        return
      }
      this.verificando = true
      try {
        const data = await verificarRifEnSeniat(val.rif)
        this.editando.nombre = data.nombreRazon || this.editando.nombre
        this.editando.condicion = data.condicion || this.editando.condicion
        showToast(`RIF verificado: ${data.nombreRazon || formatearRif(val.rif)}`)
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
      const mensaje = validarProveedor(this.editando, {
        existentes: this.proveedores,
        esNuevo: this.esNuevo
      })
      if (mensaje) {
        await showAlert(mensaje, { type: 'warning', title: 'Revisa la ficha' })
        return
      }

      const record = normalizarProveedor(this.editando)
      const lista = [...this.proveedores]
      const idx = lista.findIndex((p) => p.rif === record.rif)
      if (idx >= 0) lista[idx] = record
      else lista.push(record)

      this.guardando = true
      try {
        await saveProveedores(lista)
        this.proveedores = lista
        showToast(`Proveedor guardado: ${record.nombre}`)
        await this.sincronizar(lista)
        this.editando = null
        this.esNuevo = false
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo guardar el proveedor', {
          type: 'error',
          title: 'Proveedores'
        })
      } finally {
        this.guardando = false
      }
    },
    async sincronizar(lista) {
      try {
        const res = await postJson('/proveedores/sync', { proveedores: lista })
        showToast(
          `Sincronizado (${res.inserted || 0} nuevos, ${res.updated || 0} actualizados).`
        )
      } catch (e) {
        await agregarPendiente('proveedores', { proveedores: lista }, { motivo: 'sync_proveedores' })
        showToast('Guardado localmente; sincronización pendiente.', { type: 'warning' })
      }
    },
    async eliminar(p) {
      const ok = await showConfirm(
        `¿Eliminar al proveedor ${p.nombre} (${formatearRif(p.rif)})?`,
        { title: 'Eliminar proveedor', confirmText: 'Eliminar', danger: true }
      )
      if (!ok) return

      const lista = this.proveedores.filter((x) => x.rif !== p.rif)
      try {
        await saveProveedores(lista)
        await borrarProveedor(p.rif)
        this.proveedores = lista
        if (this.editando && this.editando.rif === p.rif) this.cancelar()
        showToast(`Proveedor eliminado: ${p.nombre}`)
        try {
          await postJson('/proveedores/delete', { rif: [p.rif] })
        } catch (e) {
          await agregarPendiente('proveedores_delete', { rif: [p.rif] }, { motivo: 'delete_proveedor' })
          showToast('Eliminación pendiente de sincronizar.', { type: 'warning' })
        }
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo eliminar el proveedor', {
          type: 'error',
          title: 'Proveedores'
        })
      }
    }
  }
}
</script>

<style scoped>
.prov-view { display: flex; flex-direction: column; gap: 16px; }
.prov-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.prov-head h2 { margin: 0 0 4px; font-size: 1.35rem; }
.sub { margin: 0; color: var(--text-secondary); font-size: 0.88rem; max-width: 620px; }
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
.count { color: var(--text-secondary); font-size: 0.8rem; white-space: nowrap; }
.table-scroll { overflow-x: auto; }
.prov-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.prov-table th, .prov-table td {
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--divider-weak);
  white-space: nowrap;
}
.prov-table th { color: var(--text-secondary); font-weight: 600; font-size: 0.76rem; }
.prov-table tr:last-child td { border-bottom: 0; }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.fuerte { font-weight: 600; }
.cond { color: var(--text-secondary); font-size: 0.78rem; margin-left: 5px; }
.tag {
  margin-left: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent);
  font-size: 0.7rem;
}
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
.tabs { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid var(--border); margin-top: 14px; }
.tab {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 10px 13px;
  font-size: 0.84rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-family: inherit;
}
.tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
.tab-body { padding-top: 16px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-wide { grid-column: 1 / -1; }
.field label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
.rif-row { display: flex; gap: 8px; }
.rif-row .input { flex: 1; }
.hint { color: var(--text-secondary); font-size: 0.73rem; }
.checks { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 18px; }
.check-line { display: flex; align-items: center; gap: 7px; font-size: 0.84rem; }
.pendiente { color: var(--text-secondary); font-size: 0.88rem; }
@media (max-width: 720px) {
  .prov-head, .ficha-head { flex-direction: column; }
  .grid { grid-template-columns: 1fr; }
}
</style>
