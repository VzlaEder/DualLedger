<template>
  <div class="resumen" :style="estilo">
    <div
      v-for="(m, i) in metrics"
      :key="m.label"
      class="metrica"
      :class="{ destacada: m.destacada || i === 0 }"
    >
      <span>{{ m.label }}</span>
      <strong>{{ m.value }}</strong>
    </div>
  </div>
</template>

<script>
// Franja de métricas compartida por Activos Fijos, CxP y Relación de gastos.
// El módulo que la usa decide qué indicares mostrar y con qué acento.
export default {
  name: 'SummaryCards',
  props: {
    metrics: { type: Array, required: true },
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
.resumen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.metrica {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow);
}
.metrica span { font-size: 0.76rem; color: var(--text-secondary); }
.metrica strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.metrica.destacada {
  border-color: var(--report-accent);
  box-shadow: inset 0 3px 0 var(--report-accent), var(--shadow);
}
.metrica.destacada strong { color: var(--report-accent); }
@media (max-width: 620px) { .resumen { grid-template-columns: 1fr; } }
</style>
