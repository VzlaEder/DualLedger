import { createRouter, createWebHashHistory } from 'vue-router'
import { isAuthenticated, state } from '../utils/auth.js'
import AppShell from '../components/AppShell.vue'
import LoginView from '../components/LoginView.vue'
import DashboardView from '../components/DashboardView.vue'
import ProcesarPanel from '../components/ProcesarPanel.vue'
import PlaceholderView from '../components/PlaceholderView.vue'
import ConfigUsuariosView from '../components/ConfigUsuariosView.vue'
import ConfigRolesView from '../components/ConfigRolesView.vue'

const comprasSubs = [
  {
    path: 'articulos',
    name: 'compras-articulos',
    title: 'Articulos',
    icon: '&#128230;',
    desc: 'Catálogo de artículos: alta, edición, precios y existencias.'
  },
  {
    path: 'proveedores',
    name: 'compras-proveedores',
    title: 'Proveedores',
    icon: '&#127981;',
    desc: 'Maestro de proveedores con datos fiscales y condiciones de compra.'
  },
  {
    path: 'documentos-no-fiscales',
    name: 'compras-documentos-no-fiscales',
    title: 'Documentos no fiscales',
    icon: '&#128196;',
    desc: 'Registro de comprobantes no fiscales y documentos internos.'
  },
  {
    path: 'compras-diarias',
    name: 'compras-compras-diarias',
    title: 'Compras diarias',
    icon: '&#128197;',
    desc: 'Registro de las compras realizadas en el día.'
  },
  {
    path: 'relacion-gastos',
    name: 'compras-relacion-gastos',
    title: 'Relación de gastos',
    icon: '&#128184;',
    desc: 'Relación mensual de gastos deducibles y no deducibles.'
  },
  {
    path: 'cxp',
    name: 'compras-cxp',
    title: 'CxP',
    icon: '&#128179;',
    desc: 'Cuentas por pagar: saldos y vencimientos con proveedores.'
  },
  {
    path: 'activos-fijos',
    name: 'compras-activos-fijos',
    title: 'Activos Fijos',
    icon: '&#127970;',
    desc: 'Registro y depreciación del activo fijo de la empresa.'
  },
  {
    path: 'retenciones-trabajadores',
    name: 'compras-retenciones-trabajadores',
    title: 'Retenciones (Trabajadores)',
    icon: '&#128101;',
    desc: 'Retenciones ISLR e impuestos aplicables a trabajadores.'
  }
]

const comprasSubRoutes = comprasSubs.map((c) => ({
  path: c.path,
  name: c.name,
  component: PlaceholderView,
  props: { title: c.title, icon: c.icon, description: c.desc }
}))

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true }
    },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'compras', redirect: { name: 'compras-procesar' } },
        {
          path: 'compras/procesar',
          name: 'compras-procesar',
          component: ProcesarPanel
        },
        ...comprasSubRoutes,
        {
          path: 'ventas',
          name: 'ventas',
          component: PlaceholderView,
          props: {
            title: 'Ventas',
            icon: '&#128176;',
            description: 'Módulo de Ventas en construcción. Sus subopciones se definirán cuando se construya el flujo de ventas.'
          }
        },
        { path: 'config', redirect: { name: 'config-usuarios' } },
        {
          path: 'config/usuarios',
          name: 'config-usuarios',
          component: ConfigUsuariosView,
          meta: { roles: ['Administrador'] }
        },
        {
          path: 'config/roles',
          name: 'config-roles',
          component: ConfigRolesView,
          meta: { roles: ['Administrador'] }
        },
        { path: ':pathMatch(.*)*', redirect: { name: 'dashboard' } }
      ]
    }
  ]
})

router.beforeEach((to) => {
  const logged = isAuthenticated()

  if (to.matched.some((r) => r.meta.public)) {
    return logged ? { name: 'dashboard' } : true
  }

  if (!logged) {
    const redirect = to.fullPath !== '/' ? to.fullPath : undefined
    return { path: '/login', query: redirect ? { redirect } : undefined }
  }

  const allowedRoles = to.matched.flatMap((r) =>
    Array.isArray(r.meta.roles) ? r.meta.roles : []
  )
  if (
    allowedRoles.length &&
    (!state.currentUser || !allowedRoles.includes(state.currentUser.rol))
  ) {
    return { name: 'dashboard' }
  }

  return true
})

export default router