// ============================================================ 
// DualLedger - Lanzador de desarrollo (frontend + API separados)
// ============================================================
// Levanta dos procesos independientes:
//   - API Express  (server/index.js)   -> http://127.0.0.1:8787
//   - Frontend Vite (vite)             -> http://127.0.0.1:3000
// El frontend alcanza la API por proxy de Vite (/api -> API).
// Ctrl+C detiene ambos.
// ============================================================

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const serverDir = join(root, 'server')

// En Windows los .cmd (npm) no se pueden lanzar sin shell desde Node 18.20+,
// pero si se lanza un .exe con shell, cmd.exe corta la ruta en el primer
// espacio ("C:\Program" no se reconoce...). Se invoca cmd.exe directamente y
// asi el .exe va sin shell y npm va dentro de cmd.exe.
function npm(commandArgs) {
  if (process.platform === 'win32') {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'npm.cmd', ...commandArgs] }
  }
  return { command: 'npm', args: commandArgs }
}

if (!existsSync(join(serverDir, 'node_modules'))) {
  console.log('[dev] Instalando dependencias de la API…')
  const { command, args } = npm(['install'])
  const install = spawn(command, args, { cwd: serverDir, stdio: 'inherit' })
  await new Promise((resolve, reject) => {
    install.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('npm install falló'))))
  })
}

const COLORS = { api: '\x1b[36m', web: '\x1b[35m', reset: '\x1b[0m' }
const children = []
let shuttingDown = false

function start(label, command, args, cwd) {
  // shell: false siempre: los .exe con shell se rompen por los espacios en la
  // ruta y npm ya se invoca a traves de cmd.exe en npm().
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe']
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
    if (!child.pid) continue
    // En Windows child.kill() solo mata al cmd.exe y deja vivos a sus nietos
    // (node/vite), que siguen ocupando los puertos 3000 y 8787.
    if (process.platform === 'win32') {
      try {
        spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
      } catch (e) { /* noop */ }
    } else {
      try { child.kill() } catch (e) { /* noop */ }
    }
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log('[dev] Frontend: http://127.0.0.1:3000  ->  API: http://127.0.0.1:8787')
start('api', process.execPath, ['--watch', join(serverDir, 'index.js')], serverDir)
const web = npm(['run', 'dev:web'])
start('web', web.command, web.args, root)
