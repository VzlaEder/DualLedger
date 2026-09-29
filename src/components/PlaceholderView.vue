<template>
  <div class="placeholder-view">
    <div class="ph-icon" v-html="icon"></div>
    <h2>{{ title }}</h2>
    <p class="ph-desc">{{ description }}</p>
    <div class="ph-soon">
      &#128295; Módulo en construcción — estará disponible en una próxima versión
    </div>
  </div>
</template>

<script>
export default {
  name: 'PlaceholderView',
  props: {
    title: { type: String, default: 'Módulo' },
    icon: { type: String, default: '&#128196;' },
    description: { type: String, default: 'Funcionalidad en construcción.' }
  }
}
</script>

<style scoped>
.placeholder-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 55vh;
  padding: 24px;
  gap: 8px;
}

.ph-icon {
  font-size: 3rem;
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--primary-rgb), 0.08);
  border-radius: 20px;
}

.placeholder-view h2 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 8px 0 0;
}

.ph-desc {
  max-width: 480px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
}

.ph-soon {
  margin-top: 14px;
  font-size: 0.78rem;
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.1);
  border: 1px dashed rgba(var(--accent-rgb), 0.4);
  border-radius: 8px;
  padding: 8px 14px;
}
</style>