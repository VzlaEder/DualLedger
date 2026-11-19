<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <img :src="brandLogo" class="login-logo" alt="DualLedger" />
        <h1 class="login-title">DualLedger</h1>
        <p class="login-subtitle">Libro de Compras - Extractor de Datos</p>
      </div>

      <form class="login-form" @submit.prevent="doLogin">
        <div class="field">
          <label for="login-username">Usuario</label>
          <input
            id="login-username"
            v-model.trim="username"
            type="text"
            autocomplete="username"
            placeholder="admin"
            :disabled="loading"
          />
        </div>
        <div class="field">
          <label for="login-password">Contraseña</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :disabled="loading"
          />
        </div>

        <p v-if="error" class="login-error">&#9888; {{ error }}</p>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>

      <div class="login-hint">
        <p class="hint-title">Cuentas de prueba</p>
        <p><b>admin</b> / admin123 <span class="badge badge-admin">Administrador</span></p>
        <p><b>consultor</b> / consultor123 <span class="badge badge-consultor">Consultor</span></p>
      </div>
    </div>
  </div>
</template>

<script>
import brandLogo from '../assets/logo/DualLedger.svg'
import { login } from '../utils/auth.js'

export default {
  name: 'LoginView',
  data() {
    return {
      brandLogo,
      username: '',
      password: '',
      error: '',
      loading: false
    }
  },
  methods: {
    doLogin() {
      if (this.loading) return
      this.error = ''
      if (!this.username || !this.password) {
        this.error = 'Ingresa usuario y contraseña'
        return
      }
      this.loading = true
      setTimeout(() => {
        const result = login(this.username, this.password)
        this.loading = false
        if (!result.ok) {
          this.error = result.error
          return
        }
        this.username = ''
        this.password = ''
        const redirect = this.$route.query.redirect
        this.$router.push(redirect || { name: 'dashboard' })
      }, 300)
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  padding: 32px 28px;
}

.login-brand {
  text-align: center;
  margin-bottom: 22px;
}

.login-logo {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  box-shadow: var(--shadow);
  object-fit: cover;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 10px 0 2px;
  color: var(--primary);
}

.login-subtitle {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.field input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.9rem;
  background: var(--background);
  color: var(--text);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field input:focus {
  outline: none;
  border-color: var(--primary-light);
  box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.15);
}

.login-error {
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error);
  border: 1px solid rgba(var(--error-rgb), 0.25);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.8rem;
  margin-bottom: 12px;
}

.login-btn {
  width: 100%;
  padding: 11px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--primary), var(--primary-light));
  color: white;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.login-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.login-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.login-hint {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px dashed var(--border);
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.login-hint p {
  margin: 4px 0;
}

.hint-title {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.68rem;
  letter-spacing: 0.5px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  margin-left: 6px;
}

.badge-admin {
  background: rgba(var(--primary-rgb), 0.12);
  color: var(--primary);
}

.badge-consultor {
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent);
}
</style>