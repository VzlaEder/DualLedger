<template>
  <div class="api-key-setup">
    <div class="setup-card" v-if="!configured || showSettings">
      <div class="setup-header">
        <div class="setup-icon">&#9889;</div>
        <h2>Configurar Gemini AI</h2>
        <p class="setup-desc">
          Para un reconocimiento preciso de facturas, pega la clave de Google AI Studio.
          Acepta API Key ("AIza...") o token de acceso ("AQ...").
        </p>
      </div>

      <div class="setup-steps">
        <div class="step">
          <span class="step-num">1</span>
          <div class="step-content">
            <p>Ve a <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a></p>
            <p class="step-detail">Inicia sesión con tu cuenta de Google</p>
          </div>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <div class="step-content">
            <p>Copia la clave que aparece (empieza con "AIza..." o "AQ.")</p>
            <p class="step-detail">Ambos formatos son válidos</p>
          </div>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <div class="step-content">
            <p>Pega la clave abajo</p>
            <p class="step-detail">Gratis: 1500 requests/día, más que suficiente</p>
          </div>
        </div>
      </div>

      <div class="key-input-group">
        <input
          v-model="keyInput"
          :type="showKey ? 'text' : 'password'"
          placeholder="AIza... o AQ..."
          class="key-input"
          @keyup.enter="saveKey"
        />
        <button class="toggle-visibility" @click="showKey = !showKey" type="button">
          {{ showKey ? '&#128065;' : '&#128064;' }}
        </button>
      </div>

      <div class="setup-actions">
        <button class="btn btn-primary" @click="saveKey" :disabled="!keyInput.trim()">
          &#10003; Guardar Key
        </button>
        <button v-if="configured" class="btn btn-text" @click="showSettings = false">
          Cancelar
        </button>
      </div>

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

export default {
  name: 'ApiKeySetup',
  data() {
    return {
      keyInput: '',
      showKey: false,
      showSettings: false,
      configured: hasApiKey(),
      error: ''
    }
  },
  methods: {
    saveKey() {
      this.error = ''
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
  padding: 20px;
  border-left: 4px solid var(--accent);
}

.setup-header { text-align: center; margin-bottom: 16px; }
.setup-icon { font-size: 2rem; margin-bottom: 4px; }
.setup-header h2 { font-size: 1.1rem; color: var(--text); margin-bottom: 4px; }
.setup-desc { font-size: 0.82rem; color: var(--text-secondary); }

.setup-steps { margin-bottom: 16px; }

.step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
}

.step-num {
  background: var(--primary);
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content p {
  font-size: 0.85rem;
  color: var(--text);
  margin: 0;
}

.step-content a {
  color: var(--primary);
  font-weight: 600;
}

.step-detail {
  font-size: 0.75rem !important;
  color: var(--text-secondary) !important;
  margin-top: 2px !important;
}

.key-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.key-input {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid var(--border);
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: monospace;
  background: var(--background);
  transition: border-color 0.2s;
}

.key-input:focus {
  outline: none;
  border-color: var(--primary);
}

.toggle-visibility {
  padding: 10px 12px;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
  font-size: 1rem;
}

.setup-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
  flex: 1;
}

.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-text {
  background: transparent;
  color: var(--text-secondary);
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
