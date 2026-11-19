// ============================================================
// DualLedger - Garantiza el build de producción (dist/)
// ============================================================
// Reemplaza `test -d dist || npm run build` (incompatible con cmd.exe
// de Windows: el binario `test` no existe ahí). Este script es
// multiplataforma y solo compila si dist/ no existe.
// ============================================================

import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

if (existsSync('dist')) {
  console.log('[build] dist/ presente ✔ (no se recompila)')
} else {
  console.log('[build] No existe dist/ — generando build de producción…')
  execSync('npm run build', { stdio: 'inherit', shell: true })
}
