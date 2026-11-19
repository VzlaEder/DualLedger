// ============================================================
// DualLedger - Garantiza las dependencias del servidor (server/)
// ============================================================
// Reemplaza `cd server && npm install` (que depende de la shell y
// puede fallar en Windows/cmd). Multiseries: instala server/node_modules
// si no existe, usando el propio npm (path absoluto, sin cd).
// ============================================================

import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serverDir = join(__dirname, '..', 'server')
const hasDeps = existsSync(join(serverDir, 'node_modules'))

if (hasDeps) {
  console.log('[deps] server/node_modules presente ✔')
} else {
  console.log('[deps] Instalando dependencias del servidor (puede tardar)…')
  execSync('npm install', { cwd: serverDir, stdio: 'inherit', shell: true })
  console.log('[deps] Dependencias del servidor instaladas ✔')
}
