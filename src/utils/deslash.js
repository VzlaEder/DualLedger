export function deslashZeros(rgba, width, height) {
  const ink = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    ink[i] = rgba[i * 4] <= 127 ? 1 : 0
  }

  const comps = labelComponents(ink, width, height)

  for (const c of comps) {
    const cw = c.x1 - c.x0 + 1
    const ch = c.y1 - c.y0 + 1
    if (cw < 6 || ch < 6) continue
    if (ch > 90) continue
    const aspect = cw / ch
    if (aspect < 0.35 || aspect > 1.8) continue
    if (c.pixels.length < 15) continue

    const info = inspectComponent(ink, width, height, c)
    const holes = info.holes

    if (holes.length === 2) {
      const h1 = holes[0]
      const h2 = holes[1]

      const overlapX =
        Math.max(0, Math.min(h1.bx1, h2.bx1) - Math.max(h1.bx0, h2.bx0) + 1)
      const glyphW = c.x1 - c.x0 + 1
      const overlapRatio = overlapX / glyphW

      if (overlapRatio >= 0.6) continue

      const xMin = Math.min(h1.bx0, h2.bx0) - 1
      const xMax = Math.max(h1.bx1, h2.bx1) + 1
      const yMin = Math.min(h1.by0, h2.by0) - 1
      const yMax = Math.max(h1.by1, h2.by1) + 1

      for (let y = Math.max(c.y0, yMin); y <= Math.min(c.y1, yMax); y++) {
        for (let x = Math.max(c.x0, xMin); x <= Math.min(c.x1, xMax); x++) {
          const idx = y * width + x
          if (!ink[idx]) continue
          if (isOuterBoundary(ink, width, height, x, y, c, info)) continue
          ink[idx] = 0
          const o = idx * 4
          rgba[o] = 255
          rgba[o + 1] = 255
          rgba[o + 2] = 255
          rgba[o + 3] = 255
        }
      }
      continue
    }

    if (holes.length === 1) {
      const h = holes[0]
      let inside = 0
      const ix0 = Math.max(h.bx0 + 1, c.x0)
      const ix1 = Math.min(h.bx1 - 1, c.x1)
      const iy0 = Math.max(h.by0 + 1, c.y0)
      const iy1 = Math.min(h.by1 - 1, c.y1)
      for (let y = iy0; y <= iy1; y++) {
        for (let x = ix0; x <= ix1; x++) {
          if (ink[y * width + x]) inside++
          if (inside >= 2) break
        }
        if (inside >= 2) break
      }

      if (inside >= 2) {
        for (let y = Math.max(c.y0, h.by0 - 1); y <= Math.min(c.y1, h.by1 + 1); y++) {
          for (let x = Math.max(c.x0, h.bx0 - 1); x <= Math.min(c.x1, h.bx1 + 1); x++) {
            const idx = y * width + x
            if (!ink[idx]) continue
            if (isOuterBoundary(ink, width, height, x, y, c, info)) continue
            ink[idx] = 0
            const o = idx * 4
            rgba[o] = 255
            rgba[o + 1] = 255
            rgba[o + 2] = 255
            rgba[o + 3] = 255
          }
        }
      }
    }
  }

  return rgba
}

export function labelComponents(ink, width, height) {
  const labels = new Int32Array(width * height).fill(-1)
  const comps = []
  let nextId = 0
  for (let i = 0; i < width * height; i++) {
    if (!ink[i] || labels[i] !== -1) continue
    const stack = [i]
    labels[i] = nextId
    let x0 = width, y0 = height, x1 = 0, y1 = 0
    const pixels = []
    while (stack.length) {
      const p = stack.pop()
      pixels.push(p)
      const x = p % width
      const y = (p / width) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x > 0 && ink[p - 1] && labels[p - 1] === -1) { labels[p - 1] = nextId; stack.push(p - 1) }
      if (x < width - 1 && ink[p + 1] && labels[p + 1] === -1) { labels[p + 1] = nextId; stack.push(p + 1) }
      if (y > 0 && ink[p - width] && labels[p - width] === -1) { labels[p - width] = nextId; stack.push(p - width) }
      if (y < height - 1 && ink[p + width] && labels[p + width] === -1) { labels[p + width] = nextId; stack.push(p + width) }
    }
    comps.push({ pixels, x0, y0, x1, y1 })
    nextId++
  }
  return comps
}

function inspectComponent(ink, width, height, c) {
  const x0 = Math.max(0, c.x0 - 2)
  const y0 = Math.max(0, c.y0 - 2)
  const x1 = Math.min(width - 1, c.x1 + 2)
  const y1 = Math.min(height - 1, c.y1 + 2)
  const rw = x1 - x0 + 1
  const rh = y1 - y0 + 1
  const reg = (x, y) => (y - y0) * rw + (x - x0)

  const exterior = new Uint8Array(rw * rh)
  const visited = new Uint8Array(rw * rh)
  const queue = []

  for (let x = x0; x <= x1; x++) {
    for (const y of [y0, y1]) {
      if (!ink[y * width + x] && !visited[reg(x, y)]) {
        exterior[reg(x, y)] = 1
        visited[reg(x, y)] = 1
        queue.push([x, y])
      }
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (const x of [x0, x1]) {
      if (!ink[y * width + x] && !visited[reg(x, y)]) {
        exterior[reg(x, y)] = 1
        visited[reg(x, y)] = 1
        queue.push([x, y])
      }
    }
  }

  while (queue.length) {
    const [x, y] = queue.pop()
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue
      if (ink[ny * width + nx]) continue
      if (visited[reg(nx, ny)]) continue
      visited[reg(nx, ny)] = 1
      exterior[reg(nx, ny)] = 1
      queue.push([nx, ny])
    }
  }

  const holeLabel = new Int32Array(rw * rh).fill(-2)
  for (let y = Math.max(y0, c.y0); y <= Math.min(y1, c.y1); y++) {
    for (let x = Math.max(x0, c.x0); x <= Math.min(x1, c.x1); x++) {
      const ri = reg(x, y)
      if (ink[y * width + x]) holeLabel[ri] = -1
      else if (exterior[ri]) holeLabel[ri] = -1
    }
  }

  let holeId = 0
  const holes = []
  for (let y = Math.max(y0, c.y0); y <= Math.min(y1, c.y1); y++) {
    for (let x = Math.max(x0, c.x0); x <= Math.min(x1, c.x1); x++) {
      const ri = reg(x, y)
      if (holeLabel[ri] !== -2) continue
      const stack = [[x, y]]
      holeLabel[ri] = holeId
      let sx = 0, sy = 0, n = 0
      let bx0 = x, by0 = y, bx1 = x, by1 = y
      while (stack.length) {
        const [px, py] = stack.pop()
        sx += px
        sy += py
        n++
        if (px < bx0) bx0 = px
        if (px > bx1) bx1 = px
        if (py < by0) by0 = py
        if (py > by1) by1 = py
        for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
          if (nx < c.x0 || nx > c.x1 || ny < c.y0 || ny > c.y1) continue
          const nri = reg(nx, ny)
          if (holeLabel[nri] !== -2) continue
          holeLabel[nri] = holeId
          stack.push([nx, ny])
        }
      }
      holes.push({ cx: sx / n, cy: sy / n, bx0, by0, bx1, by1 })
      holeId++
    }
  }

  return { holes, exterior }
}

function isOuterBoundary(ink, width, height, x, y, c, info) {
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
    if (ink[ny * width + nx]) continue
    if (nx < c.x0 - 2 || nx > c.x1 + 2 || ny < c.y0 - 2 || ny > c.y1 + 2) return true
    if (info && info.exterior) {
      const x0 = Math.max(0, c.x0 - 2)
      const y0 = Math.max(0, c.y0 - 2)
      const rw = Math.min(width - 1, c.x1 + 2) - x0 + 1
      const ri = (ny - y0) * rw + (nx - x0)
      if (info.exterior[ri]) return true
    }
  }
  return false
}

function orientationDegrees(pts) {
  let sx = 0, sy = 0
  for (const [px, py] of pts) { sx += px; sy += py }
  const n = pts.length
  const mx = sx / n
  const my = sy / n
  let xx = 0, yy = 0, xy = 0
  for (const [px, py] of pts) {
    const dx = px - mx
    const dy = py - my
    xx += dx * dx
    yy += dy * dy
    xy += dx * dy
  }
  const theta = 0.5 * Math.atan2(2 * xy, xx - yy)
  return (theta * 180) / Math.PI
}

function absAngleDeg(a) {
  let v = Math.abs(a)
  if (v > 90) v = 180 - v
  return v
}

export function countHolesForTest(ink, width, height) {
  const comps = labelComponents(ink, width, height)
  const counts = []
  for (const c of comps) {
    if (c.pixels.length < 15) continue
    const info = inspectComponent(ink, width, height, c)
    let interiorInk = 0
    for (const h of info.holes) {
      for (let y = h.by0 + 1; y <= h.by1 - 1; y++) {
        for (let x = h.bx0 + 1; x <= h.bx1 - 1; x++) {
          if (ink[y * width + x]) interiorInk++
        }
      }
    }
    counts.push({ holes: info.holes.length, interiorInk })
  }
  return counts
}