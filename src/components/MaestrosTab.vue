<template>
  <div class="maestros">
    <div class="section-header">
      <div>
        <h2>Maestros</h2>
        <p class="section-sub">Catálogos base del módulo de compras (offline en IndexedDB + sincronizados a PostgreSQL)</p>
      </div>
    </div>

    <!-- ===== Plan de Cuentas Contables ===== -->
    <section class="card">
      <div class="card-head">
        <div class="card-title">
          <h3>Plan de Cuentas Contables</h3>
          <p class="muted">Importa el archivo «Plan de Cuentas contables.xls» y siembra las cuentas jerárquicas.</p>
        </div>
        <button class="btn btn-primary" :disabled="loading" @click="pickFile">
          {{ loading ? 'Procesando…' : (cuentas.length ? 'Reimportar .xls / .xlsx' : 'Importar .xls / .xlsx') }}
        </button>
        <input ref="fileInput" type="file" accept=".xls,.xlsx" class="hidden-file" @change="onFileChange" />
      </div>

      <div v-if="error" class="error-box">&#9888; {{ error }}</div>
      <div v-if="notice" class="notice-box">{{ notice }}</div>
      <div v-if="estadoSync" class="sync-line" :class="estadoSync.kind">{{ estadoSync.text }}</div>

      <div v-if="stats" class="status-grid">
        <div class="stat"><b>{{ stats.total }}</b><span>cuentas</span></div>
        <div class="stat"><b>{{ stats.grupos }}</b><span>grupos</span></div>
        <div class="stat"><b>{{ stats.hojas }}</b><span>movimientos</span></div>
        <div class="stat"><b>{{ stats.porNivel[5] || 0 }}</b><span>nivel 5</span></div>
      </div>

      <div v-if="cuentas.length" class="toolbar">
        <input v-model="filtro" class="search-input" type="search" placeholder="Buscar por código o nombre…" />
        <select v-model="grupoFiltro" class="select-input">
          <option value="">Todos los grupos</option>
          <option v-for="g in grupos" :key="g.codigo" :value="g.codigo">{{ g.codigo }} {{ g.nombre }}</option>
        </select>
        <button class="btn" :disabled="geminiCuentasLoading || !cuentas.length" @click="auditarCuentas">
          {{ geminiCuentasLoading ? 'Auditando con Gemini…' : 'Auditar nombres (Gemini)' }}
        </button>
      </div>

      <div v-if="sugerencias.length" class="sugerencias">
        <h4>Correcciones sugeridas por Gemini</h4>
        <p class="muted">Revisa fila por fila y marca las que quieras aplicar. Nada se aplica sin tu confirmación.</p>
        <div class="table-scroll">
          <table class="cuentas-table">
            <thead>
              <tr><th>Código</th><th>Original</th><th>Sugerido</th><th>Motivo</th><th>Aplicar</th></tr>
            </thead>
            <tbody>
              <tr v-for="s in sugerencias" :key="s.codigo">
                <td class="mono">{{ s.codigo }}</td>
                <td class="tachado">{{ s.nombreOriginal }}</td>
                <td><b>{{ s.nombre }}</b><span v-if="s.certeza === 'baja'" class="tag-baja"> certeza baja</span></td>
                <td class="muted">{{ s.motivo }}</td>
                <td><input type="checkbox" v-model="aceptar[s.codigo]" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="sug-actions">
          <button class="btn" @click="sugerencias = []">Descartar todo</button>
          <button class="btn btn-primary" :disabled="!seleccionadas.length" @click="aplicarSugerencias">
            Aplicar {{ seleccionadas.length }} correcciones
          </button>
        </div>
      </div>

      <div v-if="cuentasFiltradas.length" class="table-scroll">
        <table class="cuentas-table">
          <thead>
            <tr><th>Código</th><th>Cuenta</th><th>Nivel</th><th>Mov.</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in cuentasFiltradas" :key="c.codigo" :class="{ 'is-parent': !c.esMovimiento }">
              <td class="mono">{{ c.codigo }}</td>
              <td :style="{ paddingLeft: ((c.nivel - 1) * 16) + 'px' }">{{ c.nombre }}</td>
              <td>{{ c.nivel }}</td>
              <td>{{ c.esMovimiento ? 'Sí' : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="cuentasFiltradas.length < cuentas.length" class="table-note">
          Mostrando {{ cuentasFiltradas.length }} de {{ cuentas.length }} cuentas
        </p>
      </div>

      <div v-else-if="!loading && !error" class="empty-state">
        <p>No hay plan de cuentas importado todavía.</p>
        <p class="muted">Usa el botón para cargar el archivo .xls del plan de cuentas.</p>
      </div>
    </section>

    <!-- ===== Conceptos de Retención ISLR ===== -->
    <section class="card">
      <div class="card-head">
        <div class="card-title">
          <h3>Conceptos de Retención ISLR</h3>
          <p class="muted">
            Maestro editable para proveedores. Retención = (base × % / 100) − (sustraendo × UT).
            Los valores son de partida; confirma la tabla oficial SENIAT vigente.
          </p>
        </div>
        <div class="btn-row">
          <button class="btn" :disabled="geminiConceptosLoading" @click="auditarConceptos">
            {{ geminiConceptosLoading ? 'Auditando…' : 'Auditar (Gemini)' }}
          </button>
          <button class="btn" @click="restaurarConceptos">Restaurar valores</button>
          <button class="btn btn-primary" @click="guardarConceptos">Guardar y sincronizar</button>
        </div>
      </div>

      <div v-if="hallazgos.length" class="hallazgos">
        <h4>Auditoría de consistencia (Gemini)</h4>
        <p v-for="(h, i) in hallazgos" :key="i" class="hallazgo" :class="h.nivel">
          {{ h.nivel === 'alerta' ? '&#9888;' : '&#9432;' }} {{ h.mensaje }}
        </p>
        <button class="btn" @click="hallazgos = []">Descartar</button>
      </div>

      <div v-if="conceptos.length" class="table-scroll">
        <table class="conceptos-table">
          <thead>
            <tr><th>Código</th><th>Concepto</th><th class="num">%</th><th class="num">Sustraendo (UT)</th><th class="num">Base mínima (UT)</th><th>Activo</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in conceptos" :key="c.codigo">
              <td><input v-model="c.codigo" class="field-input mono" /></td>
              <td><input v-model="c.nombre" class="field-input" /></td>
              <td class="num"><input v-model.number="c.porcentaje" type="number" min="0" max="100" step="0.01" class="field-input num-input" /></td>
              <td class="num"><input v-model.number="c.sustraendoUt" type="number" min="0" step="0.01" class="field-input num-input" /></td>
              <td class="num"><input v-model.number="c.baseMinimaUt" type="number" min="0" step="0.01" class="field-input num-input" /></td>
              <td><input v-model="c.activo" type="checkbox" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        <p>Sin conceptos cargados. Usa «Restaurar valores» para sembrar la lista por defecto.</p>
      </div>
    </section>

    <!-- ===== Parámetros del módulo ===== -->
    <section class="card">
      <div class="card-head">
        <div class="card-title">
          <h3>Parámetros del módulo</h3>
          <p class="muted">Empresa emisora, unidad tributaria y tasas. Se usan en comprobantes, retenciones y exportaciones.</p>
        </div>
        <button class="btn btn-primary" @click="guardarCfgParametros">Guardar y sincronizar</button>
      </div>

      <div class="param-grid">
        <div class="field">
          <label>Razón social</label>
          <input v-model="parametros.empresa.razonSocial" class="field-input" />
        </div>
        <div class="field">
          <label>RIF</label>
          <input v-model="parametros.empresa.rif" class="field-input mono" placeholder="JXXXXXXXXX" />
        </div>
        <div class="field">
          <label>Dirección</label>
          <input v-model="parametros.empresa.direccion" class="field-input" />
        </div>
        <div class="field">
          <label>Teléfono</label>
          <input v-model="parametros.empresa.telefono" class="field-input" />
        </div>
        <div class="field">
          <label>Actividad económica</label>
          <input v-model="parametros.empresa.actividadEconomica" class="field-input" />
        </div>
        <div class="field">
          <label>Unidad tributaria (Bs.)</label>
          <input v-model.number="parametros.unidadTributaria" type="number" min="0" step="0.01" class="field-input num-input" />
        </div>
        <div class="field">
          <label>Tasa IVA (%)</label>
          <input v-model.number="parametros.tasaIVA" type="number" min="0" step="0.01" class="field-input num-input" />
        </div>
        <div class="field">
          <label>Tasa IGTF (%)</label>
          <input v-model.number="parametros.tasaIGTF" type="number" min="0" step="0.01" class="field-input num-input" />
        </div>
      </div>
    </section>

    <section class="card muted-card">
      <div class="card-title">
        <h3>Proveedores</h3>
        <p class="muted">CRUD de proveedores (RIF SENIAT, % retención IVA, concepto ISLR, cuenta contable) en el siguiente incremento.</p>
      </div>
    </section>
  </div>
</template>

<script>
import { parsePlanDeCuentasBuf } from '../services/importAccounts'
import {
  saveCuentas,
  getCuentas,
  countCuentas,
  getParametro,
  setParametro,
  saveConceptos,
  getConceptos,
  agregarPendiente,
  listPendientes,
  borrarPendiente
} from '../stores/maestrosDb'
import { postJson } from '../utils/api'
import { hasApiKey } from '../utils/apiKey'
import { CONCEPTOS_ISLR_SEED } from '../services/conceptosIslr'
import { sanearCuentasConGemini, auditarConceptosConGemini } from '../services/sanearCatalogo'
import * as parametrosSvc from '../services/parametros'

const SYNC_HANDLERS = {
  accounts: '/accounts/sync',
  conceptos_islr: '/conceptos_islr/sync',
  parametros: '/parametros/sync'
}

function ordenarCuentas(list) {
  return [...list].sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
}

export default {
  name: 'MaestrosTab',
  data() {
    return {
      loading: false,
      error: '',
      notice: '',
      estadoSync: null,
      cuentas: [],
      filtro: '',
      grupoFiltro: '',
      sugerencias: [],
      aceptar: {},
      geminiCuentasLoading: false,
      conceptos: [],
      hallazgos: [],
      geminiConceptosLoading: false,
      parametros: parametrosSvc.mergeConDefecto(null)
    }
  },
  computed: {
    stats() {
      if (!this.cuentas.length) return null
      const porNivel = {}
      for (const c of this.cuentas) porNivel[c.nivel] = (porNivel[c.nivel] || 0) + 1
      return {
        total: this.cuentas.length,
        grupos: this.cuentas.filter(c => c.nivel === 1).length,
        hojas: this.cuentas.filter(c => c.esMovimiento).length,
        porNivel
      }
    },
    grupos() {
      return this.cuentas.filter(c => c.nivel === 1).map(c => ({ codigo: c.grupo || c.codigo, nombre: c.nombre }))
    },
    cuentasFiltradas() {
      const f = this.filtro.trim().toLowerCase()
      return this.cuentas.filter(c => {
        if (this.grupoFiltro && c.grupo !== this.grupoFiltro) return false
        if (!f) return true
        return String(c.codigo).toLowerCase().includes(f) || String(c.nombre).toLowerCase().includes(f)
      })
    },
    seleccionadas() {
      return this.sugerencias.filter(s => this.aceptar[s.codigo])
    }
  },
  async mounted() {
    await this.cargarLocales()
    await this.cargarConceptos()
    await this.cargarConfigParametros()
    await this.reintentarPendientes()
  },
  methods: {
    pickFile() {
      this.$refs.fileInput.click()
    },
    async onFileChange(e) {
      const file = e.target.files && e.target.files[0]
      e.target.value = ''
      if (!file) return
      this.error = ''
      this.notice = ''
      this.estadoSync = null
      this.loading = true
      try {
        const buf = await file.arrayBuffer()
        const { cuentas } = parsePlanDeCuentasBuf(buf)
        if (!cuentas.length) throw new Error('No se encontraron cuentas contables en el archivo')
        await saveCuentas(cuentas)
        this.cuentas = ordenarCuentas(await getCuentas())
        await setParametro('cuentasMeta', {
          fuente: file.name,
          fecha: new Date().toISOString(),
          total: cuentas.length
        })
        this.notice = `Importado correctamente: ${cuentas.length} cuentas guardadas en el dispositivo.`
        await this.sincronizar(cuentas)
      } catch (err) {
        this.error = (err && err.message) || 'Error al importar el plan de cuentas'
      } finally {
        this.loading = false
      }
    },
    async sincronizar(cuentas) {
      try {
        const res = await postJson('/accounts/sync', { cuentas })
        this.estadoSync = {
          kind: 'ok',
          text: `Sincronizado con PostgreSQL (${res.inserted || 0} nuevas, ${res.updated || 0} actualizadas).`
        }
      } catch (err) {
        this.estadoSync = {
          kind: 'warn',
          text: `Servidor no disponible: el catálogo quedó solo local y se reintentará más tarde.`
        }
        await agregarPendiente('accounts', { cuentas }, { motivo: 'sync_cuentas' })
      }
    },
    async reintentarPendientes() {
      const tipos = Object.keys(SYNC_HANDLERS)
      for (const tipo of tipos) {
        const pendientes = await listPendientes(tipo)
        if (!pendientes.length) continue
        for (const p of pendientes) {
          try {
            await postJson(SYNC_HANDLERS[tipo], p.payload)
            await borrarPendiente(p.id)
          } catch (e) {
            // sigue pendiente para el próximo intento
          }
        }
      }
    },
    async cargarLocales() {
      const total = await countCuentas()
      if (!total) return
      this.cuentas = ordenarCuentas(await getCuentas())
      const meta = await getParametro('cuentasMeta')
      if (meta) {
        const cuando = new Date(meta.fecha).toLocaleString()
        this.notice = `Última importación: ${meta.fuente} — ${meta.total} cuentas (${cuando}).`
      }
    },
    // ==== Gemini: saneamiento del catálogo (siempre con revisión humana) ====
    async auditarCuentas() {
      this.error = ''
      this.sugerencias = []
      if (!hasApiKey()) {
        this.error = 'Configura una API Key de Gemini en las herramientas primero.'
        return
      }
      this.geminiCuentasLoading = true
      try {
        const sugeridas = await sanearCuentasConGemini(this.cuentas)
        this.sugerencias = sugeridas
        this.aceptar = {}
        for (const s of sugeridas) this.aceptar[s.codigo] = s.certeza !== 'baja'
        this.notice = sugeridas.length
          ? `Gemini sugiere ${sugeridas.length} correcciones de nombres. Revisa antes de aplicar.`
          : 'Gemini no encontró nombres de cuentas que corregir. Catálogo consistente.'
      } catch (err) {
        this.error = (err && err.message) || 'Fallo al consultar Gemini'
      } finally {
        this.geminiCuentasLoading = false
      }
    },
    async aplicarSugerencias() {
      const elegidas = this.seleccionadas
      if (!elegidas.length) return
      const porCodigo = new Map(elegidas.map(s => [s.codigo, s.nombre]))
      for (const c of this.cuentas) {
        if (porCodigo.has(c.codigo)) c.nombre = porCodigo.get(c.codigo)
      }
      await saveCuentas(this.cuentas)
      this.notice = `Se aplicaron ${elegidas.length} correcciones de nombres al catálogo.`
      this.sugerencias = []
      this.aceptar = {}
      await this.sincronizar(this.cuentas)
    },
    // ==== Conceptos ISLR ====
    async cargarConceptos() {
      const locales = await getConceptos()
      this.conceptos = locales && locales.length
        ? locales.map(c => ({ ...c }))
        : CONCEPTOS_ISLR_SEED.map(c => ({ ...c }))
    },
    async guardarConceptos() {
      try {
        await saveConceptos(this.conceptos)
        this.notice = 'Conceptos ISLR guardados en el dispositivo.'
        try {
          const res = await postJson('/conceptos_islr/sync', { conceptos: this.conceptos })
          this.estadoSync = {
            kind: 'ok',
            text: `Conceptos sincronizados (${res.inserted || 0} nuevas, ${res.updated || 0} actualizados).`
          }
        } catch (err) {
          this.estadoSync = { kind: 'warn', text: 'Conceptos guardados localmente; la sincronización se reintentará más tarde.' }
          await agregarPendiente('conceptos_islr', { conceptos: this.conceptos }, { motivo: 'sync_conceptos_islr' })
        }
      } catch (err) {
        this.error = (err && err.message) || 'Error al guardar conceptos'
      }
    },
    async restaurarConceptos() {
      if (!window.confirm('¿Restaurar la lista por defecto de conceptos ISLR? Se reemplazarán los valores actuales.')) return
      this.conceptos = CONCEPTOS_ISLR_SEED.map(c => ({ ...c }))
      this.hallazgos = []
      await this.guardarConceptos()
    },
    async auditarConceptos() {
      this.hallazgos = []
      if (!hasApiKey()) {
        this.error = 'Configura una API Key de Gemini en las herramientas primero.'
        return
      }
      this.geminiConceptosLoading = true
      try {
        this.hallazgos = await auditarConceptosConGemini(this.conceptos)
        if (!this.hallazgos.length) {
          this.notice = 'La auditoría de Gemini no encontró inconsistencias en los conceptos.'
        }
      } catch (err) {
        this.error = (err && err.message) || 'Fallo al auditar con Gemini'
      } finally {
        this.geminiConceptosLoading = false
      }
    },
    // ==== Parámetros ====
    async cargarConfigParametros() {
      this.parametros = await parametrosSvc.cargarParametros()
    },
    async guardarCfgParametros() {
      try {
        await parametrosSvc.guardarParametros(this.parametros)
        this.notice = 'Parámetros guardados en el dispositivo.'
        try {
          const res = await postJson('/parametros/sync', { parametros: parametrosSvc.parametrosAArray(this.parametros) })
          this.estadoSync = {
            kind: 'ok',
            text: `Parámetros sincronizados (${res.inserted || 0} nuevos, ${res.updated || 0} actualizados).`
          }
        } catch (err) {
          this.estadoSync = { kind: 'warn', text: 'Parámetros guardados localmente; la sincronización se reintentará más tarde.' }
          await agregarPendiente('parametros', { parametros: parametrosSvc.parametrosAArray(this.parametros) }, { motivo: 'sync_parametros' })
        }
      } catch (err) {
        this.error = (err && err.message) || 'Error al guardar parámetros'
      }
    }
  }
}
</script>

<style scoped>
.maestros { max-width: 960px; margin: 0 auto; }

.section-header { margin-bottom: 12px; }
.section-header h2 { font-size: 1.1rem; color: var(--text); }
.section-sub { font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px; }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  margin-bottom: 14px;
}

.muted-card { opacity: 0.85; }

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.card-title h3 { font-size: 1rem; color: var(--text); margin-bottom: 2px; }
.muted { font-size: 0.8rem; color: var(--text-secondary); }

.btn-row { display: flex; gap: 8px; flex-wrap: wrap; }

.hidden-file { display: none; }

.btn {
  border: none;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  background: rgba(var(--primary-rgb), 0.08);
  color: var(--primary);
  transition: opacity 0.15s ease;
}

.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.error-box {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error);
  font-size: 0.85rem;
}

.notice-box {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(var(--primary-rgb), 0.08);
  color: var(--text);
  font-size: 0.85rem;
}

.sync-line {
  margin-top: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 0.82rem;
}

.sync-line.ok { background: rgba(var(--success-rgb), 0.12); color: var(--success); }
.sync-line.warn { background: rgba(var(--accent-rgb), 0.14); color: var(--accent); }

.status-grid {
  display: flex;
  gap: 12px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.stat {
  flex: 1 1 110px;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  text-align: center;
}

.stat b { display: block; font-size: 1.35rem; color: var(--text); }
.stat span { font-size: 0.72rem; color: var(--text-secondary); }

.toolbar {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1 1 220px;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 9px 12px;
  font-size: 0.85rem;
}

.select-input {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 9px 12px;
  font-size: 0.85rem;
}

.table-scroll { overflow-x: auto; margin-top: 14px; }

.cuentas-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.cuentas-table th {
  text-align: left;
  color: var(--text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  padding: 8px 10px;
}

.cuentas-table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--divider-weak);
  color: var(--text);
  vertical-align: top;
}

.cuentas-table tr.is-parent td { font-weight: 600; }
.cuentas-table tr:hover td { background: rgba(var(--primary-rgb), 0.04); }

.mono { font-family: 'Consolas', 'Menlo', monospace; white-space: nowrap; }
.table-note { font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px; text-align: center; }

.empty-state {
  text-align: center;
  padding: 32px 16px;
  margin-top: 14px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--text);
}

.sugerencias {
  margin-top: 14px;
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  border-radius: 10px;
  padding: 12px;
  background: rgba(var(--accent-rgb), 0.06);
}

.sugerencias h4 { font-size: 0.9rem; color: var(--text); margin-bottom: 2px; }

.tachado { text-decoration: line-through; color: var(--text-secondary); }
.tag-baja {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(var(--accent-rgb), 0.18);
  color: var(--accent);
}

.sug-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }

.hallazgos {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  background: var(--background);
}

.hallazgos h4 { font-size: 0.9rem; color: var(--text); margin-bottom: 6px; }

.hallazgo { font-size: 0.82rem; padding: 6px 8px; border-radius: 8px; margin-bottom: 6px; }
.hallazgo.info { background: rgba(var(--primary-rgb), 0.08); color: var(--text); }
.hallazgo.alerta { background: rgba(var(--error-rgb), 0.1); color: var(--error); }
.hallazgos .btn { margin-top: 6px; }

.conceptos-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.conceptos-table th {
  text-align: left;
  color: var(--text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  padding: 8px 10px;
}

.conceptos-table th.num, .conceptos-table td.num { text-align: center; }

.conceptos-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--divider-weak);
  color: var(--text);
}

.field-input {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 7px 9px;
  font-size: 0.82rem;
  width: 100%;
  min-width: 90px;
}

.num-input { width: 90px; text-align: right; }

.param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.field label {
  display: block;
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
</style>