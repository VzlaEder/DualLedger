<template>
  <div v-if="open" class="modal-overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <h3>&#9881; Herramientas — Worker SENIAT</h3>
        <button class="modal-close" @click="close">&#10005;</button>
      </div>

      <p class="modal-subtitle">
        Configura el servicio que consulta el SENIAT para rellenar el nombre real y %
        de contribución de cada RIF. Solo para administradores.
      </p>

      <div class="bootstrap" v-if="!workerUrl">
        <p class="bootstrap-title">&#128203; Despliegue inicial (una sola vez, por terminal):</p>
        <ol>
          <li><code>cd worker</code></li>
          <li>
            <code>npx wrangler kv namespace create RIF_CACHE</code> y copia el <code>id</code>
            en <code>worker/wrangler.toml</code>
          </li>
          <li><code>npx wrangler login</code></li>
          <li><code>npx wrangler deploy</code></li>
        </ol>
        <p class="bootstrap-hint">
          Cuando termine, copia la URL <code>https://...workers.dev</code> que imprime
          wrangler y pégala abajo. Después, este botón actualiza el Worker automáticamente.
        </p>
      </div>

      <div class="field">
        <label>Account ID (Cloudflare)</label>
        <input v-model="accountId" type="text" placeholder="Opcional: 32 caracteres alfanuméricos de tu cuenta" />
        <small>Si lo dejas vacío, se detectará automáticamente con el token.</small>
      </div>

      <div class="field">
        <label>API Token (Cloudflare)</label>
        <div class="token-row">
          <input v-model="token" :type="showToken ? 'text' : 'password'" placeholder="Tu API Token"
            @keyup.enter="run" />
          <button class="toggle-visibility" @click="showToken = !showToken" type="button" title="Mostrar/ocultar">
            {{ showToken ? '&#128065;' : '&#128064;' }}
          </button>
        </div>
        <small>
          Permisos requeridos: <code>Workers Scripts: Edit</code> y
          <code>Workers KV Storage: Edit</code>.
        </small>
      </div>

      <div class="field">
        <label>URL del Worker (desplegado)</label>
        <input v-model="workerUrl" type="text" placeholder="https://dual-ledger-seniat.xxxx.workers.dev" />
        <small>La URL que imprime <code>npx wrangler deploy</code>.</small>
      </div>

      <button class="btn btn-primary" @click="run" :disabled="!workerUrl.trim() || !token.trim() || busy">
        {{ busy ? 'Trabajando...' : 'Actualizar / desplegar Worker SENIAT' }}
      </button>

      <div v-if="status" class="status-log">
        <div v-for="(line, i) in statusLines" :key="i" class="status-line">{{ line }}</div>
      </div>

      <div v-if="workerUrl" class="success-box">
        <p>&#9989; Worker desplegado y configurado.</p>
        <p class="url-label">URL:</p>
        <code class="url">{{ workerUrl }}</code>
        <p class="hint">El botón "Verificar SENIAT" en los datos usará esta dirección.</p>
      </div>

      <div v-if="error" class="error-box">&#9888; {{ error }}</div>

      <div v-if="hasData" class="reset-row">
        <button class="btn btn-text" @click="resetConfig">Borrar configuración del SENIAT</button>
      </div>
    </div>
  </div>
</template>

<script>
import { configureSeniatWorker, hasConfiguredWorker } from '../utils/cloudflare'
import { getCfAccountId, getCfToken, getWorkerUrl, clearSeniatConfig } from '../utils/settings'

export default {
  name: 'SeniatSetup',
  data() {
    return {
      open: false,
      accountId: getCfAccountId() || '',
      token: getCfToken() || '',
      showToken: false,
      busy: false,
      statusLines: [],
      workerUrl: getWorkerUrl() || '',
      error: '',
      hasData: hasConfiguredWorker()
    }
  },
  methods: {
    show() {
      this.accountId = getCfAccountId() || this.accountId
      this.token = getCfToken() || this.token
      this.workerUrl = getWorkerUrl() || ''
      this.hasData = hasConfiguredWorker()
      this.open = true
    },
    close() {
      this.open = false
      this.resetTmp()
    },
    resetTmp() {
      this.busy = false
      this.statusLines = []
      this.error = ''
    },
    resetConfig() {
      clearSeniatConfig()
      this.workerUrl = ''
      this.token = ''
      this.accountId = ''
      this.hasData = false
      this.error = ''
      this.statusLines = []
    },
    async run() {
      this.error = ''
      this.statusLines = []
      this.busy = true
      const onStep = (msg) => this.statusLines.push(msg)
      try {
        this.workerUrl = await configureSeniatWorker(
          { token: this.token.trim(), accountId: this.accountId.trim(), workerUrl: this.workerUrl.trim() },
          onStep
        )
        this.hasData = true
      } catch (e) {
        this.error = (e && e.message) || 'Ocurrió un error durante la configuración'
      } finally {
        this.busy = false
      }
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
  max-width: 520px;
  padding: 20px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
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
  font-size: 0.82rem;
  color: var(--text-secondary);
  margin-bottom: 14px;
  line-height: 1.4;
}

.bootstrap {
  background: var(--background);
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 14px;
  font-size: 0.8rem;
}

.bootstrap-title {
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
}

.bootstrap ol {
  margin: 6px 0 0 18px;
  padding: 0;
  line-height: 1.7;
  color: var(--text-secondary);
}

.bootstrap-hint {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  line-height: 1.4;
}

.field {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
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
  flex: 1;
}

.field small {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.3;
}

.token-row {
  display: flex;
  gap: 6px;
}

.toggle-visibility {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  font-size: 0.9rem;
  flex-shrink: 0;
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
  width: 100%;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-text {
  background: transparent;
  color: var(--error);
  font-size: 0.78rem;
}

.status-log {
  margin-top: 12px;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  max-height: 160px;
  overflow-y: auto;
}

.status-line {
  font-size: 0.78rem;
  color: var(--text-secondary);
  padding: 2px 0;
}

.success-box {
  margin-top: 12px;
  background: rgba(var(--success-rgb), 0.08);
  border: 1px solid rgba(var(--success-rgb), 0.4);
  border-radius: 8px;
  padding: 12px;
  font-size: 0.85rem;
}

.success-box p { margin: 4px 0; }
.url-label { font-weight: 600; }
.url {
  display: block;
  word-break: break-all;
  background: var(--surface);
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  font-size: 0.78rem;
  margin: 6px 0;
}
.hint { font-size: 0.75rem; color: var(--text-secondary); }

.error-box {
  margin-top: 12px;
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error);
  border: 1px solid rgba(var(--error-rgb), 0.4);
  border-radius: 8px;
  padding: 10px;
  font-size: 0.82rem;
}

.reset-row {
  margin-top: 14px;
  text-align: center;
}

code {
  font-family: inherit;
}
</style>
