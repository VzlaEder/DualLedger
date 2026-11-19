<template>
  <div class="art-view">
    <ReportHeader
      title="Artículos"
      icon="&#128230;"
      badge="Catálogo · artículos"
      accent="#4f46e5"
      subtitle="Comprende las cuentas contables que serán seleccionadas de acuerdo al concepto de la factura a registrar (manual 1.1)."
    >
      <template #actions>
        <button class="btn" :disabled="cargando" @click="cargar">Recargar</button>
        <button class="btn" :disabled="cargando || importando" @click="importarCuentas">
          {{ importando ? 'Importando…' : 'Importar cuentas' }}
        </button>
        <button class="btn btn-primary" @click="nuevo">+ Nuevo</button>
      </template>
    </ReportHeader>

    <!-- ===== Listado (captura "Artículos") ===== -->
    <div v-if="!editando" class="card">
      <div class="filtros">
        <div class="filtro">
          <label>Artículo</label>
          <input v-model="filtros.articulo" class="input" type="search" placeholder="Todos" />
        </div>
        <div class="filtro">
          <label>Grupo Artículos</label>
          <select v-model="filtros.grupoArticulos" class="input">
            <option value="">Todos</option>
            <option v-for="o in opciones.grupoArticulos" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="filtro">
          <label>Presen/Modelo</label>
          <select v-model="filtros.presentacionModelo" class="input">
            <option value="">Todos</option>
            <option v-for="o in opciones.presentacionModelo" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="filtro">
          <label>Alm. inicial</label>
          <select v-model="filtros.almacenInicial" class="input">
            <option value="">Todos</option>
            <option v-for="o in opciones.almacenInicial" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="filtro">
          <label>Medida</label>
          <select v-model="filtros.medida" class="input">
            <option value="">Todos</option>
            <option v-for="o in opciones.medida" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="filtro filtro-buscar">
          <label>Buscar</label>
          <input v-model="filtros.busqueda" class="input" type="search" placeholder="Código, nombre, marca…" />
        </div>
      </div>

      <div class="toolbar">
        <span class="count">{{ filtrados.length }} de {{ articulos.length }}</span>
      </div>

      <div v-if="filtrados.length" class="table-scroll">
        <table class="art-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Marca</th>
              <th class="num">Precio</th>
              <th class="num">Existencia</th>
              <th>C.C Compra</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in filtrados" :key="a.uid">
              <td class="mono">{{ a.codigo }}</td>
              <td class="fuerte">{{ a.nombre }}</td>
              <td>{{ a.tipo }}</td>
              <td>{{ a.marca || '—' }}</td>
              <td class="num">{{ dinero(a.precioVenta) }}</td>
              <td class="num">{{ dinero(a.existencia) }}</td>
              <td class="mono">{{ a.centroCostoCompra || '—' }}</td>
              <td class="row-actions">
                <button class="btn" @click="editar(a)">Editar</button>
                <button class="btn btn-danger" @click="eliminar(a)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="empty-state">
        <p v-if="cargando">Cargando artículos…</p>
        <p v-else-if="articulos.length">No hay artículos que coincidan con los filtros.</p>
        <p v-else>
          No hay artículos registrados. Pulsa «+ Nuevo» para abrir la ficha o
          «Importar cuentas» para cargar el plan de cuentas contables.
        </p>
      </div>
    </div>

    <!-- ===== Ficha: Agregar o modificar cuenta (manual 1.1.1) ===== -->
    <div v-else class="card ficha">
      <div class="ficha-head">
        <div>
          <h3>{{ esNuevo ? 'Nuevo artículo' : 'Modificar artículo' }}</h3>
          <p class="muted">
            {{ esNuevo ? 'Ficha nueva' : `Código ${editando.codigo}` }} ·
            los campos con * son obligatorios
          </p>
        </div>
        <div class="ficha-actions">
          <button class="btn" :disabled="guardando" @click="nuevo">Incluir</button>
          <button class="btn btn-primary" :disabled="guardando" @click="guardar">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
          <button class="btn" :disabled="guardando" @click="buscar">Buscar</button>
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

      <!-- Pestaña Producto -->
      <div v-if="tab === 'producto'" class="tab-body">
        <div class="grid">
          <div class="field">
            <label>Código *</label>
            <input v-model="editando.codigo" class="input mono" placeholder="Ej. 1.1.1.01.004" />
          </div>

          <div class="field">
            <label>Artículo *</label>
            <input v-model="editando.nombre" class="input" placeholder="Nombre del artículo" />
          </div>

          <div class="field field-wide">
            <label>Descripción</label>
            <input v-model="editando.descripcion" class="input" placeholder="Descripción amplia" />
          </div>

          <div class="field">
            <label>Tipo</label>
            <select v-model="editando.tipo" class="input">
              <option v-for="t in tipos" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="field">
            <label>IVA</label>
            <select v-model="editando.iva" class="input">
              <option v-for="o in opcionesIva" :key="o" :value="o">{{ o }}</option>
            </select>
          </div>

          <div class="field field-wide">
            <label class="check-line">
              <input v-model="editando.paraVenta" type="checkbox" />
              Para la Venta
            </label>
          </div>

          <div class="field">
            <label>Grupo Artículos</label>
            <input v-model="editando.grupoArticulos" class="input" list="lista-grupos" />
            <datalist id="lista-grupos">
              <option v-for="o in opciones.grupoArticulos" :key="o" :value="o"></option>
            </datalist>
          </div>

          <div class="field">
            <label>Presen/Modelo</label>
            <input v-model="editando.presentacionModelo" class="input" list="lista-presentaciones" />
            <datalist id="lista-presentaciones">
              <option v-for="o in opciones.presentacionModelo" :key="o" :value="o"></option>
            </datalist>
          </div>

          <div class="field">
            <label>Alm. inicial</label>
            <input v-model="editando.almacenInicial" class="input" list="lista-almacenes" />
            <datalist id="lista-almacenes">
              <option v-for="o in opciones.almacenInicial" :key="o" :value="o"></option>
            </datalist>
          </div>

          <div class="field">
            <label>Medida</label>
            <div class="con-row">
              <input v-model="editando.medida" class="input" list="lista-medidas" />
              <button class="btn" type="button" @click="mostrarConversion = !mostrarConversion">Conversión</button>
            </div>
            <datalist id="lista-medidas">
              <option v-for="o in opciones.medida" :key="o" :value="o"></option>
            </datalist>
          </div>

          <div v-if="mostrarConversion" class="field field-wide conversion">
            <label>Factor de conversión</label>
            <input v-model.number="editando.factorConversion" class="input" type="number" min="0" step="0.0001" />
          </div>

          <div class="field">
            <label>Marca</label>
            <input v-model="editando.marca" class="input" />
          </div>

          <div class="field">
            <label>Precio Venta</label>
            <input v-model.number="editando.precioVenta" class="input" type="number" min="0" step="0.01" />
          </div>

          <div class="field">
            <label>Stock Máximo</label>
            <input v-model.number="editando.stockMaximo" class="input" type="number" min="0" step="0.01" />
          </div>

          <div class="field">
            <label>Stock Mínimo</label>
            <input v-model.number="editando.stockMinimo" class="input" type="number" min="0" step="0.01" />
          </div>

          <div class="field">
            <label>Existencia</label>
            <input v-model.number="editando.existencia" class="input" type="number" min="0" step="0.01" />
          </div>

          <div class="field field-wide">
            <label>C.C Venta</label>
            <AccountSelector v-model="editando.centroCostoVenta" :cuentas="cuentas" placeholder="Seleccione…" />
          </div>

          <div class="field field-wide">
            <label>C.C Compra</label>
            <div class="con-row">
              <AccountSelector v-model="editando.centroCostoCompra" :cuentas="cuentas" placeholder="Seleccione…" />
              <button class="btn" type="button" @click="abrirCuentas">Importar</button>
            </div>
            <small class="hint">Cuenta contable que se imputará al registrar la factura de compra.</small>
          </div>
        </div>
      </div>

      <!-- Resto de pestañas del manual: se muestran, sin campos inventados -->
      <div v-else class="tab-body tab-pendiente">
        <p>
          La pestaña «{{ pestañaActualLabel }}» aparece en la ficha del manual
          (1.1.1 Agregar o modificar cuenta). Su contenido se definirá con el contador;
          los datos de «Producto» ya se guardan.
        </p>
      </div>
    </div>

    <!-- Modal del botón Importar (C.C Compra) -->
    <div v-if="modalCuentas" class="modal-backdrop">
      <div class="modal">
        <h3>Seleccionar cuenta contable</h3>
        <input v-model="busquedaCuentas" class="input" type="search" placeholder="Buscar cuenta…" />
        <div class="modal-list">
          <button
            v-for="c in cuentasFiltradas"
            :key="c.codigo"
            type="button"
            class="modal-item"
            @click="elegirCuenta(c)"
          >
            <span class="mono">{{ c.codigo }}</span>
            <span>{{ c.nombre }}</span>
          </button>
          <p v-if="!cuentasFiltradas.length" class="muted">No hay cuentas que coincidan.</p>
        </div>
        <button class="btn" @click="modalCuentas = false">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script>
import AccountSelector from './AccountSelector.vue'
import ReportHeader from './ReportHeader.vue'
import { getJson, postJson } from '../utils/api.js'
import { showAlert, showConfirm, showToast } from '../utils/dialog.js'
import { agregarPendiente, getCuentas } from '../stores/maestrosDb.js'
import { getArticulos, saveArticulos } from '../stores/articulosDb.js'
import { generarUid } from '../stores/comprasDb.js'
import {
  OPCIONES_IVA,
  PESTANAS_ARTICULO,
  TIPOS_ARTICULO,
  articuloVacio,
  articulosDesdeCuentas,
  filtrarArticulos,
  normalizarArticulo,
  valoresUnicos,
  validarArticulo
} from '../services/articulos.js'

export default {
  name: 'ArticulosView',
  components: { AccountSelector, ReportHeader },
  data() {
    return {
      articulos: [],
      cuentas: [],
      cargando: false,
      guardando: false,
      importando: false,
      filtros: { articulo: '', grupoArticulos: '', presentacionModelo: '', almacenInicial: '', medida: '', busqueda: '' },
      editando: null,
      esNuevo: false,
      tab: 'producto',
      mostrarConversion: false,
      modalCuentas: false,
      busquedaCuentas: ''
    }
  },
  computed: {
    pestañas() {
      return PESTANAS_ARTICULO
    },
    tipos() {
      return TIPOS_ARTICULO
    },
    opcionesIva() {
      return OPCIONES_IVA
    },
    pestañaActualLabel() {
      const p = PESTANAS_ARTICULO.find((x) => x.id === this.tab)
      return p ? p.label : ''
    },
    filtrados() {
      return filtrarArticulos(this.articulos, this.filtros)
    },
    opciones() {
      return {
        grupoArticulos: valoresUnicos(this.articulos, 'grupoArticulos'),
        presentacionModelo: valoresUnicos(this.articulos, 'presentacionModelo'),
        almacenInicial: valoresUnicos(this.articulos, 'almacenInicial'),
        medida: valoresUnicos(this.articulos, 'medida')
      }
    },
    cuentasFiltradas() {
      const f = String(this.busquedaCuentas || '').trim().toLowerCase()
      return this.cuentas
        .filter((c) => !f || (c.codigo || '').toLowerCase().includes(f) || (c.nombre || '').toLowerCase().includes(f))
        .slice(0, 200)
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    dinero(v) {
      const n = Number(v)
      if (!isFinite(n)) return '0,00'
      return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    async cargar() {
      this.cargando = true
      try {
        const [locales, cuentas] = await Promise.all([
          getArticulos().catch(() => []),
          getCuentas().catch(() => [])
        ])
        this.cuentas = cuentas || []
        if (locales && locales.length) {
          this.articulos = locales
        } else {
          try {
            const res = await getJson('/articulos')
            this.articulos = (res && res.articulos) || []
          } catch (e) {
            this.articulos = []
          }
          if (this.articulos.length) await saveArticulos(this.articulos).catch(() => {})
        }
      } finally {
        this.cargando = false
      }
    },
    nuevo() {
      this.editando = { ...articuloVacio(), uid: generarUid('art') }
      this.esNuevo = true
      this.tab = 'producto'
      this.mostrarConversion = false
    },
    editar(a) {
      this.editando = { ...articuloVacio(), ...a }
      this.esNuevo = false
      this.tab = 'producto'
      this.mostrarConversion = false
    },
    buscar() {
      this.editando = null
      this.esNuevo = false
    },
    cancelar() {
      this.editando = null
      this.esNuevo = false
    },
    salir() {
      this.cancelar()
    },
    abrirCuentas() {
      this.busquedaCuentas = ''
      this.modalCuentas = true
    },
    elegirCuenta(c) {
      this.editando.centroCostoCompra = c.codigo
      this.modalCuentas = false
      showToast(`C.C Compra: ${c.codigo} — ${c.nombre}`)
    },
    async importarCuentas() {
      if (!this.cuentas.length) {
        await showAlert(
          'Primero importa el Plan de Cuentas contables desde Maestros → Plan de Cuentas.',
          { type: 'warning', title: 'Sin plan de cuentas' }
        )
        return
      }
      const nuevos = articulosDesdeCuentas(this.cuentas, this.articulos)
      if (!nuevos.length) {
        showToast('Todas las cuentas ya están como artículos.', { type: 'warning' })
        return
      }
      const ok = await showConfirm(
        `Se importarán ${nuevos.length} cuentas como artículos de tipo Servicio. ¿Continuar?`,
        { title: 'Importar cuentas', confirmText: 'Importar' }
      )
      if (!ok) return

      this.importando = true
      try {
        const lista = [...this.articulos, ...nuevos]
        await saveArticulos(lista)
        this.articulos = lista
        showToast(`${nuevos.length} cuentas importadas como artículos.`)
        await this.sincronizar(lista)
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudieron importar las cuentas', {
          type: 'error',
          title: 'Artículos'
        })
      } finally {
        this.importando = false
      }
    },
    async guardar() {
      const mensaje = validarArticulo(this.editando, {
        existentes: this.articulos,
        esNuevo: this.esNuevo
      })
      if (mensaje) {
        await showAlert(mensaje, { type: 'warning', title: 'Revisa el artículo' })
        return
      }

      const record = normalizarArticulo(this.editando)
      if (!record.uid) record.uid = generarUid('art')
      const lista = [...this.articulos]
      const idx = lista.findIndex((a) => a.uid === record.uid)
      if (idx >= 0) lista[idx] = record
      else lista.push(record)

      this.guardando = true
      try {
        await saveArticulos(lista)
        this.articulos = lista
        showToast(`Artículo guardado: ${record.codigo}`)
        await this.sincronizar(lista)
        this.editando = null
        this.esNuevo = false
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo guardar el artículo', {
          type: 'error',
          title: 'Artículos'
        })
      } finally {
        this.guardando = false
      }
    },
    async sincronizar(lista) {
      try {
        const res = await postJson('/articulos/sync', { articulos: lista })
        showToast(`Sincronizado (${res.inserted || 0} nuevos, ${res.updated || 0} actualizados).`)
      } catch (e) {
        await agregarPendiente('articulos', { articulos: lista }, { motivo: 'sync_articulos' })
        showToast('Guardado localmente; sincronización pendiente.', { type: 'warning' })
      }
    },
    async eliminar(a) {
      const ok = await showConfirm(
        `¿Eliminar el artículo ${a.codigo} (${a.nombre})?`,
        { title: 'Eliminar artículo', confirmText: 'Eliminar', danger: true }
      )
      if (!ok) return

      const lista = this.articulos.filter((x) => x.uid !== a.uid)
      try {
        await saveArticulos(lista)
        this.articulos = lista
        if (this.editando && this.editando.uid === a.uid) this.cancelar()
        showToast(`Artículo eliminado: ${a.codigo}`)
        try {
          await postJson('/articulos/delete', { uid: [a.uid] })
        } catch (e) {
          await agregarPendiente('articulos_delete', { uid: [a.uid] }, { motivo: 'delete_articulo' })
          showToast('Eliminación pendiente de sincronizar.', { type: 'warning' })
        }
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo eliminar el artículo', {
          type: 'error',
          title: 'Artículos'
        })
      }
    }
  }
}
</script>

<style scoped>
.art-view { display: flex; flex-direction: column; gap: 16px; }
.ficha-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}
.filtros { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.filtro { display: flex; flex-direction: column; gap: 4px; }
.filtro label, .field label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); }
.input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 8px 10px;
  font-size: 0.85rem;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}
.toolbar { display: flex; justify-content: flex-end; margin: 12px 0 8px; }
.count { color: var(--text-secondary); font-size: 0.8rem; }
.table-scroll { overflow-x: auto; }
.art-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.art-table th, .art-table td {
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--divider-weak);
  white-space: nowrap;
}
.art-table th { color: var(--text-secondary); font-size: 0.76rem; }
.art-table tr:last-child td { border-bottom: 0; }
.art-table .num { text-align: right; }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.fuerte { font-weight: 600; }
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
.btn-danger { color: var(--error); border-color: rgba(var(--error-rgb), 0.4); }
.empty-state { padding: 28px 12px; text-align: center; color: var(--text-secondary); font-size: 0.88rem; }
.ficha-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.ficha-head h3 { margin: 0 0 4px; font-size: 1.1rem; }
.muted { margin: 0; color: var(--text-secondary); font-size: 0.82rem; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 16px; border-bottom: 1px solid var(--divider-weak); }
.tab {
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  padding: 9px 12px;
  font-size: 0.82rem;
  cursor: pointer;
  font-family: inherit;
  border-bottom: 2px solid transparent;
}
.tab.active { color: var(--primary); font-weight: 600; border-bottom-color: var(--primary); }
.tab-body { padding-top: 16px; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-wide { grid-column: 1 / -1; }
.con-row { display: flex; gap: 8px; align-items: center; }
.con-row .input { flex: 1; }
.hint { color: var(--text-secondary); font-size: 0.73rem; }
.check-line { display: flex; align-items: center; gap: 7px; font-size: 0.84rem; }
.tab-pendiente { color: var(--text-secondary); font-size: 0.86rem; }
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 18px;
  width: min(560px, 92vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.modal h3 { margin: 0; font-size: 1rem; }
.modal-list { max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.modal-item {
  display: flex;
  gap: 10px;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text);
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  font-family: inherit;
}
.modal-item:hover { border-color: var(--primary); }
@media (max-width: 860px) {
  .filtros { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ficha-head { flex-direction: column; }
  .ficha-actions { justify-content: flex-start; }
}
@media (max-width: 620px) {
  .filtros, .grid { grid-template-columns: 1fr; }
}
</style>
