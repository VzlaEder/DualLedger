<template>
  <div class="report-head" :style="estilo">
    <div class="report-titulo">
      <div class="report-titulo-linea">
        <span v-if="icon" class="report-icon" aria-hidden="true" v-html="icon"></span>
        <h2>{{ title }}</h2>
      </div>
      <span v-if="badge" class="report-badge">{{ badge }}</span>
      <p class="report-sub"><slot name="subtitle">{{ subtitle }}</slot></p>
    </div>
    <div class="head-actions"><slot name="actions" /></div>
  </div>
</template>

<script>
// Cabecera común de los reportes y maestros de Compras.
// Cada módulo aporta su acento de color, icono y etiqueta de naturaleza
// ("Maestro · edición" frente a "Reporte · solo lectura") para que no
// se lean como el mismo pantallazo con otro título.
export default {
  name: 'ReportHeader',
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    icon: { type: String, default: '' },
    badge: { type: String, default: '' },
    accent: { type: String, default: '#1a56db' }
  },
  computed: {
    estilo() {
      return { '--report-accent': this.accent }
    }
  }
}
</script>

<style scoped>
.report-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 4px 0 4px 14px;
  border-left: 4px solid var(--report-accent);
}
.report-titulo { flex: 1 1 auto; min-width: 0; }
.report-titulo-linea { display: flex; align-items: center; gap: 10px; }
.report-icon {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: color-mix(in srgb, var(--report-accent) 14%, transparent);
  font-size: 1.05rem;
  line-height: 1;
}
.report-head h2 { margin: 0; font-size: 1.35rem; line-height: 1.2; }
.report-badge {
  display: inline-block;
  margin-top: 5px;
  border: 1px solid var(--report-accent);
  color: var(--report-accent);
  background: color-mix(in srgb, var(--report-accent) 8%, transparent);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.report-sub {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  max-width: 720px;
  line-height: 1.45;
}
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; flex: 0 0 auto; }
.head-actions :deep(.btn) {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.82rem;
  cursor: pointer;
  font-family: inherit;
}
.head-actions :deep(.btn:hover:not(:disabled)) { border-color: var(--report-accent); }
.head-actions :deep(.btn:disabled) { opacity: 0.55; cursor: not-allowed; }
.head-actions :deep(.btn-primary) {
  background: var(--report-accent);
  border-color: var(--report-accent);
  color: #fff;
}
@media (max-width: 900px) {
  .head-actions { justify-content: flex-start; width: 100%; }
  .report-head { flex-wrap: wrap; }
}
</style>
