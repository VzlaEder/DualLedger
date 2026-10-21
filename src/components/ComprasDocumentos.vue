<template>
  <div class="compras-docs">
    <div class="section-header">
      <h2>&#128190; Documentos guardados</h2>
      <div class="header-actions">
        <span v-if="origen === 'local'" class="sync-tag pendiente" title="La API no responde: se muestran los datos locales">
          &#9203; Modo local
        </span>
        <button class="btn-refresh" @click="cargar" :disabled="cargando">
          {{ cargando ? '&#9203; Cargando...' : '&#128260; Actualizar' }}
        </button>
      </div>
    </div>

    <div class="filtros">
      <input v-model="filtros.rif" type="text" placeholder="RIF" @keyup.enter="cargar" />
      <input v-model="filtros.proveedor" type="text" placeholder="Proveedor" @keyup.enter="cargar" />
      <input v-model="filtros.desde" type="text" placeholder="Desde (DD/MM/AAAA)" @keyup.enter="cargar" />
      <input v-model="filtros.hasta" type="text" placeholder="Hasta (DD/MM/AAAA)" @keyup.enter="cargar" />
      <button class="btn-refresh" @click="cargar">&#128269; Buscar</button>
    </div>

    <div class="resumen" v-if="resumen">
      <div class="resumen-item">
        <span class="resumen-label">Documentos</span>
        <span class="resumen-valor">{{ resumen.totalDocumentos || 0 }}</span>
      </div>
      <div class="resumen-item">
        <span class="resumen-label">Total compras</span>
        <span class="resumen-valor">{{ formatAmount(resumen.totalCompras || 0) }}</span>
      </div>
      <div class="resumen-item">
        <span class="resumen-label">Ret IVA</span>
        <span class="resumen-valor">{{ formatAmount(resumen.totalRetIva || 0) }}</span>
      </div>
      <div class="resumen-item">
        <span class="resumen-label">Crédito fiscal</span>
        <span class="resumen-valor">{{ formatAmount(resumen.totalCreditoFiscal || 0) }}</span>
      </div>
    </div>

    <div v-if="cargando" class="vacio">Cargando documentos...</div>
    <div v-else-if="!documentos.length" class="vacio">
      No hay documentos guardados todavía. Procesa una imagen y usa "Guardar en BD".
    </div>

    <div v-else class="tabla-wrap">
      <table class="tabla">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Comprobante</th>
            <th>RIF</th>
            <th>Proveedor</th>
            <th class="num">Base Nac.</th>
            <th class="num">Crd. Fiscal</th>
            <th class="num">Total</th>
            <th class="num">Ret IVA</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in documentos" :key="d.uid">
            <td>{{ d.fecha || d.fechaIso || '' }}</td>
            <td>{{ d.comprobante || d.comprobanteIva || '' }}</td>
            <td>{{ d.rif || '' }}</td>
            <td class="celda-proveedor">{{ d.nombreRazon || '' }}</td>
            <td class="num">{{ formatAmount(d.baseNacional) }}</td>
            <td class="num">{{ formatAmount(d.creditoFiscalNac) }}</td>
            <td class="num fuerte">{{ formatAmount(d.totalComprasIVA) }}</td>
            <td class="num">{{ d.retIVA ? formatAmount(d.retIVA) : '—' }}</td>
            <td>
              <span class="estado-tag" :class="(d.estado || '').toLowerCase()">{{ d.estado || 'BORRADOR' }}</span>
            </td>
            <td>
              <button class="icon-btn delete" @click="eliminar(d)" title="Eliminar documento">&#128465;</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { listarDocumentos, obtenerResumen, eliminarDocumento } from '../services/compras.js'
import { showConfirm, showToast } from '../utils/dialog.js'

export default {
  name: 'ComprasDocumentos',
  props: {
    refrescarKey: { type: Number, default: 0 }
  },
  data() {
    return {
      documentos: [],
      resumen: null,
      origen: 'api',
      cargando: false,
      filtros: { rif: '', proveedor: '', desde: '', hasta: '' }
    }
  },
  watch: {
    refrescarKey() {
      this.cargar()
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    async cargar() {
      this.cargando = true
      try {
        const res = await listarDocumentos(this.filtros)
        this.documentos = res.documentos || []
        this.origen = res.origen
        if (res.error) {
          showToast('API no disponible: mostrando datos locales', { type: 'warning' })
        }
      } catch (e) {
        showToast('Error al cargar los documentos: ' + (e.message || e), { type: 'error' })
      } finally {
        this.cargando = false
      }
      try {
        this.resumen = await obtenerResumen(this.filtros)
      } catch (e) {
        this.resumen = null
      }
    },
    async eliminar(doc) {
      const ok = await showConfirm('¿Eliminar el documento de la base de datos?', {
        confirmText: 'Eliminar',
        danger: true
      })
      if (!ok) return
      try {
        await eliminarDocumento(doc.uid)
        showToast('Documento eliminado')
        this.cargar()
      } catch (e) {
        showToast('No se pudo eliminar: ' + (e.message || e), { type: 'error' })
      }
    },
    formatAmount(v) {
      const n = Number(v)
      if (!isFinite(n)) return '0,00'
      return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
  }
}
</script>

<style scoped>
.compras-docs { padding: 4px 0; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-header h2 { font-size: 1.1rem; color: var(--text); }
.header-actions { display: flex; align-items: center; gap: 10px; }
.btn-refresh {
  background: rgba(var(--primary-rgb), 0.08);
  color: var(--primary);
  border: 1px solid rgba(var(--primary-rgb), 0.2);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-refresh:disabled { opacity: 0.55; cursor: not-allowed; }
.filtros { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.filtros input {
  flex: 1 1 140px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-input, var(--bg));
  color: var(--text);
  font-size: 0.82rem;
}
.resumen { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.resumen-item {
  flex: 1 1 140px;
  background: rgba(var(--primary-rgb), 0.05);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
}
.resumen-label { font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
.resumen-valor { font-size: 1rem; font-weight: 700; color: var(--text); }
.tabla-wrap { overflow-x: auto; }
.tabla { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.tabla th, .tabla td { padding: 7px 8px; text-align: left; border-bottom: 1px solid var(--border); }
.tabla th { color: var(--text-secondary); font-size: 0.72rem; text-transform: uppercase; white-space: nowrap; }
.tabla td { color: var(--text); }
.tabla .num { text-align: right; white-space: nowrap; }
.tabla .fuerte { font-weight: 700; color: var(--primary); }
.celda-proveedor { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.estado-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary);
}
.estado-tag.validado { background: rgba(34, 197, 94, 0.14); color: #16a34a; }
.estado-tag.enviado { background: rgba(59, 130, 246, 0.14); color: #2563eb; }
.estado-tag.anulado { background: rgba(var(--error-rgb), 0.12); color: var(--error); }
.vacio { padding: 28px; text-align: center; color: var(--text-secondary); font-size: 0.85rem; }
.icon-btn.delete { background: rgba(var(--error-rgb), 0.08); color: var(--error); border: none; cursor: pointer; border-radius: 6px; padding: 4px 7px; }
.icon-btn.delete:hover { background: rgba(var(--error-rgb), 0.15); }
.sync-tag { padding: 2px 8px; border-radius: 10px; font-size: 0.68rem; font-weight: 700; }
.sync-tag.pendiente { background: rgba(245, 158, 11, 0.16); color: #b45309; }
</style>
