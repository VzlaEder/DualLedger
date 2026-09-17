<template>
  <div v-if="current" class="dialog-backdrop">
    <div class="dialog-card" :class="'type-' + current.type" role="alertdialog" aria-modal="true">
      <div class="dialog-icon" :class="'type-' + current.type">{{ icon }}</div>
      <h3 class="dialog-title">{{ title }}</h3>
      <p class="dialog-message">{{ current.message }}</p>
      <div class="dialog-actions">
        <button
          v-if="current.kind === 'confirm'"
          class="dialog-btn dialog-btn-cancel"
          @click="settle(false)"
        >
          {{ current.cancelText }}
        </button>
        <button
          ref="primaryBtn"
          class="dialog-btn dialog-btn-primary"
          :class="{ danger: current.kind === 'confirm' && current.danger }"
          @click="settle(true)"
        >
          {{ current.kind === 'confirm' ? current.confirmText : current.buttonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { dialogState, dialogTitle, settle } from '../utils/dialog.js'

export default {
  name: 'DialogHost',
  data() {
    return { dialogState }
  },
  computed: {
    current() {
      return dialogState.queue[0] || null
    },
    title() {
      return dialogTitle(this.current)
    },
    icon() {
      const icons = { info: '\u2139', success: '\u2713', warning: '\u26a0', error: '\u2715' }
      return icons[this.current && this.current.type] || icons.info
    }
  },
  watch: {
    current(value) {
      document.body.style.overflow = value ? 'hidden' : ''
      if (value) {
        this.$nextTick(() => {
          if (this.$refs.primaryBtn) this.$refs.primaryBtn.focus()
        })
      }
    }
  },
  beforeUnmount() {
    document.body.style.overflow = ''
  },
  methods: { settle }
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 10000;
}

.dialog-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  padding: 22px 20px 18px;
  text-align: center;
  border-top: 4px solid var(--primary);
}

.dialog-card.type-success { border-top-color: var(--success); }
.dialog-card.type-warning { border-top-color: var(--accent); }
.dialog-card.type-error { border-top-color: var(--error); }

.dialog-icon {
  font-size: 1.7rem;
  line-height: 1;
  margin-bottom: 10px;
  color: var(--primary);
}

.dialog-icon.type-success { color: var(--success); }
.dialog-icon.type-warning { color: var(--accent); }
.dialog-icon.type-error { color: var(--error); }

.dialog-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}

.dialog-message {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.45;
  word-break: break-word;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.dialog-btn {
  flex: 1;
  padding: 11px 14px;
  border: none;
  border-radius: 8px;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog-btn-cancel {
  background: var(--background);
  color: var(--text);
  border: 1px solid var(--border);
}

.dialog-btn-cancel:hover { border-color: var(--text-secondary); }

.dialog-btn-primary {
  background: var(--primary);
  color: #fff;
}

.dialog-btn-primary:hover { opacity: 0.9; }

.dialog-btn-primary.danger { background: var(--error); }
</style>
