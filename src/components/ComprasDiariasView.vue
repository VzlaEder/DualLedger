<template>
  <div class="cd-view">
    <!-- ===================== LISTADO (manual 1.3) ===================== -->
    <template v-if="!editando">
      <div class="cd-head">
        <div>
          <h2>Compras diarias</h2>
          <p class="sub">
            Registro de las facturas de compras. Al guardar se generan automáticamente
            las retenciones de IVA e ISLR (manual 1.3 / 1.3.1.4).
          </p>
        </div>
        <div class="head-actions">
          <button class="btn" :disabled="cargando" @click="cargar">Ver (F5)</button>
          <button class="btn" :disabled="!seleccionado" @click="imprimir('iva')">Imprimir (F6)</button>
          <button class="btn" :disabled="cargando" @click="exportarExcel">Exportar Excel (F7)</button>
          <button class="btn btn-primary" @click="nuevo">+ Nuevo</button>
        </div>
      </div>

      <div class="card">
        <div class="filtros">
          <div class="filtro">
            <label>Almacén</label>
            <select v-model="filtros.almacen" class="input">
              <option value="">Seleccione</option>
              <option v-for="a in almacenes" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>
          <div class="filtro">
            <label>Desde</label>
            <input v-model="filtros.desde" class="input" type="date" />
          </div>
          <div class="filtro">
            <label>Hasta</label>
            <input v-model="filtros.hasta" class="input" type="date" />
          </div>
          <div class="filtro">
            <label>Status</label>
            <select v-model="filtros.status" class="input">
              <option value="">Todos</option>
              <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="filtro filtro-buscar">
            <label>Buscar</label>
            <input v-model="filtros.busqueda" class="input" type="search" placeholder="Factura, control, RIF o proveedor…" />
          </div>
        </div>

        <div class="toolbar">
          <span class="count">{{ filtrados.length }} de {{ documentos.length }} facturas</span>
          <span v-if="origen === 'local'" class="sync-tag pendiente" title="La API no responde: se muestran los datos guardados en este equipo">
            Modo local
          </span>
          <button class="btn btn-small" :disabled="!filtrados.length" @click="procesarPendientes">Procesar</button>
          <button class="btn btn-small" @click="recalcularTodo">Re-Calcular</button>
        </div>

        <div v-if="filtrados.length" class="table-scroll">
          <table class="cd-table">
            <thead>
              <tr>
                <th>Serie</th>
                <th>Número</th>
                <th>Control</th>
                <th>Proveedor</th>
                <th>RIF</th>
                <th>Status</th>
                <th>Condición</th>
                <th>Fecha Vence</th>
                <th class="num">Total</th>
                <th>Inventario</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(d, i) in filtrados"
                :key="d.uid"
                :class="{ selected: seleccionado && seleccionado.uid === d.uid }"
                @click="seleccionado = d"
              >
                <td class="mono">{{ serie(d) }}</td>
                <td class="mono fuerte">{{ d.nroFactura || '—' }}</td>
                <td class="mono">{{ d.nroControl || '—' }}</td>
                <td>{{ d.nombreRazon || '—' }}</td>
                <td class="mono">{{ d.rif || '—' }}</td>
                <td><span class="pill">{{ d.estado || 'VALIDADO' }}</span></td>
                <td>{{ d.condicion || '—' }}</td>
                <td>{{ fechaMostrar(payloadDe(d).fechaVence || d.fecha) }}</td>
                <td class="num">{{ dinero(d.totalComprasIVA) }}</td>
                <td>{{ payloadDe(d).inventario ? 'Verificado' : 'No Registrado' }}</td>
                <td class="row-actions">
                  <button class="btn btn-small" @click.stop="abrir(d)">Ver</button>
                  <button class="btn btn-small btn-danger" @click.stop="eliminar(d)">Eliminar</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-state">
          <p v-if="cargando">Cargando facturas…</p>
          <p v-else-if="documentos.length">No hay facturas que coincidan con los filtros.</p>
          <p v-else>
            No hay facturas registradas. Pulsa «+ Nuevo» para abrir la ficha
            «Agregar o modificar factura» del manual.
          </p>
        </div>

        <div v-if="resumen.total" class="resumen">
          <span>Total de compras: <strong>{{ dinero(resumen.total) }}</strong></span>
          <span>Base imponible: <strong>{{ dinero(resumen.base) }}</strong></span>
          <span>Retención IVA: <strong>{{ dinero(resumen.retIva) }}</strong></span>
        </div>
      </div>
    </template>

    <!-- ===================== FICHA (manual 1.3.1) ===================== -->
    <template v-else>
      <div class="cd-head">
        <div>
          <h2>{{ esNuevo ? 'Nueva factura de compra' : 'Modificar factura de compra' }}</h2>
          <p class="sub">
            {{ esNuevo ? 'Ficha nueva' : `${proveedorLabel} · Factura ${factura.nroFactura || '—'}` }}
            · fecha de declaración = fecha de las retenciones
          </p>
        </div>
        <div class="head-actions">
          <button class="btn btn-volver" :disabled="guardando" @click="volver">
            &#8592; Volver a Compras diarias
          </button>
        </div>
      </div>

      <div class="card ficha">
        <div class="ficha-toolbar">
          <button class="btn" :disabled="guardando" @click="nuevo">Incluir(F5)</button>
          <button class="btn btn-primary" :disabled="guardando" @click="guardar">
            {{ guardando ? 'Guardando…' : 'Guardar(F2)' }}
          </button>
          <button class="btn" :disabled="guardando" @click="buscar">Buscar(F3)</button>
          <button class="btn btn-danger" :disabled="guardando || esNuevo" @click="eliminarFactura">Eliminar(F11)</button>
          <button class="btn" :disabled="guardando" @click="cancelar">Cancelar(F12)</button>
          <span class="toolbar-sep"></span>
          <button class="btn" :class="{ active: tab === 'islr' }" @click="tab = 'islr'">ISLR</button>
          <button class="btn" :class="{ active: tab === 'retenciones' }" @click="tab = 'retenciones'">IVA</button>
          <button class="btn" :class="{ active: tab === 'avanzado' }" @click="tab = 'avanzado'">CxP(F9)</button>
          <button class="btn" @click="imprimir('islr')">Imprimir(F10)</button>
          <button class="btn" :class="{ active: tab === 'inventario' }" @click="tab = 'inventario'">Inventario</button>
          <button class="btn" :class="{ active: tab === 'avanzado' }" @click="tab = 'avanzado'">Avanzado</button>
        </div>

        <div class="tabs">
          <button
            v-for="t in pestañas"
            :key="t.id"
            type="button"
            class="tab"
            :class="{ active: tab === t.id }"
            @click="tab = t.id"
          >{{ t.label }}</button>
        </div>

        <div class="ficha-cuerpo">
          <div class="ficha-principal">
            <!-- ---------- Encabezado ---------- -->
            <div v-if="tab === 'encabezado'" class="tab-body">
              <div class="grid">
                <div class="field field-wide">
                  <label>Proveedor</label>
                  <div class="con-row">
                    <input :value="proveedorCodigo" class="input mono codigo-prov" readonly />
                    <input :value="factura.proveedorNombre" class="input" readonly placeholder="Seleccione un proveedor" />
                    <button class="btn" type="button" @click="abrirProveedores">Aceptar</button>
                  </div>
                </div>

                <div class="field">
                  <label>Fecha Emisión</label>
                  <input v-model="factura.fechaEmision" class="input" type="date" />
                </div>
                <div class="field">
                  <label>Fecha Vence</label>
                  <input v-model="factura.fechaVence" class="input" type="date" />
                </div>
                <div class="field">
                  <label>Fecha Declaración</label>
                  <input v-model="factura.fechaDeclaracion" class="input" type="date" />
                </div>
                <div class="field">
                  <label>Status</label>
                  <select v-model="factura.status" class="input">
                    <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>

                <div class="field">
                  <label>Nro. Factura</label>
                  <div class="con-row">
                    <select v-model="factura.tipoDocumento" class="input tipo-doc">
                      <option v-for="t in tiposDocumento" :key="t.value" :value="t.value">{{ t.label }}</option>
                    </select>
                    <input v-model="factura.nroFactura" class="input" />
                  </div>
                </div>
                <div class="field">
                  <label>Doc. Aplica</label>
                  <input v-model="factura.docAplica" class="input" />
                </div>
                <div class="field">
                  <label>Nro. Control</label>
                  <input v-model="factura.nroControl" class="input mono" />
                </div>
                <div class="field">
                  <label>Obras</label>
                  <select v-model="factura.obras" class="input">
                    <option value="">Seleccione</option>
                    <option v-for="o in obrasOpciones" :key="o" :value="o">{{ o }}</option>
                  </select>
                </div>

                <div class="field field-wide checks">
                  <label class="check-line">
                    <input v-model="factura.creditoFiscalNoDeducible" type="checkbox" />
                    Crédito fiscal no deducible
                  </label>
                  <label class="check-line">
                    <input v-model="factura.importacion" type="checkbox" />
                    Importación
                  </label>
                </div>

                <div class="field field-wide">
                  <label>Dirección</label>
                  <input v-model="factura.direccion" class="input" />
                </div>
                <div class="field field-wide">
                  <label>Comentarios</label>
                  <input v-model="factura.comentarios" class="input" />
                </div>
                <div class="field">
                  <label>Requisición</label>
                  <input v-model="factura.requisicion" class="input" />
                </div>
                <div class="field">
                  <label>Fletes y Otros gastos</label>
                  <input v-model.number="factura.fletesOtrosGastos" class="input" type="number" min="0" step="0.01" />
                </div>
                <div class="field">
                  <label>Expediente</label>
                  <input v-model="factura.expediente" class="input" />
                </div>
                <div class="field">
                  <label>Documento Digital</label>
                  <input v-model="factura.documentoDigital" class="input" placeholder="Ruta o nombre del archivo" />
                </div>
                <div class="field">
                  <label>Almacén</label>
                  <select v-model="factura.almacen" class="input">
                    <option value="">Seleccione</option>
                    <option v-for="a in almacenes" :key="a" :value="a">{{ a }}</option>
                  </select>
                </div>
                <div class="field">
                  <label>Cuenta contable (C.C Compra)</label>
                  <div class="con-row">
                    <input :value="factura.codigoCuenta" class="input mono" readonly />
                    <button class="btn" type="button" @click="abrirCuentas">Seleccione…</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- ---------- Detalles ---------- -->
            <div v-else-if="tab === 'detalles'" class="tab-body">
              <div class="det-toolbar">
                <button class="btn" type="button" @click="abrirArticulos">Importar</button>
                <button class="btn" type="button" @click="agregarLinea">+ Línea</button>
                <span class="muted">Los códigos vienen del maestro Compras → Articulos.</span>
              </div>
              <div class="table-scroll">
                <table class="lineas-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th class="num">Cantidad</th>
                      <th class="num">Precio</th>
                      <th>Tipo</th>
                      <th class="num">IVA %</th>
                      <th class="num">Sub Total</th>
                      <th class="num">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(l, i) in factura.detalles" :key="i">
                      <td><input v-model="l.codigo" class="input cell mono" /></td>
                      <td><input v-model="l.descripcion" class="input cell" /></td>
                      <td><input v-model.number="l.cantidad" class="input cell num" type="number" min="0" step="0.01" /></td>
                      <td><input v-model.number="l.precio" class="input cell num" type="number" min="0" step="0.01" /></td>
                      <td>
                        <select v-model="l.tipo" class="input cell">
                          <option>Producto</option>
                          <option>Servicio</option>
                        </select>
                      </td>
                      <td>
                        <select v-model.number="l.alicuotaIVA" class="input cell num">
                          <option v-for="a in alicuotas" :key="a" :value="a">{{ a }}</option>
                        </select>
                      </td>
                      <td class="num">{{ dinero(lineas[i].subTotal) }}</td>
                      <td class="num fuerte">{{ dinero(lineas[i].total) }}</td>
                      <td><button class="btn btn-small btn-danger" type="button" @click="quitarLinea(i)">×</button></td>
                    </tr>
                    <tr v-if="!factura.detalles.length">
                      <td colspan="9" class="sin-lineas">Sin líneas. Pulsa «Importar» para traer artículos o «+ Línea».</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- ---------- Retenciones ---------- -->
            <div v-else-if="tab === 'retenciones'" class="tab-body">
              <div class="ret-tabla">
                <div class="ret-row enc">
                  <span>Tipo</span><span>Concepto</span><span class="num">Base</span>
                  <span class="num">%</span><span class="num">Monto</span><span>Fecha</span><span>Comprobante</span><span></span>
                </div>
                <div class="ret-row">
                  <span><strong>Ret. IVA</strong></span>
                  <span>RETENCIÓN IVA {{ factura.porcentajeContribucion }}%</span>
                  <span class="num">{{ dinero(retenciones.baseIva) }}</span>
                  <span class="num">{{ retenciones.alicuota }}</span>
                  <span class="num fuerte">{{ dinero(retenciones.retIva) }}</span>
                  <span>{{ fechaMostrar(retenciones.fechaRetencion) }}</span>
                  <span class="mono">{{ retenciones.comprobanteIVA }}</span>
                  <span class="ret-actions">
                    <button class="btn btn-small" @click="actualizarComprobantes">Actualiza</button>
                    <button class="btn btn-small" @click="imprimir('iva')">Imprimir</button>
                  </span>
                </div>
                <div class="ret-row">
                  <span><strong>Ret. ISLR</strong></span>
                  <span>{{ retenciones.detalleIslr ? retenciones.detalleIslr.nombre : 'Sin concepto ISLR' }}</span>
                  <span class="num">{{ dinero(totales.baseImponible) }}</span>
                  <span class="num">{{ retenciones.detalleIslr ? retenciones.detalleIslr.porcentaje : 0 }}</span>
                  <span class="num fuerte">{{ dinero(retenciones.retIslr) }}</span>
                  <span>{{ fechaMostrar(retenciones.fechaRetencion) }}</span>
                  <span class="mono">{{ retenciones.comprobanteISLR }}</span>
                  <span class="ret-actions">
                    <button class="btn btn-small" @click="tab = 'islr'">Concepto</button>
                    <button class="btn btn-small" @click="imprimir('islr')">Imprimir</button>
                  </span>
                </div>
              </div>
              <p class="nota-legal">
                LA CONDICIÓN DE ESTE CONTRIBUYENTE REQUIERE LA RETENCIÓN DEL
                {{ factura.porcentajeContribucion }}% DEL IMPUESTO CAUSADO, SALVO QUE INCURRA…
              </p>
              <p class="muted">{{ parametros.empresa && parametros.empresa.razonSocial }}</p>
            </div>

            <!-- ---------- ISLR ---------- -->
            <div v-else-if="tab === 'islr'" class="tab-body">
              <div class="grid">
                <div class="field field-wide">
                  <label>Concepto de retención ISLR</label>
                  <select v-model="factura.conceptoIslr" class="input">
                    <option value="">Sin retención ISLR</option>
                    <option v-for="c in conceptos" :key="c.codigo" :value="c.codigo">
                      {{ c.codigo }} — {{ c.nombre }}
                    </option>
                  </select>
                </div>
                <div class="field"><label>Porcentaje</label><input :value="conceptoSeleccionado ? conceptoSeleccionado.porcentaje : 0" class="input" readonly /></div>
                <div class="field"><label>Sustraendo (UT)</label><input :value="conceptoSeleccionado ? conceptoSeleccionado.sustraendoUt : 0" class="input" readonly /></div>
                <div class="field"><label>Base mínima (UT)</label><input :value="conceptoSeleccionado ? conceptoSeleccionado.baseMinimaUt : 0" class="input" readonly /></div>
                <div class="field"><label>Unidad Tributaria (UT)</label><input v-model.number="unidadTributaria" class="input" type="number" min="0" step="0.01" /></div>
                <div class="field"><label>Base imponible</label><input :value="totales.baseImponible" class="input" readonly /></div>
                <div class="field"><label>Retención ISLR</label><input :value="retenciones.retIslr" class="input fuerte" readonly /></div>
                <div class="field"><label>Comprobante ISLR</label><input :value="retenciones.comprobanteISLR" class="input mono" readonly /></div>
                <div class="field"><label>Fecha retención</label><input :value="retenciones.fechaRetencion" class="input" readonly /></div>
              </div>
              <p v-if="!unidadTributaria" class="aviso">
                La UT está en 0. Configúrala en Maestros → Parámetros para calcular la retención ISLR.
              </p>
              <p class="muted">
                Fórmula: (base × porcentaje / 100) − (sustraendo × UT). La fecha de declaración
                debe ser igual a la fecha de las retenciones (manual 1.3.1.3).
              </p>
            </div>

            <!-- ---------- Inventario ---------- -->
            <div v-else-if="tab === 'inventario'" class="tab-body">
              <div class="det-toolbar">
                <button class="btn" type="button" @click="verificarInventario">Verificar Inventario</button>
                <select v-model="filtroArticulosInventario" class="input filtro-inv">
                  <option value="todos">Todos los Artículos</option>
                  <option value="factura">Solo los artículos de la factura</option>
                </select>
                <span v-if="inventarioVerificado" class="pill ok">Verificado</span>
              </div>
              <div class="table-scroll tabla-inv">
                <table class="art-table">
                  <thead><tr><th>Status</th><th>Código</th><th>Descripción</th><th>Existe</th><th>Almacén</th><th>Ubicación</th></tr></thead>
                  <tbody>
                    <tr v-for="a in articulosInventario" :key="a.codigo">
                      <td>{{ inventarioVerificado ? 'OK' : '—' }}</td>
                      <td class="mono">{{ a.codigo }}</td>
                      <td>{{ a.nombre }}</td>
                      <td class="num">{{ dinero(a.existencia) }}</td>
                      <td>{{ a.almacenInicial || '—' }}</td>
                      <td>{{ a.presentacionModelo || '—' }}</td>
                    </tr>
                    <tr v-if="!articulosInventario.length">
                      <td colspan="6" class="sin-lineas">No hay artículos para mostrar.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- ---------- Avanzado ---------- -->
            <div v-else class="tab-body">
              <div class="grid">
                <div class="field"><label>Expediente</label><input v-model="factura.expediente" class="input" /></div>
                <div class="field"><label>Nro. Planilla</label><input v-model="factura.nroPlanilla" class="input" /></div>
                <div class="field"><label>Requisición</label><input v-model="factura.requisicion" class="input" /></div>
                <div class="field"><label>Obras</label><input v-model="factura.obras" class="input" /></div>
                <div class="field"><label>Doc. Aplica</label><input v-model="factura.docAplica" class="input" /></div>
                <div class="field"><label>Documento Digital</label><input v-model="factura.documentoDigital" class="input" /></div>
                <div class="field"><label>Condición (CxP)</label><input :value="factura.status" class="input" readonly /></div>
                <div class="field"><label>Origen</label><input value="Compras diarias" class="input" readonly /></div>
                <div class="field field-wide"><label>Comentarios</label><input v-model="factura.comentarios" class="input" /></div>
                <div class="field"><label>UID</label><input :value="factura.uid" class="input mono" readonly /></div>
              </div>
            </div>
          </div>

          <!-- ---------- Panel de totales y retenciones (siempre visible) ---------- -->
          <aside class="panel-retenciones">
            <h3>Retenciones</h3>
            <div class="totales">
              <div><span>Subtotal</span><strong>{{ dinero(totales.subtotal) }}</strong></div>
              <div><span>Exento</span><strong>{{ dinero(totales.exento) }}</strong></div>
              <div><span>IVA</span><strong>{{ dinero(totales.iva) }}</strong></div>
              <div><span>IVA Adicional</span><strong>{{ dinero(0) }}</strong></div>
              <div class="total"><span>Total General</span><strong>{{ dinero(totales.totalGeneral) }}</strong></div>
              <div class="total"><span>Total General IGTF</span><strong>{{ dinero(totales.igtf) }}</strong></div>
            </div>
            <div class="panel-ret">
              <span class="ret-titulo">Ret. IVA {{ factura.porcentajeContribucion }}%</span>
              <button class="btn btn-small" @click="actualizarComprobantes">Actualiza</button>
              <strong class="mono">{{ retenciones.comprobanteIVA }}</strong>
              <span>{{ dinero(retenciones.retIva) }}</span>
            </div>
            <div class="panel-ret">
              <span class="ret-titulo">Ret. ISLR</span>
              <button class="btn btn-small" @click="tab = 'islr'">Concepto</button>
              <strong class="mono">{{ retenciones.comprobanteISLR }}</strong>
              <span>{{ dinero(retenciones.retIslr) }}</span>
            </div>
            <label class="check-line igtf-check">
              <input v-model="factura.aplicarIgtf" type="checkbox" />
              Aplicar IGTF ({{ parametros.tasaIGTF }}%)
            </label>
            <p class="nota-legal corta">
              LA CONDICIÓN DE ESTE CONTRIBUYENTE REQUIERE LA RETENCIÓN DEL
              {{ factura.porcentajeContribucion }}% DEL IMPUESTO CAUSADO, SALVO QUE INCURRA…
            </p>
            <div class="panel-actions">
              <button class="btn btn-small" @click="imprimir('islr')">Imprimir retención ISLR</button>
              <button class="btn btn-small" @click="imprimir('iva')">Imprimir retención IVA</button>
            </div>
          </aside>
        </div>
      </div>
    </template>

    <!-- ===== Modales de selección ===== -->
    <div v-if="modalProveedores" class="modal-backdrop">
      <div class="modal">
        <h3>Seleccionar proveedor</h3>
        <input v-model="busquedaProveedores" class="input" type="search" placeholder="Nombre, RIF o código…" />
        <div class="modal-list">
          <button
            v-for="(p, i) in proveedoresFiltrados"
            :key="p.rif"
            type="button"
            class="modal-item"
            @click="elegirProveedor(p, i)"
          >
            <span class="mono">{{ p.codigo || codigoProveedor(i) }}</span>
            <span class="mono">{{ p.rif }}</span>
            <span class="fuerte">{{ p.nombre }}</span>
          </button>
          <p v-if="!proveedoresFiltrados.length" class="muted">
            No hay proveedores. Regístralos en Compras → Proveedores.
          </p>
        </div>
        <button class="btn" @click="modalProveedores = false">Cerrar</button>
      </div>
    </div>

    <div v-if="modalArticulos" class="modal-backdrop">
      <div class="modal">
        <h3>Consulta Artículos — Importar</h3>
        <input v-model="busquedaArticulos" class="input" type="search" placeholder="Código o descripción…" />
        <div class="modal-list">
          <button
            v-for="a in articulosFiltrados"
            :key="a.uid || a.codigo"
            type="button"
            class="modal-item"
            @click="importarArticulo(a)"
          >
            <span class="mono">{{ a.codigo }}</span>
            <span class="fuerte">{{ a.nombre }}</span>
            <span>{{ a.tipo }}</span>
            <span class="num">{{ dinero(a.precioVenta) }}</span>
          </button>
          <p v-if="!articulosFiltrados.length" class="muted">
            No hay artículos. Regístralos en Compras → Articulos.
          </p>
        </div>
        <button class="btn" @click="modalArticulos = false">Cerrar</button>
      </div>
    </div>

    <div v-if="modalCuentas" class="modal-backdrop">
      <div class="modal">
        <h3>Seleccionar cuenta contable</h3>
        <input v-model="busquedaCuentas" class="input" type="search" placeholder="Código o nombre de la cuenta…" />
        <div class="modal-list">
          <button
            v-for="c in cuentasFiltradas"
            :key="c.codigo"
            type="button"
            class="modal-item"
            @click="elegirCuenta(c)"
          >
            <span class="mono">{{ c.codigo }}</span>
            <span class="fuerte">{{ c.nombre }}</span>
          </button>
          <p v-if="!cuentasFiltradas.length" class="muted">No hay cuentas que coincidan.</p>
        </div>
        <button class="btn" @click="modalCuentas = false">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script>
import AccountSelector from './AccountSelector.vue'
import { showAlert, showConfirm, showToast } from '../utils/dialog.js'
import { getCuentas, getProveedores } from '../stores/maestrosDb.js'
import { getArticulos } from '../stores/articulosDb.js'
import { generarUid } from '../stores/comprasDb.js'
import { listarDocumentos, guardarDocumento, eliminarDocumentoOffline } from '../services/compras.js'
import { cargarConceptos } from '../services/conceptosIslr.js'
import { cargarParametros } from '../services/parametros.js'
import { codigoProveedor } from '../services/proveedores.js'
import {
  ALICUOTAS_IVA,
  TIPOS_DOCUMENTO_COMPRA,
  aDocumentoLibro,
  calcularLinea,
  calcularRetenciones,
  calcularTotales,
  facturaVacia,
  lineaVacia,
  validarFacturaDiaria
} from '../services/comprasDiarias.js'

function hoyIso() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

export default {
  name: 'ComprasDiariasView',
  components: { AccountSelector },
  data() {
    return {
      documentos: [],
      proveedores: [],
      articulos: [],
      cuentas: [],
      conceptos: [],
      parametros: { empresa: {}, unidadTributaria: 0, tasaIVA: 16, tasaIGTF: 3 },
      unidadTributaria: 0,
      cargando: false,
      guardando: false,
      origen: 'local',
      seleccionado: null,
      filtros: { almacen: '', desde: '', hasta: '', status: '', busqueda: '' },
      editando: false,
      esNuevo: false,
      factura: facturaVacia(),
      tab: 'encabezado',
      secuencia: 1,
      inventarioVerificado: false,
      filtroArticulosInventario: 'todos',
      modalProveedores: false,
      busquedaProveedores: '',
      modalArticulos: false,
      busquedaArticulos: '',
      modalCuentas: false,
      busquedaCuentas: ''
    }
  },
  computed: {
    pestañas() {
      return [
        { id: 'encabezado', label: 'Encabezado' },
        { id: 'detalles', label: 'Detalles' },
        { id: 'retenciones', label: 'Retenciones' },
        { id: 'islr', label: 'ISLR' },
        { id: 'inventario', label: 'Inventario' },
        { id: 'avanzado', label: 'Avanzado' }
      ]
    },
    tiposDocumento() {
      return TIPOS_DOCUMENTO_COMPRA
    },
    alicuotas() {
      return ALICUOTAS_IVA
    },
    lineas() {
      return (this.factura.detalles || []).map(calcularLinea)
    },
    totales() {
      return calcularTotales(this.factura, this.parametros.tasaIGTF)
    },
    retenciones() {
      return calcularRetenciones(this.factura, {
        totales: this.totales,
        unidadTributaria: this.unidadTributaria,
        conceptos: this.conceptos,
        secuencia: this.secuencia
      })
    },
    conceptoSeleccionado() {
      return (this.conceptos || []).find((c) => c.codigo === this.factura.conceptoIslr) || null
    },
    proveedorCodigo() {
      const i = (this.proveedores || []).findIndex((p) => p.rif === this.factura.proveedorRif)
      return i >= 0 ? (this.proveedores[i].codigo || codigoProveedor(i)) : ''
    },
    proveedorLabel() {
      return this.factura.proveedorNombre
        ? `${this.factura.proveedorNombre} · RIF ${this.factura.proveedorRif}`
        : 'Sin proveedor'
    },
    almacenes() {
      return [...new Set((this.articulos || []).map((a) => a.almacenInicial).filter(Boolean))].sort()
    },
    obrasOpciones() {
      return [...new Set((this.documentos || []).map((d) => this.payloadDe(d).obras).filter(Boolean))].sort()
    },
    statuses() {
      const base = ['PENDIENTE', 'CONTADO', 'CRÉDITO', 'PROCESADO']
      const extra = [...(this.documentos || []).map((d) => d.condicion), ...(this.proveedores || []).map((p) => p.condicion)]
      return [...new Set([...base, ...extra.filter(Boolean)])]
    },
    filtrados() {
      const f = this.filtros
      const q = String(f.busqueda || '').trim().toLowerCase()
      return (this.documentos || [])
        .filter((d) => {
          if (f.almacen && this.payloadDe(d).almacen !== f.almacen) return false
          if (f.desde && (d.fecha || '') < f.desde) return false
          if (f.hasta && (d.fecha || '') > f.hasta) return false
          if (f.status && (d.condicion || '') !== f.status) return false
          if (!q) return true
          return [d.nroFactura, d.nroControl, d.rif, d.nombreRazon]
            .some((v) => String(v || '').toLowerCase().includes(q))
        })
        .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')))
    },
    resumen() {
      const docs = this.filtrados
      return {
        total: docs.reduce((s, d) => s + (Number(d.totalComprasIVA) || 0), 0),
        base: docs.reduce((s, d) => s + (Number(d.baseNacional) || 0), 0),
        retIva: docs.reduce((s, d) => s + (Number(d.retIVA) || 0), 0)
      }
    },
    proveedoresFiltrados() {
      const q = String(this.busquedaProveedores || '').trim().toLowerCase()
      return (this.proveedores || [])
        .filter((p) => !q || [p.nombre, p.rif, p.codigo].some((v) => String(v || '').toLowerCase().includes(q)))
        .slice(0, 200)
    },
    articulosFiltrados() {
      const q = String(this.busquedaArticulos || '').trim().toLowerCase()
      return (this.articulos || [])
        .filter((a) => !q || [a.codigo, a.nombre, a.descripcion].some((v) => String(v || '').toLowerCase().includes(q)))
        .slice(0, 200)
    },
    cuentasFiltradas() {
      const q = String(this.busquedaCuentas || '').trim().toLowerCase()
      return (this.cuentas || [])
        .filter((c) => !q || [c.codigo, c.nombre].some((v) => String(v || '').toLowerCase().includes(q)))
        .slice(0, 200)
    },
    codigosFactura() {
      return new Set((this.factura.detalles || []).map((l) => l.codigo).filter(Boolean))
    },
    articulosInventario() {
      if (this.filtroArticulosInventario === 'factura') {
        return (this.articulos || []).filter((a) => this.codigosFactura.has(a.codigo))
      }
      return this.articulos || []
    }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    dinero(v) {
      const n = Number(v)
      if (!isFinite(n)) return '0,00'
      return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    fechaMostrar(iso) {
      if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return iso || '—'
      return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    },
    payloadDe(d) {
      const p = d && d.payload
      if (!p) return {}
      return typeof p === 'string' ? (() => { try { return JSON.parse(p) } catch (e) { return {} } })() : p
    },
    serie(d) {
      const t = (d && d.tipoDocumento) || ''
      if (t === 'nota_debito') return 'ND'
      if (t === 'nota_credito') return 'NC'
      return 'FC'
    },
    async cargar() {
      this.cargando = true
      try {
        const [res, proveedores, articulos, cuentas, conceptos, parametros] = await Promise.all([
          listarDocumentos().catch(() => ({ documentos: [], origen: 'local' })),
          getProveedores().catch(() => []),
          getArticulos().catch(() => []),
          getCuentas().catch(() => []),
          cargarConceptos().catch(() => []),
          cargarParametros().catch(() => ({}))
        ])
        this.documentos = res.documentos || []
        this.origen = res.origen || 'local'
        this.proveedores = proveedores || []
        this.articulos = articulos || []
        this.cuentas = cuentas || []
        this.conceptos = conceptos || []
        this.parametros = parametros || this.parametros
        this.unidadTributaria = Number(parametros && parametros.unidadTributaria) || 0
      } finally {
        this.cargando = false
      }
    },
    nuevo() {
      const hoy = hoyIso()
      this.factura = {
        ...facturaVacia(),
        uid: generarUid('fac'),
        fechaEmision: hoy,
        fechaVence: hoy,
        fechaDeclaracion: hoy,
        status: 'PENDIENTE'
      }
      this.esNuevo = true
      this.editando = true
      this.tab = 'encabezado'
      this.secuencia = Math.max(1, this.documentos.length + 1)
      this.inventarioVerificado = false
    },
    abrir(doc) {
      const p = this.payloadDe(doc)
      const base = p.factura || {}
      const det = Array.isArray(p.detalles) && p.detalles.length
        ? p.detalles
        : (base.detalles || [])
      this.factura = {
        ...facturaVacia(),
        ...base,
        uid: doc.uid || base.uid || generarUid('fac'),
        proveedorRif: base.proveedorRif || doc.proveedorRif || doc.rif || '',
        proveedorNombre: base.proveedorNombre || doc.nombreRazon || '',
        direccion: base.direccion || '',
        fechaEmision: base.fechaEmision || doc.fecha || '',
        nroFactura: base.nroFactura || doc.nroFactura || '',
        nroControl: base.nroControl || doc.nroControl || '',
        codigoCuenta: base.codigoCuenta || doc.codigoCuenta || '',
        conceptoIslr: base.conceptoIslr || doc.conceptoIslr || '',
        comentarios: base.comentarios || doc.notas || '',
        porcentajeContribucion: Number(base.porcentajeContribucion || doc.porcentajeContribucion || 75),
        detalles: det.map((l) => ({ ...lineaVacia(), ...l }))
      }
      if (p.retenciones && p.retenciones.comprobanteIVA) {
        // El comprobante IVA es AAAAMM + 8 dígitos de secuencia; solo
        // se recupera la parte final para no duplicar el prefijo.
        const m = String(p.retenciones.comprobanteIVA).match(/(\d{8})$/)
        if (m) this.secuencia = Number(m[1]) || 1
      }
      this.inventarioVerificado = p.inventario === true
      this.esNuevo = false
      this.editando = true
      this.seleccionado = doc
      this.tab = 'encabezado'
    },
    buscar() {
      this.editando = false
      this.esNuevo = false
    },
    cancelar() {
      this.buscar()
    },
    // Vuelve al listado de Compras diarias desde "Modificar factura de…".
    volver() {
      this.buscar()
    },
    abrirProveedores() {
      this.busquedaProveedores = ''
      this.modalProveedores = true
    },
    elegirProveedor(p, i) {
      this.factura.proveedorRif = p.rif
      this.factura.proveedorNombre = p.nombre
      this.factura.direccion = p.direccion || ''
      if (!this.factura.codigoCuenta) this.factura.codigoCuenta = p.codigoCuenta || ''
      if (!this.factura.conceptoIslr) this.factura.conceptoIslr = p.conceptoIslr || ''
      if (p.porcentajeRetIva) this.factura.porcentajeContribucion = Number(p.porcentajeRetIva)
      if (p.creditoFiscalNoDeducible) this.factura.creditoFiscalNoDeducible = true
      if (p.condicion && (!this.factura.status || this.factura.status === 'PENDIENTE')) {
        this.factura.status = p.condicion
      }
      this.modalProveedores = false
      showToast(`Proveedor seleccionado: ${p.nombre}`)
    },
    abrirArticulos() {
      this.busquedaArticulos = ''
      this.modalArticulos = true
    },
    importarArticulo(a) {
      const iva = String(a.iva || '')
      const alicuota = iva.includes('8') ? 8 : (iva.includes('16') ? 16 : 16)
      this.factura.detalles.push({
        ...lineaVacia(),
        codigo: a.codigo || '',
        descripcion: a.nombre || a.descripcion || '',
        precio: Number(a.precioVenta) || 0,
        tipo: a.tipo || 'Servicio',
        alicuotaIVA: alicuota
      })
      this.modalArticulos = false
      showToast(`Artículo agregado: ${a.codigo}`)
    },
    abrirCuentas() {
      this.busquedaCuentas = ''
      this.modalCuentas = true
    },
    elegirCuenta(c) {
      this.factura.codigoCuenta = c.codigo
      this.modalCuentas = false
      showToast(`Cuenta contable: ${c.codigo}`)
    },
    agregarLinea() {
      this.factura.detalles.push(lineaVacia())
    },
    quitarLinea(i) {
      this.factura.detalles.splice(i, 1)
    },
    actualizarComprobantes() {
      this.secuencia += 1
      showToast(`Comprobantes actualizados: ${this.retenciones.comprobanteIVA} / ${this.retenciones.comprobanteISLR}`)
    },
    verificarInventario() {
      const codigos = this.articulos.map((a) => a.codigo)
      const faltan = [...this.codigosFactura].filter((c) => !codigos.includes(c))
      this.inventarioVerificado = !faltan.length
      if (faltan.length) {
        showToast(`Artículos no registrados en el maestro: ${faltan.join(', ')}`, { type: 'warning', duration: 5000 })
      } else {
        showToast('Inventario verificado: todos los códigos existen en el maestro.')
      }
    },
    async guardar() {
      const mensaje = validarFacturaDiaria(this.factura)
      if (mensaje) {
        await showAlert(mensaje, { type: 'warning', title: 'Revisa la factura' })
        return
      }
      this.guardando = true
      try {
        const totales = calcularTotales(this.factura, this.parametros.tasaIGTF)
        const retenciones = calcularRetenciones(this.factura, {
          totales,
          unidadTributaria: this.unidadTributaria,
          conceptos: this.conceptos,
          secuencia: this.secuencia
        })
        const doc = aDocumentoLibro(this.factura, { totales, retenciones })
        doc.payload.inventario = this.inventarioVerificado
        doc.payload.almacen = this.factura.almacen
        const res = await guardarDocumento(doc)
        showToast(
          res.offline
            ? 'Factura guardada en este equipo; sincronización pendiente.'
            : 'Factura guardada y retenciones generadas.',
          { type: res.offline ? 'warning' : 'success' }
        )
        this.buscar()
        await this.cargar()
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo guardar la factura', { type: 'error', title: 'Compras diarias' })
      } finally {
        this.guardando = false
      }
    },
    async eliminarFactura() {
      if (this.esNuevo || !this.factura.uid) return
      const doc = { uid: this.factura.uid, nroFactura: this.factura.nroFactura }
      this.buscar()
      await this.eliminar(doc)
    },
    async eliminar(doc) {
      const ok = await showConfirm(
        `¿Eliminar la factura ${doc.nroFactura || '(sin número)'} de ${doc.nombreRazon || '—'}?`,
        { title: 'Eliminar factura', confirmText: 'Eliminar', danger: true }
      )
      if (!ok) return
      try {
        const res = await eliminarDocumentoOffline(doc.uid)
        this.documentos = this.documentos.filter((d) => d.uid !== doc.uid)
        if (this.seleccionado && this.seleccionado.uid === doc.uid) this.seleccionado = null
        showToast(
          res.offline ? 'Factura eliminada; baja pendiente de sincronizar.' : 'Factura eliminada.',
          { type: res.offline ? 'warning' : 'success' }
        )
      } catch (e) {
        await showAlert((e && e.message) || 'No se pudo eliminar la factura', { type: 'error', title: 'Compras diarias' })
      }
    },
    procesarPendientes() {
      const pendientes = this.filtrados.filter((d) => String(d.condicion || '').toUpperCase() === 'PENDIENTE')
      if (!pendientes.length) {
        showToast('No hay facturas PENDIENTE con los filtros actuales.', { type: 'warning' })
        return
      }
      this.abrir(pendientes[0])
      showToast(`Abriendo factura ${pendientes[0].nroFactura} para procesarla.`)
    },
    recalcularTodo() {
      if (this.editando) {
        this.actualizarComprobantes()
      } else {
        showToast('Abre una factura para recalcular sus retenciones.', { type: 'warning' })
      }
    },
    exportarExcel() {
      const columnas = ['Serie', 'Número', 'Control', 'RIF', 'Proveedor', 'Status', 'Condición', 'Fecha Vence', 'Total', 'Inventario']
      const filas = this.filtrados.map((d) => [
        this.serie(d), d.nroFactura, d.nroControl, d.rif, d.nombreRazon, d.estado, d.condicion,
        this.fechaMostrar(this.payloadDe(d).fechaVence || d.fecha), d.totalComprasIVA,
        this.payloadDe(d).inventario ? 'Verificado' : 'No Registrado'
      ])
      const csv = [columnas, ...filas]
        .map((fila) => fila.map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(';'))
        .join('\r\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'compras-diarias.csv'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Listado exportado a Excel (CSV).')
    },
    htmlComprobante(kind) {
      const r = this.retenciones
      const f = this.factura
      const e = this.parametros.empresa || {}
      const esIva = kind === 'iva'
      const titulo = esIva ? 'COMPROBANTE DE RETENCIÓN DE IVA' : 'COMPROBANTE DE RETENCIÓN DE ISLR'
      const concepto = esIva
        ? `RETENCIÓN IVA ${f.porcentajeContribucion}%`
        : (r.detalleIslr ? r.detalleIslr.nombre : (this.conceptoSeleccionado ? this.conceptoSeleccionado.nombre : '—'))
      const base = esIva ? r.baseIva : this.totales.baseImponible
      const alicuota = esIva ? `${r.alicuota}% × ${f.porcentajeContribucion}%` : (r.detalleIslr ? `${r.detalleIslr.porcentaje}%` : '—')
      const monto = esIva ? r.retIva : r.retIslr
      const comprobante = esIva ? r.comprobanteIVA : r.comprobanteISLR
      return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>body{font-family:Arial,sans-serif;color:#222;margin:32px;font-size:13px}
h1{font-size:16px;text-align:center;letter-spacing:1px;margin:0 0 4px}
.emp{text-align:center;margin-bottom:22px}.emp strong{font-size:15px}
table{border-collapse:collapse;width:100%;margin-bottom:18px}td,th{border:1px solid #999;padding:7px 9px;text-align:left}
th{background:#eee;width:34%}.mono{font-family:Consolas,monospace}
.nota{font-size:10px;margin-top:26px;border-top:1px solid #999;padding-top:8px}
.firma{margin-top:48px;border-top:1px solid #222;width:55%;text-align:center;padding-top:6px}
</style></head><body>
<div class="emp"><strong>${esc(e.razonSocial)}</strong><br>RIF: ${esc(e.rif)}<br>${esc(e.direccion)}</div>
<h1>${titulo}</h1>
<table>
<tr><th>Fecha de emisión</th><td>${esc(this.fechaMostrar(f.fechaEmision))}</td></tr>
<tr><th>Fecha de declaración</th><td>${esc(this.fechaMostrar(f.fechaDeclaracion))}</td></tr>
<tr><th>Proveedor</th><td>${esc(f.proveedorNombre)}</td></tr>
<tr><th>RIF proveedor</th><td class="mono">${esc(f.proveedorRif)}</td></tr>
<tr><th>Factura N°</th><td class="mono">${esc(f.nroFactura)}</td></tr>
<tr><th>N° de control</th><td class="mono">${esc(f.nroControl)}</td></tr>
<tr><th>Concepto</th><td>${esc(concepto)}</td></tr>
<tr><th>Base imponible</th><td>${esc(this.dinero(base))}</td></tr>
<tr><th>Alicuota</th><td>${esc(alicuota)}</td></tr>
<tr><th>Monto retenido</th><td><strong>${esc(this.dinero(monto))}</strong></td></tr>
<tr><th>N° de comprobante</th><td class="mono">${esc(comprobante)}</td></tr>
</table>
<p class="nota">LA CONDICIÓN DE ESTE CONTRIBUYENTE REQUIERE LA RETENCIÓN DEL ${esc(f.porcentajeContribucion)}% DEL IMPUESTO CAUSADO, SALVO QUE INCURRA…</p>
<div class="firma">Firma y sello del retenedor</div>
</body></html>`
    },
    imprimir(kind) {
      if (!this.editando && !this.seleccionado) {
        showToast('Selecciona una factura para imprimir el comprobante.', { type: 'warning' })
        return
      }
      if (!this.editando) this.abrir(this.seleccionado)
      const w = window.open('', '_blank')
      if (!w) {
        showToast('El navegador bloqueó la ventana de impresión.', { type: 'warning' })
        return
      }
      w.document.write(this.htmlComprobante(kind))
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 300)
    }
  }
}
</script>

<style scoped>
.cd-view { display: flex; flex-direction: column; gap: 16px; }
.cd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.cd-head h2 { margin: 0 0 4px; font-size: 1.35rem; }
.sub { margin: 0; color: var(--text-secondary); font-size: 0.88rem; max-width: 640px; }
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.btn-volver { border-color: var(--primary); color: var(--primary); font-weight: 600; }
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}
.filtros { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.filtro { display: flex; flex-direction: column; gap: 4px; }
.filtro label, .field label { font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); }
.input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 8px 10px;
  font-size: 0.85rem;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}
.toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin: 12px 0 8px; }
.count { color: var(--text-secondary); font-size: 0.8rem; margin-right: auto; }
.sync-tag { font-size: 0.75rem; border-radius: 999px; padding: 3px 9px; }
.sync-tag.pendiente { background: rgba(255, 165, 0, 0.15); color: #b26a00; }
.table-scroll { overflow-x: auto; }
.cd-table, .lineas-table, .art-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.cd-table th, .cd-table td, .lineas-table th, .lineas-table td, .art-table th, .art-table td {
  text-align: left;
  padding: 8px 9px;
  border-bottom: 1px solid var(--divider-weak);
  white-space: nowrap;
}
.cd-table th, .lineas-table th, .art-table th { color: var(--text-secondary); font-size: 0.74rem; }
.cd-table tbody tr { cursor: pointer; }
.cd-table tbody tr:hover { background: var(--hover, rgba(0, 0, 0, 0.03)); }
.cd-table tbody tr.selected { outline: 1px solid var(--primary); }
.cd-table .num, .lineas-table .num, .art-table .num { text-align: right; }
.mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.fuerte { font-weight: 600; }
.pill { background: rgba(0, 0, 0, 0.06); border-radius: 999px; padding: 2px 8px; font-size: 0.72rem; }
.pill.ok { background: rgba(40, 167, 69, 0.15); color: #207a35; }
.row-actions { display: flex; gap: 5px; }
.btn {
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
}
.btn:hover:not(:disabled) { border-color: var(--primary); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-small { padding: 5px 9px; font-size: 0.75rem; }
.btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.btn-danger { color: var(--error); border-color: rgba(var(--error-rgb), 0.4); }
.btn.active { border-color: var(--primary); color: var(--primary); font-weight: 600; }
.empty-state { padding: 28px 12px; text-align: center; color: var(--text-secondary); font-size: 0.88rem; }
.resumen { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--divider-weak); font-size: 0.82rem; color: var(--text-secondary); }
.resumen strong { color: var(--text); }
.ficha-toolbar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.toolbar-sep { width: 1px; height: 22px; background: var(--border); margin: 0 4px; }
.tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 14px; border-bottom: 1px solid var(--divider-weak); }
.tab {
  border: 0; background: transparent; color: var(--text-secondary);
  padding: 9px 12px; font-size: 0.82rem; cursor: pointer; font-family: inherit;
  border-bottom: 2px solid transparent;
}
.tab.active { color: var(--primary); font-weight: 600; border-bottom-color: var(--primary); }
.ficha-cuerpo { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; padding-top: 14px; }
.tab-body { min-width: 0; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field-wide { grid-column: 1 / -1; }
.con-row { display: flex; gap: 7px; align-items: center; }
.con-row .input { flex: 1; }
.codigo-prov { max-width: 130px; flex: 0 0 130px !important; }
.tipo-doc { max-width: 70px; flex: 0 0 70px !important; }
.checks { flex-direction: row; gap: 26px; flex-wrap: wrap; }
.check-line { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; }
.muted { color: var(--text-secondary); font-size: 0.78rem; }
.aviso { color: #b26a00; background: rgba(255, 165, 0, 0.12); padding: 9px 11px; border-radius: 8px; font-size: 0.8rem; }
.det-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.input.cell { padding: 5px 7px; font-size: 0.78rem; }
.sin-lineas { text-align: center; color: var(--text-secondary); padding: 18px; }
.ret-tabla { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.ret-row { display: grid; grid-template-columns: 80px minmax(140px, 1fr) 90px 44px 90px 100px 130px 130px; gap: 6px; padding: 9px; font-size: 0.76rem; align-items: center; border-bottom: 1px solid var(--divider-weak); }
.ret-row.enc { background: var(--surface-alt, rgba(0, 0, 0, 0.03)); color: var(--text-secondary); font-weight: 600; }
.ret-row:last-child { border-bottom: 0; }
.ret-actions { display: flex; gap: 4px; }
.nota-legal { color: var(--text-secondary); font-size: 0.72rem; line-height: 1.5; margin: 14px 0 4px; }
.nota-legal.corta { font-size: 0.68rem; }
.filtro-inv { max-width: 280px; }
.tabla-inv { max-height: 340px; overflow-y: auto; }
.panel-retenciones { background: var(--surface-alt, rgba(0, 0, 0, 0.02)); border: 1px solid var(--border); border-radius: 10px; padding: 12px; align-self: start; }
.panel-retenciones h3 { margin: 0 0 12px; font-size: 0.95rem; }
.totales > div { display: flex; justify-content: space-between; font-size: 0.8rem; padding: 4px 0; }
.totales .total { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 7px; font-weight: 600; }
.panel-ret { margin-top: 10px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; display: grid; grid-template-columns: 1fr auto; gap: 4px; font-size: 0.76rem; }
.panel-ret .ret-titulo { font-weight: 600; }
.panel-ret .mono { grid-column: 1 / -1; font-size: 0.72rem; color: var(--text-secondary); }
.igtf-check { margin-top: 12px; }
.panel-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; z-index: 50; }
.modal { background: var(--surface); border-radius: var(--radius); padding: 18px; width: min(720px, 94vw); display: flex; flex-direction: column; gap: 10px; }
.modal h3 { margin: 0; font-size: 1rem; }
.modal-list { max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.modal-item { display: grid; grid-template-columns: auto auto 1fr auto; gap: 10px; text-align: left; border: 1px solid transparent; background: transparent; color: var(--text); padding: 7px 8px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-family: inherit; }
.modal-item:hover { border-color: var(--primary); }
@media (max-width: 1200px) { .ficha-cuerpo { grid-template-columns: 1fr; } }
@media (max-width: 900px) { .filtros { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cd-head { flex-direction: column; } .head-actions { justify-content: flex-start; } }
@media (max-width: 620px) { .filtros, .grid { grid-template-columns: 1fr; } }
</style>
