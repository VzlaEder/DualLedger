<div align="center">

# 📗 Changelog · DualLedger

**Libro de Compras — Extractor de Datos Fiscales**

![Versión](https://img.shields.io/badge/versi%C3%B3n-1.0.0-1a56db?style=for-the-badge)
![Estado](https://img.shields.io/badge/estado-en%20desarrollo-f59e0b?style=for-the-badge)
![Plataforma](https://img.shields.io/badge/PWA-offline--first-16a34a?style=for-the-badge)
![Vue](https://img.shields.io/badge/Vue-3.4%2B-42b883?style=for-the-badge&logo=vuedotjs&logoColor=white)
![PDF](https://img.shields.io/badge/PDF-soportado-dc2626?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)
![SENIAT](https://img.shields.io/badge/SENIAT-verificaci%C3%B3n-1a56db?style=for-the-badge)

*Registro profesional de novedades, cambios y correcciones del proyecto.*

</div>

---

> [!NOTE]
> Este documento sigue una adaptación ampliada de **[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)**
> y usa **[Versionado Semántico](https://semver.org/lang/es/)** (`MAYOR.MENOR.PARCHE`).
> El objetivo es que el equipo **y** el cliente entiendan *qué* cambió, *por qué* y *cómo*,
> sin necesidad de leer el historial de Git.

---

## 📑 Índice

- [Sin publicar — 2026-09-17](#sin-publicar--2026-09-17)
  - [🧾 Resumen para el cliente](#-resumen-para-el-cliente)
  - [🆕 Añadido](#-añadido)
  - [🔄 Cambiado](#-cambiado)
  - [🐞 Corregido](#-corregido)
  - [🛡️ Seguridad y estabilidad](#-seguridad-y-estabilidad)
  - [📚 Documentación](#-documentación)
  - [⚙️ Detalle técnico](#-detalle-técnico)
- [1.0.0 — 2024](#100--2024)

---

## 🧭 Cómo leer este documento

| Símbolo | Categoría | Significado |
| :---: | --- | --- |
| 🆕 | **Añadido** | Funcionalidad nueva. |
| 🔄 | **Cambiado** | Cambios en el comportamiento existente. |
| 🐞 | **Corregido** | Errores solucionados. |
| 🗑️ | **Eliminado** | Funcionalidad retirada. |
| 🛡️ | **Seguridad / Estabilidad** | Robustez, prevención de bucles y manejo de errores. |
| 📚 | **Documentación** | Cambios en archivos de documentación. |
| ⚙️ | **Técnico** | Detalles de implementación para desarrollo. |

> [!TIP]
> Para el cliente, basta con leer la sección **Resumen para el cliente**.
> El **Detalle técnico** está pensado para el equipo de desarrollo.

---

## Sin publicar — 2026-09-17

> [!IMPORTANT]
> Esta versión se centra en: **(1)** soporte de facturas en **PDF**, **(2)** una experiencia de
> usuario cuidada con **modales, avisos flotantes y sonido**, **(3)** la **verificación SENIAT**
> a prueba de fallos y **(4)** la corrección de un bug crítico que impedía **editar el RIF**.

### 🧾 Resumen para el cliente

| | Novedad |
| :---: | --- |
| 📄 | **Facturas en PDF:** además de fotos, se pueden subir archivos PDF. Cada página se procesa como una factura distinta y la cola muestra una miniatura con el número de páginas. |
| 🔔 | **Avisos flotantes:** los mensajes ("Registro eliminado", "RIF verificado"…) aparecen abajo como notificaciones breves, no como ventanas del navegador. Se cierran solos a los **2,3 s** o con la ✕. |
| 🔉 | **Aviso sonoro:** al terminar de procesar suena un tono suave, silenciable con el botón 🔊/🔇 del encabezado (la preferencia se recuerda). |
| 🪟 | **Ventanas con el diseño de la app:** las alertas y confirmaciones **no se cierran al hacer clic fuera**; las acciones destructivas se ven en rojo. |
| ✅ | **Corrección crítica:** el **RIF ya se puede editar** y el SENIAT dejó de mostrar "el contribuyente no existe" cuando el RIF sí existe. |
| 🔴 | **Resultado real del procesamiento:** si algo falla, el aviso sale **en rojo** con el texto **"El procesamiento falló"** (antes aparecía en verde como si todo hubiera ido bien). |

---

### 🆕 Añadido

#### 📄 Entrada de documentos PDF

- El área de carga ahora acepta `image/*` **y** `application/pdf`.
- **Cada página del PDF se procesa como una factura independiente**, reutilizando el mismo
  pipeline de OCR/parseo que las imágenes.
- **Límites de tamaño:** `25 MB` para PDF y `10 MB` para imágenes. El arrastrar y soltar filtra los
  archivos válidos y avisa de los que no lo son.
- **Miniatura real de PDF:** se renderiza la primera página como imagen (URL `blob:`) y se superpone
  una insignia con el **número de páginas**.
- **Previsualización:** imágenes en un modal `<img>`; PDF en un modal `<iframe>`.
- **Precache offline:** el worker de `pdfjs` (`.mjs`) forma parte del precache de la PWA.

#### 🔔 Avisos flotantes (toasts)

- Notificaciones no bloqueantes en la **parte inferior central**.
- Tipos con color e icono propios: `info` 🔵 · `success` 🟢 · `warning` 🟠 · `error` 🔴.
- Cierre automático a los **2300 ms** (configurable) y botón **✕** para cerrar manualmente.
- Se apilan verticalmente y respetan el área segura del móvil (`safe-area-inset-bottom`).
- Disparadores actuales:

  | Aviso | Origen |
  | --- | --- |
  | Registro eliminado | Pestaña **Datos** |
  | Registros de la sesión limpiados | Pestaña **Datos** |
  | Registro actualizado | Al guardar una edición con cambios reales |
  | RIF verificado: `<nombre>` | Verificación SENIAT exitosa |
  | Registro del historial eliminado · Historial eliminado | Pestaña **Historial** |
  | Procesamiento completado · con N error(es) · El procesamiento falló | Al terminar la carga |

#### 🪟 Modales propios de alerta y confirmación

- Reemplazan a **todos** los `alert()` y `confirm()` nativos del navegador.
- API basada en **Promesas**:

  ```js
  await showAlert('No se pudo leer el archivo', { type: 'warning' })
  const ok = await showConfirm('¿Eliminar este registro?', { danger: true, confirmText: 'Eliminar' })
  ```

- El fondo **no cierra** el modal al hacer clic fuera; **tampoco** con la tecla `Escape`.
  Solo se cierra con los botones.
- Foco automático en el botón principal y bloqueo del scroll de fondo.
- Confirmaciones destructivas con `danger: true` (botón rojo y textos como "Eliminar" o "Limpiar").

#### 🔊 Aviso sonoro y control de sonido

- **Sonido de finalización:** chime sutil de dos notas **ascendentes** al terminar correctamente.
- **Sonido de error:** dos notas **descendentes** cuando el procesamiento falla (total o parcial).
- **Control 🔊/🔇** en el encabezado, junto al botón de tema; al activarlo reproduce una muestra.
- Preferencia persistida en `localStorage` (`dualledger-sound`; `'on'` por defecto).
- Sonidos **sintetizados** con la Web Audio API (osciladores + envolvente), por lo que **no se
  agregan archivos de audio** al proyecto.

#### 🧾 Manejo de Nota de Crédito / Nota de Débito

- Se distingue el **tipo de documento**: `factura`, `nota_credito`, `nota_debito`, `reporte_z`.
- Las notas registran su **número propio** (`nroNotaCredito` / `nroNotaDebito`) y la
  **factura afectada** (`nroFacturaAfectada`).
- Los montos se manejan con **signo negativo** en el registro y el Excel, pero se muestran
  **positivos** en la vista para facilitar la lectura.
- La vista oculta la fila "Nro. Factura" en las notas y omite "Tipo Transacción" en modo lectura
  (se conserva en edición y en el Excel).

---

### 🔄 Cambiado

- **Se eliminaron todos los avisos nativos** (`alert`/`confirm`) en `ImageUploader.vue`,
  `ExcelExport.vue`, `App.vue`, `DataPreview.vue` y `History.vue`; ahora usan `showAlert` /
  `showConfirm`.
- **Captcha del SENIAT:** ya **no se cancela al hacer clic fuera**; solo se cierra con el botón
  **Cancelar** (antes un clic accidental abortaba la verificación).
- **Verificación SENIAT:** al corregir el RIF, el error anterior se limpia de inmediato y **no se
  reutilizan datos viejos** de la caché.
- **Resultado del procesamiento:** el aviso final ahora refleja el resultado real (ver tabla en el
  detalle técnico).
- **Edición de registros:** toast "Registro actualizado" solo si hubo cambios reales.
- **Modelo de OCR:** documentado `gemini-3.5-flash-lite` (antes el README indicaba otra versión).
- **Precache de la PWA:** se amplió a archivos `mjs` y el límite por archivo subió a **3 MB**
  (necesario para el worker de `pdfjs`).

---

### 🐞 Corregido

#### 🔁 Bucle infinito de autoverificación SENIAT al editar el RIF — *crítico*

> [!WARNING]
> Este bug impedía editar el RIF con normalidad y mostraba "el contribuyente no existe" de forma
> errática, dejando la interfaz "pegada".

- **Causa raíz (doble):**
  1. `autoLookupAll` (un `watcher` profundo sobre los registros) relanzaba `autoLookupSeniat`, que
     **capturaba el registro antes del `await`** y luego emitía una copia antigua, sobreescribiendo
     la edición.
  2. Existía una fila basura en la caché de Supabase:
     `J500125843` → `nombre_razon = "No existe el contribuyente solicitado"`, `porcentaje = null`,
     que provocaba reintentos infinitos.
- **Solución (en tres frentes):**
  1. El servidor **ya no cachea** respuestas tipo "no existe" (`isNotFoundLike`) y las devuelve como
     `{ ok: false, notFound: true }`.
  2. El cliente **filtra** esas entradas de la caché local y de la compartida.
  3. La verificación **aborta si el RIF cambió**, fusiona **solo** los campos del SENIAT y **no
     emite** actualización si nada cambió (lo que corta el bucle).
- Se eliminó manualmente la **fila basura** de `rif_cache` en Supabase.

#### Otras correcciones

- **Parseo de montos en formato venezolano:** lectura correcta de cifras con **coma decimal y punto
  de miles** (por ejemplo `1.234,56`).
- **Serial de la máquina fiscal:** captura corregida de `numeroMaquinaFiscal`.
- **Aviso de error en verde:** cuando el procesamiento fallaba, el aviso final aparecía en verde.
  Ahora se muestra en rojo o ámbar, con el tono de error correspondiente.

---

### 🛡️ Seguridad y estabilidad

- **Sin bucles de verificación:** la detección de "no existe" evita reintentos perpetuos y escrituras
  innecesarias en la caché.
- **Cancelación limpia:** el botón "Cancelar" usa un `AbortController`; los `AbortError` no cuentan
  como fallos.
- **Aislamiento del modal:** los diálogos bloquean el scroll de fondo y evitan cierres accidentales.
- **Audio tolerante a fallos:** toda la lógica de sonido está en `try/catch`; si el navegador no
  permite audio, la app sigue funcionando.
- **Autoplay:** el contexto de audio se desbloquea dentro del gesto del usuario (clic en "Procesar"
  o en el botón de sonido).

---

### 📚 Documentación

- Se creó este **`CHANGELOG.md`** con el detalle de las versiones.
- Se actualizó el **`README.md`**: PDF, SENIAT, avisos, sonido, arquitectura, estructura y stack.

---

### ⚙️ Detalle técnico

<details>
<summary><strong>1. Entrada y renderizado de PDF</strong></summary>

- **Dependencia:** `pdfjs-dist ^6.3.289` (importación dinámica para no cargarla si no se usa).
- **`src/utils/ocr.js`:**
  - `loadPdfjs()` — carga perezosa y configura `workerSrc`
    (`pdfjs-dist/build/pdf.worker.min.mjs?url`).
  - `loadPdfDocument(file)` — abre el PDF desde un `ArrayBuffer`.
  - `renderPdfPageToBlob(page, opts)` — dibuja la página en un `<canvas>` (fondo blanco) y la
    exporta a `Blob`/PNG.
  - `renderPdfThumbnail(file, maxWidth = 160)` — devuelve `{ url, numPages }` para la miniatura.
  - `renderPdfPages(file)` / `expandFile(file)` — expande cada página a un archivo procesable.
- **`src/components/ImageUploader.vue`:** `accept="image/*,application/pdf"`, validación por tipo y
  tamaño, cola con `isPdf`/`pages`/URLs `blob:` (con revocación al desmontar) y modal que alterna
  `<img>` / `<iframe>`.
- **`vite.config.js`:** `workbox.globPatterns` incluye `mjs` y `maximumFileSizeToCacheInBytes: 3 MB`.

</details>

<details>
<summary><strong>2. Verificación SENIAT y caché</strong></summary>

- **Servidor local (`server/index.js`):** proxy Express que consulta el portal público del SENIAT
  (`BuscaRif.jsp` + `Captcha.jpg`, solo HTTP) con un `User-Agent` de Chrome y usa **Supabase** como
  caché compartida (tabla `rif_cache`).
  - `isNotFoundLike(value)` — detecta "no existe" / "no se encontró".
  - `/verify` — si no existe, devuelve `{ ok: false, notFound: true }` **sin cachear**.
  - `/lookup` — ignora entradas "no existe".
- **Cliente (`src/utils/seniat.js`):** `WORKER_URL` (`/api` en desarrollo; `VITE_SENIAT_WORKER_URL` o
  URL configurada en producción), `getWorkerUrl()` con prioridad de `localStorage`, filtrado de
  caché local/compartida y mensajes claros de error.
- **`src/components/DataPreview.vue`:** `autoLookupSeniat` relee el registro actual, aborta si cambió
  el RIF, fusiona solo campos del SENIAT y no emite si nada cambió; `verificarSENIAT` limpia el error
  previo y emite el resultado; `toggleEdit` limpia campos SENIAT al cambiar el RIF; `watcher
  'editForm.rif'` limpia el error en vivo.

</details>

<details>
<summary><strong>3. Diálogos y toasts</strong></summary>

- **`src/utils/dialog.js`:**
  - `dialogState = reactive({ queue: [] })` → `showAlert`, `showConfirm`, `settle`, `dialogTitle`.
  - `toastState = reactive({ items: [] })` → `showToast(message, { type, duration })` y
    `dismissToast(id)` (auto-cierre con `setTimeout`).
- **`src/components/DialogHost.vue`:** renderiza `dialogState.queue[0]`; sin `@click` en el backdrop
  y sin manejador de `Escape`; `z-index: 10000`; foco automático; `body.overflow = 'hidden'`.
- **`src/components/ToastHost.vue`:** pila con `TransitionGroup`; `z-index: 10001`; contenedor
  `pointer-events: none` con ítems `pointer-events: auto`; respeta el área segura del móvil.
- **Montaje:** ambos se montan una sola vez en `App.vue`.

</details>

<details>
<summary><strong>4. Sonido</strong></summary>

- **`src/utils/sound.js`:**
  - `isSoundEnabled()` / `setSoundEnabled(bool)` → `localStorage['dualledger-sound']`.
  - `unlockAudio()` — crea/reanuda el `AudioContext` (se llama en gestos del usuario).
  - `playTone(ctx, freq, startAt, duration, peak)` — oscilador `sine` con envolvente
    (`linearRampToValueAtTime` + `exponentialRampToValueAtTime`) a ganancia baja (~`0.05`).
  - `playCompletionSound()` — ascendente (`659.25 Hz → 880 Hz`).
  - `playErrorSound()` — descendente (`349.23 Hz → 261.63 Hz`).

</details>

<details>
<summary><strong>5. Notas de crédito / débito</strong></summary>

- **`src/utils/parse.js`:** `normalizeTipoDocumento`, detección de `nota_credito` / `nota_debito` /
  `reporte_z`, resolución de `nroFacturaAfectada` y manejo de signos.
- **`src/components/DataPreview.vue`:** la vista oculta "Nro. Factura" en notas y omite "Tipo
  Transacción" en modo lectura.
- **`src/utils/excelTemplate.js`:** exportación con signos y campos correctos según el tipo.

</details>

<details>
<summary><strong>6. Resultado del procesamiento</strong></summary>

`App.vue` → `handleProcessStart`: `let failCount = 0` se incrementa en el `catch` por ítem (los
`AbortError` se propagan para no contar la cancelación). Al finalizar sin abortar:

| Condición | Aviso | Tipo | Sonido |
| --- | --- | :---: | :---: |
| `failCount === 0` | Procesamiento completado | 🟢 `success` | ascendente |
| `0 < failCount < total` | Procesamiento completado con N error(es) | 🟠 `warning` | error |
| `failCount >= total` | El procesamiento falló | 🔴 `error` | error |

</details>

<details>
<summary><strong>7. Capas (z-index)</strong></summary>

| Elemento | `z-index` |
| --- | :---: |
| Overlay de carga | `9999` |
| Modales (`DialogHost`, `SeniatSetup`) | `10000` |
| Toasts (`ToastHost`) | `10001` |
| Modales internos (`CaptchaModal`, previsualización) | `1000` |

</details>

<details>
<summary><strong>8. Archivos nuevos</strong></summary>

| Archivo | Rol |
| --- | --- |
| `src/utils/dialog.js` | Cola de diálogos/toasts y API de promesas. |
| `src/utils/sound.js` | Sonidos sintetizados y preferencia de silencio. |
| `src/components/DialogHost.vue` | Modal de alerta/confirmación. |
| `src/components/ToastHost.vue` | Pila de avisos flotantes. |

</details>

<details>
<summary><strong>9. Archivos modificados</strong></summary>

| Archivo | Cambios |
| --- | --- |
| `src/App.vue` | Montaje de hosts, toggle de sonido, `failCount` y toasts de resultado, toasts de borrado. |
| `src/components/DataPreview.vue` | `showConfirm`/`showToast`, fix del bucle SENIAT, toast de RIF verificado y de registro actualizado. |
| `src/components/CaptchaModal.vue` | Se quitó `@click.self="cancel"`. |
| `src/components/ImageUploader.vue` | PDF, miniatura + badge, previsualización, `showAlert`. |
| `src/components/ExcelExport.vue` | `showAlert` en error de exportación. |
| `src/components/History.vue` | Confirmaciones y toasts de borrado. |
| `src/utils/ocr.js` | Carga y renderizado de PDF. |
| `src/utils/seniat.js` | `isNotFoundLike`, filtrado de caché, aborts y mensajes. |
| `server/index.js` | `isNotFoundLike`, `/verify` sin cachear "no existe", `/lookup` filtrado. |
| `vite.config.js` | Precache `mjs` + límite de 3 MB. |
| `package.json` | `pdfjs-dist ^6.3.289`. |
| `README.md` / `CHANGELOG.md` | Documentación. |

</details>

<details>
<summary><strong>10. Historial de commits (rama <code>develop</code>)</strong></summary>

| Commit | Tipo | Descripción |
| :---: | :---: | --- |
| `185d92b` | 🐞 `fix` | Aviso de procesamiento en rojo y sonido de error cuando falla. |
| `3749b9e` | 🆕 `feat` | Modales y toasts propios, toggle de sonido y aviso al procesar. |
| `5edf3fa` | 🆕 `feat` | Miniatura de PDF, previsualización y precache offline. |
| `f6f2d32` | 🆕 `feat` | Sube PDFs y procesa cada página. |
| `0319079` | 🐞 `fix` | Evita bucle de autoverificación SENIAT y edición de RIF. |
| `13bca20` | 🆕 `feat` | Manejo de Nota de Crédito/Débito (tipo, factura afectada, signos y vista). |
| `d0cc648` | 🐞 `fix` | Parseo de montos en formato es-VE y serial de máquina fiscal. |

</details>

<details>
<summary><strong>11. Notas de despliegue</strong></summary>

- `pdfjs-dist` se carga de forma dinámica; el worker `.mjs` debe quedar en el precache (ya
  configurado).
- El sonido requiere interacción del usuario para desbloquearse (comportamiento normal del navegador);
  la app ya lo maneja.
- **No versionar:** `eng.traineddata` y `worker/dev8787.log`.
- Variables de entorno relevantes: `DATABASE_URL`, `VITE_SENIAT_WORKER_URL`,
  `PORT` (servidor local).

</details>

### 🗑️ Eliminado

- Eliminado el flujo de despliegue del **Cloudflare Worker** desde la UI: el panel ⚙
  "Herramientas" ya no pide token ni account de Cloudflare.
- Eliminado `src/utils/cloudflare.js` y las funciones de token/cuenta de
  `src/utils/settings.js`.

### 🔄 Cambiado

- La caché compartida de RIF pasa de **Supabase** a **PostgreSQL directo** (driver `pg`) vía
  `DATABASE_URL` en el proxy local Express (`server/index.js`).
- El cliente usa por defecto el proxy local **`/api`** en desarrollo y producción; la URL del
  servicio queda como override opcional para un backend externo (ej. dominio propio).
- El panel ⚙ "Herramientas" ahora muestra el estado del servicio local (proxy + PostgreSQL) y
  permite guardar/limpiar una URL alternativa.
- **Arranque con un solo comando:** `npm run dev` y `npm start` inicializan la base de datos
  automáticamente (`server/init-db.mjs`, vía hooks `predev`/`prestart`). `npm start` además
  sirve el build estático + `/api` + PostgreSQL desde el mismo origen (`server/index.js`).

### 📚 Documentación

- Actualizados `README.md`, `.env.example` y `server/schema.sql` para PostgreSQL local.
- Añadido `docker-compose.yml` en la raíz para levantar PostgreSQL localmente.
- `README.md` (sección **Instalación**): pasos completos — dependencias de la app y del servidor,
  configuración de `.env`, PostgreSQL (Docker o instalado) y arranque con un solo comando.

---

## [1.0.0] — 2024

### 🆕 Añadido

- Implementación inicial de la PWA.
- OCR dual: **Gemini AI** (nube) con fallback a **Tesseract.js** (local).
- Soporte de documentos **impresos y manuscritos** con puntuación de confianza por campo.
- Exportación a Excel en formato **Libro de Compras** venezolano.
- **Historial** de exportaciones en IndexedDB.
- PWA **offline-first**.
- Interfaz en español.

---

<div align="center">

### 🔗 Enlaces

[Repositorio](https://github.com/VzlaEder/DualLedger) ·
[Comparar cambios](https://github.com/VzlaEder/DualLedger/compare/develop...HEAD) ·
[README](README.md)

<sub>Hecho con ❤️ para las empresas venezolanas.</sub>

</div>
