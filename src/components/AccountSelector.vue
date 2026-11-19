<template>
  <div class="acct-selector">
    <button type="button" class="acct-btn" @click="open = !open" @keydown.esc="open = false">
      <template v-if="seleccionada">
        <span class="mono">{{ seleccionada.codigo }}</span>
        <span class="acct-name">{{ seleccionada.nombre }}</span>
      </template>
      <template v-else>
        <span class="acct-placeholder">{{ placeholder || 'Seleccionar cuenta contable…' }}</span>
      </template>
      <span class="chev">&#9662;</span>
    </button>

    <div v-if="open" class="acct-pop">
      <input
        v-model="buscador"
        class="search-input"
        type="search"
        placeholder="Buscar código o nombre…"
        autofocus
      />
      <div class="acct-list">
        <button
          v-for="c in resultados"
          :key="c.codigo"
          type="button"
          class="acct-item"
          :class="{ 'is-mov': c.esMovimiento }"
          @click="elegir(c)"
        >
          <span class="mono acct-code">{{ c.codigo }}</span>
          <span class="acct-name" :style="{ paddingLeft: ((c.nivel - 1) * 10) + 'px' }">{{ c.nombre }}</span>
        </button>
        <p v-if="!resultados.length" class="acct-empty">Sin coincidencias</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AccountSelector',
  props: {
    modelValue: { type: String, default: '' },
    cuentas: { type: Array, default: () => [] },
    placeholder: { type: String, default: '' },
    soloMovimiento: { type: Boolean, default: false },
    limite: { type: Number, default: 40 }
  },
  emits: ['update:modelValue', 'select'],
  data() {
    return { open: false, buscador: '' }
  },
  computed: {
    seleccionada() {
      return this.cuentas.find(c => c.codigo === this.modelValue) || null
    },
    resultados() {
      const f = this.buscador.trim().toLowerCase()
      let lista = this.cuentas
      if (this.soloMovimiento) lista = lista.filter(c => c.esMovimiento)
      if (f) {
        lista = lista.filter(c => String(c.codigo).toLowerCase().includes(f) || String(c.nombre).toLowerCase().includes(f))
      }
      return lista.slice(0, this.limite)
    }
  },
  methods: {
    elegir(c) {
      this.$emit('update:modelValue', c.codigo)
      this.$emit('select', c)
      this.open = false
      this.buscador = ''
    }
  }
}
</script>

<style scoped>
.acct-selector { position: relative; }

.acct-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 8px 10px;
  font-size: 0.82rem;
  cursor: pointer;
  text-align: left;
}

.acct-btn:hover { border-color: var(--primary); }

.acct-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.acct-placeholder { color: var(--text-secondary); flex: 1; }
.chev { color: var(--text-secondary); font-size: 0.7rem; }

.acct-pop {
  position: absolute;
  z-index: 20;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  padding: 8px;
}

.acct-pop .search-input {
  width: 100%;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 8px 10px;
  font-size: 0.82rem;
  margin-bottom: 8px;
}

.acct-list { max-height: 220px; overflow-y: auto; }

.acct-item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 0.8rem;
  cursor: pointer;
  text-align: left;
}

.acct-item:hover { background: rgba(var(--primary-rgb), 0.08); }
.acct-item .acct-code { white-space: nowrap; opacity: 0.8; }
.acct-empty { color: var(--text-secondary); font-size: 0.78rem; padding: 8px; text-align: center; }

.mono { font-family: 'Consolas', 'Menlo', monospace; }
</style>