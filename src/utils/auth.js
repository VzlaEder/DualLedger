import { reactive } from 'vue'

export const ROLES = [
  {
    id: 'administrador',
    nombre: 'Administrador',
    descripcion: 'Acceso total a la aplicación: dashboard, compras, ventas y configuración de usuarios y roles.',
    modulos: ['Dashboard', 'Compras', 'Ventas', 'Configuración'],
    estado: 'Activo'
  },
  {
    id: 'consultor',
    nombre: 'Consultor',
    descripcion: 'Acceso a dashboard, compras y ventas. Sin acceso al módulo de configuración.',
    modulos: ['Dashboard', 'Compras', 'Ventas'],
    estado: 'Activo'
  }
]

export const USERS = [
  {
    username: 'admin',
    password: 'admin123',
    nombre: 'Administrador Principal',
    correo: 'admin@dualledger.local',
    rol: 'Administrador',
    activo: true
  },
  {
    username: 'consultor',
    password: 'consultor123',
    nombre: 'Consultor de Prueba',
    correo: 'consultor@dualledger.local',
    rol: 'Consultor',
    activo: true
  }
]

const state = reactive({
  currentUser: null
})

export function login(username, password) {
  const name = String(username || '').trim().toLowerCase()
  const user = USERS.find(
    (u) => u.username.toLowerCase() === name && u.password === String(password || '')
  )
  if (!user) return { ok: false, error: 'Usuario o contraseña incorrectos' }
  if (!user.activo) return { ok: false, error: 'El usuario está desactivado' }
  state.currentUser = {
    username: user.username,
    nombre: user.nombre,
    correo: user.correo,
    rol: user.rol
  }
  return { ok: true, user: state.currentUser }
}

export function logout() {
  state.currentUser = null
}

export function isAuthenticated() {
  return !!state.currentUser
}

export function hasRole(rol) {
  return state.currentUser && state.currentUser.rol === rol
}

export { state }