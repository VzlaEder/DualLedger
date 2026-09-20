<div align="center">

# 📗 DualLedger

**Libro de Compras — Extractor de Datos Fiscales**

![Versión](https://img.shields.io/badge/versi%C3%B3n-1.0.0-1a56db?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-offline--first-16a34a?style=for-the-badge)
![Vue](https://img.shields.io/badge/Vue-3.4%2B-42b883?style=for-the-badge&logo=vuedotjs&logoColor=white)
![PDF](https://img.shields.io/badge/PDF-soportado-dc2626?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)
![SENIAT](https://img.shields.io/badge/SENIAT-verificaci%C3%B3n-1a56db?style=for-the-badge)
![Licencia](https://img.shields.io/badge/licencia-MIT-f59e0b?style=for-the-badge)

</div>

---

## 📑 Tabla de contenidos

- [Descripción](#descripción)
- [Instalación](#instalación--installation)
- [Uso](#uso--usage)
  - [Verificación de RIF en el SENIAT](#verificación-de-rif-en-el-seniat-opcional)
  - [Avisos, sonido y confirmaciones](#avisos-sonido-y-confirmaciones)
- [Arquitectura](#arquitectura--architecture)
- [Configuración de Gemini](#configuración-de-gemini--gemini-ai-setup)
- [Tecnologías](#tecnologías--tech-stack)
- [Estructura del Proyecto](#estructura-del-proyecto--project-structure)
- [Scripts](#scripts)
- [Contribuir](#contribuir--contributing)
- [Licencia](#licencia--license)
- [Changelog](#changelog)

---

## 🧭 Descripción

**DualLedger** es una Progressive Web Application (PWA) diseñada para empresas venezolanas que necesitan digitalizar y procesar documentos fiscales de compra. La aplicación extrae datos de imágenes de facturas, notas de crédito, notas de débito y reportes Z utilizando tecnología OCR e inteligencia artificial, y genera un archivo Excel en formato "Libro de Compras" listo para declaration fiscal.

### Características Principales

- **Entrada de Imágenes y PDF:** Acepta fotos (JPG/PNG) y archivos **PDF**; cada página del PDF se procesa como una factura independiente, con miniatura y previsualización.
- **OCR Dual:** Gemini AI (nube, mayor precisión) con fallback automático a Tesseract.js (local, gratuito)
- **Documentos Impresos y Manuscritos:** Soporte completo con puntuación de confianza por campo
- **Tipos de Documento:** Facturas, **notas de crédito**, **notas de débito** y reportes Z, con factura afectada y manejo de signos.
- **Verificación SENIAT:** Consulta del RIF contra el portal público del SENIAT (razón social, % de contribución y condición), con captcha manual y caché compartida en PostgreSQL.
- **PWA Offline-First:** Funciona sin conexión después de la carga inicial
- **Exportación Excel:** Genera archivos .xlsx en formato Libro de Compras venezolano
- **Historial de Exportaciones:** Registro persistente en IndexedDB
- **Experiencia Cuidada:** Modales y avisos flotantes con el diseño de la app, además de un **aviso sonoro** (silenciable) al terminar el procesamiento.
- **Interfaz en Español:** Diseñada específicamente para el mercado venezolano

---

## 🧭 Description

**DualLedger** is a Progressive Web Application (PWA) designed for Venezuelan businesses that need to digitize and process purchase fiscal documents. The application extracts data from images of invoices, credit notes, debit notes, and Z-reports using OCR technology and artificial intelligence, generating an Excel file in "Libro de Compras" (Purchase Ledger) format ready for tax declaration.

### Key Features

- **Images and PDF Input:** Accepts photos (JPG/PNG) and **PDF** files; each PDF page is processed as an independent invoice, with thumbnail and preview.
- **Dual OCR:** Gemini AI (cloud, higher accuracy) with automatic fallback to Tesseract.js (local, free)
- **Printed and Handwritten Documents:** Full support with per-field confidence scoring
- **Document Types:** Invoices, **credit notes**, **debit notes** and Z-reports, with affected invoice and sign handling.
- **SENIAT Verification:** RIF lookup against the SENIAT public portal (company name, contribution %, condition), with manual captcha and shared PostgreSQL cache.
- **Offline-First PWA:** Works without connection after initial load
- **Excel Export:** Generates .xlsx files in Venezuelan Purchase Ledger format
- **Export History:** Persistent record storage in IndexedDB
- **Polished UX:** In-app modals and floating toasts, plus a mutable completion sound.
- **Spanish Interface:** Designed specifically for the Venezuelan market

---

## ⚙️ Instalación | Installation

### Prerrequisitos | Prerequisites

- Node.js 18 o superior / Node.js 18 or higher
- npm o yarn

### Pasos | Steps

```bash
# 1. Clonar el repositorio / Clone the repository
git clone [URL_DEL_REPOSITORIO]

# 2. Navegar al directorio / Navigate to directory
cd DualLedger

# 3. Instalar dependencias / Install dependencies
npm install

# 4. Iniciar servidor de desarrollo / Start development server
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

---

## 🚀 Uso | Usage

### Configuración Inicial

1. **Obtener API Key de Gemini (Recomendado):**
   - Visita [Google AI Studio](https://aistudio.google.com/apikey)
   - Crea una cuenta gratuita
   - Genera una API Key
   - En la app, haz clic en el ícono de configuración (⚙️) en el encabezado
   - Ingresa tu API Key y haz clic en "Guardar"

2. **Sin API Key:**
   - La aplicación funcionará con Tesseract.js local
   - La precisión será menor, especialmente con documentos manuscritos

### Verificación de RIF en el SENIAT (opcional)

Para rellenar automáticamente el nombre real (razón social), el % de contribución y la condición de
cada RIF, la app consulta el portal público del SENIAT a través de un **backend 100% local**
(Express + PostgreSQL) embebido en la ruta `/api`. Ideal para quedarte en tu propia infraestructura
y moverlo después a tu propio dominio.

#### Backend local: proxy Express + PostgreSQL

El servidor Express (`server/index.js`) se integra en el servidor de desarrollo de Vite mediante el
plugin `seniatProxy`, por lo que el cliente llama a `/api` sin necesidad de configurar una URL. En
producción puedes desplegar el mismo Express en tu propio dominio y el cliente seguirá usando `/api`.

1. Instala las dependencias del servidor:

   ```bash
   cd server
   npm install
   ```

2. Levanta PostgreSQL local (opción A: Docker, recomendada):

   ```bash
   docker compose up -d
   ```

   O con un PostgreSQL instalado en tu máquina:

   ```bash
   createdb dualledger
   psql -d dualledger -f server/schema.sql
   ```

   > El schema se aplica automáticamente la primera vez que el contenedor de Docker crea el
   > volumen; el comando `psql` es la alternativa para instalaciones manuales.

3. Crea el archivo `.env` en la raíz (usa `.env.example` como guía):

   ```env
   DATABASE_URL=postgres://dualledger:dualledger@localhost:5432/dualledger
   VITE_SENIAT_WORKER_URL=        # Vacío: se usa el proxy local /api
   PORT=8787                      # Opcional (por defecto 8787)
   ```

4. Inicia la app con `npm run dev`. El cliente usará el proxy local automáticamente.

> [!NOTE]
> El RIF se normaliza sin guiones (por ejemplo, `J-508125843` → `J508125843`). Los RIF que **no
> existen** no se cachean.

#### Modo producción: tu propio dominio

Como todo corre en tu infraestructura, para producción basta con:

1. Desplegar el servidor Express (`server/`) en tu servidor/VPS con tu PostgreSQL y la variable
   `DATABASE_URL` apuntando a él.
2. Servir el build de la app (`dist/`) desde el propio dominio (mismo origen), por lo que el
   cliente usa `/api` sin configuración adicional.
3. Opcional: si separas el backend en otro dominio, rellena `VITE_SENIAT_WORKER_URL` al compilar
   (o guárdala desde la UI, panel ⚙ Herramientas, que además permite probar la conexión).

En la UI (botón ⚙ Herramientas) puedes verificar el estado del servicio: proxy activo y PostgreSQL
conectado o deshabilitado, así como guardar o limpiar una URL alternativa.

> [!NOTE]
> El **Cloudflare Worker** (`worker/`) queda disponible como alternativa opcional de backend SENIAT
> (consulta `MIGRACION.md`), pero ya **no** forma parte del flujo principal de la app.

### Flujo de Trabajo

1. **Subir Imágenes o PDF:**
   - Arrastra y suelta archivos en la zona de carga
   - O haz clic para seleccionar archivos
   - Máximo 10MB por imagen (JPG/PNG) y 25MB por PDF
   - Los PDF muestran una miniatura con el número de páginas y se pueden previsualizar
   - Marca con el ícono ✏️ los documentos manuscritos

2. **Procesar Documentos:**
   - Haz clic en "Procesar" para iniciar el OCR
   - La app mostrará el progreso del procesamiento
   - Los resultados aparecerán en la pestaña "Datos"

3. **Revisar y Editar:**
   - Verás los registros extraídos en tarjetas
   - Haz clic en cualquier campo para editarlo
   - Los campos con baja confianza aparecerán resaltados en naranja
   - Puedes agregar o eliminar registros manualmente

4. **Exportar a Excel:**
   - Ve a la pestaña "Exportar"
   - Selecciona el rango de fechas del libro
   - Revisa el resumen de totales
   - Haz clic en "Exportar" para descargar el archivo .xlsx

5. **Consultar Historial:**
   - En la pestaña "Historial" verás todas las exportaciones anteriores
   - Puedes eliminar registros individuales o todo el historial

### Avisos, sonido y confirmaciones

- Las acciones muestran **avisos flotantes** ("Registro actualizado", "RIF verificado", "Registro
  eliminado", etc.) que se cierran solos a los 2,3 s o con la ✕.
- Al terminar el procesamiento suena un **tono suave**; si algo falla, el aviso sale **en rojo**
  ("El procesamiento falló") con un tono descendente.
- El sonido se puede **silenciar** con el botón 🔊/🔇 del encabezado (se recuerda la preferencia).
- Las confirmaciones destructivas se muestran en un modal propio con botón rojo y **no se cierran al
  hacer clic fuera**.

---

## 🏗️ Arquitectura | Architecture

### Flujo de Datos

```
┌──────────────────┐
│  Subida de       │
│  Imágenes / PDF  │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Pipeline OCR    │
│  (Gemini/Tess)   │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Parser Regex    │
│  (Extracción)    │
└────────┬─────────┘
         │
         v
┌──────────────────┐      ┌────────────────────┐
│  Vista/Edición   │ ───> │  Verificación      │
│  (DataPreview)   │      │  SENIAT (opcional) │
└────────┬─────────┘      └────────────────────┘
         │
         v
┌──────────────────┐
│  Exportación     │
│  Excel (XLSX)    │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Historial       │
│  (IndexedDB)     │
└──────────────────┘
```

La verificación SENIAT consulta la razón social, el % de contribución y la condición del RIF a
través del proxy local (`/api`), y guarda el resultado en caché en **PostgreSQL** (la caché KV
del Cloudflare Worker queda solo como alternativa opcional).

### Pipeline de OCR

**Con Gemini AI (Recomendado):**
1. Imagen se convierte a base64
2. Se envía a Gemini API con prompt estructurado
3. Respuesta JSON se parsea a registros
4. Se extraen campos: RIF, empresa, fechas, montos, números de documento

**Con Tesseract.js (Fallback):**
1. **Preprocesamiento de Imagen:**
   - Escala 3x (mayor resolución)
   - Conversión a escala de grises
   - Estiramiento de histograma
   - Enfoque Laplaciano
   - Binarización Otsu
   - Algoritmo "deslash zeros" (corrige confusión 0/8)

2. **Reconocimiento OCR:**
   - Idioma: Español (spa)
   - Modo: PSM 6 (bloque uniforme)
   - Preserva espacios entre palabras

3. **Re-OCR de Campos Numéricos:**
   - Recorta regiones específicas (FACTURA, CONTROL, RIF, etc.)
   - Re-ejecuta Tesseract con conjunto de caracteres restringido
   - Upscale 3x para mejor precisión

4. **Extracción Regex:**
   - Divide texto en bloques por patrones
   - Extrae: RIF, empresa, fechas, montos, números de documento
   - Calcula: base imponible, crédito fiscal (16% IVA)

### Modelo de Datos

Cada registro contiene 28 campos base (más `condicion` y `confidencias` según el caso):

| Campo | Descripción |
|-------|-------------|
| `nro` | Número secuencial |
| `tipoDocumento` | `factura`, `nota_credito`, `nota_debito` o `reporte_z` |
| `fecha` | Fecha (DD/MM/AAAA) |
| `rif` | RIF del proveedor |
| `nombreRazon` | Razón social (se completa con el SENIAT si está configurado) |
| `porcentajeContribucion` | % de contribución devuelto por el SENIAT |
| `condicion` | Condición del contribuyente (SENIAT) |
| `nroFactura` | Número de factura |
| `nroControl` | Número de control |
| `numeroMaquinaFiscal` | Serial de la máquina fiscal |
| `nroNotaDebito` | Número nota de débito |
| `nroNotaCredito` | Número nota de crédito |
| `tipoTransaccion` | "01 -Reg" o "02 - Affect" |
| `nroFacturaAfectada` | Número de factura afectada (notas) |
| `totalComprasIVA` | Total incluyendo IVA |
| `noGravadas` | Compras no gravadas |
| `baseNacional` | Base imponible nacional |
| `alicuotaNac` | Alícuota nacional (16%) |
| `creditoFiscalNac` | Crédito fiscal nacional |
| `baseImportacion` | Base imponible importación |
| `alicuotaImp` | Alícuota importación (16%) |
| `creditoFiscalImp` | Crédito fiscal importación |
| `numExpediente` | Número expediente importación |
| `numPlanilla` | Número planilla importación |
| `fechaPlanilla` | Fecha planilla importación |
| `retIVA` | Retención de IVA |
| `comprobanteIVA` | Número de comprobante de retención de IVA |
| `fechaIVA` | Fecha del comprobante de retención de IVA |
| `igtf` | IGTF (3%) |
| `confidencias` | Mapa de confianza por campo (manuscritos) |

---

## 🤖 Configuración de Gemini | Gemini AI Setup

### Obtener API Key

1. Visita [Google AI Studio](https://aistudio.google.com/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia la clave generada (empieza con `AIza...`)

### Formatos Soportados

- **API Key:** `AIza...` (formato estándar)
- **OAuth Token:** `AQ....` (token de Google AI Studio)

### Limitaciones

- **Rate Limits:** Google aplica límites de solicitudes por minuto
- **Modelo:** Utiliza `gemini-3.5-flash-lite` (gratuito)
- **Tamaño Máximo:** 10MB por imagen (25MB por PDF)
- **Tokens:** Máximo 1024 tokens de respuesta

### Sin API Key

Si no configurás una API Key:

> [!TIP]
> La aplicación usará **Tesseract.js** local: no requiere conexión a internet, pero tiene menor
> precisión en documentos manuscritos y un procesamiento más lento.

---

## 🧰 Tecnologías | Tech Stack

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Vue.js** | ^3.4.0 | Framework UI reactivo |
| **Vite** | ^5.4.0 | Build tool y servidor de desarrollo |
| **Tesseract.js** | ^5.1.0 | Motor OCR local |
| **pdfjs-dist** | ^6.3.289 | Renderizado de archivos PDF |
| **SheetJS (xlsx)** | ^0.18.5 | Generación de archivos Excel |
| **idb** | ^8.0.0 | Envoltorio de IndexedDB para el historial |
| **Workbox** | ^7.0.0 | Service worker para PWA |
| **Express** | ^4.21.0 | Proxy local SENIAT (`server/`) |
| **node-postgres (pg)** | ^8.13.0 | Caché compartida de RIF en PostgreSQL (`rif_cache`) |
| **IndexedDB** | Nativo | Persistencia local de datos |

### Dependencias de Desarrollo

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@vitejs/plugin-vue` | ^5.0.0 | Plugin Vite para Vue 3 |
| `vite-plugin-pwa` | ^0.20.0 | Soporte PWA para Vite |
| `workbox-window` | ^7.0.0 | Registro del service worker |
| `@resvg/resvg-js` | ^2.6.2 | Generación del logotipo (`scripts/`)|

---

## 🗂️ Estructura del Proyecto | Project Structure

```
DualLedger/
├── public/                     # Assets estáticos
│   ├── favicon.ico
│   ├── icon-192.png            # Icono PWA 192x192
│   ├── icon-512.png            # Icono PWA 512x512
│   └── index.html              # HTML entry point (versión anterior)
│
├── server/                     # Proxy local SENIAT (Express + PostgreSQL)
│   ├── index.js                # Endpoints /lookup, /verify, /captcha
│   ├── schema.sql              # Esquema de la tabla rif_cache (PostgreSQL)
│   └── package.json
│
├── worker/                     # Cloudflare Worker SENIAT (alternativa opcional)
│   └── src/index.js
│
├── docker-compose.yml          # PostgreSQL local (Docker)
│
├── scripts/
│   └── generate-logo.mjs       # Generación del logotipo
│
├── src/
│   ├── main.js                 # Bootstrap de Vue
│   ├── App.vue                 # Componente raíz (orquestador)
│   │
│   ├── components/             # Componentes Vue
│   │   ├── ApiKeySetup.vue     # Configuración API key Gemini
│   │   ├── CaptchaModal.vue    # Entrada manual del captcha SENIAT
│   │   ├── DataPreview.vue     # Vista/edición de registros
│   │   ├── DialogHost.vue      # Modales de alerta/confirmación
│   │   ├── ExcelExport.vue     # Exportación a Excel
│   │   ├── History.vue         # Historial de exportaciones
│   │   ├── ImageUploader.vue   # Subida de imágenes y PDF (drag & drop)
│   │   ├── SeniatSetup.vue     # Configuración del servicio SENIAT
│   │   └── ToastHost.vue       # Avisos flotantes (toasts)
│   │
│   ├── stores/                 # Gestión de estado
│   │   ├── db.js               # CRUD IndexedDB (historial)
│   │   └── theme.js            # Proveedor de temas (no usado)
│   │
│   └── utils/                  # Lógica de negocio
│       ├── apiKey.js           # Almacenamiento API key (localStorage)
│       ├── deslash.js          # Preprocesamiento de imagen
│       ├── dialog.js           # Cola de diálogos y toasts
│       ├── excelTemplate.js    # Plantilla Excel (SheetJS)
│       ├── gemini.js           # Integración Google Gemini AI
│       ├── ocr.js              # Orquestador OCR + PDF
│       ├── parse.js            # Parser regex (extracción de campos)
│       ├── prompts.js          # Prompts para Gemini AI
│       ├── seniat.js           # Verificación de RIF en el SENIAT
│       ├── settings.js         # Configuración (Worker URL, credenciales)
│       └── sound.js            # Sonidos sintetizados (Web Audio)
│
├── index.html                  # Entry point HTML (Vite)
├── package.json                # Configuración npm
├── vite.config.js              # Configuración Vite + PWA
├── CHANGELOG.md                # Historial de cambios
├── MIGRACION.md                # Guía de migración del Worker SENIAT
├── README.md                   # Este archivo
└── .env.example                # Variables de entorno de ejemplo
```

---

## 📜 Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | **Todo automático**: inicializa la BD (si falta el esquema) y arranca el servidor de desarrollo en `localhost:3000` (proxy SENIAT embebido en `/api`) |
| `npm start` | **Todo automático**: inicializa la BD + genera el build si falta `dist/` + sirve producción en `127.0.0.1:8787` (estático + `/api` + PostgreSQL, mismo origen) |
| `npm run build` | Genera build de producción en `dist/` |
| `npm run preview` | Vista previa del build de producción |

> [!TIP]
> Para **pruebas rápidas** solo necesitas `npm run dev`. La base de datos se inicializa sola
> (`server/init-db.mjs` se ejecuta vía el hook `predev`), siguiendo el esquema de
> `server/schema.sql`. Requisito único: tener corriendo un PostgreSQL con el rol y la BD
> indicados en `DATABASE_URL` (ver sección anterior).

### Scripts del servidor (`server/`)

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia el proxy SENIAT de forma independiente |
| `npm run dev` | Proxy SENIAT con recarga automática (`node --watch`) |

---

## 🤝 Contribuir | Contributing

### Guías Básicas

1. **Branching:**
   - `main` - Producción estable
   - `develop` - Desarrollo activo
   - `feature/*` - Nuevas funcionalidades
   - `fix/*` - Corrección de bugs

2. **Commits:**
   - Usar formato convencional: `feat:`, `fix:`, `docs:`, `style:`
   - Ejemplo: `feat: agregar soporte para notas de crédito`

3. **Pull Requests:**
   - Describir cambios claramente
   - Incluir capturas de pantalla si aplica
   - Referenciar issues relacionadas

4. **Estilo de Código:**
   - Seguir convenciones existentes
   - Usar ES Modules (`import/export`)
   - Variables en `camelCase`, componentes en `PascalCase`

### Testing

Actualmente no hay tests automatizados. El testing es manual:

1. Ejecutar `npm run dev`.
2. Probar el flujo completo: subir → procesar → editar → exportar.
3. Subir una imagen y un **PDF** (verificar miniatura, número de páginas y previsualización).
4. Verificar los **avisos flotantes**, los modales (que no cierren al hacer clic fuera) y el
   **sonido** (activar/silenciar).
5. Verificar la **edición de RIF** y la verificación SENIAT (incluido el captcha manual).
6. Probar el resultado del procesamiento con archivos válidos e inválidos.
7. Verificar en diferentes navegadores y probar el modo **offline** (PWA).

---

## 📄 Licencia | License

MIT License - Ver archivo [LICENSE](LICENSE) para detalles.

---

## 🙌 Créditos | Credits

### Desarrollado por

- **Eder Briceño** ([@VzlaEder](https://github.com/VzlaEder))
- **Alberth Ojeda** ([@Leand24](https://github.com/Leand24))


### Tecnología

- **OCR:** Google Gemini AI + Tesseract.js
- **Generación Excel:** SheetJS Community Edition

---

## 💬 Soporte | Support

Para problemas o preguntas:
- Abrir un [GitHub Issue](../../issues)
- Revisar la documentación de [Gemini AI](https://ai.google.dev/docs)
- Consultar [Tesseract.js Docs](https://github.com/naptha/tesseract.js)

---

## 📗 Changelog

El historial completo y detallado de cambios está en **[CHANGELOG.md](CHANGELOG.md)**.

### Sin publicar
- ✅ Entrada y procesamiento de **PDF** (cada página como factura)
- ✅ Modales y **avisos flotantes** propios
- ✅ **Aviso sonoro** silenciable al terminar el procesamiento
- ✅ Manejo de **notas de crédito/débito**

### v1.0.0 (2024)
- ✅ Implementación inicial
- ✅ OCR dual (Gemini + Tesseract)
- ✅ Soporte documentos manuscritos
- ✅ Exportación Excel Libro de Compras
- ✅ Historial de exportaciones
- ✅ PWA offline-first

---

<div align="center">

**Hecho con ❤️ para las empresas venezolanas.**

[Repositorio](https://github.com/VzlaEder/DualLedger) · [Changelog](CHANGELOG.md) · [Migración](MIGRACION.md)

</div>
