# Contexto general — DualLedger

Documento de contexto del proyecto para continuidad de trabajo (estado, arquitectura, módulos y pendientes).

- **Fecha de contexto:** 2026-11-19
- **Workspace:** `C:\Users\PC\Desktop\DualLedger-main`
- **Repositorio:** `https://github.com/VzlaEder/DualLedger.git`
- **Rama:** `Develop`
- **HEAD remoto referenciado:** `9346b16` (commits de Compras/Activos Fijos y ajustes previos ya pusheados según contexto del proyecto)
- **Documento relacionado:** `CONTEXTO-COMPRAS.md` (detalle profundo del módulo Compras)

---

## 1. Resumen ejecutivo

**DualLedger** es una aplicación web/PWA (Vue 3 + Vite) orientada a gestión fiscal/administrativa (foco actual: **Compras**). Permite procesar comprobantes (OCR), mantener maestros (artículos/cuentas, proveedores, activos), registrar compras diarias que alimentan el Libro de Compras, registrar documentos no fiscales y consultar reportes derivados (Relación de gastos, CxP).

La app opera con enfoque **offline-first**: persiste en **IndexedDB** (`dualledger-maestros`) y sincroniza con una API/servidor Node cuando está disponible; si falla, encola operaciones en `syncQueue`. En el entorno actual **PostgreSQL no está disponible** (rutas `/api` pueden responder 500), por lo que la operación local/offline es la esperada.

---

## 2. Estado del repositorio (al momento de generar este archivo)

`git status --short --branch`:
- `## Develop...origin/Develop`
- Modificados: `src/components/ActivosFijosView.vue`, `src/components/ArticulosView.vue`, `src/components/ComprasDiariasView.vue`, `src/components/CxpView.vue`, `src/components/DocumentosNoFiscalesView.vue`, `src/components/ProveedoresView.vue`, `src/components/RelacionGastosView.vue`
- Sin seguimiento: `src/components/ReportHeader.vue`, `src/components/SummaryCards.vue`, `src/utils/reporte.js`

> Hay cambios de UI/refactor (cabeceras compartidas y utilidades de reporte) sin commitear. Antes de commitear/pushear, revisar con el usuario; si se aprueba, usar autor `Leand24 <Leand24@users.noreply.github.com>` y `git push origin Develop`.

---

## 3. Entorno y ejecución

- **Frontend dev:** `http://127.0.0.1:3000`
- **API dev:** `http://127.0.0.1:8787`
- **Plataforma:** Windows (`win32`)
- **Base de datos:** PostgreSQL (configurada vía `.env`, sin Docker instalado en este entorno). Cuando no está levantada, la app funciona en modo offline con IndexedDB/`syncQueue`.
- **Autenticación:** en memoria (demo). Al recargar se vuelve a `#/login`.
  - `admin` / `admin123` — **Administrador**
  - `consultor` / `consultor123` — **Consultor**

### Scripts principales (`package.json`)
- `npm run dev` — entorno de desarrollo (prepara DB de servidor e inicia dev)
- `npm run dev:api` — API con watch (`node --watch server/index.js`)
- `npm run dev:web` — Vite
- `npm run build` — build de producción
- `npm test` — pruebas (`node --test tests/`)
- `npm start` / `start:api` / `start:web` / `preview`

### Stack y dependencias relevantes
- **UI:** Vue 3, `vue-router`
- **Build/PWA:** Vite, `vite-plugin-pwa`, `workbox-window`
- **Datos locales/utilidades:** `idb`, `xlsx`, `pdfjs-dist`, `tesseract.js` (OCR existente en la app)
- **Servidor:** Node (`server/index.js`, rutas en `server/routes/*`, migraciones en `server/migrations/*`)
- **Pruebas:** `node --test` en `tests/*.mjs`

### Verificación reciente conocida
- `npm test`: 92 pruebas, 91 pasan, 1 omitida (`Plan de Cuentas contables.xls`).
- `npm run build`: correcto.

---

## 4. Arquitectura y patrones

- **Rutas:** `src/router/index.js` (hash history). Rutas hijas de compras bajo prefijo `compras/` (padre `/`). Guard de autenticación y restricción por rol (`meta.roles`).
- **Shell/navegación:** `src/components/AppShell.vue` (menú lateral, módulos/submódulos, acciones globales como herramientas/tema/instalación según contexto).
- **Vistas/módulos:** componentes en `src/components/*View.vue` y paneles como `ProcesarPanel.vue`.
- **Componentes/utilidades compartidas (UI de reportes/maestros):**
  - `src/components/ReportHeader.vue` — cabecera (icono + título en línea, badge debajo, acento).
  - `src/components/SummaryCards.vue` — métricas/resumen.
  - `src/utils/reporte.js` — utilidades de formato y exportación/impresión (`dinero`, `fechaMostrar`, `esc`, `descargarCsv`, `imprimirReporte`, etc.).
- **Lógica de negocio pura:** `src/services/*` (cálculos, normalización, mapeos, CSV; determinista y testeable).
- **Persistencia local:** `src/stores/*` + `src/stores/maestrosDb.js` (IndexedDB `dualledger-maestros`, versión actual v5 con stores como `articulos`, `proveedores`, `compras_documentos`, `documentos_no_fiscales`, `activosFijos`, `syncQueue`, `parametros`, etc., según implementación).
- **API y sincronización:** `server/index.js` (maestros/SENIAT/endpoints varios), `server/routes/compras.js` (sync de compras), migraciones en `server/migrations/*`. Patrón offline-first: guardar local → intentar sync → encolar en `syncQueue` si falla.
- **OCR:** existente en `src/utils/ocr.js` (flujo `Compras → Procesar`); no se agregó OCR nuevo de runtime para las secciones construidas recientemente.
- **Reportes derivados:** CxP y Relación de gastos son **solo lectura** y se calculan/derivan de datos existentes (no persisten saldos como fuente de verdad). Depreciación de Activos Fijos también es **derivada** (no persistida).

---

## 5. Módulos de la aplicación

> Descripción por módulo: **qué hace**, **cómo funciona** y **en qué caso se usa** (estado actual).

### 5.1 Acceso / Inicio de sesión (`#/login`)
- **Qué hace:** controla el acceso a la aplicación.
- **Cómo funciona:** formulario de usuario/contraseña con autenticación en memoria (`src/utils/auth.js`); al autenticarse redirige al destino solicitado o al Dashboard. La sesión no persiste entre recargas. Control de acceso por ruta y por rol.
- **En qué caso se usa:** siempre, para ingresar al sistema.
- **Estado:** funcional (demo).

### 5.2 Dashboard (`#/`)
- **Qué hace:** presenta un resumen general de la actividad (KPI y gráficas, p. ej. compras vs ventas, documentos).
- **Cómo funciona:** vista de consulta informativa al entrar.
- **En qué caso se usa:** para una visión panorámica rápida del estado general.
- **Estado:** implementado como panel de resumen; sus métricas/gráficas son de referencia/ejemplo en el estado actual (no consolidado operativo en tiempo real de todos los módulos).

### 5.3 Compras

Contenedor con submódulos (`#/compras/*`). `#/compras` redirige a `compras/procesar`.

#### 5.3.1 Procesar (`#/compras/procesar`)
- **Qué hace:** extracción y procesamiento de datos fiscales de comprobantes/facturas mediante OCR.
- **Cómo funciona:** pestañas: **Subir** (imágenes/PDF), **Datos** (revisión/edición, acumulación de registros), **Exportar**, **Documentos**, **Historial**, **Maestros** (según flujo del panel).
- **En qué caso se usa:** para digitalizar comprobantes de compra y obtener/depurar sus datos sin carga manual completa.
- **Estado:** funcional (flujo existente de la app).

#### 5.3.2 Artículos (`#/compras/articulos`)
- **Qué hace:** catálogo de artículos/cuentas contables seleccionables según el concepto de la factura (manual 1.1).
- **Cómo funciona:** listado con filtros, recarga, **Importar cuentas** y alta/edición; vincula conceptos a cuentas contables.
- **En qué caso se usa:** para mantener el catálogo/cuentas usadas al imputar compras.
- **Estado:** funcional. Cabecera: `📦 Artículos` · `Catálogo · artículos` · acento `#4f46e5`.

#### 5.3.3 Proveedores (`#/compras/proveedores`)
- **Qué hace:** maestro de proveedores con datos fiscales y condiciones de compra (manual 1.2).
- **Cómo funciona:** búsqueda/listado (RIF, nombre, clasificación, retención IVA/ISLR, cuenta, crédito), alta/edición, validación y consulta de RIF en SENIAT; define condiciones (p. ej. % retención IVA, concepto ISLR) usadas en compras.
- **En qué caso se usa:** para registrar y mantener proveedores antes de/durante el registro de compras.
- **Estado:** funcional. Cabecera: `👥 Proveedores` · `Maestro · proveedores` · acento `#0891b2`.

#### 5.3.4 Documentos no fiscales (`#/compras/documentos-no-fiscales`)
- **Qué hace:** registro de comprobantes de gastos sin factura fiscal (recibos, tickets, contratos, etc.).
- **Cómo funciona:** listado/búsqueda y ficha de alta/edición (monto, cuenta, deducibilidad, etc.). **No entra al Libro de Compras ni genera retenciones**.
- **En qué caso se usa:** para controlar gastos no fiscales y consolidarlos en reportes de gastos sin afectar el libro fiscal.
- **Estado:** funcional (módulo propio offline-first). Cabecera: `🧾 Documentos no fiscales` · `Registro · fuera del libro` · acento `#64748b`.

#### 5.3.5 Compras diarias (`#/compras/compras-diarias`)
- **Qué hace:** registro de facturas de compra que alimenta el **Libro de Compras** (manual 1.3).
- **Cómo funciona:** filtros por período/almacén/estatus/búsqueda; acciones de ver/imprimir/exportar y alta. Registra documento, proveedor, líneas e impuestos; **al guardar calcula/genera automáticamente retenciones de IVA e ISLR** según reglas/proveedor/concepto (1.3.1.4). Soporta tipos como factura, nota de débito y nota de crédito.
- **En qué caso se usa:** para cargar compras del período con trazabilidad fiscal y generar la base del libro y retenciones de compras.
- **Estado:** funcional. Cabecera: `🛒 Compras diarias` · `Registro · Libro de Compras` · acento `#d97706`.

#### 5.3.6 Relación de gastos (`#/compras/relacion-gastos`)
- **Qué hace:** reporte consolidado de gastos deducibles y no deducibles.
- **Cómo funciona:** **solo lectura**, derivado de facturas del Libro de Compras y de Documentos no fiscales. Filtros (fecha, origen, deducibilidad, cuenta, búsqueda), exportar CSV/imprimir.
- **En qué caso se usa:** para análisis y soporte de gastos por período/origen/cuenta/deducibilidad.
- **Estado:** funcional (derivado). Cabecera: `📝 Relación de gastos` · `Reporte · solo lectura` · acento `#7c3aed`.

#### 5.3.7 CxP (`#/compras/cxp`)
- **Qué hace:** reporte de Cuentas por pagar (saldos y vencimientos con proveedores).
- **Cómo funciona:** **solo lectura**, derivado de facturas del Libro de Compras. Vencimiento desde compra o crédito del proveedor; saldo = `total + IGTF − retenciones`. Filtros (fecha, proveedor, estado, búsqueda), exportar/imprimir. **No registra pagos ni abonos**.
- **En qué caso se usa:** para seguimiento de obligaciones y vencimientos por pagar.
- **Estado:** funcional (derivado). Cabecera: `💰 Cuentas por pagar (CxP)` · `Reporte · solo lectura` · acento `#2563eb`.

#### 5.3.8 Activos Fijos (`#/compras/activos-fijos`)
- **Qué hace:** maestro de registro, control y depreciación de activos fijos.
- **Cómo funciona:** alta/edición y listado con filtros (categoría, estado, cuenta, fecha de cálculo) y métricas; exportar/imprimir. Vinculado a cuentas contables. **La depreciación se calcula en forma derivada (no se persiste)**.
- **En qué caso se usa:** para inventariar activos y consultar depreciación/valor a una fecha.
- **Estado:** funcional (CRUD, API/migración `0006`, store `activosFijos`, pruebas asociadas en el historial). Cabecera: `🏢 Activos Fijos` · `Maestro · control y depreciación` · acento `#059669`.

#### 5.3.9 Retenciones (Trabajadores) (`#/compras/retenciones-trabajadores`)
- **Qué hace (previsto):** retenciones ISLR e impuestos aplicables a trabajadores.
- **Cómo funciona:** **placeholder** (`PlaceholderView`, "Módulo en construcción").
- **En qué caso se usa:** se definirá al implementar (requiere alcance/reglas/formatos; no descrito en el manual de Compras).
- **Estado:** no implementado.

### 5.4 Ventas (`#/ventas`)
- **Qué hace (previsto):** módulo de ventas (subopciones y flujo por definir).
- **Cómo funciona:** **placeholder** (`PlaceholderView`), sin subrutas ni lógica.
- **En qué caso se usa:** para el flujo de ventas/libro de ventas cuando se disponga de especificación/manual.
- **Estado:** no implementado.

### 5.5 Configuración (solo Administrador)

#### 5.5.1 Usuarios (`#/config/usuarios`)
- **Qué hace:** administración/listado de usuarios del sistema.
- **Cómo funciona:** tabla con usuario, nombre, correo, rol y estado (validación del lado del cliente, demo).
- **En qué caso se usa:** para consultar cuentas y roles asignados.
- **Estado:** vista demo.

#### 5.5.2 Roles (`#/config/roles`)
- **Qué hace:** administración/listado de roles y permisos.
- **Cómo funciona:** tabla con rol, descripción, módulos permitidos y estado (validación del lado del cliente, demo).
- **En qué caso se usa:** para revisar permisos por rol.
- **Estado:** vista demo.

---

## 6. Fuentes y alcance funcional (manual Compras)

- **Manual:** `C:\Users\PC\Desktop\MANUAL DE PROCEDIMINETO MODULO COMPRAS (1).pdf`
- **Transcripción:** `C:\Users\PC\AppData\Local\Temp\opencode\manual-compras.txt` (15 páginas).
- **Cubre:** 1.1 Artículos, 1.2 Proveedores, 1.3 Compras diarias, 1.4 Reportes (Libro de compra, Retenciones IVA TXT, Retenciones ISLR XML de proveedores/compras).
- **No cubre:** Activos Fijos, Relación de gastos, CxP (implementados como maestro/reportes derivados según datos existentes), ni **Retenciones (Trabajadores)**. "Retenciones ISLR" del manual son de **proveedores/compras**, no laborales.

---

## 7. Pendientes y próximos pasos conocidos

1. **Retenciones (Trabajadores):** definir alcance (solo ISLR salarial u otros aportes), fuente de datos (manual/nómina), maestro de trabajadores, reglas/tarifa y formatos (comprobante, ARC, archivos SENIAT). Sin manual; hoy es placeholder.
2. **Ventas:** definir alcance y submódulos (clientes, registro/libro de ventas, retenciones recibidas, CxC, reportes) y formatos fiscales; hoy es placeholder.
3. **Reportes fiscales SENIAT:** Libro formal, TXT de retenciones IVA, XML ISLR, etc., con formatos/XSD/códigos oficiales por confirmar.
4. **UI/refactor pendiente de commit:** cabeceras compartidas y utilidades (`ReportHeader`, `SummaryCards`, `utils/reporte.js` y vistas ajustadas) según `git status`; revisar y commitear/pushear si el usuario lo aprueba.
5. **Distribución/DB local:** considerar incrementar `DB_VERSION` (p. ej. a 6) antes de distribuir si existen clientes con v5 previa sin el store `activosFijos`.
6. **Infraestructura:** PostgreSQL no disponible en este entorno; validar sincronización/API cuando esté operativo.

---

## 8. Archivos y referencias relevantes

- `CONTEXTO-COMPRAS.md` — traspaso detallado del módulo Compras.
- `src/router/index.js` — rutas y módulos.
- `src/components/AppShell.vue` — shell y navegación.
- `src/components/ProcesarPanel.vue` — flujo OCR/procesamiento.
- `src/components/{Articulos,Proveedores,DocumentosNoFiscales,ComprasDiarias,RelacionGastos,Cxp,ActivosFijos}View.vue` — módulos de Compras.
- `src/components/{DashboardView,LoginView,PlaceholderView,ConfigUsuariosView,ConfigRolesView}.vue`
- `src/components/ReportHeader.vue`, `src/components/SummaryCards.vue`, `src/utils/reporte.js` — componentes/utilidades compartidas de UI de reportes.
- `src/services/*` — lógica pura (ej. `compras.js`, `comprasDiarias.js`, `conceptosIslr.js`, `activosFijos.js`, etc.).
- `src/stores/maestrosDb.js` — IndexedDB y stores.
- `src/utils/{auth.js,ocr.js,seniat.js,rif.js,...}`
- `server/index.js`, `server/routes/compras.js`, `server/migrations/*` — API y esquema.
- `tests/*.mjs` — pruebas.

---

*Este documento consolida el estado y las descripciones funcionales conocidas; ante duda de reglas fiscales, formatos SENIAT o alcance de módulos pendientes, confirmar con manual del cliente/contador antes de implementar.*
