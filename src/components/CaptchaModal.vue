<template>
  <div class="captcha-overlay">
    <div class="captcha-modal">
      <h3>&#127760; Verificación del SENIAT</h3>
      <p>No se pudo leer el captcha automáticamente. Escribe el código que ves en la imagen:</p>
      <img class="captcha-img" :src="captchaSrc" alt="Captcha del SENIAT" />
      <input
        ref="codeInput"
        v-model="code"
        type="text"
        maxlength="10"
        autocomplete="off"
        spellcheck="false"
        class="captcha-input"
        placeholder="Código del captcha"
        @keyup.enter="submit"
      />
      <div class="captcha-actions">
        <button class="btn-cancel" @click="cancel">Cancelar</button>
        <button class="btn-submit" :disabled="!code.trim()" @click="submit">
          Verificar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CaptchaModal',
  props: {
    visible: { type: Boolean, default: false },
    imageBase64: { type: String, default: '' }
  },
  emits: ['submit', 'cancel'],
  data() {
    return {
      code: ''
    }
  },
  computed: {
    captchaSrc() {
      return this.imageBase64 ? `data:image/jpeg;base64,${this.imageBase64}` : ''
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.code = ''
        this.$nextTick(() => {
          const el = this.$refs.codeInput
          if (el) el.focus()
        })
      }
    }
  },
  methods: {
    submit() {
      const clean = this.code.replace(/[^A-Za-z0-9]/g, '').slice(0, 10)
      if (!clean) return
      this.code = ''
      this.$emit('submit', clean)
    },
    cancel() {
      this.code = ''
      this.$emit('cancel')
    }
  }
}
</script>

<style scoped>
.captcha-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.captcha-modal {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  max-width: 360px;
  width: 100%;
  padding: 20px;
  text-align: center;
}

.captcha-modal h3 {
  margin: 0 0 6px;
  font-size: 1rem;
  color: var(--text);
}

.captcha-modal p {
  margin: 0 0 12px;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.captcha-img {
  max-width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 12px;
  background: #fff;
}

.captcha-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.9rem;
  text-align: center;
  letter-spacing: 2px;
  background: var(--background);
  color: var(--text);
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.captcha-input:focus {
  outline: none;
  border-color: var(--primary);
}

.captcha-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-cancel {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-submit {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 6px;
  background: var(--primary);
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>