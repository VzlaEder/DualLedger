<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-top">
        <button
          class="menu-toggle"
          @click="toggleSidebar"
          title="Abrir menú de módulos"
          aria-label="Menú"
        >
          &#9776;
        </button>
        <div class="header-content">
          <div class="brand-row">
            <img :src="brandLogo" class="brand-logo" alt="DualLedger" />
            <div class="brand-text">
              <h1 class="app-title">DualLedger</h1>
              <p class="app-subtitle">Libro de Compras - Extractor de Datos</p>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button
            class="tools-toggle"
            @click="openHerramientas"
            title="Herramientas: servicio SENIAT y base de datos"
          >
            &#9881;
          </button>
          <button
            class="sound-toggle"
            @click="toggleSound"
            :title="soundOn ? 'Silenciar avisos' : 'Activar avisos'"
          >
            <svg v-if="soundOn" class="sound-icon" :class="{ solid: theme === 'dark' }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
            <svg v-else class="sound-icon" :class="{ solid: theme === 'dark' }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
          </button>
          <button
            class="theme-toggle"
            @click="toggleTheme"
            :title="theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
          >
            <svg v-if="theme === 'dark'" class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg v-else class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <button
            v-if="showInstall"
            class="install-btn"
            @click="installApp"
            title="Instalar app en escritorio"
          >
            &#128228; Instalar App
          </button>
        </div>
      </div>
      <ApiKeySetup @key-saved="handleKeySaved" />
    </header>

    <div class="app-body">
      <aside class="sidebar" :class="{ open: sidebarOpen }">
        <div v-if="sidebarOpen" class="sidebar-backdrop" @click="closeSidebarMobile"></div>
        <nav class="sidebar-nav">
          <template v-for="m in visibleModules" :key="m.id">
            <button
              :class="['sidebar-module', { active: isActive(m) }]"
              @click="selectModule(m)"
            >
              <span class="mod-icon" v-html="m.icon"></span>
              <span class="mod-label">{{ m.label }}</span>
              <span v-if="m.children.length" class="mod-arrow" :class="{ open: expanded[m.id] }">&#9662;</span>
            </button>
            <div v-if="m.children.length" v-show="expanded[m.id]" class="sidebar-children">
              <button
                v-for="c in m.children"
                :key="c.id"
                :class="['sidebar-child', { active: isActive(m, c) }]"
                @click="selectChild(m, c)"
              >
                <span class="child-icon" v-html="c.icon"></span>
                {{ c.label }}
              </button>
            </div>
          </template>
        </nav>
        <div class="sidebar-footer">
          <div class="user-box">
            <span class="user-avatar">{{ state.currentUser.username.charAt(0).toUpperCase() }}</span>
            <div class="user-info">
              <span class="user-name">{{ state.currentUser.nombre }}</span>
              <span class="user-role">{{ state.currentUser.rol }}</span>
            </div>
            <button class="logout-btn" @click="doLogout" title="Cerrar sesión">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main class="content-area">
        <router-view />
      </main>
    </div>

    <HerramientasModal
      ref="toolsRef"
      @open-data="openDataExplorer"
    />

    <div v-if="dataExplorerOpen" class="de-overlay">
      <div class="de-overlay-bar">
        <span class="de-overlay-title">&#128451; Base de datos — Explorador</span>
        <button class="de-overlay-close" @click="closeDataExplorer">&#10005; Cerrar</button>
      </div>
      <DataExplorer @open-tools="openHerramientas" />
    </div>

    <DialogHost />
    <ToastHost />
  </div>
</template>

<script>
import ApiKeySetup from './ApiKeySetup.vue'
import HerramientasModal from './HerramientasModal.vue'
import DataExplorer from './DataExplorer.vue'
import DialogHost from './DialogHost.vue'
import ToastHost from './ToastHost.vue'
import brandLogo from '../assets/logo/DualLedger.svg'
import { state, logout } from '../utils/auth.js'
import { showToast } from '../utils/dialog.js'
import { hasApiKey } from '../utils/apiKey.js'
import { isSoundEnabled, setSoundEnabled, unlockAudio, playCompletionSound } from '../utils/sound.js'

export default {
  name: 'AppShell',
  components: {
    ApiKeySetup,
    HerramientasModal,
    DataExplorer,
    DialogHost,
    ToastHost
  },
  data() {
    return {
      brandLogo,
      state,
      expanded: { dashboard: false, compras: false, ventas: false, config: false },
      modules: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: '&#128202;',
          path: '/',
          children: []
        },
        {
          id: 'compras',
          label: 'Compras',
          icon: '&#128722;',
          children: [
            { id: 'procesar', label: 'Procesar', icon: '&#128203;', path: '/compras/procesar' },
            { id: 'articulos', label: 'Articulos', icon: '&#128230;', path: '/compras/articulos' },
            { id: 'proveedores', label: 'Proveedores', icon: '&#127981;', path: '/compras/proveedores' },
            { id: 'documentos-no-fiscales', label: 'Documentos no fiscales', icon: '&#128196;', path: '/compras/documentos-no-fiscales' },
            { id: 'compras-diarias', label: 'Compras diarias', icon: '&#128197;', path: '/compras/compras-diarias' },
            { id: 'relacion-gastos', label: 'Relación de gastos', icon: '&#128184;', path: '/compras/relacion-gastos' },
            { id: 'cxp', label: 'CxP', icon: '&#128179;', path: '/compras/cxp' },
            { id: 'activos-fijos', label: 'Activos Fijos', icon: '&#127970;', path: '/compras/activos-fijos' },
            { id: 'retenciones-trabajadores', label: 'Retenciones (Trabajadores)', icon: '&#128101;', path: '/compras/retenciones-trabajadores' }
          ]
        },
        {
          id: 'ventas',
          label: 'Ventas',
          icon: '&#128176;',
          path: '/ventas',
          children: []
        },
        {
          id: 'config',
          label: 'Configuración',
          icon: '&#9881;',
          children: [
            { id: 'usuarios', label: 'Usuarios', icon: '&#128100;', path: '/config/usuarios' },
            { id: 'roles', label: 'Roles', icon: '&#128273;', path: '/config/roles' }
          ]
        }
      ],
      sidebarOpen: false,
      dataExplorerOpen: false,
      canInstall: false,
      deferredPrompt: null,
      isIos: false,
      standalone: false,
      hasApiKey: hasApiKey(),
      theme: 'light',
      soundOn: isSoundEnabled()
    }
  },
  computed: {
    visibleModules() {
      const isAdmin = this.state.currentUser && this.state.currentUser.rol === 'Administrador'
      return this.modules.filter((m) => (m.id === 'config' ? isAdmin : true))
    },
    showInstall() {
      return this.canInstall || (this.isIos && !this.standalone)
    }
  },
  watch: {
    $route() {
      this.syncExpanded()
    }
  },
  mounted() {
    this.syncExpanded()
    this.applyInitialTheme()
    this.detectPlatform()
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      this.deferredPrompt = e
      this.canInstall = true
    })
    window.addEventListener('appinstalled', () => {
      this.canInstall = false
      this.deferredPrompt = null
    })
  },
  methods: {
    detectPlatform() {
      const ua = navigator.userAgent || ''
      this.isIos = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      this.standalone =
        window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      if (this.isIos && !this.standalone && !sessionStorage.getItem('dualledger-ios-hint')) {
        sessionStorage.setItem('dualledger-ios-hint', '1')
        showToast('Para instalarla en iPhone: Comparte > Añadir a pantalla de inicio', {
          type: 'info',
          duration: 8000
        })
      }
    },
    baseOf(m) {
      if (m.children.length) {
        const first = m.children[0].path
        return first.slice(0, first.lastIndexOf('/')) || '/'
      }
      return m.path
    },

    isActive(m, c) {
      const path = this.$route.path
      if (c) return path === c.path
      if (m.children.length) {
        const base = this.baseOf(m)
        return path === base || path.startsWith(base + '/')
      }
      return path === m.path
    },

    syncExpanded() {
      for (const m of this.modules) {
        if (m.children.length && this.isActive(m)) {
          this.expanded[m.id] = true
        }
      }
    },

    go(path) {
      this.$router.push(path)
      this.closeSidebarMobile()
    },

    selectModule(m) {
      if (m.children.length) {
        this.expanded[m.id] = !this.expanded[m.id]
        this.closeSidebarMobile()
      } else {
        this.go(m.path)
      }
    },

    selectChild(m, c) {
      this.go(c.path)
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },

    closeSidebarMobile() {
      this.sidebarOpen = false
    },

    doLogout() {
      logout()
      this.expanded = { dashboard: false, compras: false, ventas: false, config: false }
      this.sidebarOpen = false
      this.dataExplorerOpen = false
      this.$router.push({ name: 'login' })
    },

    async installApp() {
      if (!this.deferredPrompt) {
        if (this.isIos) {
          showToast('En iPhone o iPad: toca Compartir y luego "Añadir a pantalla de inicio"', {
            type: 'info',
            duration: 8000
          })
        }
        return
      }
      this.deferredPrompt.prompt()
      const { outcome } = await this.deferredPrompt.userChoice
      if (outcome === 'accepted') {
        this.canInstall = false
      }
      this.deferredPrompt = null
    },

    handleKeySaved() {
      this.hasApiKey = true
    },

    applyInitialTheme() {
      const stored = localStorage.getItem('dualledger-theme')
      let theme = 'light'
      if (stored === 'dark' || stored === 'light') {
        theme = stored
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'dark'
      }
      this.theme = theme
      document.documentElement.setAttribute('data-theme', theme)
    },

    setTheme(theme) {
      this.theme = theme
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('dualledger-theme', theme)
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },

    toggleSound() {
      this.soundOn = !this.soundOn
      setSoundEnabled(this.soundOn)
      if (this.soundOn) {
        unlockAudio()
        playCompletionSound()
      }
    },

    openHerramientas() {
      if (this.$refs.toolsRef) {
        this.$refs.toolsRef.show()
      }
    },

    openDataExplorer() {
      this.dataExplorerOpen = true
    },

    closeDataExplorer() {
      this.dataExplorerOpen = false
    }
  }
}
</script>

<style>
:root {
  --primary: #1a56db;
  --primary-light: #3b82f6;
  --primary-dark: #0f3d9e;
  --accent: #f59e0b;
  --surface: #ffffff;
  --background: #f3f5f9;
  --error: #dc2626;
  --success: #16a34a;
  --text: #111827;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
  --shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  --shadow-lg: 0 8px 24px rgba(15, 23, 42, 0.12);
  --radius: 12px;
  --primary-rgb: 26, 86, 219;
  --accent-rgb: 245, 158, 11;
  --error-rgb: 220, 38, 38;
  --success-rgb: 22, 163, 74;
  --divider-weak: rgba(0, 0, 0, 0.04);
  --tesseract-bg: rgba(33, 33, 33, 0.08);
  --badge-strong: #ffffff;
  --badge-text: #4b5563;
}

[data-theme="dark"] {
  --primary: #3b82f6;
  --primary-light: #60a5fa;
  --primary-dark: #2563eb;
  --accent: #fbbf24;
  --surface: #1f2937;
  --background: #111827;
  --error: #f87171;
  --success: #4ade80;
  --text: #f3f4f6;
  --text-secondary: #a9b2bd;
  --border: #374151;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.45);
  --primary-rgb: 59, 130, 246;
  --accent-rgb: 251, 191, 36;
  --error-rgb: 248, 113, 113;
  --success-rgb: 74, 222, 128;
  --divider-weak: rgba(255, 255, 255, 0.06);
  --tesseract-bg: rgba(255, 255, 255, 0.08);
  --badge-strong: #1f2937;
  --badge-text: #ffffff;
}

[data-theme="dark"] .app-header {
  background: linear-gradient(135deg, #1e40af, #2563eb);
}

[data-theme="dark"] input,
[data-theme="dark"] select,
[data-theme="dark"] textarea {
  color-scheme: dark;
}

* { box-sizing: border-box; }

html, body {
  color: var(--text);
  background: var(--background);
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: var(--text);
  background: var(--background);
}

.app-header {
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
  padding: calc(12px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 0 calc(16px + env(safe-area-inset-left));
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.18);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.header-content { text-align: center; flex: 1; }

.brand-row {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.brand-logo {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
  object-fit: cover;
}

.brand-text { text-align: left; }

.app-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  line-height: 1;
}

.icon { font-size: 1.2rem; }

.app-subtitle {
  font-size: 0.75rem;
  opacity: 0.85;
  margin-top: 3px;
}

.install-btn {
  background: var(--accent);
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  animation: pulse 2s infinite;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.theme-toggle,
.sound-toggle,
.tools-toggle,
.menu-toggle {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: white;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}

.tools-toggle {
  background: rgba(255, 255, 255, 0.12);
}

.menu-toggle {
  display: none;
}

.tools-toggle:hover,
.sound-toggle:hover,
.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.28);
}

.theme-icon,
.sound-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.sound-icon.solid polygon {
  fill: currentColor;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* ===== Layout: sidebar + contenido ===== */
.app-body {
  display: flex;
  flex: 1;
  align-items: stretch;
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-module {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s, color 0.2s;
  text-align: left;
}

.sidebar-module:hover {
  background: rgba(26, 86, 219, 0.06);
}

.sidebar-module.active {
  color: var(--primary);
  background: rgba(26, 86, 219, 0.1);
}

.mod-icon {
  width: 22px;
  text-align: center;
  font-size: 1.05rem;
  flex-shrink: 0;
}

.mod-label { flex: 1; }

.mod-arrow {
  font-size: 0.7rem;
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.mod-arrow.open {
  transform: rotate(180deg);
}

.sidebar-children {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 18px;
  padding-left: 14px;
  border-left: 2px solid var(--divider-weak);
}

.sidebar-child {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.83rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s, color 0.2s;
  text-align: left;
}

.sidebar-child:hover {
  background: rgba(26, 86, 219, 0.06);
  color: var(--text);
}

.sidebar-child.active {
  color: var(--primary);
  background: rgba(26, 86, 219, 0.1);
  font-weight: 600;
}

.child-icon {
  font-size: 0.95rem;
  flex-shrink: 0;
}

.sidebar-backdrop {
  display: none;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.sidebar-nav + .sidebar-footer {
  margin-top: 16px;
}

.user-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 10px;
  background: var(--background);
  border: 1px solid var(--border);
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
  font-size: 0.95rem;
  font-weight: 700;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.logout-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
  flex-shrink: 0;
}

.logout-btn:hover {
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error);
}

.logout-btn svg {
  width: 17px;
  height: 17px;
}

.content-area {
  flex: 1;
  min-width: 0;
  padding: 16px calc(16px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left));
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

/* ===== Responsive ===== */
@media (max-width: 600px) {
  .app-subtitle { display: none; }
  .app-title { font-size: 1.15rem; }
  .brand-logo { width: 36px; height: 36px; }
  .header-top { gap: 8px; }
  .content-area { padding-top: 12px; }
  .install-btn { font-size: 0.68rem; padding: 6px 9px; }
}

@media (max-width: 480px) {
  .app-title { font-size: 1.2rem; }
  .brand-logo { width: 38px; height: 38px; font-size: 1.2rem; }
  .install-btn { font-size: 0.68rem; padding: 6px 8px; }
}

@media (max-width: 900px) {
  .menu-toggle {
    display: flex;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 90;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: var(--shadow-lg);
    padding-top: calc(12px + env(safe-area-inset-top));
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    padding-left: calc(10px + env(safe-area-inset-left));
    width: min(280px, 82vw);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: -1;
  }
}

/* Targets tactiles (moviles/tablets) */
@media (pointer: coarse) {
  .sidebar-module,
  .sidebar-child {
    min-height: 44px;
  }

  .theme-toggle,
  .sound-toggle,
  .tools-toggle,
  .menu-toggle {
    width: 42px;
    height: 42px;
  }
}

.de-overlay {
  position: fixed;
  inset: 0;
  z-index: 9500;
  background: var(--background);
  overflow-y: auto;
  padding: 14px 18px 28px;
}

.de-overlay-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.de-overlay-title {
  font-size: 0.9rem;
  font-weight: 700;
}

.de-overlay-close {
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.de-overlay-close:hover {
  border-color: var(--error);
  color: var(--error);
}
</style>