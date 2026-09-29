<template>
  <div class="modulo-view">
    <div class="section-header">
      <div>
        <h2>&#128273; Roles</h2>
        <p class="section-sub">Administración de roles y permisos del sistema</p>
      </div>
      <div class="header-note">Validación del lado del cliente (demo)</div>
    </div>

    <section class="card">
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Descripción</th>
              <th>Módulos permitidos</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in roles" :key="r.id">
              <td class="cell-strong">
                <span class="badge" :class="r.id === 'administrador' ? 'badge-admin' : 'badge-consultor'">
                  {{ r.nombre }}
                </span>
              </td>
              <td class="cell-desc">{{ r.descripcion }}</td>
              <td>
                <div class="mod-list">
                  <span v-for="m in r.modulos" :key="m" class="mini-chip">{{ m }}</span>
                </div>
              </td>
              <td>
                <span class="badge badge-active">Activo</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script>
import { ROLES } from '../utils/auth.js'

export default {
  name: 'ConfigRolesView',
  data() {
    return {
      roles: ROLES
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
  vertical-align: top;
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

.cell-desc {
  color: var(--text-secondary);
  font-size: 0.83rem;
  max-width: 360px;
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

.mod-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 320px;
}

.mini-chip {
  font-size: 0.7rem;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--background);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

@media (max-width: 600px) {
  .data-table th,
  .data-table td {
    padding: 8px 8px;
  }
}
</style>