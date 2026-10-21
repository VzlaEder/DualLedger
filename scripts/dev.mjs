// ============================================================ 
// DualLedger - Lanzador de desarrollo (frontend + API separados)
// ============================================================
// Levanta dos procesos independientes:
//   - API Express  (server/index.js)   -> http://127.0.0.1:8787
//   - Frontend Vite (vite)             -> http://127.0.0.1:3000
// El frontend alcanza la API por proxy de Vite (/api -> API).
// Ctrl+C detiene ambos.
// ============================================================

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const serverDir = join(root, 'server')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

if (!existsSync(join(serverDir, 'node_modules'))) {
  console.log('[dev] Instalando dependencias de la API…')
  const install = spawn(npmCmd, ['install'], { cwd: serverDir, stdio: 'inherit', shell: process.platform === 'win32' })
  await new Promise((resolve, reject) => {
    install.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('npm install falló'))))
  })
}

const COLORS = { api: '\x1b[36m', web: '\x1b[35m', reset: '\x1b[0m' }
const children = []
let shuttingDown = false

function start(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  })
  const prefix = `${COLORS[label]}[${label}]${COLORS.reset} `
  const pipe = (stream) => {
    stream.setEncoding('utf8')
    let buffer = ''
    stream.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) process.stdout.write(prefix + line + '\n')
    })
  }
  pipe(child.stdout)
  pipe(child.stderr)
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`${prefix}terminó con código ${code}`)
      shutdown(code === null ? 1 : code)
    }
  })
  children.push(child)
  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    try { child.kill() } catch (e) { /* noop */ }
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('[dev] Frontend: http://127.0.0.1:3000  ->  API: http://127.0.0.1:8787')
start('api', process.execPath, ['--watch', join(serverDir, 'index.js')], serverDir)
start('web', npmCmd, ['run', 'dev:web'], root)
