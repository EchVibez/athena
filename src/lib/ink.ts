import { getStroke } from 'perfect-freehand'
import type { Stroke } from './types'

/* ---------- Compact storage: zigzag varints, base64 ---------- */

export interface StoredStroke {
  i: string
  t: 'pen' | 'hl'
  c: string
  w: number
  s?: 1
  p: string
}

function pushVar(out: number[], v: number) {
  let z = v < 0 ? -v * 2 - 1 : v * 2
  while (z >= 0x80) {
    out.push((z & 0x7f) | 0x80)
    z = Math.floor(z / 128)
  }
  out.push(z)
}

function toB64(bytes: number[]): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.slice(i, i + 0x8000))
  return btoa(s)
}

export function encodePts(pts: number[]): string {
  const out: number[] = []
  let px = 0
  let py = 0
  for (let i = 0; i < pts.length; i += 3) {
    const x = Math.round(pts[i] * 10)
    const y = Math.round(pts[i + 1] * 10)
    pushVar(out, x - px)
    pushVar(out, y - py)
    out.push(Math.round((pts[i + 2] ?? 0.5) * 255) & 255)
    px = x
    py = y
  }
  return toB64(out)
}

export function decodePts(b64: string): number[] {
  const s = atob(b64)
  const pts: number[] = []
  let i = 0
  let x = 0
  let y = 0
  const readVar = () => {
    let r = 0
    let m = 1
    for (;;) {
      const b = s.charCodeAt(i++)
      r += (b & 0x7f) * m
      if (b < 0x80) break
      m *= 128
    }
    return r % 2 ? -(r + 1) / 2 : r / 2
  }
  while (i < s.length) {
    x += readVar()
    y += readVar()
    const p = s.charCodeAt(i++) / 255
    pts.push(x / 10, y / 10, p)
  }
  return pts
}

export const storeStroke = (s: Stroke): StoredStroke => ({
  i: s.id,
  t: s.tool,
  c: s.color,
  w: s.size,
  ...(s.sim ? { s: 1 as const } : {}),
  p: encodePts(s.pts),
})

export const loadStroke = (s: StoredStroke): Stroke => ({
  id: s.i,
  tool: s.t,
  color: s.c,
  size: s.w,
  sim: !!s.s,
  pts: decodePts(s.p),
})

/* ---------- Geometry ---------- */

export type Box = [number, number, number, number]

const pathCache = new WeakMap<Stroke, Path2D>()
const boxCache = new WeakMap<Stroke, Box>()

export function strokeOptions(s: { tool: 'pen' | 'hl'; size: number; sim: boolean }, pressure = true) {
  if (s.tool === 'hl') {
    return { size: s.size, thinning: 0, smoothing: 0.6, streamline: 0.4, simulatePressure: false, start: { cap: true }, end: { cap: true } }
  }
  return {
    size: s.size,
    thinning: pressure ? (s.sim ? 0.55 : 0.62) : 0,
    smoothing: 0.62,
    streamline: s.sim ? 0.42 : 0.3,
    simulatePressure: pressure && s.sim,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
  }
}

export function outlineToPath(outline: number[][]): Path2D {
  const p = new Path2D()
  if (!outline.length) return p
  p.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length - 1; i++) {
    const [x0, y0] = outline[i]
    const [x1, y1] = outline[i + 1]
    p.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  }
  p.closePath()
  return p
}

export function pointsOf(pts: number[]): number[][] {
  const out: number[][] = []
  for (let i = 0; i < pts.length; i += 3) out.push([pts[i], pts[i + 1], pts[i + 2]])
  return out
}

export function strokePath(s: Stroke, pressure = true): Path2D {
  let p = pathCache.get(s)
  if (!p) {
    const pts = pointsOf(s.pts)
    if (pts.length === 1) pts.push([pts[0][0] + 0.1, pts[0][1] + 0.1, pts[0][2]])
    p = outlineToPath(getStroke(pts, { ...strokeOptions(s, pressure), last: true }))
    pathCache.set(s, p)
  }
  return p
}

export function clearPathCache(s: Stroke) {
  pathCache.delete(s)
}

export function strokeBox(s: Stroke): Box {
  let b = boxCache.get(s)
  if (!b) {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i < s.pts.length; i += 3) {
      const x = s.pts[i]
      const y = s.pts[i + 1]
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
    const r = s.size / 2
    b = [x0 - r, y0 - r, x1 + r, y1 + r]
    boxCache.set(s, b)
  }
  return b
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const l = dx * dx + dy * dy
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0
  t = Math.max(0, Math.min(1, t))
  const x = ax + t * dx - px
  const y = ay + t * dy - py
  return Math.sqrt(x * x + y * y)
}

export function strokeHit(s: Stroke, x: number, y: number, r: number): boolean {
  const b = strokeBox(s)
  if (x < b[0] - r || x > b[2] + r || y < b[1] - r || y > b[3] + r) return false
  const lim = r + s.size / 2
  const p = s.pts
  if (p.length <= 3) return Math.hypot(p[0] - x, p[1] - y) <= lim
  for (let i = 0; i + 5 < p.length; i += 3) {
    if (segDist(x, y, p[i], p[i + 1], p[i + 3], p[i + 4]) <= lim) return true
  }
  return false
}

export function segHit(x: number, y: number, ax: number, ay: number, bx: number, by: number, r: number) {
  return segDist(x, y, ax, ay, bx, by) <= r
}

export function pointInPoly(x: number, y: number, poly: number[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i]
    const yi = poly[i + 1]
    const xj = poly[j]
    const yj = poly[j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function translateStroke(s: Stroke, dx: number, dy: number): Stroke {
  const pts = s.pts.slice()
  for (let i = 0; i < pts.length; i += 3) {
    pts[i] += dx
    pts[i + 1] += dy
  }
  return { ...s, pts }
}

/* ---------- Colors ---------- */

export const INK_COLORS = ['ink', '#2f6fde', '#d64545', '#2e9d5b', '#e08a1e', '#8e5bd8']
export const HL_COLORS = ['#ffd54a', '#8ee08e', '#7cc4ff', '#ff8fc8']

export function inkColor(c: string, darkPaper: boolean): string {
  if (c === 'ink') return darkPaper ? '#f2f2f2' : '#161616'
  if (darkPaper && c === '#2f6fde') return '#6ea0ff'
  return c
}
