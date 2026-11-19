<template>
  <div class="toast-stack">
    <TransitionGroup name="toast">
      <div
        v-for="item in toastState.items"
        :key="item.id"
        class="toast"
        :class="'type-' + item.type"
        role="status"
      >
        <span class="toast-icon" :class="'type-' + item.type">{{ icons[item.type] || icons.info }}</span>
        <span class="toast-message">{{ item.message }}</span>
        <button class="toast-close" @click="dismissToast(item.id)" aria-label="Cerrar">&#10005;</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script>
import { toastState, dismissToast } from '../utils/dialog.js'

export default {
  name: 'ToastHost',
  data() {
    return {
      toastState,
      icons: { info: '\u2139', success: '\u2713', warning: '\u26a0', error: '\u2715' }
    }
  },
  methods: { dismissToast }
}
</script>

<style scoped>
.toast-stack {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: calc(100% - 32px);
  max-width: 420px;
  z-index: 10001;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-lg);
  border-left: 4px solid var(--primary);
  font-size: 0.88rem;
}

.toast.type-success { border-left-color: var(--success); }
.toast.type-warning { border-left-color: var(--accent); }
.toast.type-error { border-left-color: var(--error); }

.toast-icon {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--primary);
}

.toast-icon.type-success { color: var(--success); }
.toast-icon.type-warning { color: var(--accent); }
.toast-icon.type-error { color: var(--error); }

.toast-message {
  flex: 1;
  line-height: 1.35;
  word-break: break-word;
}

.toast-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
}

.toast-close:hover { color: var(--text); }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
