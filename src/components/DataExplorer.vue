<template>
  <div class="data-explorer">
    <div class="de-header">
      <div class="de-title">
        <h2>&#128451; Base de datos</h2>
        <span class="de-subtitle">Explorador provisional (ver, editar, extraer y eliminar)</span>
      </div>
      <div class="de-header-actions">
        <span v-if="status" class="de-status" :class="{ ok: !!status.pool }">
          <span class="dot" :class="status.pool ? 'dot-ok' : 'dot-err'"></span>
          {{ status.pool ? 'PostgreSQL conectado' : 'Base de datos no levantada' }}
        </span>
        <template v-if="status && status.pool">
          <button class="btn btn-outline" @click="refreshAll" :disabled="loading">&#128260; Refrescar</button>
          <button class="btn btn-outline" @click="volume" v-if="status.docker !== false">&#128190; Detener BD</button>
        </template>
        <template v-else>
          <button class="btn btn-primary" @click="startDb" :disabled="startingDb">&#9650; Levantar base de datos</button>
          <button class="btn btn-outline" @click="$emit('open-tools')">&#9881; Herramientas</button>
        </template>
      </div>
    </div>

    <div v-if="booting" class="de-empty">
      <div class="de-spinner"></div>
      <p>Comprobando la base de datos...</p>
    </div>

    <div v-else-if="error" class="error-box">&#9888; {{ error }}</div>

    <div v-else-if="!status || !status.pool" class="de-empty">
      <p class="de-empty-title">&#127976; La base de datos aún no está levantada</p>
      <p class="de-empty-hint">
        Esto es provisional (mientras sale la versión oficial con dominio). Pulsa
        <strong>Levantar base de datos</strong> para arrancar PostgreSQL local vía Docker
        y aplicar el esquema, o usa <strong>Herramientas &#8594; Base de datos</strong>
        para conectar una DATABASE_URL externa.
      </p>
    </div>

    <div v-else class="de-layout">
      <aside class="de-sidebar">
        <div class="de-sidebar-header">Tablas</div>
        <button
          v-for="t in tables"
          :key="t.name"
          class="de-tab-item"
          :class="{ active: t.name === current }"
          @click="openTable(t.name)"
        >
          <span class="de-tab-name">&#128196; {{ t.name }}</span>
          <span class="de-tab-badge">{{ t.rows }}</span>
        </button>
        <div v-if="!tables.length" class="de-sidebar-empty">No hay tablas (aplica el esquema levantando la BD).</div>
      </aside>

      <section class="de-main">
        <div v-if="!current || !table" class="de-empty">
          <p>Selecciona una tabla de la lista.</p>
        </div>

        <template v-else>
          <div class="de-toolbar">
            <div class="de-tb-left">
              <strong class="de-table-name">{{ current }}</strong>
              <span class="de-total">{{ total }} registro(s)</span>
            </div>
            <div class="de-tb-actions">
              <button class="btn btn-small" @click="refreshCurrent">&#128260;</button>
              <button class="btn btn-small btn-primary" @click="openInsert">&#43; Insertar</button>
              <span class="de-menu">
                <button class="btn btn-small" @click="toggleMenu('export')">
                  &#128229; Exportar <span class="caret">&#9662;</span>
                </button>
                <div v-if="openMenu === 'export'" class="de-menu-box">
                  <button @click="doExport('csv')">CSV (tabla)</button>
                  <button @click="doExport('json')">JSON (tabla)</button>
                  <button @click="doExport('sql')">SQL INSERTs (tabla)</button>
                  <button @click="doExport('sql', true)">SQL compelta (toda la BD)</button>
                  <button @click="doExport('json', true)">JSON (toda la BD)</button>
                </div>
              </span>
              <span class="de-menu">
                <button class="btn btn-small" @click="toggleMenu('import')">
                  &#128190; Importar <span class="caret">&#9662;</span>
                </button>
                <div v-if="openMenu === 'import'" class="de-menu-box">
                  <button @click="pickFile('csv')">CSV a esta tabla</button>
                  <button @click="pickFile('json')">JSON a esta tabla</button>
                  <button @click="pickFileSql">Script SQL (toda la BD)</button>
                </div>
              </span>
              <button class="btn btn-small btn-danger" :disabled="!selectedCount" @click="removeSelected">
                &#128465; Eliminar ({{ selectedCount }})
              </button>
            </div>
          </div>

          <div class="de-table-wrap">
            <table class="de-table">
              <thead>
                <tr>
                  <th class="de-tick">
                    <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
                  </th>
                  <th
                    v-for="c in visibleColumns"
                    :key="c.name"
                    class="de-col"
                    :class="{ 'de-pk': c.isPk }"
                    :title="`${c.name} (${c.dataType})`"
                    @click="sortBy(c)"
                  >
                    {{ c.name }}
                    <span v-if="order === c.name" class="de-sort">&#9662;</span>
                    <span v-else-if="c.isPk" class="de-key">&#128273;</span>
                  </th>
                  <th class="de-actions-th">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in rows" :key="rowKey(row)" :class="{ selected: selected.has(i) }">
                  <td class="de-tick">
                    <input type="checkbox" :checked="selected.has(i)" @change="toggleSelect(i)" />
                  </td>
                  <td
                    v-for="c in visibleColumns"
                    :key="c.name"
                    class="de-cell"
                    :class="{ 'de-pk': c.isPk }"
                  >
                    <code>{{ cellText(row[c.name]) }}</code>
                  </td>
                  <td class="de-row-actions">
                    <button class="btn btn-mini" title="Editar" @click="openEdit(row)">&#9998;</button>
                    <button class="btn btn-mini btn-danger" title="Eliminar" @click="removeOne(row)">&#128465;</button>
                  </td>
                </tr>
                <tr v-if="!rows.length">
                  <td :colspan="visibleColumns.length + 2" class="de-no-rows">
                    Sin registros en esta tabla.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="de-pager">
            <span>Filas por página:</span>
            <select v-model.number="limit" @change="onPageSize">
              <option :value="25">25</option>
              <option :value="100">100</option>
              <option :value="250">250</option>
              <option :value="500">500</option>
            </select>
            <button class="btn btn-mini" :disabled="offset <= 0" @click="prevPage">&#9664; Anterior</button>
            <span class="de-range">
              {{ offset + 1 }}&ndash;{{ Math.min(offset + limit, total) }} de {{ total }}
            </span>
            <button class="btn btn-mini" :disabled="offset + limit >= total" @click="nextPage">Siguiente &#9654;</button>
          </div>
        </template>
      </section>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".csv,.json,.sql,.txt"
      class="hidden-file"
      @change="onFilePicked"
    />

    <div v-if="editor" class="modal-overlay" @click.self="closeEditor">
      <div class="modal de-editor">
        <div class="modal-header">
          <h3>{{ editor.mode === 'insert' ? 'Insertar fila' : 'Editar fila' }} &mdash; {{ current }}</h3>
          <button class="modal-close" @click="closeEditor">&#10005;</button>
        </div>
        <div class="de-editor-body">
          <div v-for="c in editableColumns" :key="c.name" class="de-field">
            <label>
              {{ c.name }}
              <span class="de-field-type">
                {{ c.dataType }}{{ c.isPk ? ' · PK' : '' }}{{ c.isNullable || c.isPk ? '' : ' · obligatorio' }}
              </span>
            </label>
            <input
              v-if="isNumber(c)"
              type="number"
              step="any"
              :placeholder="c.isNullable ? '(vacío)' : 'obligatorio'"
              v-model.number="editor.row[c.name]"
            />
            <input
              v-else-if="isBool(c)"
              type="checkbox"
              v-model="editor.row[c.name]"
            />
            <textarea
              v-else-if="isJson(c)"
              rows="3"
              :placeholder="c.isNullable ? '(vacío)' : 'JSON obligatorio'"
              :value="jsonText(c, editor.row[c.name])"
              @input="setJson(c.name, $event.target.value)"
            ></textarea>
            <input
              v-else
              type="text"
              :disabled="c.isPk && editor.mode === 'edit'"
              :placeholder="c.isNullable ? '(vacío)' : 'obligatorio'"
              v-model="editor.row[c.name]"
            />
          </div>
        </div>
        <div v-if="editorError" class="error-box">&#9888; {{ editorError }}</div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="closeEditor">Cancelar</button>
          <button class="btn btn-primary" @click="saveEditor" :disabled="editorSaving">
            {{ editorSaving ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  getStatus,
  getTables,
  getTableData,
  insertRow,
  updateRow,
  deleteRows,
  dbUp,
  dbDown,
  importInto,
  importSql,
  downloadUrl,
  exportTableUrl,
  exportAllUrl
} from '../services/apiAdmin'
import { showConfirm, showToast } from '../utils/dialog'

const AUTO_COLS = new Set(['created_at', 'updated_at'])

export default {
  name: 'DataExplorer',
  emits: ['open-tools'],
  data() {
    return {
      status: null,
      booting: true,
      startingDb: false,
      tables: [],
      current: null,
      table: null,
      rows: [],
      total: 0,
      limit: 100,
      offset: 0,
      order: null,
      loading: false,
      error: '',
      selected: new Set(),
      openMenu: '',
      fileJob: null,
      editor: null,
      editorError: '',
      editorSaving: false,
      pollTimer: null
    }
  },
  computed: {
    visibleColumns() {
      return this.table ? this.table.columns : []
    },
    editableColumns() {
      if (!this.table) return []
      return this.table.columns.filter((c) => {
        if (this.editor && this.editor.mode === 'insert' && AUTO_COLS.has(c.name)) return false
        if (AUTO_COLS.has(c.name)) return false
        return true
      })
    },
    selectedCount() {
      return this.selected.size
    },
    allSelected() {
      return this.rows.length > 0 && this.selected.size >= this.rows.length
    }
  },
  async mounted() {
    await this.boot()
    this.pollTimer = setInterval(() => this.pollStatus(), 6000)
  },
  beforeUnmount() {
    if (this.pollTimer) clearInterval(this.pollTimer)
  },
  methods: {
    async boot() {
      this.booting = true
      this.error = ''
      try {
        this.status = await getStatus()
        if (this.status.pool) {
          await this.loadTables()
          if (this.current) await this.loadData()
        }
      } catch (e) {
        if (e.code === 'DB_DOWN') {
          this.status = { pool: false, docker: true, tables: null }
        } else {
          this.error = e.message || 'No se pudo consultar el estado de la base de datos'
        }
      } finally {
        this.booting = false
      }
    },
    async pollStatus() {
      try {
        const s = await getStatus()
        const wasDown = !this.status || !this.status.pool
        this.status = s
        if (!wasDown && s.pool) {
          const list = await getTables()
          this.tables = list.tables
          if (this.current) await this.loadData()
        } else if (wasDown && s.pool) {
          await this.loadTables()
          if (this.current) await this.loadData()
        }
      } catch { /* silencioso: el poll reintenta */ }
    },
    async refreshAll() {
      this.error = ''
      await this.loadTables()
      if (this.current) await this.loadData()
    },
    async refreshCurrent() {
      this.error = ''
      await this.loadData()
    },
    async loadTables() {
      try {
        const res = await getTables()
        this.tables = res.tables
        if (this.tables.length && !this.current) this.current = this.tables[0].name
      } catch (e) {
        this.error = e.message
      }
    },
    async openTable(name) {
      this.current = name
      this.offset = 0
      this.order = null
      await this.loadData()
    },
    async loadData() {
      if (!this.current) return
      this.loading = true
      this.error = ''
      try {
        const res = await getTableData(this.current, { limit: this.limit, offset: this.offset, order: this.order })
        this.table = res.table
        this.total = res.total
        this.rows = res.rows
        this.selected = new Set()
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },
    async startDb() {
      this.startingDb = true
      this.error = ''
      try {
        await dbUp()
        showToast('Base de datos levantada')
        this.status = await getStatus()
        await this.loadTables()
        if (this.current) await this.loadData()
      } catch (e) {
        this.error = `${e.message} ${e.hint || ''}`
      } finally {
        this.startingDb = false
      }
    },
    async volume() {
      const ok = await showConfirm('Detener el contenedor PostgreSQL (docker compose down). Los datos se conservan en el volumen.', {
        title: 'Detener BD',
        confirmText: 'Detener',
        danger: true
      })
      if (!ok) return
      try {
        await dbDown()
        showToast('BD detenida', { type: 'info' })
        this.status = await getStatus()
      } catch (e) {
        this.error = e.message
      }
    },
    sortBy(c) {
      this.order = this.order === c.name ? null : c.name
      this.offset = 0
      this.loadData()
    },
    onPageSize() {
      this.offset = 0
      this.loadData()
    },
    prevPage() {
      this.offset = Math.max(0, this.offset - this.limit)
      this.loadData()
    },
    nextPage() {
      const next = this.offset + this.limit
      if (next >= this.total) return
      this.offset = next
      this.loadData()
    },
    rowKey(row) {
      if (!this.table || !this.table.pk.length) return JSON.stringify(row)
      return this.table.pk.map((p) => row[p]).join('|')
    },
    toggleMenu(menu) {
      this.openMenu = this.openMenu === menu ? '' : menu
    },
    toggleSelect(i) {
      const s = new Set(this.selected)
      if (s.has(i)) s.delete(i)
      else s.add(i)
      this.selected = s
    },
    toggleSelectAll() {
      if (this.allSelected) this.selected = new Set()
      else this.selected = new Set(this.rows.map((_, i) => i))
    },
    cellText(v) {
      if (v === null || v === undefined || v === '') return ''
      if (typeof v === 'object') {
        try { return JSON.stringify(v) } catch { return String(v) }
      }
      return String(v)
    },
    openInsert() {
      const row = {}
      for (const c of this.table.columns) {
        if (AUTO_COLS.has(c.name)) continue
        if (this.isBool(c)) row[c.name] = false
      }
      this.editor = { mode: 'insert', row }
      this.editorError = ''
    },
    openEdit(row) {
      const key = {}
      if (this.table.pk.length) {
        for (const p of this.table.pk) key[p] = row[p]
      } else {
        for (const c of this.table.columns.slice(0, 2)) key[c.name] = row[c.name]
      }
      this.editor = { mode: 'edit', key, row: { ...row } }
      this.editorError = ''
    },
    closeEditor() {
      this.editor = null
      this.editorError = ''
    },
    async saveEditor() {
      this.editorError = ''
      this.editorSaving = true
      try {
        if (this.editor.mode === 'insert') {
          await insertRow(this.current, this.editor.row)
          showToast('Fila insertada')
        } else {
          await updateRow(this.current, this.editor.key, this.editor.row)
          showToast('Fila actualizada')
        }
        this.closeEditor()
        await this.loadData()
      } catch (e) {
        this.editorError = e.message
      } finally {
        this.editorSaving = false
      }
    },
    keysFor(row) {
      const key = {}
      if (this.table.pk.length) {
        for (const p of this.table.pk) key[p] = row[p]
      } else {
        for (const c of this.table.columns.slice(0, 2)) key[c.name] = row[c.name]
      }
      return key
    },
    async removeOne(row) {
      const key = this.keysFor(row)
      const ok = await showConfirm(`¿Eliminar este registro de ${this.current}? Esta acción no se puede deshacer.`, {
        title: 'Eliminar registro',
        confirmText: 'Eliminar',
        danger: true
      })
      if (!ok) return
      try {
        const res = await deleteRows(this.current, [key])
        showToast(`Eliminado (${res.deleted})`, { type: 'info' })
        await this.loadData()
      } catch (e) {
        this.error = e.message
      }
    },
    async removeSelected() {
      const keys = []
      for (const i of Array.from(this.selected).sort((a, b) => b - a)) {
        keys.push(this.keysFor(this.rows[i]))
      }
      const ok = await showConfirm(`¿Eliminar ${keys.length} registro(s) de ${this.current}? Esta acción no se puede deshacer.`, {
        title: 'Eliminar selección',
        confirmText: 'Eliminar',
        danger: true
      })
      if (!ok) return
      try {
        const res = await deleteRows(this.current, keys)
        showToast(`Eliminado (${res.deleted})`, { type: 'info' })
        await this.loadData()
      } catch (e) {
        this.error = e.message
      }
    },
    async doExport(fmt, whole) {
      this.openMenu = ''
      try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        if (whole) {
          await downloadUrl(exportAllUrl(fmt), fmt === 'json' ? `dualledger-export-${stamp}.json` : `dualledger-export-${stamp}.sql`)
        } else {
          await downloadUrl(exportTableUrl(this.current, fmt), `${this.current}.${fmt}`)
        }
        showToast('Exportación lista', { type: 'info' })
      } catch (e) {
        this.error = e.message
      }
    },
    pickFile(fmt) {
      this.fileJob = { fmt, kind: 'table' }
      this.openMenu = ''
      this.$refs.fileInput.value = ''
      this.$refs.fileInput.click()
    },
    pickFileSql() {
      this.fileJob = { kind: 'sql' }
      this.openMenu = ''
      this.$refs.fileInput.value = ''
      this.$refs.fileInput.click()
    },
    async onFilePicked(e) {
      const file = e.target.files && e.target.files[0]
      if (!file || !this.fileJob) return
      const job = this.fileJob
      this.fileJob = null
      const text = await file.text()
      try {
        if (job.kind === 'sql') {
          const ok = await showConfirm(
            `Enviar y ejecutar el script SQL del archivo "${file.name}" sobre la base de datos entera. El script corre tal cual (varios statements). ¿Continuar?`,
            { title: 'Importar SQL', confirmText: 'Ejecutar', danger: true }
          )
          if (!ok) return
          await importSql(text)
          showToast('Script SQL ejecutado')
        } else {
          const ok = await showConfirm(
            `Importar el archivo "${file.name}" como ${job.fmt.toUpperCase()} hacia la tabla "${this.current}". Las filas existentes se actualizan (upsert). ¿Continuar?`,
            { title: 'Importar datos', confirmText: 'Importar', danger: true }
          )
          if (!ok) return
          const res = await importInto(this.current, job.fmt, text)
          showToast(`Importadas/actualizadas ${res.imported} fila(s)`)
        }
        await this.loadTables()
        await this.loadData()
      } catch (err) {
        this.error = err.message
      }
    },
    isNumber(c) {
      return /INT|NUMERIC|DOUBLE|REAL|DECIMAL/.test(c.dataType)
    },
    isBool(c) {
      return /BOOL/.test(c.dataType)
    },
    isJson(c) {
      return /JSON/.test(c.dataType)
    },
    jsonText(c, v) {
      if (v === null || v === undefined || v === '') return ''
      return typeof v === 'string' ? v : JSON.stringify(v, null, 2)
    },
    setJson(name, text) {
      const t = text.trim()
      if (!t) {
        this.editor.row[name] = null
        return
      }
      try {
        this.editor.row[name] = JSON.parse(t)
      } catch {
        if (typeof this.editor.row[name] === 'string') return
        this.editor.row[name] = t
      }
    }
  }
}
</script>

<style scoped>
.data-explorer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 420px;
}

.de-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.de-title h2 {
  margin: 0;
  font-size: 1.15rem;
}

.de-subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.de-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.de-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.de-status.ok { color: var(--success); border-color: rgba(var(--success-rgb), 0.4); }

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-ok { background: var(--success); }
.dot-err { background: var(--error); }

.btn {
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}
.btn:hover { border-color: var(--primary); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
  border: none;
}
.btn-primary:hover { opacity: 0.9; }
.btn-outline { background: var(--surface); }
.btn-danger { color: var(--error); border-color: rgba(var(--error-rgb), 0.5); }
.btn-danger:hover { background: rgba(var(--error-rgb), 0.08); }
.btn-small { padding: 5px 10px; font-size: 0.78rem; }
.btn-mini { padding: 4px 8px; font-size: 0.75rem; }

.error-box {
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error);
  border: 1px solid rgba(var(--error-rgb), 0.4);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.82rem;
}

.de-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 48px 20px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
}

.de-empty-title { font-size: 0.95rem; color: var(--text); font-weight: 600; }
.de-empty-hint { max-width: 520px; font-size: 0.82rem; line-height: 1.5; }

.de-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 12px;
  min-height: 420px;
}

.de-sidebar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px;
  overflow: auto;
  max-height: 60vh;
}

.de-sidebar-header {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  padding: 4px 8px 8px;
}

.de-tab-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.de-tab-item:hover { background: var(--background); }
.de-tab-item.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
}

.de-tab-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.de-tab-badge {
  flex-shrink: 0;
  min-width: 22px;
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
  padding: 2px 7px;
  border-radius: 10px;
  background: var(--background);
  color: var(--text-secondary);
}
.de-tab-item.active .de-tab-badge { background: rgba(255, 255, 255, 0.25); color: white; }
.de-sidebar-empty { font-size: 0.75rem; color: var(--text-secondary); padding: 8px; }

.de-main {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.de-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.de-tb-left { display: flex; align-items: baseline; gap: 10px; }
.de-table-name { font-size: 0.95rem; }
.de-total { font-size: 0.75rem; color: var(--text-secondary); }
.de-tb-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.de-menu { position: relative; }

.de-menu-box {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 30;
  min-width: 210px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  padding: 6px;
  display: flex;
  flex-direction: column;
}

.de-menu-box button {
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.8rem;
  text-align: left;
  border-radius: 6px;
  cursor: pointer;
}
.de-menu-box button:hover { background: var(--background); }

.caret { font-size: 0.65rem; }

.de-table-wrap {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.de-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.de-table th {
  position: sticky;
  top: 0;
  background: var(--background);
  color: var(--text-secondary);
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.de-table th.de-tick { cursor: default; width: 34px; }
.de-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }

.de-table tbody tr:hover { background: var(--background); }
.de-table tbody tr.selected { background: rgba(var(--primary-rgb), 0.08); }

.de-cell code {
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

.de-pk { color: var(--accent); font-weight: 600; }
.de-key { font-size: 0.7rem; opacity: 0.7; }
.de-sort { font-size: 0.65rem; }

.de-actions-th { width: 90px; cursor: default; }
.de-row-actions { white-space: nowrap; }

.de-no-rows { text-align: center; color: var(--text-secondary); padding: 24px 0 !important; }

.de-pager {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.de-pager select {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
  color: var(--text);
  font-size: 0.78rem;
}

.de-range { font-variant-numeric: tabular-nums; }

.hidden-file { display: none; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  z-index: 9999;
  overflow-y: auto;
}

.modal {
  background: var(--surface);
  color: var(--text);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 560px;
  padding: 20px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.modal-header h3 { font-size: 1rem; }
.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.05rem;
  color: var(--text-secondary);
}

.de-editor-body {
  display: grid;
  gap: 10px;
  max-height: 60vh;
  overflow: auto;
  padding-right: 4px;
}

.de-field { display: flex; flex-direction: column; gap: 4px; }

.de-field label {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.de-field-type { font-weight: 400; opacity: 0.8; }

.de-field input[type='text'],
.de-field input[type='number'],
.de-field textarea,
.de-field input:not([type]) {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.82rem;
  background: var(--background);
  color: var(--text);
  font-family: inherit;
}
.de-field input[type='checkbox'] { width: 18px; height: 18px; align-self: flex-start; }
.de-field input:disabled { opacity: 0.55; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.de-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: de-rotate 0.8s linear infinite;
}

@keyframes de-rotate { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .de-layout {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .de-sidebar {
    max-height: 180px;
  }

  .de-table {
    min-width: 620px;
  }
}
</style>