<template>
  <div class="modulo-view">
    <div class="section-header">
      <div>
        <h2>&#128100; Usuarios</h2>
        <p class="section-sub">Administración de usuarios del sistema</p>
      </div>
      <div class="header-note">Validación del lado del cliente (demo)</div>
    </div>

    <section class="card">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre completo</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.username">
              <td class="cell-strong">
                <span class="user-avatar" v-html="u.username.charAt(0).toUpperCase()"></span>
                {{ u.username }}
              </td>
              <td>{{ u.nombre }}</td>
              <td class="cell-muted">{{ u.correo }}</td>
              <td>
                <span class="badge" :class="u.rol === 'Administrador' ? 'badge-admin' : 'badge-consultor'">
                  {{ u.rol }}
                </span>
              </td>
              <td>
                <span class="badge" :class="u.activo ? 'badge-active' : 'badge-inactive'">
                  {{ u.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script>
import { USERS } from '../utils/auth.js'

export default {
  name: 'ConfigUsuariosView',
  data() {
    return {
      users: USERS
    }
  }
}
</script>

<style scoped>
.modulo-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.section-header h2 {
  margin: 0 0 4px;
  font-size: 1.3rem;
}

.section-sub {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.header-note {
  font-size: 0.72rem;
  color: var(--text-secondary);
  background: rgba(var(--accent-rgb), 0.1);
  border: 1px dashed rgba(var(--accent-rgb), 0.4);
  border-radius: 999px;
  padding: 4px 12px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.87rem;
}

.data-table th {
  text-align: left;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  border-bottom: 2px solid var(--border);
  padding: 10px 12px;
  white-space: nowrap;
}

.data-table td {
  padding: 12px;
  border-bottom: 1px solid var(--divider-weak);
  vertical-align: middle;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover td {
  background: rgba(var(--primary-rgb), 0.03);
}

.cell-strong {
  font-weight: 600;
}

.cell-muted {
  color: var(--text-secondary);
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(var(--primary-rgb), 0.12);
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 700;
  margin-right: 8px;
  vertical-align: middle;
}

.badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-admin {
  background: rgba(var(--primary-rgb), 0.12);
  color: var(--primary);
}

.badge-consultor {
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent);
}

.badge-active {
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success);
}

.badge-inactive {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error);
}

@media (max-width: 600px) {
  .data-table th,
  .data-table td {
    padding: 8px 8px;
  }
}
</style>