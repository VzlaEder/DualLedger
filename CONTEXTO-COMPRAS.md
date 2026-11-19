# Traspaso de contexto — Módulo Compras (DualLedger)

Este archivo resume todo el trabajo realizado en el módulo **Compras** para que otra sesión de OpenCode pueda continuar sin volver a investigar desde cero.

**Estado general:** módulo funcional en modo offline-first con IndexedDB. PostgreSQL no está levantado: las rutas `/api` devuelven 500 y las escrituras quedan en `syncQueue`. Eso es esperado en este entorno.

---

## 1. Objetivo y fuentes

- Construir las secciones del módulo **Compras** siguiendo el manual:
  `C:\Users\PC\Desktop\MANUAL DE PROCEDIMINETO MODULO COMPRAS (1).pdf`
- Transcripción del manual: `C:\Users\PC\AppData\Local\Temp\opencode\manual-compras.txt`
- Capturas extraídas: `C:\Users\PC\AppData\Local\Temp\opencode\manual-imgs\`
- El manual cubre **Compras diarias** (págs. 6–10) y **Reportes** (págs. 11–15).
- El manual **no describe** «Relación de gastos» ni «CxP». Ambas se implementaron como reportes derivados de datos existentes, sin inventar campos nuevos.
- El usuario eligió:
  - PostgreSQL: **solo crear `.env`**, sin instalar Docker/PostgreSQL.
  - Documentos no fiscales: **módulo propio offline-first**.
  - CxP: **solo consulta derivada, sin registrar pagos/abonos**.
- No usar OCR en runtime; el OCR solo se usó durante el desarrollo para leer el manual.

---

## 2. Decisiones importantes

1. Cada sección de Compras tiene vista propia en vez de `PlaceholderView`.
2. Las rutas hijas llevan prefijo `compras/` porque el padre es `/`. Ejemplo: `compras/cxp`, no `cxp`.
3. Estrategia offline-first: se guarda primero en IndexedDB; si la API falla, se encola en `syncQueue`.
4. `Documentos no fiscales` tiene tabla/API propias y **no entra** al Libro de Compras ni genera retenciones.
5. `Articulos` se vincula al plan de cuentas mediante `C.C Compra` / `C.C Venta`.
6. `Compras diarias` reutiliza `compras_documentos`, `/compras/documentos` y `src/services/compras.js`; no se creó otra tabla.
7. La retención ISLR no tiene columna propia en `compras_documentos`; su detalle viaja en `payload` JSONB.
8. Relación de gastos: el IVA de proveedores con «crédito fiscal no deducible» **no se acredita**, pero **sí entra dentro del gasto deducible**.
9. CxP: el saldo es `total + IGTF − retenciones`. Las notas de crédito **ya vienen con signo negativo desde el Libro**, así que no se debe invertir el signo otra vez.

---

## 3. Lo nuevo

### Vistas

| Archivo | Sección |
|---|---|
| `src/components/ProveedoresView.vue` | Compras → Proveedores |
| `src/components/DocumentosNoFiscalesView.vue` | Compras → Documentos no fiscales |
| `src/components/ArticulosView.vue` | Compras → Articulos |
| `src/components/ComprasDiariasView.vue` | Compras → Compras diarias |
| `src/components/RelacionGastosView.vue` | Compras → Relación de gastos |
| `src/components/CxpView.vue` | Compras → CxP |

### Servicios / helpers puros

| Archivo | Contenido |
|---|---|
| `src/services/proveedores.js` | RIF/SENIAT, retenciones IVA 75/100, ISLR, cuenta contable, días de crédito |
| `src/services/documentosNoFiscales.js` | Normalización y validación de comprobantes no fiscales |
| `src/services/articulos.js` | Modelo de artículos, filtros, importación desde plan de cuentas |
| `src/services/comprasDiarias.js` | Ficha de factura → registro del Libro, totales y retenciones |
| `src/services/relacionGastos.js` | Consolidado de gastos, resumen, agrupaciones, CSV |
| `src/services/cxp.js` | Saldos, vencimientos, aging, agrupaciones y CSV de CxP |

### Stores IndexedDB

| Archivo | Store |
|---|---|
| `src/stores/documentosNoFiscalesDb.js` | `documentosNoFiscales` |
| `src/stores/articulosDb.js` | `articulos` |

`src/stores/maestrosDb.js` quedó en `DB_VERSION = 4` y contiene:
`cuentas`, `proveedores`, `conceptosIslr`, `parametros`, `syncQueue`, `comprasDocumentos`, `documentosNoFiscales`, `articulos`.

### Rutas API (servidor)

| Archivo | Rutas |
|---|---|
| `server/routes/proveedores.js` | `GET /proveedores`, `/proveedores/sync`, `/proveedores/delete` |
| `server/routes/documentosNoFiscales.js` | `GET /documentos-no-fiscales`, `/sync`, `/delete` |
| `server/routes/articulos.js` | `GET /articulos`, `/sync`, `/delete` |

### Migraciones SQL

- `migrations/0003_proveedores_ficha.sql`
- `migrations/0004_documentos_no_fiscales.sql`
- `migrations/0005_articulos.sql`

Se aplican solas cuando PostgreSQL esté disponible.

### Pruebas

- `tests/proveedores.test.mjs`
- `tests/documentosNoFiscales.test.mjs`
- `tests/articulos.test.mjs`
- `tests/comprasDiarias.test.mjs`
- `tests/relacionGastos.test.mjs`
- `tests/cxp.test.mjs`

---

## 4. Lo modificado

- `src/router/index.js`
  - Importa y registra las vistas nuevas.
  - `compras/cxp` ya no usa `PlaceholderView`; usa `CxpView`.
- `src/services/compras.js`
  - Helpers fiscales verificados contra el Libro real.
  - `prepararDocumento()` conserva `diasCredito`, `condicion`, `codigoCuenta`, `payload`, etc.
  - Guardado offline-first y sincronización por lote.
- `server/routes/compras.js`
  - Mapeo de columnas del Libro, incluidos `dias_credito` y `payload`.
- `src/stores/maestrosDb.js`
  - Nuevos stores y subida de versión de IndexedDB.
- `README.md`
  - Documentación de todas las secciones, pasos de verificación y changelog.
- `src/components/AppShell.vue`
  - El sidebar ya navega a `/compras/cxp`, `/compras/relacion-gastos`, etc. (la navegación ya existía; ahora las rutas tienen vista real).

---

## 5. Lo arreglado

1. **Compras diarias — clonado IndexedDB**
   - Error: `Failed to execute 'put' on 'IDBObjectStore': [object Object] could not be cloned.`
   - Solución: helper `clon()` en `src/services/comprasDiarias.js` antes de guardar `payload`.

2. **Compras diarias — comprobante duplicado al reabrir**
   - Se ajustó el parseo para tomar solo el sufijo `(\d{8})$` del comprobante.

3. **Compras diarias — retorno desde la ficha**
   - Botón `← Volver a Compras diarias` añadido en la cabecera de «Modificar factura de compra».
   - Navega a `#/compras/compras-diarias`.

4. **Relación de gastos — IVA no acreditable**
   - El crédito fiscal no deducible se separa del acreditable, pero se incluye en el gasto deducible.

5. **CxP — signo de notas de crédito (último arreglo)**
   - Problema: CxP mostraba `Bs 2.070.818,72` mientras Relación de gastos mostraba `Bs 1.036.176,36`.
   - Causa: las notas de crédito ya están guardadas en negativo en el Libro y CxP las multiplicaba por `-1` otra vez.
   - Solución: en `lineaCxpDesdeDocumento()` se toman `total`, `igtf` y `retenciones` tal como vienen del Libro.
   - Resultado: CxP ahora muestra exactamente `Bs 1.036.176,36`, igual que el total general de Relación de gastos.

---

## 6. Detalle específico de CxP (trabajo más reciente)

### Archivos

- `src/services/cxp.js`
- `src/components/CxpView.vue`
- `tests/cxp.test.mjs`
- `src/router/index.js`
- `README.md`

### Reglas implementadas

- Ignora documentos anulados y fechas inválidas.
- Acepta fechas ISO `YYYY-MM-DD` y `DD/MM/AAAA`.
- `vencimiento`:
  1. `payload.factura.fechaVence`
  2. si no hay, `payload.fechaVence` o `doc.fechaVence`
  3. si no hay, `fecha emisión + díasCrédito` del documento o del maestro de proveedores
  4. si no hay nada: `Sin vencimiento`
- `estado`: `vencido`, `por_vencer`, `sin_vencimiento`, `pagado`.
- Se considera pagado si la condición contiene `PAGAD`, `CANCEL` o `LIQUID`; esos documentos tienen saldo `0`.
- `saldo = total + IGTF − retenciones`, respetando el signo guardado en el Libro.
- `antiguedad / aging`: `Corriente`, `1 - 30 días`, `31 - 60 días`, `61 - 90 días`, `Más de 90 días`, `Sin vencimiento`, `Pagado`.
- Funciones exportadas principales:
  - `filtrosCxpVacios()`
  - `lineaCxpDesdeDocumento(doc, { hoy, proveedoresPorRif })`
  - `indiceProveedores(proveedores)`
  - `construirLineasCxp(documentos, proveedores, { hoy })`
  - `filtrarLineasCxp(lineas, filtros)`
  - `listarLineasCxp({ documentos, proveedores, filtros, hoy })`
  - `resumenCxp(lineas)`
  - `agruparCxpPorProveedor`, `agruparCxpPorAging`, `agruparCxpPorMes`
  - `csvCxp(lineas)`
  - `etiquetaEstadoCxp(estado)`
- La vista usa `listarDocumentos()` y `cargarProveedores({ force: true })` de `src/services/compras.js`.
- No hay store, API ni migración propia de CxP: es solo lectura.

### Diferencia con Relación de gastos

- Relación de gastos responde «¿cuánto gasté y cuánto es deducible?».
- CxP responde «¿cuánto debo y cuándo vence?».
- Relación de gastos incluye documentos no fiscales; CxP no.
- Relación de gastos separa gasto deducible / crédito fiscal; CxP muestra saldo a pagar y vencimientos.
- Con los datos actuales coinciden porque no hay retenciones, vencimientos, pagos ni documentos no fiscales.

---

## 7. Estado actual de verificación

- `npm test`: **75 pruebas, 74 pasan, 1 omitida**.
  - La omitida es `el plan de cuentas se parsea completo y consistente`, que requiere `Plan de Cuentas contables.xls` en la raíz (archivo ignorado).
- `npm run build`: correcto (solo advertencia habitual de chunk > 500 kB).
- Navegador verificado en `http://127.0.0.1:3000/#/compras/cxp`:
  - 3 documentos del Libro.
  - `Saldo Bs 1.036.176,36` = total general de Relación de gastos.
  - Pestañas Detalle / Por proveedor / Por vencimiento / Por mes correctas.
  - Filtro «Solo vencidas» y exportación `cuentas-por-pagar.csv` correctos.
- No se crearon datos de prueba ni quedaron pendientes en `syncQueue` durante la verificación de CxP.
- Los 3 documentos preexistentes del Libro se conservaron.

---

## 8. Entorno / cómo retomar

- Frontend: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8787` (actualmente caída → errores 500 esperados)
- Auth: solo en memoria; al recargar vuelve a `#/login`.
- Credenciales: `admin / admin123` o `consultor / consultor123`.
- Después de login, la app puede abrir la última ruta visitada; si no es CxP, navegar explícitamente a `#/compras/cxp`.
- IndexedDB: base `dualledger-maestros`, versión `4`. Cerrar pestañas viejas antes de nuevos upgrades.
- No hay repositorio git en `C:\Users\PC\Desktop\DualLedger-main`; todos los cambios están sin commitear.

### Secciones aún pendientes

- `compras/activos-fijos` → sigue con `PlaceholderView`.
- `compras/retenciones-trabajadores` → sigue con `PlaceholderView`.
- CxP pagos/abonos → **decidido no implementar** por ahora (el usuario eligió solo consulta derivada).
- Si en el futuro se quiere CxP con pagos, seguir el patrón de `Documentos no fiscales`:
  store propio en `maestrosDb.js`, API `/cxp-abonos/...`, migración y formulario en `CxpView.vue`.

---

## 9. Preguntas abiertas del análisis original

Archivo: `ANALISIS-MODULO-COMPRAS.md`, §10.

- Pregunta #7: «Uso de Forma de pago (contado/crédito) → ¿genera CxP?»
- Respuesta aplicada: CxP se deriva de la fecha de vencimiento o de los días de crédito; la «Condición (CxP)` del manual se usa para detectar documentos pagados.
- El manual no define más reglas de CxP, así que no se inventaron campos.
