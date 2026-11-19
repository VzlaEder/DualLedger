# Migración del Worker SENIAT a cuenta de empresa

## Resumen

El Worker `dual-ledger-seniat` está actualmente desplegado en la **cuenta personal** de trabajoalberth24. Al completar el proyecto, debe migrarse a la **cuenta de empresa** para que el equipo tenga acceso y control.

## Datos del Worker actual

- **Nombre**: `dual-ledger-seniat`
- **Cuenta actual**: `trabajoalberth24`
- **URL生产**: `https://dual-ledger-seniat.trabajoalberth24.workers.dev`
- **KV Namespace**: `RIF_CACHE` (id: `a610441d78b7474692ff7b2e831b9210`)
- **Archivos**: `worker/src/index.js`, `worker/wrangler.toml`

## Pasos de migración

### 1. Obtener token de la cuenta de empresa

```bash
# En la consola de Cloudflare → My Profile → API Tokens → Create Token
# Permisos necesarios:
#   - Workers Scripts: Edit
#   - Workers KV: Edit
#   - Account Settings: Read (para obtener el Account ID)
```

### 2. Configurar Wrangler con la nueva cuenta

```bash
cd worker/
wrangler logout
wrangler login  # Esto abre el browser; iniciar sesión con la cuenta de empresa
```

### 3. Crear KV Namespace en la nueva cuenta

```bash
wrangler kv namespace create "RIF_CACHE"
# Anotar el ID nuevo
```

### 4. Actualizar `wrangler.toml`

Cambiar:
```toml
# Antes
[[kv_namespaces]]
binding = "RIF_CACHE"
id = "a610441d78b7474692ff7b2e831b9210"

# Después
[[kv_namespaces]]
binding = "RIF_CACHE"
id = "NUEVO_ID_AQUI"
```

### 5. Migrar datos del KV (opcional)

Si hay datos en caché que preservar:

```bash
# Exportar de la cuenta vieja
wrangler kv key list --namespace-id=a610441d78b7474692ff7b2e831b9210

# Importar a la cuenta nueva (para cada key)
wrangler kv key put --namespace-id=NUEVO_ID "RIF:J070080752" '{"nombreRazon":"SIDERURGICA ZULIANA, C.A.",...}' --binding=RIF_CACHE
```

### 6. Desplegar en la nueva cuenta

```bash
wrangler deploy
# Resultado: https://dual-ledger-seniat.empresa-cuenta.workers.dev
```

### 7. Actualizar la app frontend

En `.env` o en la configuración de la app:

```
VITE_SENIAT_WORKER_URL=https://dual-ledger-seniat.empresa-cuenta.workers.dev
```

O desde la UI: Settings → URL del Worker SENIAT.

### 8. Verificar

```bash
# Health check
curl https://dual-ledger-seniat.empresa-cuenta.workers.dev/

# Test de captcha
curl -X POST https://dual-ledger-seniat.empresa-cuenta.workers.dev/captcha -H "Content-Type: application/json" -d "{}"

# Test de verificación
curl -X POST https://dual-ledger-seniat.empresa-cuenta.workers.dev/verify \
  -H "Content-Type: application/json" \
  -d '{"rif":"J070080752","codigo":"LECTURA_CAPTCHA","cookies":[],"forceRefresh":true}'
```

### 9. Eliminar Worker viejo (cuando se confirme que todo funciona)

```bash
# En la cuenta personal
wrangler logout
wrangler login  # Iniciar sesión con trabajoalberth24
wrangler delete dual-ledger-seniat
```

## Notas importantes

- El **User-Agent** `SENIAT_UA` es crítico — sin él el SENIAT bloquea las peticiones.
- El Worker usa **HTTP** (no HTTPS) para conectarse al SENIAT.
- Los captchas del SENIAT son sensibles a mayúsculas/minúsculas y caducan rápido.
- El KV tiene un TTL de 7 días por defecto.
