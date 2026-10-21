<template>
  <div class="dashboard">
    <div class="section-header">
      <div>
        <h2>Dashboard</h2>
        <p class="section-sub">Resumen general de la actividad del negocio</p>
      </div>
    </div>

    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-icon" v-html="k.icon"></span>
          <span v-if="k.delta" class="kpi-delta" :class="k.up ? 'up' : 'down'">
            {{ k.delta }}
          </span>
        </div>
        <div class="kpi-value">{{ k.value }}</div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="chart-grid">
      <section class="panel chart-panel">
        <h3 class="panel-title">Compras vs Ventas (últimos 6 meses)</h3>
        <svg class="chart-svg" viewBox="0 0 560 210" role="img" aria-label="Compras vs ventas por mes">
          <line
            v-for="t in barGrid"
            :key="t.y"
            :x1="34"
            :x2="544"
            :y1="t.y"
            :y2="t.y"
            stroke="var(--divider-weak)"
            stroke-width="1"
          />
          <text
            v-for="t in barGrid"
            :key="'t' + t.y"
            x="28"
            :y="t.y + 4"
            class="chart-axis"
            text-anchor="end"
          >{{ t.label }}</text>
          <g v-for="g in barGroups" :key="g.label">
            <rect :x="g.x1" :y="g.y1" :width="g.bw" :height="g.h1" rx="3" fill="var(--primary)" />
            <rect :x="g.x2" :y="g.y2" :width="g.bw" :height="g.h2" rx="3" fill="var(--accent)" />
            <text :x="g.cx" y="200" class="chart-axis" text-anchor="middle">{{ g.label }}</text>
          </g>
        </svg>
        <div class="chart-legend">
          <span><i class="dot dot-primary"></i> Compras</span>
          <span><i class="dot dot-accent"></i> Ventas</span>
        </div>
      </section>

      <section class="panel chart-panel">
        <h3 class="panel-title">Distribución por tipo de documento</h3>
        <div class="donut-wrap">
          <svg class="chart-svg donut-svg" viewBox="0 0 200 200" role="img" aria-label="Tipos de documentos">
            <circle cx="100" cy="100" r="66" fill="none" stroke="var(--divider-weak)" stroke-width="26" />
            <circle
              v-for="s in donutSegments"
              :key="s.label"
              cx="100"
              cy="100"
              r="66"
              fill="none"
              :stroke="s.color"
              stroke-width="26"
              :stroke-dasharray="s.dash"
              :stroke-dashoffset="s.offset"
              transform="rotate(-90 100 100)"
            />
            <text x="100" y="96" class="donut-center" text-anchor="middle">{{ donutTotal }}</text>
            <text x="100" y="114" class="donut-sub" text-anchor="middle">documentos</text>
          </svg>
          <ul class="donut-legend">
            <li v-for="s in donutSegments" :key="s.label">
              <i class="dot" :style="{ background: s.color }"></i>
              {{ s.label }}
              <b>{{ s.percent }}%</b>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <section class="panel chart-panel">
      <h3 class="panel-title">Evolución mensual de compras (Bs)</h3>
      <svg class="chart-svg" viewBox="0 0 560 210" role="img" aria-label="Evolución de compras mensual">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.22" />
            <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <line
          v-for="t in lineGrid"
          :key="t.y"
          :x1="44"
          :x2="540"
          :y1="t.y"
          :y2="t.y"
          stroke="var(--divider-weak)"
          stroke-width="1"
        />
        <text
          v-for="t in lineGrid"
          :key="'t' + t.y"
          x="38"
          :y="t.y + 4"
          class="chart-axis"
          text-anchor="end"
        >{{ t.label }}</text>
        <polygon :points="lineArea" fill="url(#lineFill)" />
        <polyline :points="linePoints" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <circle
          v-for="p in lineDots"
          :key="'d' + p.x"
          :cx="p.x"
          :cy="p.y"
          r="3.5"
          fill="var(--surface)"
          stroke="var(--primary)"
          stroke-width="2"
        />
        <text
          v-for="p in lineDots"
          :key="'l' + p.x"
          :x="p.x"
          :y="p.y - 9"
          class="chart-axis chart-label"
          text-anchor="middle"
        >{{ p.label }}</text>
        <text
          v-for="p in lineMonth"
          :key="'m' + p.x"
          :x="p.x"
          y="202"
          class="chart-axis"
          text-anchor="middle"
        >{{ p.label }}</text>
      </svg>
    </section>
  </div>
</template>

<script>
export default {
  name: 'DashboardView',
  data() {
    return {
      kpis: [
        { label: 'Compras procesadas (mes)', value: '124', icon: '&#128722;', delta: '+12%', up: true },
        { label: 'Ventas registradas (mes)', value: '86', icon: '&#128176;', delta: '+8%', up: true },
        { label: 'Monto procesado (mes)', value: 'Bs 45.320,00', icon: '&#128200;', delta: '-3%', up: false },
        { label: 'Proveedores activos', value: '32', icon: '&#127981;', delta: '+2', up: true }
      ],
      barMonths: ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'],
      barCompras: [12, 18, 14, 20, 16, 24],
      barVentas: [9, 12, 15, 11, 14, 18],
      donutData: [
        { label: 'Facturas', percent: 70 },
        { label: 'Notas de crédito', percent: 15 },
        { label: 'Notas de débito', percent: 5 },
        { label: 'Reportes Z', percent: 10 }
      ],
      donutColors: ['var(--primary)', 'var(--accent)', '#10b981', '#8b5cf6'],
      lineMonths: ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'],
      lineValues: [32000, 45000, 28000, 51000, 48000, 62000]
    }
  },
  computed: {
    donutTotal() {
      return this.donutData.reduce((s, d) => s + d.percent, 0)
    },
    donutSegments() {
      const C = 2 * Math.PI * 66
      let cum = 0
      return this.donutData.map((d, i) => {
        const frac = d.percent / this.donutTotal
        const seg = {
          label: d.label,
          percent: d.percent,
          color: this.donutColors[i % this.donutColors.length],
          dash: `${frac * C} ${C}`,
          offset: -cum * C
        }
        cum += frac
        return seg
      })
    },
    barMax() {
      return Math.max(...this.barCompras, ...this.barVentas)
    },
    barGrid() {
      const plotH = 210 - 30 - 14
      const top = 14
      return [
        { y: top, label: String(Math.ceil(this.barMax / 25) * 25) },
        { y: top + plotH / 2, label: String(Math.ceil(this.barMax / 25) * 12.5) },
        { y: top + plotH, label: '0' }
      ]
    },
    barGroups() {
      const padL = 34
      const plotW = 560 - padL - 16
      const plotH = 210 - 30 - 14
      const n = this.barMonths.length
      const groupW = plotW / n
      const bw = Math.min(16, groupW * 0.28)
      const max = this.barMax
      return this.barMonths.map((label, i) => {
        const cx = padL + i * groupW + groupW / 2
        const v1 = this.barCompras[i]
        const v2 = this.barVentas[i]
        const h1 = (v1 / max) * plotH
        const h2 = (v2 / max) * plotH
        return {
          label,
          cx,
          x1: cx - bw - 2,
          x2: cx + 2,
          bw,
          y1: 14 + plotH - h1,
          y2: 14 + plotH - h2,
          h1,
          h2
        }
      })
    },
    lineMax() {
      return Math.ceil(Math.max(...this.lineValues) / 10000) * 10000
    },
    lineGrid() {
      const plotH = 210 - 28 - 14
      const top = 14
      let ticks = []
      const step = this.lineMax / 4
      for (let i = 4; i >= 0; i--) {
        const v = i * step
        ticks.push({ y: top + plotH - (v / this.lineMax) * plotH, label: this.fmt(v) })
      }
      return ticks
    },
    linePoints() {
      return this.lineCoords.map((p) => `${p.x},${p.y}`).join(' ')
    },
    lineArea() {
      const coords = this.lineCoords
      const bottom = 14 + (210 - 28 - 14)
      return `${coords[0].x},${bottom} ${coords.map((p) => `${p.x},${p.y}`).join(' ')} ${coords[coords.length - 1].x},${bottom}`
    },
    lineDots() {
      return this.lineCoords.map((p, i) => ({
        x: p.x,
        y: p.y,
        label: this.fmt(this.lineValues[i])
      }))
    },
    lineMonth() {
      return this.lineCoords.map((p, i) => ({ x: p.x, label: this.lineMonths[i] }))
    },
    lineCoords() {
      const padL = 44
      const plotW = 560 - padL - 20
      const plotH = 210 - 28 - 14
      const n = this.lineValues.length
      const stepX = plotW / (n - 1)
      return this.lineValues.map((v, i) => ({
        x: padL + i * stepX,
        y: 14 + plotH - (v / this.lineMax) * plotH
      }))
    }
  },
  methods: {
    fmt(v) {
      return 'Bs ' + v.toLocaleString('es-VE')
    }
  }
}
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.section-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 2px 0 0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
  gap: 14px;
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.kpi-icon {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  background: rgba(var(--primary-rgb), 0.1);
  border-radius: 10px;
}

.kpi-delta {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
}

.kpi-delta.up {
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success);
}

.kpi-delta.down {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error);
}

.kpi-value {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.1;
}

.kpi-label {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.chart-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 14px;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}

.panel-title {
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0 0 12px;
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.chart-axis {
  font-size: 10px;
  fill: var(--text-secondary);
}

.chart-label {
  font-size: 9px;
}

.chart-legend {
  display: flex;
  gap: 18px;
  justify-content: center;
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--text-secondary);
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}

.dot-primary {
  background: var(--primary);
}

.dot-accent {
  background: var(--accent);
}

.donut-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.donut-svg {
  max-width: 180px;
}

.donut-center {
  font-size: 18px;
  font-weight: 800;
  fill: var(--text);
}

.donut-sub {
  font-size: 10px;
  fill: var(--text-secondary);
}

.donut-legend {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
}

.donut-legend li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  padding: 3px 0;
  color: var(--text);
}

.donut-legend b {
  margin-left: auto;
  color: var(--text-secondary);
  font-weight: 600;
}

@media (max-width: 900px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>