# DualLedger - Image Info PWA

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![PWA](https://img.shields.io/badge/PWA-Ready-green)
![Vue](https://img.shields.io/badge/Vue-3.4+-brightgreen)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Descripción

**DualLedger** es una Progressive Web Application (PWA) diseñada para empresas venezolanas que necesitan digitalizar y procesar documentos fiscales de compra. La aplicación extrae datos de imágenes de facturas, notas de crédito, notas de débito y reportes Z utilizando tecnología OCR e inteligencia artificial, y genera un archivo Excel en formato "Libro de Compras" listo para declaration fiscal.

### Características Principales

- **OCR Dual:** Gemini AI (nube, mayor precisión) con fallback automático a Tesseract.js (local, gratuito)
- **Documentos Impresos y Manuscritos:** Soporte completo con puntuación de confianza por campo
- **PWA Offline-First:** Funciona sin conexión después de la carga inicial
- **Exportación Excel:** Genera archivos .xlsx en formato Libro de Compras venezolano
- **Historial de Exportaciones:** Registro persistente en IndexedDB
- **Interfaz en Español:** Diseñada específicamente para el mercado venezolano

---

## Description

**DualLedger** is a Progressive Web Application (PWA) designed for Venezuelan businesses that need to digitize and process purchase fiscal documents. The application extracts data from images of invoices, credit notes, debit notes, and Z-reports using OCR technology and artificial intelligence, generating an Excel file in "Libro de Compras" (Purchase Ledger) format ready for tax declaration.

### Key Features

- **Dual OCR:** Gemini AI (cloud, higher accuracy) with automatic fallback to Tesseract.js (local, free)
- **Printed and Handwritten Documents:** Full support with per-field confidence scoring
- **Offline-First PWA:** Works without connection after initial load
- **Excel Export:** Generates .xlsx files in Venezuelan Purchase Ledger format
- **Export History:** Persistent record storage in IndexedDB
- **Spanish Interface:** Designed specifically for the Venezuelan market

---

## Instalación | Installation

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

## Uso | Usage

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

### Flujo de Trabajo

1. **Subir Imágenes:**
   - Arrastra y suelta imágenes en la zona de carga
   - O haz clic para seleccionar archivos
   - Máximo 10MB por imagen (JPG/PNG)
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

---

## Arquitectura | Architecture

### Flujo de Datos

```
┌─────────────────┐
│  Subida de      │
│  Imágenes       │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Pipeline OCR   │
│  (Gemini/Tess)  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Parser Regex   │
│  (Extracción)   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Vista/Edición  │
│  (DataPreview)  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Exportación    │
│  Excel (XLSX)   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Historial      │
│  (IndexedDB)    │
└─────────────────┘
```

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

Cada registro contiene 26 campos:

| Campo | Descripción |
|-------|-------------|
| `nro` | Número secuencial |
| `fecha` | Fecha (DD/MM/AAAA) |
| `rif` | RIF del proveedor |
| `nombreRazon` | Razón social |
| `nroFactura` | Número de factura |
| `nroControl` | Número de control |
| `nroNotaDebito` | Número nota de débito |
| `nroNotaCredito` | Número nota de crédito |
| `tipoTransaccion` | "01 -Reg" o "02 - Affect" |
| `totalComprasIVA` | Total incluyendo IVA |
| `baseNacional` | Base imponible nacional |
| `alicuotaNac` | Alícuota nacional (16%) |
| `creditoFiscalNac` | Crédito fiscal nacional |
| `baseImportacion` | Base imponible importación |
| `alicuotaImp` | Alícuota importación (16%) |
| `creditoFiscalImp` | Crédito fiscal importación |
| `retIVA` | Retención de IVA |
| `igtf` | IGTF (3%) |
| `numExpediente` | Número expediente importación |
| `numPlanilla` | Número planilla importación |
| `fechaPlanilla` | Fecha planilla importación |
| `confidencias` | Mapa de confianza por campo (manuscritos) |

---

## Configuración de Gemini | Gemini AI Setup

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
- **Modelo:** Utiliza `gemini-3.1-flash-lite` (gratuito)
- **Tamaño Máximo:** 10MB por imagen
- **Tokens:** Máximo 1024 tokens de respuesta

### Sin API Key

Si no configurás una API Key:
- La aplicación usará Tesseract.js local
- No requiere conexión a internet
- Precisión menor en documentos manuscritos
- Procesamiento más lento

---

## Tecnologías | Tech Stack

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Vue.js** | ^3.4.0 | Framework UI reactivo |
| **Vite** | ^5.4.0 | Build tool y servidor de desarrollo |
| **Tesseract.js** | ^5.1.0 | Motor OCR local |
| **SheetJS (xlsx)** | ^0.18.5 | Generación de archivos Excel |
| **Workbox** | ^7.0.0 | Service worker para PWA |
| **IndexedDB** | Nativo | Persistencia local de datos |

### Dependencias de Desarrollo

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@vitejs/plugin-vue` | ^5.0.0 | Plugin Vite para Vue 3 |
| `vite-plugin-pwa` | ^0.20.0 | Soporte PWA para Vite |

---

## Estructura del Proyecto | Project Structure

```
DualLedger/
├── public/                    # Assets estáticos
│   ├── favicon.ico
│   ├── icon-192.png           # Icono PWA 192x192
│   ├── icon-512.png           # Icono PWA 512x512
│   └── index.html             # HTML entry point (versión anterior)
│
├── src/
│   ├── main.js                # Bootstrap de Vue
│   ├── App.vue                # Componente raíz (orquestador)
│   │
│   ├── components/            # Componentes Vue
│   │   ├── ApiKeySetup.vue    # Configuración API key Gemini
│   │   ├── DataPreview.vue    # Vista/edición de registros
│   │   ├── ExcelExport.vue    # Exportación a Excel
│   │   ├── History.vue        # Historial de exportaciones
│   │   └── ImageUploader.vue  # Subida de imágenes (drag & drop)
│   │
│   ├── stores/                # Gestión de estado
│   │   ├── db.js              # CRUD IndexedDB (historial)
│   │   └── theme.js           # Proveedor de temas (no usado)
│   │
│   └── utils/                 # Lógica de negocio
│       ├── apiKey.js          # Almacenamiento API key (localStorage)
│       ├── deslash.js         # Preprocesamiento imagen (conectados componentes)
│       ├── excelTemplate.js   # Plantilla Excel (SheetJS)
│       ├── gemini.js          # Integración Google Gemini AI
│       ├── ocr.js             # Orquestador OCR principal
│       ├── parse.js           # Parser regex (extracción campos)
│       └── prompts.js         # Prompts para Gemini AI
│
├── index.html                 # Entry point HTML (Vite)
├── package.json               # Configuración npm
├── vite.config.js             # Configuración Vite + PWA
└── README.md                  # Este archivo
```

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia servidor de desarrollo en `localhost:3000` |
| `npm run build` | Genera build de producción en `dist/` |
| `npm run preview` | Vista previa del build de producción |

---

## Contribuir | Contributing

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
1. Ejecutar `npm run dev`
2. Probar flujo completo: subir → procesar → editar → exportar
3. Verificar en diferentes navegadores
4. Probar modo offline (PWA)

---

## Licencia | License

MIT License - Ver archivo [LICENSE](LICENSE) para detalles.

---

## Créditos | Credits

### Desarrollado por

- **Eder Briceño** ([@VzlaEder](https://github.com/VzlaEder))
- **Alberth Ojeda** ([@Leand24](https://github.com/Leand24))


### Tecnología

- **OCR:** Google Gemini AI + Tesseract.js
- **Generación Excel:** SheetJS Community Edition

---

## Soporte | Support

Para problemas o preguntas:
- Abrir un [GitHub Issue](../../issues)
- Revisar la documentación de [Gemini AI](https://ai.google.dev/docs)
- Consultar [Tesseract.js Docs](https://github.com/naptha/tesseract.js)

---

## Changelog

### v1.0.0 (2024)
- ✅ Implementación inicial
- ✅ OCR dual (Gemini + Tesseract)
- ✅ Soporte documentos manuscritos
- ✅ Exportación Excel Libro de Compras
- ✅ Historial de exportaciones
- ✅ PWA offline-first

---

**Hecho con ❤️ para las empresas venezolanas**
