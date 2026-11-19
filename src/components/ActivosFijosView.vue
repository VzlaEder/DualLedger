<template>
  <div class="af-view">
    <div class="af-head">
      <div>
        <h2>Activos Fijos</h2>
        <p class="sub">
          Registro, control y depreciación del activo fijo de la empresa. La depreciación se calcula
          en forma derivada; no se guarda como dato. Las cuentas contables vinculan cada activo con
          el plan de cuentas.
        </p>
      </div>
      <div class="head-actions">
        <button class="btn" :disabled="cargando" @click="cargar">Recargar</button>
        <button class="btn" :disabled="!filtrados.length" @click="exportar">Exportar Excel (CSV)</button>
        <button class="btn btn-primary" :disabled="!filtrados.length" @click="imprimir">Imprimir</button>
        <button v-if="!editando" class="btn btn-primary" @click="nuevo">+ Nuevo</button>
      </div>
    </div>

    <!-- ===== Listado ===== -->
    <template v-if="!editando">
      <div class="card filtros">
        <div class="filtros-grid">
          <div class="field">
            <label>Categoría</label>
            <select v-model="filtros.categoria" class="input">
              <option value="">Todas</option>
              <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="field">
            <label>Estado</label>
            <select v-model="filtros.estado" class="input">
              <option value="">Todos</option>
              <option v-for="e in estados" :key="e" :value="e">{{ e }}</option>
            </select>
          </div>
          <div class="field">
            <label>Cuenta contable</label>
            <select v-model="filtros.cuenta" class="input">
              <option value="">Todas</option>
              <option v-for="c in cuentasConActivos" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="field">
            <label>Depreciación al</label>
            <input v-model="filtros.hasta" class="input" type="date" />
          </div>
          <div class="field field-wide">
            <label>Buscar</label>
            <input
              v-model="filtros.busqueda"
              class="input"
              type="search"
              placeholder="Código, descripción, proveedor, RIF, factura…"
            />
          </div>
        </div>
        <div class="atajos">
          <span class="atajos-label">Atajos:</span>
          <button class="btn btn-small" @click="soloActivos">Solo activos</button>
          <button class="btn btn-small" @click="hoy">Hoy</button>
          <button class="btn btn-small" @click="limpiarFiltros">Limpiar filtros</button>
          <span class="resultado">{{ filtrados.length }} de {{ activos.length }} activos</span>
        </div>
      </div>

      <div v-if="cargando" class="card empty-state">Cargando activos fijos…</div>

      <template v-else>
        <div class="resumen">
          <div class="metrica destacada">
            <span>Valor neto en libros</span>
            <strong>Bs {{ dinero(resumen.valorNeto) }}</strong>
          </div>
          <div class="metrica">
            <span>Costo total</span>
            <strong>Bs {{ dinero(resumen.costo) }}</strong>
          </div>
          <div class="metrica">
            <span>Depreciación acumulada</span>
            <strong>Bs {{ dinero(resumen.depreciacion) }}</strong>
          </div>
          <div class="metrica">
            <span>Activos registrados</span>
            <strong>{{ resumen.cantidad }}</strong>
          </div>
          <div class="metrica">
            <span>En uso</span>
            <strong>{{ resumen.activos }}</strong>
          </div>
          <div class="metrica">
            <span>Dados de baja</span>
            <strong>{{ resumen.dadosDeBaja }}</strong>
          </div>
        </div>

        <div class="card">
          <div v-if="!filtrados.length" class="empty-state">
            <p v-if="activos.length">No hay activos que coincidan con los filtros.</p>
            <p v-else>
              Todavía no hay activos registrados. Pulsa «+ Nuevo» para abrir la ficha de alta.
            </p>
          </div>
          <div v-else class="table-scroll">
            <table class="af-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Adquisición</th>
                  <th class="num">Costo</th>
                  <th class="num">Dep. acum.</th>
                  <th class="num">Valor neto</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in filtrados" :key="a.uid">
                  <td class="mono">{{ a.codigo }}</td>
                  <td class="fuerte">
                    {{ a.descripcion }}
                    <small v-if="a.ubicacion" class="subcelda">{{ a.ubicacion }}</small>
                  </td>
                  <td>{{ a.categoria }}</td>
                  <td>{{ fechaMostrar(a.fechaAdquisicion) }}</td>
                  <td class="num">{{ dinero(costoTotal(a)) }}</td>
                  <td class="num">{{ dinero(depreciacionAcumulada(a, filtros.hasta)) }}</td>
                  <td class="num fuerte">{{ dinero(valorNeto(a, filtros.hasta)) }}</td>
                  <td>
                    <span class="pill" :class="claseEstado(a.estado)">{{ a.estado }}</span>
                  </td>
                  <td class="row-actions">
                    <button class="btn" @click="verDepreciacion(a)">Depreciación</button>
                    <button class="btn" @click="editar(a)">Editar</button>
                    <button class="btn btn-danger" @click="eliminar(a)">Eliminar</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>

    <!-- ===== Ficha: agregar o modificar activo ===== -->
    <div v-else class="card ficha">
      <div class="ficha-head">
        <div>
          <h3>{{ esNuevo ? 'Nuevo activo fijo' : 'Modificar activo fijo' }}</h3>
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
          <button class="btn" :disabled="guardando" @click="cancelar">Buscar</button>
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

      <!-- Pestaña Datos -->
      <div v-if="tab === 'datos'" class="tab-body">
        <div class="grid">
          <div class="field">
            <label>Código *</label>
            <div class="con-row">
              <input v-model="editando.codigo" class="input mono" placeholder="AF-000001" />
              <button class="btn" type="button" @click="sugerirCodigo">Generar</button>
            </div>
          </div>
          <div class="field">
            <label>Categoría *</label>
            <select v-model="editando.categoria" class="input">
              <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="field field-wide">
            <label>Descripción *</label>
            <input v-model="editando.descripcion" class="input" placeholder="Descripción del activo" />
          </div>
          <div class="field">
            <label>Fecha de adquisición *</label>
            <input v-model="editando.fechaAdquisicion" class="input" type="date" />
          </div>
          <div class="field">
            <label>Fecha de puesta en servicio</label>
            <input v-model="editando.fechaPuestaEnServicio" class="input" type="date" />
            <small class="hint">Si se deja vacía se usa la fecha de adquisición.</small>
          </div>
          <div class="field">
            <label>Proveedor</label>
            <input v-model="editando.proveedor" class="input" placeholder="Nombre del proveedor" />
          </div>
          <div class="field">
            <label>RIF del proveedor</label>
            <input v-model="editando.rifProveedor" class="input mono" placeholder="J-00000000-0" />
          </div>
          <div class="field">
            <label>Número de factura</label>
            <input v-model="editando.numeroFactura" class="input" />
          </div>
          <div class="field">
            <label>Estado</label>
            <select v-model="editando.estado" class="input">
              <option v-for="e in estados" :key="e" :value="e">{{ e }}</option>
            </select>
          </div>
          <div class="field">
            <label>Ubicación</label>
            <input v-model="editando.ubicacion" class="input" placeholder="Ej. Almacén principal" />
          </div>
          <div class="field">
            <label>Responsable</label>
            <input v-model="editando.responsable" class="input" />
          </div>
          <div class="field field-wide">
            <label>Observaciones</label>
            <textarea v-model="editando.observaciones" class="input" rows="2"></textarea>
          </div>
        </div>
      </div>

      <!-- Pestaña Depreciación -->
      <div v-else-if="tab === 'depreciacion'" class="tab-body">
        <div class="grid">
          <div class="field">
            <label>Costo de adquisición *</label>
            <input v-model.number="editando.costoAdquisicion" class="input" type="number" min="0" step="0.01" />
          </div>
          <div class="field">
            <label>Gastos capitalizables</label>
            <input v-model.number="editando.gastosCapitalizables" class="input" type="number" min="0" step="0.01" />
            <small class="hint">Flete, instalación, impuestos no recuperables, etc.</small>
          </div>
          <div class="field">
            <label>Valor residual</label>
            <input v-model.number="editando.valorResidual" class="input" type="number" min="0" step="0.01" />
          </div>
          <div class="field">
            <label>Vida útil (años)</label>
            <input v-model.number="editando.vidaUtilAnos" class="input" type="number" min="0" max="50" step="1" />
          </div>
          <div class="field">
            <label>Método de depreciación</label>
            <select v-model="editando.metodoDepreciacion" class="input">
              <option v-for="m in metodos" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
          <div class="field">
            <label>Tasa anual % (opcional)</label>
            <input
              v-model.number="editando.tasaDepreciacionAnual"
              class="input"
              type="number"
              min="0"
              max="100"
              step="0.0001"
            />
            <small class="hint">En blanco se deriva de la vida útil y el método.</small>
          </div>
        </div>

        <div class="resumen interna">
          <div class="metrica"><span>Costo total</span><strong>Bs {{ dinero(costoTotal(editando)) }}</strong></div>
          <div class="metrica"><span>Base depreciable</span><strong>Bs {{ dinero(baseDepreciable(editando)) }}</strong></div>
          <div class="metrica"><span>Tasa anual efectiva</span><strong>{{ dinero(tasaAnual(editando)) }} %</strong></div>
          <div class="metrica"><span>Depreciación mensual</span><strong>Bs {{ dinero(depreciacionMensual(editando)) }}</strong></div>
          <div class="metrica"><span>Depreciación acumulada</span><strong>Bs {{ dinero(depreciacionAcumulada(editando)) }}</strong></div>
          <div class="metrica destacada"><span>Valor neto</span><strong>Bs {{ dinero(valorNeto(editando)) }}</strong></div>
        </div>

        <div v-if="tablaDepreciacion(editando).length" class="tabla-anual">
          <h4>Tabla anual de depreciación</h4>
          <div class="table-scroll">
            <table class="af-table">
              <thead>
                <tr>
                  <th>Año</th>
                  <th class="num">Depreciación</th>
                  <th class="num">Acumulada</th>
                  <th class="num">Valor neto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="f in tablaDepreciacion(editando)" :key="f.anio">
                  <td>{{ f.anio }}</td>
                  <td class="num">{{ dinero(f.depreciacion) }}</td>
                  <td class="num">{{ dinero(f.acumulada) }}</td>
                  <td class="num">{{ dinero(f.valorNeto) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-else class="muted nota">
          Este activo no genera depreciación (categoría «Terrenos», método «No deprecia» o vida útil
          no definida).
        </p>
      </div>

      <!-- Pestaña Contabilidad -->
      <div v-else class="tab-body">
        <div class="grid">
          <div class="field field-wide">
            <label>Cuenta del activo</label>
            <AccountSelector v-model="editando.cuentaActivo" :cuentas="cuentas" placeholder="Seleccione…" />
            <small class="hint">Cuenta de activo fijo en el plan de cuentas contables.</small>
          </div>
          <div class="field field-wide">
            <label>Cuenta de depreciación acumulada</label>
            <AccountSelector
              v-model="editando.cuentaDepreciacionAcumulada"
              :cuentas="cuentas"
              placeholder="Seleccione…"
            />
          </div>
          <div class="field field-wide">
            <label>Cuenta de gasto por depreciación</label>
            <AccountSelector
              v-model="editando.cuentaGastoDepreciacion"
              :cuentas="cuentas"
              placeholder="Seleccione…"
            />
          </div>
          <div class="field field-wide">
            <label>Centro de costo</label>
            <input v-model="editando.centroCosto" class="input mono" placeholder="Ej. 5.1.01" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AccountSelector from './AccountSelector.vue'
import { getJson, postJson } from '../utils/api.js'
import { showAlert, showConfirm, showToast } from '../utils/dialog.js'
import { agregarPendiente, getCuentas } from '../stores/maestrosDb.js'
import { getActivosFijos, saveActivosFijos } from '../stores/activosFijosDb.js'
import { generarUid } from '../stores/comprasDb.js'
import {
  CATEGORIAS_ACTIVO_FIJO,
  ESTADOS_ACTIVO_FIJO,
  METODOS_DEPRECIACION,
  activoFijoVacio,
  baseDepreciable,
  codigoActivoFijo,
  costoTotal,
  csvActivosFijos,
  depreciacionAcumulada,
  depreciacionMensual,
  filtrarActivosFijos,
  filtrosActivosFijosVacios,
  hoyISO,
  normalizarActivoFijo,
  resumenActivosFijos,
  tasaAnual,
  tablaDepreciacion,
  validarActivoFijo,
  valorNeto,
  valoresUnicosActivos
} from '../services/activosFijos.js'

export default {
  name: 'ActivosFijosView',
  components: { AccountSelector },
  data() {
    return {
      activos: [],
      cuentas: [],
      cargando: false,
      guardando: false,
      filtros: { ...filtrosActivosFijosVacios(), hasta: hoyISO() },
      editando: null,
      esNuevo: false,
      tab: 'datos'
    }
  },
  computed: {
    pestañas() {
      return [
        { id: 'datos', label: 'Datos del activo' },
        { id: 'depreciacion', label: 'Depreciación' },
        { id: 'contabilidad', label: 'Contabilidad' }
      ]
    },
    categorias() {
      return CATEGORIAS_ACTIVO_FIJO
    },
    metodos() {
      return METODOS_DEPRECIACION
    },
    estados() {
      return ESTADOS_ACTIVO_FIJO
    },
    filtrados() {
      return filtrarActivosFijos(this.activos, this.filtros)
    },
    resumen() {
      return resumenActivosFijos(this.filtrados, this.filtros.hasta)
    },
    cuentasConActivos() {
      return valoresUnicosActivos(this.activos, 'cuentaActivo')
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    costoTotal,
    baseDepreciable,
    tasaAnual,
    depreciacionAcumulada,
    depreciacionMensual,
    valorNeto,
    tablaDepreciacion,
    dinero(v) {
      const n = Number(v)
      if (!isFinite(n)) return '0,00'
      return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    fechaMostrar(fecha) {
      if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return '—'
      const [y, m, d] = fecha.split('-')
      return `${d}/${m}/${y}`
    },
    claseEstado(estado) {
      if (estado === 'Activo') return 'pill-ok'
      if (estado === 'En mantenimiento') return 'pill-warn'
      return 'pill-off'
    },
    async cargar() {
      this.cargando = true
      try {
        const [locales, cuentas] = await Promise.all([
          getActivosFijos().catch(() => []),
          getCuentas().catch(() => [])
        ])
        this.cuentas = cuentas || []
        if (locales && locales.length) {
          this.activos = locales
        } else {
          try {
            const res = await getJson('/activos-fijos')
            this.activos = (res && res.activos) || []
          } catch (e) {
            this.activos = []
          }
          if (this.activos.length) await saveActivosFijos(this.activos).catch(() => {})
        }
      } finally {
        this.cargando = false
      }
    },
    nuevo() {
      this.editando = {
        ...activoFijoVacio(),
        uid: generarUid('af'),
        codigo: codigoActivoFijo(this.activos.length),
        fechaAdquisicion: hoyISO()
      }
      this.esNuevo = true
      this.tab = 'datos'
    },
    sugerirCodigo() {
      this.editando.codigo = codigoActivoFijo(this.activos.length)
    },
    editar(a) {
      this.editando = { ...activoFijoVacio(), ...a }
      this.esNuevo = false
      this.tab = 'datos'
    },
    verDepreciacion(a) {
      this.editar(a)
      this.tab = 'depreciacion'
    },
    cancelar() {
      this.editando = null
      this.esNuevo = false
    },
    salir() {
      this.cancelar()
    },
    async guardar() {
      const mensaje = validarActivoFijo(this.editando, {
        existentes: this.activos,
        esNuevo: this.esNuevo
      })
      if (mensaje) {
        await showAlert(mensaje, { type: 'warning', title: 'Revisa el activo fijo' })
        return
      }

      const record = normalizarActivoFijo(this.editando)
      if (!record.uid) record.uid = generarUid('af')
      const lista = [...this.activos]
      const idx = lista.findIndex((a) => a.uid === record.uid)
      if (idx >= 0) lista[idx] = record
      else lista.push(record)

      this.guardando = true
      try {
        await saveActivosFijos(lista)
        this.activos = lista
        showToast(`Activo fijo guardado: ${record.codigo}`)
        await this.sincronizar(lista)
        this.cancelar()
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo guardar el activo fijo', {
          type: 'error',
          title: 'Activos Fijos'
        })
      } finally {
        this.guardando = false
      }
    },
    async sincronizar(lista) {
      try {
        const res = await postJson('/activos-fijos/sync', { activos: lista })
        showToast(`Sincronizado (${res.inserted || 0} nuevos, ${res.updated || 0} actualizados).`)
      } catch (e) {
        await agregarPendiente('activosFijos', { activos: lista }, { motivo: 'sync_activos_fijos' })
        showToast('Guardado localmente; sincronización pendiente.', { type: 'warning' })
      }
    },
    async eliminar(a) {
      const ok = await showConfirm(
        `¿Eliminar el activo ${a.codigo} (${a.descripcion})?`,
        { title: 'Eliminar activo fijo', confirmText: 'Eliminar', danger: true }
      )
      if (!ok) return

      const lista = this.activos.filter((x) => x.uid !== a.uid)
      try {
        await saveActivosFijos(lista)
        this.activos = lista
        if (this.editando && this.editando.uid === a.uid) this.cancelar()
        showToast(`Activo eliminado: ${a.codigo}`)
        try {
          await postJson('/activos-fijos/delete', { uid: [a.uid] })
        } catch (e) {
          await agregarPendiente('activosFijos_delete', { uid: [a.uid] }, { motivo: 'delete_activo_fijo' })
          showToast('Eliminación pendiente de sincronizar.', { type: 'warning' })
        }
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo eliminar el activo fijo', {
          type: 'error',
          title: 'Activos Fijos'
        })
      }
    },
    soloActivos() {
      this.filtros = { ...this.filtros, estado: 'Activo' }
    },
    hoy() {
      this.filtros = { ...this.filtros, hasta: hoyISO() }
    },
    limpiarFiltros() {
      this.filtros = { ...filtrosActivosFijosVacios(), hasta: hoyISO() }
    },
    esc(v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    },
    exportar() {
      if (!this.filtrados.length) {
        showToast('No hay activos para exportar con los filtros actuales.', { type: 'warning' })
        return
      }
      const blob = new Blob([csvActivosFijos(this.filtrados, this.filtros.hasta)], {
        type: 'text/csv;charset=utf-8'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'activos-fijos.csv'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Activos fijos exportados a Excel (CSV).')
    },
    imprimir() {
      if (!this.filtrados.length) {
        showToast('No hay activos para imprimir con los filtros actuales.', { type: 'warning' })
        return
      }
      const filas = this.filtrados.map((a) => `<tr>
        <td>${this.esc(a.codigo)}</td>
        <td>${this.esc(a.descripcion)}</td>
        <td>${this.esc(a.categoria)}</td>
        <td>${this.esc(this.fechaMostrar(a.fechaAdquisicion))}</td>
        <td class="num">${this.esc(this.dinero(costoTotal(a)))}</td>
        <td class="num">${this.esc(this.dinero(depreciacionAcumulada(a, this.filtros.hasta)))}</td>
        <td class="num">${this.esc(this.dinero(valorNeto(a, this.filtros.hasta)))}</td>
        <td>${this.esc(a.estado)}</td>
      </tr>`).join('')
      const r = this.resumen
      const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Activos fijos</title>
<style>
body{font-family:Arial,sans-serif;color:#222;margin:24px;font-size:12px}
h1{font-size:17px;text-align:center;margin:0 0 4px}
.sub{text-align:center;color:#555;margin:0 0 18px}
table{border-collapse:collapse;width:100%;margin-bottom:14px}
th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}
th{background:#eee;font-size:11px}
.num{text-align:right}
.total{font-weight:bold;background:#f6f6f6}
</style></head><body>
<h1>Activos fijos</h1>
<p class="sub">Depreciación calculada al ${this.esc(this.fechaMostrar(this.filtros.hasta))}</p>
<table><thead><tr>
<th>Código</th><th>Descripción</th><th>Categoría</th><th>Adquisición</th>
<th>Costo</th><th>Dep. acum.</th><th>Valor neto</th><th>Estado</th>
</tr></thead><tbody>${filas}</tbody>
<tfoot><tr class="total">
<td colspan="4">Totales (${r.cantidad} activos)</td>
<td class="num">${this.esc(this.dinero(r.costo))}</td>
<td class="num">${this.esc(this.dinero(r.depreciacion))}</td>
<td class="num">${this.esc(this.dinero(r.valorNeto))}</td>
<td></td>
</tr></tfoot></table>
</body></html>`
      const w = window.open('', '_blank')
      if (!w) {
        showToast('El navegador bloqueó la ventana de impresión.', { type: 'warning' })
        return
      }
      w.document.write(html)
      w.document.close()
      w.focus()
      w.print()
    }
  }
}
</script>

<style scoped>
.af-view { display: flex; flex-direction: column; gap: 16px; }
.af-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.af-head h2 { margin: 0 0 4px; font-size: 1.35rem; }
.sub { margin: 0; color: var(--text-secondary); font-size: 0.88rem; max-width: 680px; }
.head-actions, .ficha-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}
.filtros-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-wide { grid-column: 1 / -1; }
.field label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); }
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
.hint { color: var(--text-secondary); font-size: 0.73rem; }
.atajos { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.atajos-label { color: var(--text-secondary); font-size: 0.78rem; }
.resultado { margin-left: auto; color: var(--text-secondary); font-size: 0.8rem; }
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
.btn-small { padding: 5px 9px; font-size: 0.76rem; }
.btn:hover:not(:disabled) { border-color: var(--primary); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn-danger { color: var(--error); border-color: rgba(var(--error-rgb), 0.4); }
.resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
.resumen.interna { margin-top: 18px; }
.metrica {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.metrica span { color: var(--text-secondary); font-size: 0.75rem; }
.metrica strong { font-size: 1.1rem; }
.metrica.destacada { border-color: var(--primary); }
.table-scroll { overflow-x: auto; margin-top: 12px; }
.af-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
.af-table th, .af-table td {
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--divider-weak);
  white-space: nowrap;
}
.af-table th { color: var(--text-secondary); font-size: 0.76rem; }
.af-table tr:last-child td { border-bottom: 0; }
.af-table .num { text-align: right; }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.fuerte { font-weight: 600; }
.subcelda { display: block; color: var(--text-secondary); font-size: 0.72rem; }
.row-actions { display: flex; gap: 6px; }
.pill { border-radius: 999px; padding: 3px 9px; font-size: 0.72rem; border: 1px solid var(--border); }
.pill-ok { color: #1b7f4b; border-color: rgba(27, 127, 75, 0.4); }
.pill-warn { color: #a86a00; border-color: rgba(168, 106, 0, 0.4); }
.pill-off { color: var(--text-secondary); }
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
.con-row { display: flex; gap: 8px; align-items: center; }
.con-row .input { flex: 1; }
.tabla-anual { margin-top: 18px; }
.tabla-anual h4 { margin: 0; font-size: 0.9rem; }
.nota { margin-top: 16px; }
@media (max-width: 980px) { .filtros-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) {
  .filtros-grid, .grid { grid-template-columns: 1fr; }
  .af-head, .ficha-head { flex-direction: column; }
  .head-actions, .ficha-actions { justify-content: flex-start; }
}
</style>
