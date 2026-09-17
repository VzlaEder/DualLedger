import { reactive } from 'vue'

export const dialogState = reactive({ queue: [] })

let idSeq = 0

const DEFAULT_TITLES = {
  info: 'Información',
  success: 'Listo',
  warning: 'Atención',
  error: 'Error'
}

function enqueue(kind, message, options = {}) {
  return new Promise((resolve) => {
    dialogState.queue.push({
      id: ++idSeq,
      kind,
      message,
      type: options.type || (kind === 'confirm' ? 'warning' : 'info'),
      title: options.title || '',
      buttonText: options.buttonText || 'Aceptar',
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      danger: options.danger !== false,
      resolve
    })
  })
}

export function showAlert(message, options = {}) {
  return enqueue('alert', message, options)
}

export function showConfirm(message, options = {}) {
  return enqueue('confirm', message, options)
}

export function dialogTitle(item) {
  if (!item) return ''
  return item.title || DEFAULT_TITLES[item.type] || 'Aviso'
}

export function settle(result) {
  const current = dialogState.queue[0]
  if (!current) return
  dialogState.queue.shift()
  current.resolve(result)
}

export const toastState = reactive({ items: [] })

let toastSeq = 0

export function showToast(message, options = {}) {
  const id = ++toastSeq
  const duration = options.duration != null ? options.duration : 2300
  toastState.items.push({
    id,
    message,
    type: options.type || 'success'
  })
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export function dismissToast(id) {
  const index = toastState.items.findIndex((t) => t.id === id)
  if (index !== -1) toastState.items.splice(index, 1)
}
