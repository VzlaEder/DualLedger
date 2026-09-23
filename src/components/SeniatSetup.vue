<template>
  <div class="seniat-panel">
    <p class="modal-subtitle">
      El servicio SENIAT corre en tu propia infraestructura (proxy local Express con
      PostgreSQL) y está embebido en la app (ruta <code>/api</code>). Se usa para rellenar
      la razón social, % de contribución y condición de cada RIF.
    </p>

    <div class="status-box" v-if="status">
      <div class="status-line-info">
        <span :class="['dot', status.ok ? 'dot-ok' : 'dot-err']"></span>
        <strong>{{ status.ok ? 'Servicio activo' : 'Servicio no disponible' }}</strong>
      </div>
      <p class="status-detail" v-if="status.ok">
        {{ status.service }} — PostgreSQL:
        <strong :class="status.postgres ? 'text-ok' : 'text-warn'">
          {{ status.postgres ? 'Conectado' : 'Deshabilitado' }}
        </strong>
      </p>
      <p class="status-detail" v-else>{{ status.error }}</p>
    </div>

    <div class="field">
      <label>URL del servicio (opcional)</label>
      <input v-model="urlOverride" type="text" placeholder="Vacío = proxy local /api" />
      <small>
        Déjalo vacío para usar el proxy local embebido (<code>/api</code>). Solo rellénalo si
        en el futuro apuntas a un backend SENIAT desplegado en tu propio dominio.
      </small>
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" @click="testConnection" :disabled="busy">
        {{ busy ? 'Comprobando...' : 'Probar conexión' }}
      </button>
      <button class="btn btn-outline" @click="saveOverride" :disabled="busy">
        Guardar URL
      </button>
      <button
        v-if="hasOverride"
        class="btn btn-text"
        @click="resetToLocal"
        :disabled="busy"
      >
        Restablecer a local (/api)
      </button>
    </div>

    <div v-if="error" class="error-box">&#9888; {{ error }}</div>
  </div>
</template>

<script>
import { getWorkerUrl, setWorkerUrl, clearWorkerUrl } from '../utils/settings'

const LOCAL_PROXY = '/api'

export default {
  name: 'SeniatSetup',
  data() {
    return {
      busy: false,
      urlOverride: getWorkerUrl() || '',
      status: null,
      error: ''
    }
  },
  computed: {
    effectiveBase() {
      return this.urlOverride.trim().replace(/\/+$/, '') || LOCAL_PROXY
    },
    hasOverride() {
      return !!getWorkerUrl()
    }
  },
  methods: {
    async testConnection() {
      this.error = ''
      this.status = null
      this.busy = true
      try {
        const res = await fetch(`${this.effectiveBase}/`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        this.status = {
          ok: true,
          service: data.service || this.effectiveBase,
          postgres: !!data.postgres
        }
      } catch (e) {
        this.status = {
          ok: false,
          error: (e && e.message) || 'No se pudo conectar con el servicio SENIAT'
        }
      } finally {
        this.busy = false
      }
    },
    saveOverride() {
      this.error = ''
      setWorkerUrl(this.urlOverride)
      this.status = null
    },
    resetToLocal() {
      this.error = ''
      clearWorkerUrl()
      this.urlOverride = ''
      this.status = null
    }
  }
}
</script>

<style scoped>
.seniat-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modal-subtitle {
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
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

.text-ok { color: var(--success); }
.text-warn { color: var(--accent); }

.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
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
}

.field small {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.3;
}

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
}

.btn-primary {
  flex: 1;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
}

.btn-outline:hover { background: rgba(var(--primary-rgb), 0.1); }

.btn-text {
  background: transparent;
  color: var(--error);
  font-size: 0.78rem;
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
  font-family: inherit;
}
</style>