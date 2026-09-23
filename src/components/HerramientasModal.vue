<template>
  <div v-if="open" class="modal-overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <h3>&#9881; Herramientas</h3>
        <button class="modal-close" @click="close">&#10005;</button>
      </div>
      <p class="modal-subtitle">
        Utilidades provisionales mientras se lanza la versión oficial con su BD y dominio propios.
      </p>

      <div class="tools-nav">
        <button
          class="tools-tab"
          :class="{ active: section === 'seniat' }"
          @click="section = 'seniat'"
        >
          Servicio SENIAT
        </button>
        <button
          class="tools-tab"
          :class="{ active: section === 'database' }"
          @click="section = 'database'"
        >
          Base de datos
        </button>
      </div>

      <div class="tools-body">
        <SeniatSetup v-if="section === 'seniat'" />

        <div v-else class="db-section">
          <div class="status-box">
            <div class="status-line-info">
              <span :class="['dot', db.pool ? 'dot-ok' : 'dot-err']"></span>
              <strong>{{ db.pool ? 'Base de datos conectada' : 'Base de datos no levantada' }}</strong>
            </div>
            <p class="status-detail" v-if="db.pool">
              Docker: <strong>{{ db.docker ? 'disponible' : 'no detectado' }}</strong>
              <span v-if="db.tables && db.tables.length">
                &middot;
                {{ db.tables.length }} tabla(s),
                {{ totalRows }} fila(s) en total
              </span>
            </p>
            <p class="status-detail" v-else>
              {{ db.docker ? 'Docker disponible. Postgres inactivo o sin contenedor.' : 'Docker no detectado. Revisa Docker Desktop.' }}
            </p>

            <div v-if="db.tables && db.tables.length" class="table-chips">
              <span v-for="t in db.tables" :key="t.name" class="table-chip" :title="`${t.name}: ${t.rows} fila(s)`">
                {{ t.name }} <b>{{ t.rows }}</b>
              </span>
            </div>
          </div>

          <div class="btn-row">
            <button class="btn btn-primary" @click="startDb" :disabled="dbBusy || db.pool">
              {{ dbBusy ? 'Levantando...' : '&#9650; Levantar base de datos' }}
            </button>
            <button class="btn btn-outline" @click="stopDb" :disabled="dbBusy || !db.pool">
              &#9660; Detener
            </button>
            <button class="btn btn-outline" @click="openData" :disabled="!db.pool">
              &#128451; Ver datos
            </button>
          </div>

          <div class="field">
            <label>DATABASE_URL externa (opcional)</label>
            <input
              v-model="manualUrl"
              type="text"
              placeholder="postgres://usuario:clave@host:5432/bd"
            />
            <small>
              Úsalo si ya tienes PostgreSQL (local o remoto) y quieres que la app guarde ahí.
              Se prueba la conexión, se aplica el esquema y se guarda en el <code>.env</code>.
            </small>
            <button class="btn btn-outline btn-connect" @click="connectManual" :disabled="connectBusy || !manualUrl.trim()">
              {{ connectBusy ? 'Conectando...' : 'Probar y conectar' }}
            </button>
          </div>

          <div v-if="error" class="error-box">&#9888; {{ error }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SeniatSetup from './SeniatSetup.vue'
import { getStatus, dbUp, dbDown, dbConnect } from '../services/apiAdmin'
import { showToast } from '../utils/dialog'

export default {
  name: 'HerramientasModal',
  components: { SeniatSetup },
  emits: ['open-data'],
  data() {
    return {
      open: false,
      section: 'seniat',
      db: { pool: false, docker: false, tables: null },
      dbBusy: false,
      connectBusy: false,
      manualUrl: '',
      error: '',
      pollTimer: null
    }
  },
  computed: {
    totalRows() {
      return (this.db.tables || []).reduce((acc, t) => acc + t.rows, 0)
    }
  },
  methods: {
    show() {
      this.section = 'seniat'
      this.error = ''
      this.open = true
      this.refreshStatus()
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = setInterval(() => this.refreshStatus(true), 5000)
    },
    close() {
      this.open = false
      this.dbBusy = false
      this.error = ''
      if (this.pollTimer) clearInterval(this.pollTimer)
    },
    async refreshStatus(silent) {
      try {
        this.db = await getStatus()
      } catch (e) {
        if (e.code === 'DB_DOWN') {
          this.db = { pool: false, docker: true, tables: null }
        } else if (!silent) {
          this.error = e.message
        }
      }
    },
    async startDb() {
      this.dbBusy = true
      this.error = ''
      try {
        await dbUp()
        showToast('Base de datos levantada')
        await this.refreshStatus()
      } catch (e) {
        this.error = `${e.message} ${e.hint || ''}`
      } finally {
        this.dbBusy = false
      }
    },
    async stopDb() {
      this.dbBusy = true
      this.error = ''
      try {
        await dbDown()
        showToast('BD detenida', { type: 'info' })
        await this.refreshStatus()
      } catch (e) {
        this.error = e.message
      } finally {
        this.dbBusy = false
      }
    },
    async connectManual() {
      this.connectBusy = true
      this.error = ''
      try {
        const res = await dbConnect(this.manualUrl.trim())
        showToast(`Conectado (${res.url})`)
        await this.refreshStatus()
      } catch (e) {
        this.error = e.message
      } finally {
        this.connectBusy = false
      }
    },
    openData() {
      this.close()
      this.$emit('open-data')
    }
  }
}
</script>

<style scoped>
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
  margin-bottom: 4px;
}

.modal-header h3 { font-size: 1.05rem; }

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: var(--text-secondary);
}

.modal-subtitle {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0 0 12px;
  line-height: 1.4;
}

.tools-nav {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 14px;
}

.tools-tab {
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.tools-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tools-body {
  min-height: 140px;
}

.db-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-box {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  font-size: 0.8rem;
}

.status-line-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.dot-ok { background: var(--success); }
.dot-err { background: var(--error); }

.status-detail {
  margin: 8px 0 0;
  color: var(--text-secondary);
  line-height: 1.4;
}

.status-detail strong { color: var(--text); }

.table-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.table-chip {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.table-chip b { color: var(--text); }

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-primary {
  flex: 1;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
  border: none;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-outline { background: var(--surface); }
.btn-outline:hover { border-color: var(--primary); }

.btn-connect { align-self: flex-start; margin-top: 6px; }

.field {
  display: flex;
  flex-direction: column;
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.field input {
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.85rem;
  background: var(--background);
  color: var(--text);
  font-family: monospace;
}

.field small {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.3;
}

.error-box {
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error);
  border: 1px solid rgba(var(--error-rgb), 0.4);
  border-radius: 8px;
  padding: 10px;
  font-size: 0.82rem;
}

code {
  font-family: monospace;
}
</style>