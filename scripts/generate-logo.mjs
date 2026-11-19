import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const svgPath = join(projectRoot, 'src', 'assets', 'logo', 'DualLedger.svg')
const publicDir = join(projectRoot, 'public')

const svg = readFileSync(svgPath, 'utf-8')

function renderPng(size, outPath) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(255,255,255,0)'
  })
  const png = resvg.render().asPng()
  writeFileSync(outPath, png)
  console.log(`Generated ${outPath} (${png.length} bytes)`)
}

mkdirSync(publicDir, { recursive: true })

renderPng(192, join(publicDir, 'icon-192.png'))
renderPng(512, join(publicDir, 'icon-512.png'))
renderPng(64, join(publicDir, 'favicon-64.png'))
