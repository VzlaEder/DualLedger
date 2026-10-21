# Análisis del Módulo de Compras — MANUAL DE PROCEDIMIENTO MÓDULO COMPRAS

> Fuente: `Image-Info/MANUAL DE PROCEDIMINETO MODULO COMPRAS.pdf` (15 páginas, 1.5 MB)
> Análisis: 2026-10-21
> Propósito: extraer el modelo de negocio implícito en el manual y convertirlo en un esquema de base de datos extensible + una API REST.

---

## 1. Resumen ejecutivo

El manual documenta **4 secciones** del módulo de compras de un sistema contable venezolano ya en producción:

| Sección | Contenido | Naturaleza |
|---|---|---|
| **1.1 Artículos** | Cuentas contables que se seleccionan según el concepto de la factura | Maestro |
| **1.2 Proveedores** | Maestro con validación SENIAT, Ret IVA, Ret ISLR, pestañas Básicos/Documentos/Contactos/Documentos Digitales/Log | Maestro |
| **1.3 Compras Diarias** | Registro de facturas de compra; al guardar se **generan automáticamente** las retenciones de IVA e ISLR | Transacción |
| **1.4 Reportes** | Libro de Compras (Nacional), Retenciones IVA (TXT), Retenciones ISLR (XML) | Salida |

**Conclusión central:** el manual no describe "un CRUD más". Describe un **flujo transaccional con tres salidas fiscales obligatorias** (Libro de Compras, TXT de Ret IVA, XML de Ret ISLR) que hoy en `image-info-pwa` **sólo existe parcialmente**: el Excel del Libro de Compras ya se genera en el cliente (`src/utils/excelTemplate.js`), pero **no hay tabla de facturas de compra, ni retenciones persistidas, ni motor de cálculo, ni correlativos de comprobante**.

### Hallazgos clave

1. **El ciclo de vida transaccional es el core que falta.** El `payload JSONB` de la tabla `compras` actual (sin usar) no modela cabecera + líneas + retenciones generadas.
2. **Las retenciones son documentos de primera clase**, no campos calculados: tienen número de comprobante, periodo, estado y archivo.
3. **El manual exige 3 formatos de salida con destino externo:** Excel (Libro de Compras), **TXT** (Ret IVA, SENIAT), **XML** (Ret ISLR, SENIAT). El TXT y XML no existen en el código actual.
4. **La consulta al SENIAT ya es un diferenciador técnico** (`src/utils/seniat.js`, worker Cloudflare + KV) y debe promoverse a un dato persistido en el proveedor (`condicion`, `porcentaje_contribucion`), no a un input manual.
5. **El `concepto_islr` del proveedor es polimórfico en el manual** (lista de ~8 conceptos legislatorios). El modelo actual `conceptos_islr` con `sustraendo_ut`/`base_minima_ut` es correcto y **debe conservarse**.

---

## 2. Metodología de extracción y límites

- **Texto nativo del PDF:** 15 páginas, íntegro y legible (sección 1 completa con numeración 1.1 → 1.4.3.2).
- **Capturas de pantalla:** ~10 páginas son screenshots de la aplicación legacy (ERP contable). **No son imágenes vectoriales**, por lo que los campos se extrajeron por **OCR local (`tesseract.js`, español)** → resultado con ruido, validado contra el texto nativo.
- **Límite:** los nombres exactos de algunas etiquetas de UI se leen parcialmente (ej. `Trma: Cuna` = "Forma de [Pago]", `Seno Doc: Suspendido` = "Estado Doc"). **Los campos dudosos están marcados como `[por confirmar]`** abajo y no se deben codificar sin validación del usuario.
- **Fuentes de contraste usadas:** `server/schema.sql`, `src/utils/parse.js` (modelo OCR de 25 campos), `src/utils/excelTemplate.js` (25 columnas del Libro de Compras), `src/services/conceptosIslr.js` (10 conceptos ISLR seed).

---

## 3. Contenido del manual — detalle por sección

### 1.1 Artículos

> "Comprende las cuentas contables que serán seleccionadas de acuerdo al concepto de la factura a registrar."

- CRUD con botón **NUEVO** → despliega ficha.
- La captura (pág. 1, inferior) muestra un plan de cuentas con columnas `Código | Descripción | Gastos | Ingresos` y códigos jerárquicos (`1.1.1.01.001`).

**Lectura:** en el sistema legacy, "Artículos" es el **plan de cuentas de inventario/productos**, no un catálogo de precios. En `image-info-pwa` esto ya está resuelto por `cuentas_contables` (jerarquía + `es_movimiento` + importador `.xls` en `src/services/importAccounts.js`).

**Decisión:** `articulos` debe ser una **extensión** de `cuentas_contables` (FK), no una tabla paralela. Se crea sólo para lo que el plan de cuentas no modela: unidad, precios, existencia y si el bien es **mercadería** (existencia) o **servicio** (no existe).

### 1.2 Proveedores

> "en esta sección se encontrará el registro de todos proveedores que estén agregados"

Listado (pág. 3): columnas `Nro | Nombre | Clasificación | ... | Días | Documento | ...`.

**Ficha de proveedor** (págs. 3–5). Pestañas: **Básicos | Documentos | Contactos | Documentos Digitales | Log**.

| Campo | Tipo | Notas |
|---|---|---|
| Rif/Cédula | texto | Botón **Consultar** → portal SENIAT (valida y trae razón social + condición) |
| Nombre / Razón Social | texto | Se autocompleta desde SENIAT |
| Dirección | texto | Checkbox **Extranjero** |
| Clasificación | catálogo | `Básicos \| Documentos \| Contabilidad \| Comercio \| Bienes \| ...` (OCR parcial) `[por confirmar]` |
| Días Crédito | entero | |
| Cta. Contable | FK `cuentas_contables` | Selector jerárquico (ya existe `AccountSelector.vue`) |
| **Ret IVA** | enum | `RETENCIÓN IVA 75%` \| `RETENCIÓN IVA 100%` — según lo que informa el SENIAT |
| **Ret ISLR** | catálogo | Lista de conceptos legislatorios (pág. 5) |
| Condición | texto | Texto devuelto por SENIAT (p. ej. "Contribuyente Ordinario del IVA y Agente de Retención del IVA") |
| Crédito fiscal no deducible | bool | |
| Prorratear Documentos | bool | |
| Transporte | bool | |
| Banco | tabla | Botón **Importar** |
| Dirección / Teléfono / E-mail | texto | Pestaña Contactos |
| Documentos / Documentos Digitales | adjuntos | |

**Conceptos ISLR del manual** (pág. 5, OCR):

| Concepto | Con retenue |
|---|---|
| Servicios a empresas contratistas | del 100% |
| Demaciar o no en el [??] | |
| Canon de Arrendamiento de bienes inmuebles | 100% |
| Pago por gastos de transporte | |
| Pago por servicio de Publicidad y Propaganda | |
| Pago a empresas contratistas | |

> ⚠️ La lista del manual está truncada por OCR. El seed real de la app (`src/services/conceptosIslr.js`, 10 conceptos) es la referencia a conservar.

### 1.3 Compras Diarias

> "Donde se realiza el registro de las facturas de compras."

**Listado** (pág. 6): `Fecha | Nro. Documento | ... | Moneda | ... | Base | IVA | Ret IVA | Ret ISLR | IGTF | Total | Estado | Proveedor`.

**Ficha** (págs. 6–8) — botón `NUEVO`:

| Grupo | Campos |
|---|---|
| **Encabezado** | Proveedor (búsqueda por nombre, RIF o desplegable), Tipo de Documento, Nro. Factura, Nro. Control, Fecha de Emisión, **Fecha de Declaración** (= fecha de las retenciones de IVA e ISLR), Nro. Factura Afectada, Tipo de Transacción, Moneda, Forma de Pago, Días Crédito, Estado (`PENDIENTE`), Observaciones, Nro. Máquina Fiscal |
| **Detalle** | Código, Descripción, Cantidad, Precio, Total, **% IVA** (o `Exento`), Subtotal |
| **Totales** | Base Imponible, IVA, Subtotal, Total General, **Ret IVA %**, **Ret ISLR %**, IGTF, Monto Total Retenido, Monto Total a Pagar |
| **Selector de cuenta** | Código o nombre de cuenta contable (autocomplete jerárquico) |
| **Concepto ISLR** | Dropdown con el concepto y "Monto Base" (cálculo de la retención) |
| **Importación** | Sí/No + datos de planilla/expediente |

**Pie de la factura (texto legal impreso):**
> "LA CONDICION DE ESTE CONTRIBUYENTE REQUIERE LA RETENCION DEL 75% DEL IMPUESTO CAUSADO, SALVO QUE INCURRA DISTINTA DE LICORES CONFIANZA, C.A."

→ **El porcentaje de retención se imprime en la factura** y depende de la condición SENIAT del proveedor.

### 1.4 Reportes

| # | Reporte | Filtros | Salida |
|---|---|---|---|
| 1.4.1 | **Libro de Compras (Nacional)** | Intervalo de fechas (ej. `01/09/2026` → `15/09/2026`) | Excel |
| 1.4.2 | **Retenciones de IVA** | Intervalo de fechas | Botón **Generar** → **TXT** (formato SENIAT) + botón "Ver" → comprobante imprimible / **PDF** / **Excel** |
| 1.4.3 | **Retenciones de ISLR** | Intervalo de fechas | Botón **Generar** → **XML** (formato SENIAT) + botón "Ver" → comprobante imprimible / **PDF** / **Excel** |

**Columnas del Libro de Compras** (pág. 12, OCR): `Fecha Fact | Fecha IVA | Documento | Nro. Control | Razón Social | Retención IVA | Nro Ret | Base | Total | Comprobante`.
→ Coincide con las 25 columnas ya implementadas en `src/utils/excelTemplate.js` (el Libro de Compras del manual es **más corto**: resumen por factura, no el formato fiscal SENIAT detallado).

**Comprobante de Retención de IVA** (pág. 13): "COMPROBANTE DE RETENCIÓN DE IMPUESTO AL VALOR AGREGADO" — RIF, Razón Social del retenido, Ejercicio, Mes, Fecha de emisión, Tipo/Nro. documento, Nro. comprobante, Monto total, Base imponible, IVA, %, Retención IVA, Total a pagar.

**Comprobante de Retención de ISLR** (pág. 14): Nro. Comprobante, Nro. Control, Monto Contrapartida, Código de concepto, Nombre del concepto.

**Menú de reportes** identificado en la app legacy (pág. 11): *Libro de Compras Nacional, Libro de Compras Importación, Retención de IVA, Retención de ISLR, Resumen de Retenciones, Compras por Proveedor, Estado de Proveedores, Compras Diarias, Compras Analítico*.

---

## 4. Reglas de negocio extraídas

### 4.1 Retención de IVA

El SENIAT devuelve la **condición** del contribuyente. Según la condición se asigna el porcentaje de retención:

| Condición SENIAT | `% Retención` | Cálculo |
|---|---|---|
| "Contribuyente Ordinario del IVA y **Agente de Retención** del IVA" | **75 %** | `retenido = IVA_pagado × 0.75` |
| "Contribuyente **Especial**" | **100 %** | `retenido = IVA_pagado × 1.00` |
| Sin condición de agente | — | `retenido = 0` |

- `IVA_pagado = base_imponible × 16 %` (tasa en `parametros.tasaIVA`).
- La **fecha de declaración** de la factura es la fecha de la retención de IVA **y** de la de ISLR (deben coincidir).
- El valor ya se persistió en `rif_cache.porcentaje_contribucion` (`rif_cache` + `proveedores.porcentaje_ret_iva`) — **reutilizar, no duplicar**.

### 4.2 Retención de ISLR

Base legal: Providencia SNAT 0071. Fórmula (ya documentada como comentario en `MaestrosTab.vue:103`):

```
base_imponible  = max( base_factura_retenible , base_minima_ut × unidad_tributaria )
monto_retenido  = max( 0 , ( base_imponible − sustraendo_ut × unidad_tributaria ) × porcentaje / 100 )
```

Parametrizable por `conceptos_islr` (`porcentaje`, `sustraendo_ut`, `base_minima_ut`) y `parametros.unidadTributaria`.

> ⚠️ **A confirmar con el cliente**: si el sustraendo se expresa en UT (como sugiere `sustraendo_ut`) o en BSD como monto fijo. El código actual asume UT.

### 4.3 IGTF

3 % (`parametros.tasaIGTF`) sobre pagos de fletes/seguros — aplicable sólo a documentos marcados como tales.

### 4.4 Correlativos de comprobante

**Confirmado contra datos reales** (§4.6): el número de comprobante de retención de IVA es
`{YYYY}{MM}{correlativo de 8 dígitos}` → `20260700001323` (año `2026`, periodo `07`, correlativo `00001323`).

Formato confirmado: `YYYYMM` + `String(correlativo).padStart(8, '0')`.
El `numeradores_serie` actual (`tipo`, `periodo`, `ultimo`) cubre el requisito; sólo falta definir el
separador/formato como parámetro en vez de hardcodearlo.

### 4.5 Fecha de declaración

`fecha_declaracion` es **una sola fecha** que gobierna la retención de IVA y la de ISLR. Debe validarse: `fecha_declaracion >= fecha_emision`.

---

## 5. Validación contra el Libro de Compras real del cliente

Archivo analizado: `Image-Info/Libro de Compras con importaci\u00f3n 2da quincena con importaci\u00f3n.xls`
(hoja `Sheet1`, 150 filas, **96 registros** reales, 18 proveedores distintos, mayo–julio 2026).

### 5.1 El formato del Excel de la app YA es el formato SENIAT

El archivo real tiene **25 columnas** en este orden (cabecera fusionada en 3 filas):

| # | Columna | # | Columna | # | Columna |
|---|---|---|---|---|---|
| 1 | Nro. | 10 | Nro. de Factura Afectada | 18 | Crédito Fiscal (Importación) |
| 2 | Fecha | 11 | Total de Compras Incluyendo IVA | 19 | Número Expediente Importación |
| 3 | Rif | 12 | No Gravadas | 20 | Número Planilla Importación |
| 4 | Nombre ó Razón Social | 13 | Base Imponible (Nac.) | 21 | Fecha Planilla Importación |
| 5 | Nro. Factura | 14 | Alicuota (Nac.) | 22 | Ret IVA |
| 6 | Nro. Control | 15 | Crédito Fiscal (Nac.) | 23 | Comprobante IVA |
| 7 | Nro. Nota de Débito | 16 | Base (Importación) | 24 | Fecha IVA |
| 8 | Nro. Nota de Crédito | 17 | Alicuota (Importación) | 25 | (3%) IGTF |
| 9 | Tipo de Transacción | | | | |

**Coincidencia 25/25 con `src/utils/excelTemplate.js`** (`COLUMN_HEADERS`), mismo orden y mismos nombres.
→ **El exportador de Libro de Compras de la app ya produce el formato SENIAT correcto.** No hay que rehacerlo,
sólo cambiar su **fuente de datos** (hoy: el estado del navegador; debe ser: la BD).

### 5.2 El OCR extrae exactamente el Libro de Compras

Los 25 campos del registro OCR (`createEmptyRecord()` en `src/utils/parse.js`) mapean 1:1 con las 25 columnas
del Libro de Compras. **El OCR de la app es, hoy, un extractor de "Libro de Compras"**, no de documentos de compra.

→ **El Libro de Compras NO tiene líneas de detalle** (ni cantidad, ni precio unitario, ni descripción de ítems),
ni tiene cuenta contable. Eso define el nivel de madurez alcanzable en la primera versión.

### 5.3 Hallazgo crítico: los datos actuales del cliente están incompletos

Las 96 filas se **parten en dos grupos mutuamente excluyentes**, intercalados por fecha:

| Grupo | Filas | Qué traen | Qué les falta |
|---|---|---|---|
| **Con montos** | 53 | Nro. Factura, Total incl. IVA, Base imponible, Alicuota 16 % | Ret IVA, Comprobante, Fecha IVA |
| **Con retención** | 43 | Nro. Control, Factura Afectada, Ret IVA (monto), Comprobante, Fecha IVA | Nro. Factura, Total, Base imponible |

- **Ninguna invoice tiene a la vez monto total y retención de IVA** (53 + 43 = 96, sin solape).
- Alícuota 16 % en el 100 % de las filas; `IGTF` vacío en todas.
- Sólo **1 de 96** registros es de importación (`20265004/C25350`, HOFER MATERIALS CO., LIMITED).
- 43 de 96 (45 %) son de **agentes de retención** (J-413215586, J-506801361, J-310541469, J-314403419…).

**Interpretación:** el `.xls` es una **unión manual de dos listados** (compras + retenciones) hecha en Excel, no
el export de un sistema. El encabezado dice *"Desde el 16/07/2026 Al 31/07/2026"* pero la primera fila es del
**14/05/2026** y hay RIFs con formato inválido (`J-00007702-9`).

→ **Ésta es la brecha de valor real de la app**: no se trata de "reproducir el Legacy", sino de que la app
**lea la factura real** (donde sí están todos los datos), los valide y complete, en vez de arrastrar
un Excel con huecos. La validación cruzada de la app (base × alícuota = IVA; total = base + IVA;
retención = IVA × % del proveedor) detecta exactamente esta clase de corruption.

### 5.4 Formatos de RIF encontrados

| Formato | Ejemplo | ¿Valida `src/utils/rif.js`? |
|---|---|---|
| RIF persona jurídica | `J-310541469` | ✅ |
| RIF con ceros a la izquierda | `J-000033927` | ✅ (9 dígitos tras la letra) |
| RIF de importación | `20265004/C25350` | ⚠️ **No** — formato `N/AAAA/C####`, requiere soporte nuevo |
| RIF malformado | `J-00007702-9` | ❌ (dato sucio, debe rechazarse con aviso) |

**Acción:** `validarRif()` en `src/services/rif.js` debe aceptar el formato de importación (`/^\d{5,8}\/[A-Z]\d{5}$/`)
y marcar los RIF no parseables en vez de romper el flujo.

### 5.5 Validación del motor de retenciones contra datos reales

Se dispone de **43 montos reales de Retención de IVA** (2.644,56 / 66.324,05 / 143.182,20 / …) y su
comprobante correlativo. Sirven como **casos de prueba (ground truth)** para el motor: con la factura
original se puede verificar si `retenido = IVA_pagado × 75 %` o `× 100 %`, y si el 16 % es la alícuota real.



| # | Capacidad del manual | Estado actual | Ubicación |
|---|---|---|---|
| 1 | Artículos | 🟡 Parcial — `cuentas_contables` sí; sin precios/existencia/unidad | `schema.sql:63` |
| 2 | Proveedores (ficha básica) | 🟢 Implementado | `schema.sql:104`, `MaestrosTab.vue` |
| 3 | Proveedores → Documentos / Contactos / Log | 🔴 No existe | — |
| 4 | Validación RIF → SENIAT | 🟢 Implementado (código + worker + KV) | `src/utils/seniat.js`, `worker/src/index.js` |
| 5 | Ret IVA 75 % / 100 % por condición | 🟡 Parcial — el campo `porcentaje_ret_iva` existe; no hay motor ni comprobante | `schema.sql:109` |
| 6 | Ret ISLR por concepto | 🟡 Parcial — maestro `conceptos_islr` listo; falta motor | `schema.sql:90` |
| 7 | Compras Diarias (cabecera) | 🔴 No existe | tabla `compras` (`schema.sql:149`) es genérica y **sin uso** |
| 8 | Compras Diarias (líneas de detalle) | 🔴 No existe | — |
| 9 | Generación automática de retenciones al guardar | 🔴 No existe | — |
| 10 | Estados del documento (`PENDIENTE`, …) | 🔴 No existe | — |
| 11 | Reporte Libro de Compras (Excel) | 🟢 Implementado, pero **en el cliente** y sin fuente en BD | `src/utils/excelTemplate.js` |
| 12 | Reporte Ret IVA → **TXT** SENIAT | 🔴 No existe | — |
| 13 | Reporte Ret ISLR → **XML** SENIAT | 🔴 No existe | — |
| 14 | Comprobante imprimible (PDF/Excel) | 🔴 No existe | — |
| 15 | Correlativo de comprobante por periodo | 🟡 Tabla creada, sin código | `schema.sql:140` |
| 16 | Importación / Exportación de datos | 🟢 Genérico admin | `server/dbAdmin.mjs` |
| 17 | Auditoría (pestaña Log) | 🔴 No existe | — |
| 18 | Multi-empresa / multi-moneda | 🔴 No existe (heredado del legacy, fuera del alcance del manual) | — |

**Dos bugs de rutas detectados en `server/index.js`** (a corregir en la misma pasada):
- `GET /api/admin/export/all` (línea ~798) registrado **después** de `GET /api/admin/export/:name` (línea ~774) → siempre cae en `:name` y da 500.
- `POST /api/admin/import/sql` (línea ~859) registrado **después** de `POST /api/admin/import/:name` (línea ~828) → siempre da 400.

---

## 6. Diseño de base de datos propuesto

### 6.1 Estrategia de evolución

El schema actual es un **único `schema.sql`** aplicado con `CREATE TABLE IF NOT EXISTS` desde `server/init-db.mjs`. Eso **no permite agregar columnas ni cambiar tablas ya creadas** (el `IF NOT EXISTS` no altera la tabla existente) y no deja rastro de qué versión se aplicó.

**Propuesta: migraciones versionadas.**

```
server/
  migrations/
    0001_base.sql        -- rif_cache, cuentas_contables, conceptos_islr,
                          -- proveedores, parametros, numeradores_serie
    0002_compras.sql     -- artículos, compras_documentos, compras_lineas,
                          -- retenciones_iva, retenciones_islr
    0003_proveedores_ext.sql -- columnas extra + documentos + contactos
    0004_auditoria.sql   -- auditoria, reportes_generados
  migrate.mjs            -- runner: aplica *.sql no aplicados, registra en schema_migrations
```

`migrate.mjs` debe:
1. Crear `schema_migrations(version TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ)`.
2. Leer `migrations/*.sql` ordenados, aplicar los que no estén en la tabla, cada uno en su **propia transacción**.
3. Ser idempotente y ejecutarse en `predev` / `prestart` (reemplazando `init-db.mjs`).

Todas las tablas usan el patrón ya existente: `created_at`/`updated_at` `TIMESTAMPTZ`, trigger `update_updated_at_column()`, `NUMERIC(14,2)` para montos, `TEXT` para códigos de negocio (los códigos contables no son numéricos).

### 6.2 DDL — Migración `0002_compras.sql`

```sql
-- ============================================================
-- 0002_compras.sql - Núcleo transaccional del módulo de compras
-- ============================================================

-- ------------------------------------------------------------
-- ARTÍCULOS: extensão comercial del plan de cuentas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articulos (
  codigo        TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  codigo_cuenta TEXT REFERENCES cuentas_contables(codigo) ON DELETE SET NULL,
  tipo          TEXT NOT NULL DEFAULT 'MERCADERIA',  -- MERCADERIA | SERVICIO
  unidad        TEXT NOT NULL DEFAULT 'UND',
  precio_costo  NUMERIC(14,2) NOT NULL DEFAULT 0,
  precio_venta  NUMERIC(14,2) NOT NULL DEFAULT 0,
  existencia    NUMERIC(14,4) NOT NULL DEFAULT 0,
  exento_iva    BOOLEAN NOT NULL DEFAULT FALSE,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_articulos_cuenta ON articulos(codigo_cuenta);
CREATE INDEX IF NOT EXISTS idx_articulos_activo  ON articulos(activo);

DROP TRIGGER IF EXISTS update_articulos_updated_at ON articulos;
CREATE TRIGGER update_articulos_updated_at
  BEFORE UPDATE ON articulos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- COMPRAS DIARIAS - cabecera (una fila = un documento de compra)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras_documentos (
  uid                   TEXT PRIMARY KEY,          -- uuid cliente (offline-first)
  tipo_documento         TEXT NOT NULL DEFAULT 'factura', -- factura | nota_credito | nota_debito
  tipo_transaccion       TEXT NOT NULL DEFAULT '01 -Reg',
  numero                 TEXT NOT NULL DEFAULT '',
  numero_control         TEXT NOT NULL DEFAULT '',
  numero_maquina_fiscal  TEXT NOT NULL DEFAULT '',
  fecha_emision          DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_declaracion      DATE,
  proveedor_rif          TEXT NOT NULL REFERENCES proveedores(rif) ON DELETE RESTRICT,
  proveedor_nombre       TEXT NOT NULL DEFAULT '',
  codigo_cuenta          TEXT REFERENCES cuentas_contables(codigo) ON DELETE SET NULL,
  es_importacion         BOOLEAN NOT NULL DEFAULT FALSE,
  num_expediente         TEXT NOT NULL DEFAULT '',
  num_planilla           TEXT NOT NULL DEFAULT '',
  fecha_planilla         DATE,
  nro_factura_afectada   TEXT NOT NULL DEFAULT '',
  estado                 TEXT NOT NULL DEFAULT 'PENDIENTE', -- BORRADOR|PENDIENTE|PROCESADO|ANULADO
  forma_pago             TEXT NOT NULL DEFAULT 'CONTADO',  -- CONTADO | CREDITO
  dias_credito           INTEGER NOT NULL DEFAULT 0,
  moneda                 TEXT NOT NULL DEFAULT 'VES',
  tasa_cambio            NUMERIC(14,6) NOT NULL DEFAULT 1,
  base_no_gravada        NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_imponible         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_iva              NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_igtf             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_retencion_iva    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_retencion_islr   NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_general          NUMERIC(14,2) NOT NULL DEFAULT 0,
  notas                  TEXT NOT NULL DEFAULT '',
  payload                JSONB NOT NULL DEFAULT '{}'::jsonb,  -- respaldo OCR crudo
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compras_doc_fecha     ON compras_documentos(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_compras_doc_proveedor ON compras_documentos(proveedor_rif);
CREATE INDEX IF NOT EXISTS idx_compras_doc_estado     ON compras_documentos(estado);
CREATE INDEX IF NOT EXISTS idx_compras_doc_declaracion ON compras_documentos(fecha_declaracion);
CREATE INDEX IF NOT EXISTS idx_compras_doc_numero     ON compras_documentos(numero, numero_control);

DROP TRIGGER IF EXISTS update_compras_documentos_updated_at ON compras_documentos;
CREATE TRIGGER update_compras_documentos_updated_at
  BEFORE UPDATE ON compras_documentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- COMPRAS DIARIAS - detalle (líneas del documento)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compras_lineas (
  id               BIGSERIAL PRIMARY KEY,
  documento_uid    TEXT NOT NULL REFERENCES compras_documentos(uid) ON DELETE CASCADE,
  linea            INTEGER NOT NULL DEFAULT 1,
  codigo_articulo  TEXT REFERENCES articulos(codigo) ON DELETE SET NULL,
  codigo_cuenta    TEXT REFERENCES cuentas_contables(codigo) ON DELETE SET NULL,
  descripcion      TEXT NOT NULL DEFAULT '',
  cantidad         NUMERIC(14,4) NOT NULL DEFAULT 1,
  precio_unitario  NUMERIC(14,4) NOT NULL DEFAULT 0,
  subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
  porcentaje_iva   NUMERIC(6,2) NOT NULL DEFAULT 16,
  monto_iva        NUMERIC(14,2) NOT NULL DEFAULT 0,
  exento           BOOLEAN NOT NULL DEFAULT FALSE,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compras_lineas_doc ON compras_lineas(documento_uid);
CREATE INDEX IF NOT EXISTS idx_compras_lineas_cuenta ON compras_lineas(codigo_cuenta);

DROP TRIGGER IF EXISTS update_compras_lineas_updated_at ON compras_lineas;
CREATE TRIGGER update_compras_lineas_updated_at
  BEFORE UPDATE ON compras_lineas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- RETENCIONES DE IVA  (comprobante fiscal numerado)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retenciones_iva (
  uid                TEXT PRIMARY KEY,
  documento_uid      TEXT NOT NULL REFERENCES compras_documentos(uid) ON DELETE CASCADE,
  proveedor_rif      TEXT NOT NULL,
  fecha_declaracion  DATE NOT NULL,
  porcentaje         NUMERIC(5,2) NOT NULL DEFAULT 75,  -- 75 | 100
  base_imponible     NUMERIC(14,2) NOT NULL DEFAULT 0,
  alicuota           NUMERIC(6,2) NOT NULL DEFAULT 16,
  monto_iva          NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_retenido     NUMERIC(14,2) NOT NULL DEFAULT 0,
  numero_comprobante TEXT NOT NULL DEFAULT '',
  periodo            TEXT NOT NULL DEFAULT '',         -- YYYYMM
  estado             TEXT NOT NULL DEFAULT 'PENDIENTE',-- PENDIENTE | GENERADO | DECLARADO | ANULADO
  archivo_path       TEXT NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ret_iva_doc        ON retenciones_iva(documento_uid);
CREATE INDEX IF NOT EXISTS idx_ret_iva_proveedor  ON retenciones_iva(proveedor_rif);
CREATE INDEX IF NOT EXISTS idx_ret_iva_periodo    ON retenciones_iva(periodo);
CREATE INDEX IF NOT EXISTS idx_ret_iva_comprobante ON retenciones_iva(numero_comprobante);

DROP TRIGGER IF EXISTS update_retenciones_iva_updated_at ON retenciones_iva;
CREATE TRIGGER update_retenciones_iva_updated_at
  BEFORE UPDATE ON retenciones_iva FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- RETENCIONES DE ISLR  (comprobante fiscal numerado)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retenciones_islr (
  uid                 TEXT PRIMARY KEY,
  documento_uid       TEXT NOT NULL REFERENCES compras_documentos(uid) ON DELETE CASCADE,
  proveedor_rif       TEXT NOT NULL,
  concepto_codigo     TEXT REFERENCES conceptos_islr(codigo) ON DELETE SET NULL,
  concepto_nombre     TEXT NOT NULL DEFAULT '',
  fecha_declaracion   DATE NOT NULL,
  base_factura        NUMERIC(14,2) NOT NULL DEFAULT 0,
  base_imponible      NUMERIC(14,2) NOT NULL DEFAULT 0,
  porcentaje          NUMERIC(6,2) NOT NULL DEFAULT 0,
  sustraendo_ut       NUMERIC(12,4) NOT NULL DEFAULT 0,
  base_minima_ut      NUMERIC(12,4) NOT NULL DEFAULT 0,
  unidad_tributaria   NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_retenido      NUMERIC(14,2) NOT NULL DEFAULT 0,
  numero_comprobante  TEXT NOT NULL DEFAULT '',
  periodo             TEXT NOT NULL DEFAULT '',
  estado              TEXT NOT NULL DEFAULT 'PENDIENTE',
  archivo_path        TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ret_islr_doc        ON retenciones_islr(documento_uid);
CREATE INDEX IF NOT EXISTS idx_ret_islr_proveedor  ON retenciones_islr(proveedor_rif);
CREATE INDEX IF NOT EXISTS idx_ret_islr_periodo    ON retenciones_islr(periodo);
CREATE INDEX IF NOT EXISTS idx_ret_islr_concepto   ON retenciones_islr(concepto_codigo);

DROP TRIGGER IF EXISTS update_retenciones_islr_updated_at ON retenciones_islr;
CREATE TRIGGER update_retenciones_islr_updated_at
  BEFORE UPDATE ON retenciones_islr FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 6.3 DDL — Migración `0003_proveedores_ext.sql`

```sql
-- ============================================================
-- 0003_proveedores_ext.sql - Ficha completa del proveedor
-- ============================================================

-- Columnas adicionales de la ficha "Básicos" (el manual las lista)
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS email             TEXT NOT NULL DEFAULT '';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS tipo_cedula       TEXT NOT NULL DEFAULT 'RIF';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS rif_fiscal        TEXT NOT NULL DEFAULT '';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS direccion_fiscal  TEXT NOT NULL DEFAULT '';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS clasificacion     TEXT NOT NULL DEFAULT '';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS dias_credito      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS ret_iva_tipo      TEXT NOT NULL DEFAULT 'NINGUNA';
-- ret_iva_tipo: NINGUNA | RETENCION_IVA_75 | RETENCION_IVA_100
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS es_extranjero     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS prorratear_docs   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS aplica_transporte BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS codigo_banco      TEXT NOT NULL DEFAULT '';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS retenido_por      TEXT NOT NULL DEFAULT '';
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS notas             TEXT NOT NULL DEFAULT '';

-- Pestaña "Documentos"
CREATE TABLE IF NOT EXISTS proveedores_documentos (
  id               BIGSERIAL PRIMARY KEY,
  rif              TEXT NOT NULL REFERENCES proveedores(rif) ON DELETE CASCADE,
  tipo             TEXT NOT NULL DEFAULT 'OTRO', -- RIF|NIT|CERTIFICACION|CONTRATO|OTRO
  numero           TEXT NOT NULL DEFAULT '',
  fecha_emision    DATE,
  fecha_vencimiento DATE,
  es_digital       BOOLEAN NOT NULL DEFAULT FALSE,
  archivo_path     TEXT NOT NULL DEFAULT '',
  notas            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prov_docs_rif ON proveedores_documentos(rif);

-- Pestaña "Contactos"
CREATE TABLE IF NOT EXISTS proveedores_contactos (
  id         BIGSERIAL PRIMARY KEY,
  rif        TEXT NOT NULL REFERENCES proveedores(rif) ON DELETE CASCADE,
  nombre     TEXT NOT NULL DEFAULT '',
  cargo      TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  telefono   TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prov_contactos_rif ON proveedores_contactos(rif);

-- Numeradores: prefijo del comprobante (ej. "2020090000613")
ALTER TABLE numeradores_serie ADD COLUMN IF NOT EXISTS prefijo TEXT NOT NULL DEFAULT '';
ALTER TABLE numeradores_serie ADD COLUMN IF NOT EXISTS ancho   INTEGER NOT NULL DEFAULT 6;
```

### 6.4 DDL — Migración `0004_auditoria.sql`

```sql
-- ============================================================
-- 0004_auditoria.sql - Trazabilidad y reportes generados
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria (
  id           BIGSERIAL PRIMARY KEY,
  entidad      TEXT NOT NULL,
  entidad_id   TEXT NOT NULL,
  accion       TEXT NOT NULL,   -- CREATE | UPDATE | DELETE | GENERAR
  usuario      TEXT NOT NULL DEFAULT '',
  datos_antes  JSONB,
  datos_despues JSONB,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha    ON auditoria(creado_en DESC);

CREATE TABLE IF NOT EXISTS reportes_generados (
  id           BIGSERIAL PRIMARY KEY,
  tipo         TEXT NOT NULL,   -- LIBRO_COMPRAS | RETENCION_IVA | RETENCION_ISLR
  formato      TEXT NOT NULL DEFAULT 'xlsx', -- xlsx | pdf | txt | xml
  periodo      TEXT NOT NULL DEFAULT '',
  parametros   JSONB NOT NULL DEFAULT '{}'::jsonb,
  archivo_path TEXT NOT NULL DEFAULT '',
  generado_por TEXT NOT NULL DEFAULT '',
  generado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reportes_tipo ON reportes_generados(tipo, periodo);
```

### 6.5 Tabla `compras` actual — qué hacer

`schema.sql:149` (`compras` con `payload JSONB`) **no la usa nadie**. Opciones:

- **Opción A (recomendada):** marcarla como `LEGACY`, dejarla sin uso y migrar sus filas a `compras_documentos` + `compras_lineas` (el `payload` OCR mapea casi 1:1 con los campos del `createEmptyRecord()` de `src/utils/parse.js`).
- **Opción B:** conservar `compras` como tabla de staging offline y copiar a `compras_documentos` al validar.

Recomiendo **A** + un script de import de una sola vez.

### 6.6 Extensibilidad futura (qué el modelo ya permite crecer)

| Extensión | Soporte en el diseño |
|---|---|
| Más módulos (Ventas, Inventarios, Activos Fijos, CxP) | Mismo patrón `*_documentos` + `*_lineas` |
| Multi-empresa | Añadir `empresa_id` a las tablas maestras y `documento_*`; `parametros.clave='configuracion'` ya es el contenedor |
| Multi-moneda | `moneda` + `tasa_cambio` ya en `compras_documentos`; falta tabla `monedas` + `tasas_cambio` |
| Nóminas / retenciones de trabajadores | Tabla `retenciones_trabajadores` con la misma forma que `retenciones_islr` |
| Cuentas por cobrar/pagar | `documentos_cuenta_por_cobrar/pagar` con `proveedor_rif` + `dias_credito` + vencimiento |
| Auditoría completa | `auditoria` genérica |

---

## 7. Diseño de la API

### 7.1 Convenciones (las ya usadas en `server/index.js` + `src/utils/api.js`)

- Prefijo `/api`. Payload y respuesta en **camelCase**; columnas en `snake_case`.
- Respuesta ok: `{ ok: true, ...datos }`. Error: `{ ok: false, error: "mensaje" }` con status HTTP correcto.
- POST para operaciones de lectura con cuerpo (`/lookup`, `/verify`) — **conservar** por compatibilidad.
- Autenticación actual: mock en cliente (`src/utils/auth.js`). **Pendiente** de backend real.

### 7.2 Catálogo de endpoints

#### Maestros (existentes — se mantienen)
```
GET  /api/accounts
POST /api/accounts/sync
GET  /api/conceptos_islr
POST /api/conceptos_islr/sync
GET  /api/proveedores
POST /api/proveedores/sync
POST /api/proveedores/delete
GET  /api/parametros
POST /api/parametros/sync
```

#### Proveedores (extensión)
```
GET    /api/proveedores/:rif                 -> ficha completa (básicos + docs + contactos)
PATCH  /api/proveedores/:rif
POST   /api/proveedores/:rif/verificar       -> consulta SENIAT, guarda condicion/porcentaje
GET    /api/proveedores/:rif/documentos
POST   /api/proveedores/:rif/documentos
DELETE /api/proveedores/documentos/:id
GET    /api/proveedores/:rif/contactos
POST   /api/proveedores/:rif/contactos
DELETE /api/proveedores/contactos/:id
GET    /api/proveedores/buscar?q=            -> autocomplete (nombre o RIF)
```

#### Artículos (nuevo)
```
GET    /api/articulos?cuenta=&activo=&q=
GET    /api/articulos/:codigo
POST   /api/articulos            (upsert por codigo)
DELETE /api/articulos/:codigo
```

#### Compras Diarias (nuevo — núcleo)
```
GET    /api/compras/documentos
       ?desde&hasta&proveedor&estado&tipo&importacion&q&page&limit&sort
GET    /api/compras/documentos/:uid            -> cabecera + líneas + retenciones
POST   /api/compras/documentos                 -> crea cabecera y líneas (upsert por uid)
PUT    /api/compras/documentos/:uid
PATCH  /api/compras/documentos/:uid/estado     -> BORRADOR|PENDIENTE|PROCESADO|ANULADO
DELETE /api/compras/documentos/:uid
GET    /api/compras/documentos/:uid/líneas
POST   /api/compras/documentos/:uid/líneas
PUT    /api/compras/líneas/:id
DELETE /api/compras/líneas/:id
POST   /api/compras/documentos/:uid/recalcular  -> recalcula IVA/Ret IVA/Ret ISLR/IGTF/totales
POST   /api/compras/documentos/:uid/generar-retenciones
                                            -> genera retenciones_iva + retenciones_islr
                                                y numera los comprobantes
POST   /api/compras/sync                       -> lote offline {documentos:[...]}
GET    /api/compras/proveedores/:rif/resumen   -> totales del proveedor
```

#### Retenciones (nuevo)
```
GET  /api/retenciones/iva?desde&hasta&periodo&proveedor&estado
GET  /api/retenciones/iva/:comprobante        -> detalle del comprobante
GET  /api/retenciones/islr?desde&hasta&periodo&proveedor&concepto&estado
GET  /api/retenciones/islr/:comprobante
POST /api/retenciones/iva/:uid/exportar        ?formato=pdf|xlsx
POST /api/retenciones/islr/:uid/exportar       ?formato=pdf|xlsx
```

#### Reportes (nuevo)
```
GET  /api/reportes/libro-compras
     ?desde&hasta&tipo=nacional|importacion&formato=json|xlsx|pdf
GET  /api/reportes/resumen-retenciones?desde&hasta
GET  /api/reportes/compras-por-proveedor?desde&hasta
POST /api/reportes/retenciones-iva/generar     ?desde&hasta&formato=txt   -> TXT SENIAT
POST /api/reportes/retenciones-islr/generar    ?desde&hasta&formato=xml   -> XML SENIAT
GET  /api/reportes/historico
```

#### Comprobantes / series (nuevo)
```
GET  /api/numeradores/:tipo/:periodo
POST /api/numeradores/:tipo/:periodo/avanzar   -> reserva el siguiente correlativo
```

#### SENIAT (existente — se mantiene)
```
POST /api/captcha
POST /api/lookup
POST /api/verify
```

#### Salud
```
GET  /api/health    -> { ok, service, postgres, version, migrations }
```

### 7.3 Ejemplo de contrato — crear factura con retenciones

`POST /api/compras/documentos`

```jsonc
{
  "uid": "b1f2…",                       // opcional: id del cliente (offline-first)
  "tipoDocumento": "factura",
  "numero": "000123",
  "numeroControl": "00145",
  "fechaEmision": "2026-09-01",
  "fechaDeclaracion": "2026-09-05",
  "proveedorRif": "J300000000",
  "codigoCuenta": "5.1.1.01.001",
  "formaPago": "CREDITO",
  "diasCredito": 30,
  "moneda": "VES",
  "esImportacion": false,
  "lineas": [
    { "linea": 1, "codigoArticulo": "ART-001", "descripcion": "Ron 40%",
      "cantidad": 100, "precioUnitario": 12.50, "porcentajeIva": 16 }
  ],
  "conceptoIslr": { "codigo": "ISLR-01", "montoBase": 1250.00 },
  "aplicaIgtf": false,
  "generarRetenciones": true
}
```

**Respuesta:**
```jsonc
{
  "ok": true,
  "documento": { "uid": "b1f2…", "estado": "PROCESADO", "baseImponible": 1250.00,
                 "totalIva": 200.00, "totalRetencionIva": 150.00,
                 "totalRetencionIslr": 0.00, "totalGeneral": 1300.00 },
  "retenciones": [
    { "tipo": "IVA",  "uid": "r1…", "numeroComprobante": "202609000001",
      "porcentaje": 75, "baseImponible": 1250.00, "montoRetenido": 150.00 },
    { "tipo": "ISLR", "uid": "r2…", "numeroComprobante": "202609000002",
      "conceptoCodigo": "ISLR-01", "baseImponible": 1250.00, "montoRetenido": 0.00 }
  ],
  "advertencias": []
}
```

### 7.4 Motor de cálculo — dónde va

Nuevo módulo `server/motor/retenciones.mjs` (funciones puras, testeables):

```js
export function calcularRetencionIva({ baseImponible, alicuota, porcentajeRetencion })
export function calcularRetencionIslr({ baseFactura, concepto, unidadTributaria })
export function calcularTotalesDocumento({ lineas, alicuota, aplicaIgtf, tasaIgtf })
export function formatearNumeroComprobante({ prefijo, periodo, correlativo, ancho })
```

El endpoint `POST /api/compras/documentos` orquesta: calcula totales → guarda cabecera + líneas → genera retenciones → numera comprobantes desde `numeradores_serie` (usando `SELECT ... FOR UPDATE` para evitar carreras).

---

## 8. Formatos de salida exigidos por el SENIAT

### 8.1 Retenciones de IVA → TXT

El SENIAT carga un archivo `.txt` con **una línea por comprobante**, campos separados por `|`, formato `AAAAMM|COMPROBANTE|RIF|CEDULA|NOMBRE|BASE|IVA|RETENCION|...`. **El separador y el orden exacto deben copiarse del portal del SENIAT** (el manual no los especifica) → **tarea de investigación con el cliente**.

### 8.2 Retenciones de ISLR → XML

Estructura estándar del SENIAT:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<RetencionesISLR>
  <Cabecera>
    <RifRetenedor>J500821484</RifRetenedor>
    <NombreRetenedor>GRUPO HIERROCA, C.A.</NombreRetenedor>
    <Periodo>202609</Periodo>
    <FechaGeneracion>2026-10-01</FechaGeneracion>
  </Cabecera>
  <Comprobantes>
    <Comprobante>
      <RifRetenido>J300000000</RifRetenido>
      <NombreRetenido>PROVEEDOR, C.A.</NombreRetenido>
      <NumeroComprobante>202609000001</NumeroComprobante>
      <NumeroControl>00145</NumeroControl>
      <FechaFactura>2026-09-01</FechaFactura>
      <FechaDeclaracion>2026-09-05</FechaDeclaracion>
      <ConceptoCodigo>ISLR-01</ConceptoCodigo>
      <ConceptoNombre>Servicios a empresas contratistas</ConceptoNombre>
      <BaseImponible>1250.00</BaseImponible>
      <Porcentaje>2.00</Porcentaje>
      <MontoRetenido>25.00</MontoRetenido>
    </Comprobante>
  </Comprobantes>
</RetencionesISLR>
```

> El XSD exacto también debe verificarse contra el portal del SENIAT.

---

## 9. Roadmap de implementación

| Fase | Alcance | Entregable |
|---|---|---|
| **F0 — Suelo** | Sistema de migraciones (`server/migrate.mjs` + `migrations/`); fix de los 2 bugs de rutas admin | Base migrable |
| **F1 — Maestros** | `articulos` + extensión de `proveedores` (ficha completa) + `proveedores/documentos` + `proveedores/contactos` | Maestros del §1.1 y §1.2 |
| **F2 — Transacción** | `compras_documentos` + `compras_lineas` + endpoints + `motor/retenciones.mjs` + numeradores | §1.3 |
| **F3 — Retenciones** | `retenciones_iva` + `retenciones_islr` + generación automática + numeradores de comprobante | §1.4.2 y §1.4.3 |
| **F4 — Reportes** | Libro de Compras (JSON/XLSX/PDF), TXT SENIAT (IVA), XML SENIAT (ISLR), comprobantes imprimibles | §1.4.1 |
| **F5 — Migración de datos** | Import del `Libro de Compras con importación 2da quincena.xls` y del sistema legacy | Datos reales cargados |
| **F6 — Endurecimiento** | Auth real (JWT + roles), auditoría, tests de la API, OpenAPI/Swagger | Producción |

---

## 10. Riesgos y preguntas abiertas

| # | Riesgo / Pregunta | Impacto | Acción |
|---|---|---|---|
| 1 | **Formato exacto del TXT de Ret IVA del SENIAT** (separador, orden, ceros) | 🔴 Alto | Obtener archivo de ejemplo del cliente o del portal |
| 2 | **XSD exacto del XML de Ret ISLR** | 🔴 Alto | Igual que #1 |
| 3 | Sustraendo ISLR en UT vs. BSD fijo | 🔴 Alto | Confirmar con el cliente y documentar en `conceptos_islr` |
| 4 | ¿La retención de IVA es 75 % / 100 % **del IVA pagado** o **de la base**? | 🔴 Alto | El manual dice "del impuesto causado" → % del IVA. Confirmar |
| 5 | Condiciones exactas que devuelven 75 % vs 100 % | 🟡 Medio | Mapeo `rif_cache.condicion` → `proveedores.ret_iva_tipo` |
| 6 | "¿Son todas las compras de la **misma entidad** (Grupo Hierroca vs. Licores Confianza)?" | 🟡 Medio | Define si hace falta multi-empresa ya |
| 7 | Uso de "Forma de pago" (contado/crédito) → ¿genera CxP? | 🟡 Medio | `compras_cxp` en fase posterior |
| 8 | Formato de los 10 conceptos ISLR (nombres exactos) | 🟢 Bajo | Ya están en `src/services/conceptosIslr.js` |
| 9 | Numeración de comprobante: `YYYYMM` + correlativo 8 dígitos → `20260700001323` | 🟢 **Resuelto** (§4.4, §5.3) | — |
| 10 | Roles: ¿quién puede generar/anular retenciones? | 🟡 Medio | `src/utils/auth.js` ya define Administrador / Consultor |

---

## 11. Anexo — Trazabilidad manual → diseño

| Sección del manual | Sección del diseño |
|---|---|
| 1.1 Artículos | §6.2 `articulos` + `cuentas_contables` (existente) |
| 1.2 Proveedores | §6.2 `proveedores` (existente) + §6.3 extensión + `proveedores_documentos` + `proveedores_contactos` |
| 1.3 Compras Diarias | §6.2 `compras_documentos` + `compras_lineas` |
| 1.3.1.4 retenciones automáticas | §6.2 `retenciones_iva` + `retenciones_islr` + §7.4 motor |
| 1.4.1 Libro de Compras | §7.2 `/api/reportes/libro-compras` |
| 1.4.2 Retenciones de IVA (TXT) | §7.2 `/api/reportes/retenciones-iva/generar` + §8.1 |
| 1.4.3 Retenciones de ISLR (XML) | §7.2 `/api/reportes/retenciones-islr/generar` + §8.2 |
| — | §6.1 sistema de migraciones (crecimiento de la BD) |
