<template>
  <div class="api-key-setup">
    <div class="setup-card" v-if="!configured || showSettings">
      <div class="setup-row">
        <span class="setup-label">&#9889; API Gemini</span>
        <input
          v-model="keyInput"
          :type="showKey ? 'text' : 'password'"
          placeholder="AIza... o AQ..."
          class="key-input"
          @keyup.enter="saveKey"
        />
        <button class="toggle-visibility" @click="showKey = !showKey" type="button" title="Mostrar/ocultar">
          {{ showKey ? '&#128065;' : '&#128064;' }}
        </button>
        <button class="btn btn-primary" @click="saveKey" :disabled="!keyInput.trim()">
          Guardar
        </button>
        <button class="btn btn-text" @click="testKey" :disabled="!keyInput.trim() || testing">
          {{ testing ? 'Probando...' : 'Probar' }}
        </button>
        <button v-if="configured" class="btn btn-text" @click="closeSettings">
          Cerrar
        </button>
      </div>

      <div v-if="testResult" class="test-result" :class="testResult.ok ? 'ok' : 'bad'">
        <span :class="testResult.ok ? 'engine-dot gemini' : 'engine-dot red'"></span>
        {{ testResult.message }}
      </div>

      <details class="help-details">
        <summary>&#10067; Cómo obtener la clave de Google AI Studio</summary>
        <ol class="help-list">
          <li>Entra a <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a> e inicia sesión con tu cuenta de Google.</li>
          <li>Copia la clave que aparece (empieza con "AIza..." o "AQ."). Ambos formatos son válidos.</li>
          <li>Pégala arriba y haz clic en Guardar. Es gratis: 1500 requests/día.</li>
        </ol>
      </details>

      <p v-if="error" class="error-msg">{{ error }}</p>
    </div>

    <div class="engine-badge" v-else>
      <span class="engine-dot gemini"></span>
      <span class="engine-label">Gemini AI activo</span>
      <button class="settings-btn" @click="showSettings = true" title="Configurar API key">&#9881;</button>
    </div>
  </div>
</template>

<script>
import { getApiKey, setApiKey, hasApiKey } from '../utils/apiKey'
import { testCredential } from '../utils/gemini'

export default {
  name: 'ApiKeySetup',
  data() {
    return {
      keyInput: '',
      showKey: false,
      showSettings: false,
      configured: hasApiKey(),
      error: '',
      testing: false,
      testResult: null
    }
  },
  methods: {
    saveKey() {
      this.error = ''
      this.testResult = null
      const key = this.keyInput.trim()
      if (!key) {
        this.error = 'Ingresa una API key válida'
        return
      }
      if (!key.startsWith('AIza') && !key.startsWith('AQ.')) {
        this.error = 'Formato no reconocido. Las claves empiezan con "AIza" o "AQ."'
        return
      }
      setApiKey(key)
      this.configured = true
      this.showSettings = false
      this.keyInput = ''
      this.$emit('key-saved')
    },
    async testKey() {
      this.error = ''
      const key = this.keyInput.trim()
      if (!key) return
      this.testing = true
      this.testResult = null
      try {
        this.testResult = await testCredential(key)
      } catch (e) {
        this.testResult = { ok: false, message: e.message || 'Error inesperado' }
      } finally {
        this.testing = false
      }
    },
    closeSettings() {
      this.showSettings = false
      this.testResult = null
      this.error = ''
    }
  }
}
</script>

<style scoped>
.api-key-setup { margin-bottom: 12px; }

.setup-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 12px 14px;
  border-left: 4px solid var(--accent);
}

.setup-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.setup-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

.key-input {
  flex: 1;
  min-width: 180px;
  padding: 8px 10px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 0.85rem;
  font-family: monospace;
  background: var(--background);
  transition: border-color 0.2s;
}

.key-input:focus {
  outline: none;
  border-color: var(--primary);
}

.toggle-visibility {
  padding: 8px 10px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.btn {
  padding: 9px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-text {
  background: transparent;
  color: var(--text-secondary);
}

.help-details {
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.help-details summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--primary);
}

.help-list {
  margin: 6px 0 0;
  padding-left: 18px;
  line-height: 1.5;
}

.error-msg {
  color: var(--error);
  font-size: 0.8rem;
  margin-top: 8px;
  text-align: center;
}

.engine-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(46, 125, 50, 0.08);
  border: 1px solid rgba(46, 125, 50, 0.2);
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 0.78rem;
}

.engine-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.engine-dot.gemini {
  background: var(--success);
  animation: pulse-dot 2s infinite;
}

.engine-dot.red {
  background: var(--error);
}

.test-result {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  background: var(--surface);
  border: 1px solid var(--border);
}

.test-result.ok {
  border-color: rgba(46, 125, 50, 0.4);
  color: var(--success);
}

.test-result.bad {
  border-color: rgba(198, 40, 40, 0.4);
  color: var(--error);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.engine-label {
  color: var(--success);
  font-weight: 600;
}

.settings-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.settings-btn:hover { opacity: 1; }
</style>
