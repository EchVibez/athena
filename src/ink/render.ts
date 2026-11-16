import { inkColor, strokePath } from '../lib/ink'
import { extrema, intersections, zeros, type Found } from '../lib/math/analyze'
import { defineAll, type Def } from '../lib/math/defs'
import { fmtShort } from '../lib/math/expr'
import { GRID, PAGE_H, PAGE_W, type GraphObj, type Obj, type Page, type Paper, type ShapeObj, type Stroke } from '../lib/types'

export interface Look {
  dark: boolean
  pressure: boolean
  z: number
}

export function paperColors(dark: boolean) {
  return dark
    ? { paper: '#151517', grid: 'rgba(255,255,255,0.075)', strong: 'rgba(255,255,255,0.13)', text: '#d8d8dc', quiet: '#8a8a90', axis: '#c9c9ce', box: 'rgba(255,255,255,0.14)' }
    : { paper: '#ffffff', grid: 'rgba(40,70,110,0.13)', strong: 'rgba(40,70,110,0.22)', text: '#1d1d1f', quiet: '#7a7a80', axis: '#3a3a3e', box: 'rgba(0,0,0,0.16)' }
}

export function drawPaper(ctx: CanvasRenderingContext2D, paper: Paper, look: Look) {
  const c = paperColors(look.dark)
  ctx.fillStyle = c.paper
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)
  if (paper === 'blank') return
  const lw = Math.max(0.55, 0.8 / look.z)
  ctx.lineWidth = lw
  if (paper === 'rutor') {
    ctx.strokeStyle = c.grid
    ctx.beginPath()
    for (let x = GRID; x < PAGE_W; x += GRID) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, PAGE_H)
    }
    for (let y = GRID; y < PAGE_H; y += GRID) {
      ctx.moveTo(0, y)
      ctx.lineTo(PAGE_W, y)
    }
    ctx.stroke()
  } else if (paper === 'linjer') {
    ctx.strokeStyle = c.strong
    ctx.beginPath()
    for (let y = 80; y < PAGE_H - 20; y += 30) {
      ctx.moveTo(0, y)
      ctx.lineTo(PAGE_W, y)
    }
    ctx.stroke()
    ctx.strokeStyle = look.dark ? 'rgba(255,110,110,0.25)' : 'rgba(220,60,60,0.3)'
    ctx.beginPath()
    ctx.moveTo(72, 0)
    ctx.lineTo(72, PAGE_H)
    ctx.stroke()
  } else if (paper === 'prickar') {
    ctx.fillStyle = c.strong
    const r = Math.max(0.9, 1.1 / Math.sqrt(look.z))
    for (let y = GRID; y < PAGE_H; y += GRID) for (let x = GRID; x < PAGE_W; x += GRID) ctx.fillRect(x - r / 2, y - r / 2, r, r)
  }
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, look: Look) {
  ctx.fillStyle = s.tool === 'hl' ? s.color : inkColor(s.color, look.dark)
  ctx.fill(strokePath(s, look.pressure))
}

/* ---------- Shapes ---------- */

export function drawShapeRaw(ctx: CanvasRenderingContext2D, shape: ShapeObj['shape'], x1: number, y1: number, x2: number, y2: number, size: number, color: string) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (shape === 'line' || shape === 'arrow') {
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    if (shape === 'arrow') {
      const a = Math.atan2(y2 - y1, x2 - x1)
      const L = Math.min(Math.hypot(x2 - x1, y2 - y1) * 0.5, 11 + size * 2.2)
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - L * Math.cos(a - 0.42), y2 - L * Math.sin(a - 0.42))
      ctx.lineTo(x2 - L * Math.cos(a + 0.42), y2 - L * Math.sin(a + 0.42))
      ctx.closePath()
      ctx.fill()
    }
  } else if (shape === 'rect') {
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
  } else {
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

export function drawShape(ctx: CanvasRenderingContext2D, s: ShapeObj, look: Look) {
  drawShapeRaw(ctx, s.shape, s.x1, s.y1, s.x2, s.y2, s.size, inkColor(s.color, look.dark))
}

/* ---------- Graphs ---------- */

export interface GraphData {
  defs: Def[]
  found: (Found & { label: string })[]
}

const graphCache = new WeakMap<GraphObj, GraphData>()

export function graphData(g: GraphObj): GraphData {
  let d = graphCache.get(g)
  if (d) return d
  const defs = defineAll(g.fns.map((f) => f.expr))
  const found: GraphData['found'] = []
  const { x0, x1, y0, y1 } = g.view
  const fns = defs.map((df, i) => ({ df, i })).filter((o) => o.df.type === 'fn') as { df: Extract<Def, { type: 'fn' }>; i: number }[]
  const inView = (p: Found) => p.y >= y0 - 1e-9 && p.y <= y1 + 1e-9
  for (const { df } of fns) {
    if (g.show.zeros) for (const p of zeros(df.f, x0, x1)) if (inView(p)) found.push({ ...p, label: `Nollställe ${df.name}` })
    if (g.show.extrema)
      for (const p of extrema(df.f, x0, x1)) if (inView(p)) found.push({ ...p, label: `${p.kind === 'max' ? 'Maximum' : 'Minimum'} ${df.name}` })
  }
  if (g.show.intersections)
    for (let a = 0; a < fns.length; a++)
      for (let b = a + 1; b < fns.length; b++)
        for (const p of intersections(fns[a].df.f, fns[b].df.f, x0, x1)) if (inView(p)) found.push({ ...p, label: `Skärning ${fns[a].df.name}, ${fns[b].df.name}` })
  d = { defs, found }
  graphCache.set(g, d)
  return d
}

export function niceStep(range: number, target: number) {
  const raw = range / Math.max(1, target)
  const p = 10 ** Math.floor(Math.log10(raw))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}

export const GRAPH_COLORS = ['#2f6fde', '#d64545', '#2e9d5b', '#e08a1e', '#8e5bd8', '#16a3a3']

export function drawGraph(ctx: CanvasRenderingContext2D, g: GraphObj, look: Look, trace?: { x: number; y: number; label: string } | null) {
  const c = paperColors(look.dark)
  const { x, y, w, h } = g
  const { x0, x1, y0, y1 } = g.view
  const sx = (v: number) => x + ((v - x0) / (x1 - x0)) * w
  const sy = (v: number) => y + h - ((v - y0) / (y1 - y0)) * h
  ctx.save()
  ctx.fillStyle = c.paper
  ctx.fillRect(x, y, w, h)
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  const stepX = niceStep(x1 - x0, w / 55)
  const stepY = niceStep(y1 - y0, h / 55)
  const lw = Math.max(0.5, 0.7 / look.z)
  ctx.lineWidth = lw
  ctx.strokeStyle = c.grid
  ctx.beginPath()
  for (let v = Math.ceil(x0 / stepX) * stepX; v <= x1; v += stepX) {
    ctx.moveTo(sx(v), y)
    ctx.lineTo(sx(v), y + h)
  }
  for (let v = Math.ceil(y0 / stepY) * stepY; v <= y1; v += stepY) {
    ctx.moveTo(x, sy(v))
    ctx.lineTo(x + w, sy(v))
  }
  ctx.stroke()

  // Axes and their numbers.
  const ax = Math.min(Math.max(sy(0), y), y + h)
  const ay = Math.min(Math.max(sx(0), x), x + w)
  ctx.strokeStyle = c.axis
  ctx.lineWidth = Math.max(0.9, 1.2 / look.z)
  ctx.beginPath()
  ctx.moveTo(x, ax)
  ctx.lineTo(x + w, ax)
  ctx.moveTo(ay, y)
  ctx.lineTo(ay, y + h)
  ctx.stroke()
  ctx.fillStyle = c.axis
  ctx.beginPath()
  ctx.moveTo(x + w, ax)
  ctx.lineTo(x + w - 8, ax - 4)
  ctx.lineTo(x + w - 8, ax + 4)
  ctx.moveTo(ay, y)
  ctx.lineTo(ay - 4, y + 8)
  ctx.lineTo(ay + 4, y + 8)
  ctx.fill()
  ctx.font = '500 11px Inter Variable, Inter, system-ui, sans-serif'
  ctx.fillStyle = c.quiet
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (let v = Math.ceil(x0 / stepX) * stepX; v <= x1; v += stepX) {
    if (Math.abs(v) < stepX / 2) continue
    const px = sx(v)
    if (px < x + 10 || px > x + w - 14) continue
    ctx.fillText(fmtShort(v), px, Math.min(ax + 4, y + h - 14))
  }
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let v = Math.ceil(y0 / stepY) * stepY; v <= y1; v += stepY) {
    if (Math.abs(v) < stepY / 2) continue
    const py = sy(v)
    if (py < y + 12 || py > y + h - 8) continue
    ctx.fillText(fmtShort(v), Math.max(ay - 5, x + 26), py)
  }
  ctx.textAlign = 'left'
  ctx.fillText('x', x + w - 12, ax - 10)
  ctx.textBaseline = 'top'
  ctx.fillText('y', ay + 7, y + 4)

  const data = graphData(g)
  const colorOf = (i: number) => g.fns[i]?.color ?? GRAPH_COLORS[i % GRAPH_COLORS.length]
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  data.defs.forEach((df, i) => {
    ctx.strokeStyle = colorOf(i)
    ctx.fillStyle = colorOf(i)
    if (df.type === 'fn') {
      const n = Math.min(2400, Math.ceil(w * Math.max(1, look.z) * 1.5))
      ctx.beginPath()
      let pen = false
      let prev = NaN
      for (let k = 0; k <= n; k++) {
        const xv = x0 + ((x1 - x0) * k) / n
        let yv: number
        try {
          yv = df.f(xv)
        } catch {
          yv = NaN
        }
        if (!Number.isFinite(yv)) {
          pen = false
          prev = NaN
          continue
        }
        const py = sy(yv)
        const clamped = Math.max(y - h * 2, Math.min(y + h * 3, py))
        if (pen && Number.isFinite(prev) && Math.abs(py - prev) > h * 1.2 && (py < y || py > y + h || prev < y || prev > y + h)) pen = false
        if (pen) ctx.lineTo(sx(xv), clamped)
        else ctx.moveTo(sx(xv), clamped)
        pen = true
        prev = py
      }
      ctx.stroke()
    } else if (df.type === 'vline') {
      ctx.beginPath()
      ctx.moveTo(sx(df.x), y)
      ctx.lineTo(sx(df.x), y + h)
      ctx.stroke()
    } else if (df.type === 'point') {
      ctx.beginPath()
      ctx.arc(sx(df.x), sy(df.y), 4.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = '600 12px Inter Variable, Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${df.label ? df.label + ' ' : ''}(${fmtShort(df.x)}; ${fmtShort(df.y)})`, sx(df.x) + 7, sy(df.y) - 5)
    }
  })

  for (const p of data.found) {
    const px = sx(p.x)
    const py = sy(p.y)
    ctx.fillStyle = c.paper
    ctx.strokeStyle = c.axis
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.arc(px, py, 4.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = c.text
    ctx.font = '500 11px Inter Variable, Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = p.kind === 'min' ? 'top' : 'bottom'
    ctx.fillText(`(${fmtShort(p.x)}; ${fmtShort(p.y)})`, px + 7, p.kind === 'min' ? py + 5 : py - 5)
  }

  if (trace) {
    const px = sx(trace.x)
    const py = sy(trace.y)
    ctx.strokeStyle = c.quiet
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px, ax)
    ctx.lineTo(px, py)
    ctx.moveTo(ay, py)
    ctx.lineTo(px, py)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = c.text
    ctx.beginPath()
    ctx.arc(px, py, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '650 12.5px Inter Variable, Inter, system-ui, sans-serif'
    const label = `${trace.label} (${fmtShort(trace.x)}; ${fmtShort(trace.y)})`
    const tw = ctx.measureText(label).width
    const lx = Math.min(px + 9, x + w - tw - 8)
    const ly = Math.max(py - 26, y + 6)
    ctx.fillStyle = c.paper
    ctx.globalAlpha = 0.92
    ctx.fillRect(lx - 4, ly - 2, tw + 8, 19)
    ctx.globalAlpha = 1
    ctx.fillStyle = c.text
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(label, lx, ly + 1)
  }
  ctx.restore()
  ctx.strokeStyle = c.box
  ctx.lineWidth = Math.max(0.8, 1 / look.z)
  ctx.strokeRect(x, y, w, h)
}

/* ---------- A whole page ---------- */

export interface PageDrawOpts {
  look: Look
  paper: Paper
  bitmaps: Map<string, ImageBitmap | null>
  /** Items being dragged, drawn at an offset. */
  moving?: { ids: Set<string>; dx: number; dy: number } | null
  hidden?: Set<string>
  trace?: { id: string; x: number; y: number; label: string } | null
}

export function drawPage(ctx: CanvasRenderingContext2D, page: Page, o: PageDrawOpts) {
  drawPaper(ctx, page.bg ? 'blank' : (page.paper ?? o.paper), o.look)
  if (page.bg) {
    const bm = o.bitmaps.get(page.bg)
    if (bm) ctx.drawImage(bm, 0, 0, PAGE_W, PAGE_H)
  }
  const mv = o.moving
  const at = (id: string, f: () => void) => {
    if (o.hidden?.has(id)) return
    if (mv && mv.ids.has(id)) {
      ctx.save()
      ctx.translate(mv.dx, mv.dy)
      f()
      ctx.restore()
    } else f()
  }
  ctx.save()
  ctx.globalAlpha = 0.42
  for (const s of page.strokes) if (s.tool === 'hl') at(s.id, () => drawStroke(ctx, s, o.look))
  ctx.restore()
  for (const ob of page.objects) drawObject(ctx, ob, o, at)
  for (const s of page.strokes) if (s.tool === 'pen') at(s.id, () => drawStroke(ctx, s, o.look))
}

function drawObject(ctx: CanvasRenderingContext2D, ob: Obj, o: PageDrawOpts, at: (id: string, f: () => void) => void) {
  if (ob.type === 'image') {
    at(ob.id, () => {
      const bm = o.bitmaps.get(ob.asset)
      if (bm) ctx.drawImage(bm, ob.x, ob.y, ob.w, ob.h)
      else {
        ctx.fillStyle = paperColors(o.look.dark).grid
        ctx.fillRect(ob.x, ob.y, ob.w, ob.h)
      }
    })
  } else if (ob.type === 'graph') {
    at(ob.id, () => drawGraph(ctx, ob, o.look, o.trace && o.trace.id === ob.id ? o.trace : null))
  } else if (ob.type === 'shape') {
    at(ob.id, () => drawShape(ctx, ob, o.look))
  }
}
