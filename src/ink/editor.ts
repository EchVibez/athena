import { getStroke } from 'perfect-freehand'
import { HL_COLORS, inkColor, outlineToPath, pointInPoly, pointsOf, segHit, strokeBox, strokeHit, strokeOptions, translateStroke } from '../lib/ink'
import { getPrefs, paperIsDark, setPrefs } from '../lib/prefs'
import { assetBitmap, putAsset, savePage } from '../lib/store'
import { GRID, PAGE_GAP, PAGE_H, PAGE_W, type GraphObj, type Note, type Obj, type Page, type ShapeKind, type ShapeObj, type Stroke } from '../lib/types'
import { clamp, sid } from '../lib/util'
import { drawPage, drawShapeRaw, graphData, paperColors, type Look } from './render'
import { fmtShort } from '../lib/math/expr'

export type Tool = 'pen' | 'hl' | 'eraser' | 'lasso' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'math' | 'graph' | 'hand'

export interface ToolStyle {
  color: string
  size: number
}

type Snap = { strokes: Stroke[]; objects: Obj[] }
interface Cmd {
  pageId: string
  before: Snap
  after: Snap
}

export interface Sel {
  pageId: string
  strokes: Set<string>
  objects: Set<string>
}

export interface EditorState {
  canUndo: boolean
  canRedo: boolean
  zoom: number
  sel: null | { pageId: string; count: number; single: Obj | null; rect: { x: number; y: number; w: number; h: number } }
  page: number
}

export interface EditorHost {
  state(s: EditorState): void
  objects(): void
  edit(target: { pageId: string; id: string } | null): void
  requestMath(pageId: string, x: number, y: number): void
}

type Gesture =
  | { k: 'draw'; id: number; page: number; pts: number[]; sim: boolean; tool: 'pen' | 'hl'; edge: null | { ox: number; oy: number; dx: number; dy: number } ; t0: number }
  | { k: 'erase'; id: number; page: number; before: Snap; changed: boolean }
  | { k: 'lasso'; id: number; page: number; poly: number[]; sx: number; sy: number; moved: boolean }
  | { k: 'move'; id: number; page: number; x0: number; y0: number; dx: number; dy: number }
  | { k: 'shape'; id: number; page: number; shape: ShapeKind; x1: number; y1: number; x2: number; y2: number }
  | { k: 'pan'; id: number; lx: number; ly: number; vx: number; vy: number; t: number }
  | { k: 'pinch'; a: number; b: number; d0: number; z0: number; wx: number; wy: number }
  | { k: 'graph'; id: number; page: number; obj: string; lx: number; ly: number; sx: number; sy: number; moved: boolean }
  | { k: 'resize'; id: number; page: number; obj: Obj; sx: number; sy: number; before: Snap }

const STEP = PAGE_H + PAGE_GAP
const DEFAULT_STYLES: Record<string, ToolStyle> = {
  pen: { color: 'ink', size: 2.6 },
  hl: { color: HL_COLORS[0], size: 18 },
  shape: { color: 'ink', size: 2.2 },
  text: { color: 'ink', size: 18 },
}

export class Editor {
  ctx: CanvasRenderingContext2D
  lctx: CanvasRenderingContext2D
  view = { x: 0, y: 0, z: 1 }
  vw = 0
  vh = 0
  dpr = 1
  tool: Tool = 'pen'
  styles: Record<string, ToolStyle>
  bitmaps = new Map<string, ImageBitmap | null>()
  undoStack: Cmd[] = []
  redoStack: Cmd[] = []
  sel: Sel | null = null
  activeGraph: { pageId: string; id: string } | null = null
  trace: { id: string; x: number; y: number; label: string } | null = null
  ruler = { on: false, x: 0, y: 0, a: 0 }
  protractor = { on: false, x: 0, y: 0, a: 0 }
  objSizes = new Map<string, { w: number; h: number }>()
  private g: Gesture | null = null
  private pointers = new Map<number, { x: number; y: number; type: string; t: number }>()
  private raf = 0
  private liveRaf = 0
  private editSnaps = new Map<string, Snap>()
  private ro: ResizeObserver
  private inertia = 0
  private spaceDown = false
  private destroyed = false
  private stateRaf = 0
  private viewTimer = 0

  constructor(
    public root: HTMLDivElement,
    public canvas: HTMLCanvasElement,
    public live: HTMLCanvasElement,
    public layer: HTMLDivElement,
    public note: Note,
    public pages: Page[],
    public host: EditorHost,
  ) {
    this.ctx = canvas.getContext('2d')!
    this.lctx = (live.getContext('2d', { desynchronized: true } as any) as CanvasRenderingContext2D) ?? live.getContext('2d')!
    let saved: Record<string, ToolStyle> = {}
    try {
      saved = JSON.parse(localStorage.getItem('athena.styles') || '{}')
    } catch {
      /* ignore */
    }
    this.styles = { ...DEFAULT_STYLES, ...saved }
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(root)
    this.resize(true)
    root.addEventListener('pointerdown', this.onDown)
    root.addEventListener('pointermove', this.onMove)
    root.addEventListener('pointerup', this.onUp)
    root.addEventListener('pointercancel', this.onCancel)
    root.addEventListener('wheel', this.onWheel, { passive: false })
    root.addEventListener('contextmenu', (e) => e.preventDefault())
    // A mouse press on the paper must not steal focus from a text box the editor just opened.
    root.addEventListener('mousedown', (e) => {
      if (!(e.target as HTMLElement).closest('[data-ui]')) e.preventDefault()
    })
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('keyup', this.onKeyUp)
    for (const p of pages) this.loadImages(p)
  }

  destroy() {
    this.destroyed = true
    this.ro.disconnect()
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('keyup', this.onKeyUp)
    cancelAnimationFrame(this.raf)
    cancelAnimationFrame(this.liveRaf)
    cancelAnimationFrame(this.inertia)
    this.saveView()
  }

  /* ---------- Geometry ---------- */

  top(i: number) {
    return i * STEP
  }
  get totalH() {
    return Math.max(PAGE_H, this.pages.length * STEP - PAGE_GAP)
  }
  toWorld(sx: number, sy: number) {
    return { x: sx / this.view.z + this.view.x, y: sy / this.view.z + this.view.y }
  }
  pageAt(wy: number) {
    return clamp(Math.floor((wy + PAGE_GAP / 2) / STEP), 0, this.pages.length - 1)
  }
  local(sx: number, sy: number, page?: number) {
    const w = this.toWorld(sx, sy)
    const i = page ?? this.pageAt(w.y)
    return { i, x: w.x, y: w.y - this.top(i) }
  }
  private rel(e: PointerEvent | WheelEvent) {
    const r = this.root.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  pageById(id: string) {
    const i = this.pages.findIndex((p) => p.id === id)
    return { i, page: this.pages[i] }
  }

  /* ---------- View ---------- */

  resize(first = false) {
    const r = this.root.getBoundingClientRect()
    const wasFit = !first && this.vw > 0 && Math.abs(this.view.z / this.fitZ() - 1) < 0.03
    this.vw = r.width
    this.vh = r.height
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    for (const c of [this.canvas, this.live]) {
      c.width = Math.round(this.vw * this.dpr)
      c.height = Math.round(this.vh * this.dpr)
      c.style.width = this.vw + 'px'
      c.style.height = this.vh + 'px'
    }
    if (first) {
      this.fitWidth(false)
      // The saved place is relative to "fit width", so it works on a phone and a laptop alike.
      try {
        const s = JSON.parse(localStorage.getItem('athena.view.' + this.note.id) || 'null') as { y: number; zr: number; x: number } | null
        if (s && typeof s.zr === 'number') {
          const fit = this.view.z
          this.view.z = clamp(s.zr * fit, 0.2, 6)
          this.view.y = s.y
          if (s.zr > 1.03) this.view.x = s.x
          else this.view.x = -(this.vw / this.view.z - PAGE_W) / 2
        }
      } catch {
        /* keep fit width */
      }
    } else if (wasFit) {
      this.fitWidth(true)
      return
    }
    this.clampView()
    this.applyView()
  }

  fitWidth(keepY = true) {
    const z = this.fitZ()
    const center = this.toWorld(this.vw / 2, this.vh / 2)
    this.view.z = z
    this.view.x = -(this.vw / z - PAGE_W) / 2
    this.view.y = keepY ? center.y - this.vh / 2 / z : -18 / z
    this.clampView()
    this.applyView()
  }

  zoomBy(f: number, sx = this.vw / 2, sy = this.vh / 2) {
    const w = this.toWorld(sx, sy)
    this.view.z = clamp(this.view.z * f, 0.2, 6)
    this.view.x = w.x - sx / this.view.z
    this.view.y = w.y - sy / this.view.z
    this.clampView()
    this.applyView()
  }

  /** Move the view (smoothly) so a box on a page is visible beside a panel. */
  reveal(pageId: string, box: [number, number, number, number], inset: { right: number; bottom: number }) {
    const { i } = this.pageById(pageId)
    if (i < 0) return
    const z = this.view.z
    const top = this.top(i)
    const pad = 16
    const availW = this.vw - inset.right
    const availH = this.vh - inset.bottom
    const sx0 = (box[0] - this.view.x) * z
    const sx1 = (box[2] - this.view.x) * z
    const sy0 = (box[1] + top - this.view.y) * z
    const sy1 = (box[3] + top - this.view.y) * z
    let dx = 0
    let dy = 0
    if (sx1 > availW - pad) dx = sx1 - (availW - pad)
    if (sx0 - dx < pad) dx = sx0 - pad
    if (sy1 > availH - pad) dy = sy1 - (availH - pad)
    if (sy0 - dy < pad) dy = sy0 - pad
    if (!dx && !dy) return
    const from = { x: this.view.x, y: this.view.y }
    const to = { x: from.x + dx / z, y: from.y + dy / z }
    const t0 = performance.now()
    cancelAnimationFrame(this.inertia)
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 320)
      const e = 1 - Math.pow(1 - t, 3)
      this.view.x = from.x + (to.x - from.x) * e
      this.view.y = from.y + (to.y - from.y) * e
      this.applyView()
      if (t < 1) this.inertia = requestAnimationFrame(step)
    }
    this.inertia = requestAnimationFrame(step)
  }

  scrollToPage(i: number) {
    this.view.y = this.top(i) - 18 / this.view.z
    this.clampView()
    this.applyView()
  }

  private clampView() {
    const { z } = this.view
    const w = this.vw / z
    const h = this.vh / z
    const slackX = w * 0.6
    if (w >= PAGE_W) this.view.x = clamp(this.view.x, -(w - PAGE_W) - slackX * 0.2, slackX * 0.2)
    else this.view.x = clamp(this.view.x, -slackX * 0.3, PAGE_W - w + slackX * 0.3)
    this.view.y = clamp(this.view.y, -h * 0.4, this.totalH - h * 0.45)
  }

  applyView() {
    const { x, y, z } = this.view
    this.layer.style.transform = `translate(${-x * z}px, ${-y * z}px) scale(${z})`
    this.root.style.setProperty('--z', String(z))
    this.requestDraw()
    this.emitState()
    window.clearTimeout(this.viewTimer)
    this.viewTimer = window.setTimeout(() => this.saveView(), 600)
  }

  private fitZ() {
    const margin = this.vw < 640 ? 10 : 56
    return clamp((this.vw - margin * 2) / PAGE_W, 0.2, 1.6)
  }

  private saveView() {
    try {
      localStorage.setItem('athena.view.' + this.note.id, JSON.stringify({ y: this.view.y, x: this.view.x, zr: this.view.z / this.fitZ() }))
    } catch {
      /* ignore */
    }
  }

  /* ---------- Drawing ---------- */

  look(): Look {
    return { dark: paperIsDark(), pressure: getPrefs().pressure, z: this.view.z }
  }

  requestDraw() {
    if (this.raf || this.destroyed) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.draw()
    })
  }

  private loadImages(p: Page) {
    const ids: string[] = []
    if (p.bg) ids.push(p.bg)
    for (const o of p.objects) if (o.type === 'image') ids.push(o.asset)
    for (const id of ids) {
      if (this.bitmaps.has(id)) continue
      this.bitmaps.set(id, null)
      assetBitmap(id).then((b) => {
        if (b) {
          this.bitmaps.set(id, b)
          this.requestDraw()
        } else this.bitmaps.delete(id)
      })
    }
  }

  draw() {
    const { ctx, dpr } = this
    const { x, y, z } = this.view
    const look = this.look()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const first = clamp(Math.floor(y / STEP), 0, this.pages.length - 1)
    const last = clamp(Math.floor((y + this.vh / z) / STEP), 0, this.pages.length - 1)
    const moving = this.g?.k === 'move' && this.sel ? { ids: new Set([...this.sel.strokes, ...this.sel.objects]), dx: this.g.dx, dy: this.g.dy } : null
    const darkDesk = document.documentElement.dataset.theme !== 'light'
    for (let i = first; i <= last; i++) {
      const page = this.pages[i]
      const ox = -x * z
      const oy = (this.top(i) - y) * z
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.save()
      ctx.shadowColor = darkDesk ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.13)'
      ctx.shadowBlur = 22
      ctx.shadowOffsetY = 4
      ctx.fillStyle = paperColors(look.dark).paper
      ctx.fillRect(ox, oy, PAGE_W * z, PAGE_H * z)
      ctx.restore()
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy)
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, PAGE_W, PAGE_H)
      ctx.clip()
      drawPage(ctx, page, {
        look,
        paper: this.note.paper,
        bitmaps: this.bitmaps,
        moving: moving && this.sel?.pageId === page.id ? moving : null,
        trace: this.trace,
      })
      if (this.sel && this.sel.pageId === page.id) this.drawSelection(page, moving)
      if (this.activeGraph?.pageId === page.id) {
        const g = page.objects.find((o) => o.id === this.activeGraph!.id)
        if (g && g.type === 'graph') {
          ctx.strokeStyle = look.dark ? '#ffffff' : '#000000'
          ctx.lineWidth = 2 / z
          ctx.strokeRect(g.x - 3 / z, g.y - 3 / z, g.w + 6 / z, g.h + 6 / z)
        }
      }
      ctx.restore()
      if (look.dark === false && !darkDesk) {
        // A hairline so a white page never melts into a light desk.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'
        ctx.lineWidth = 1
        ctx.strokeRect(ox + 0.5, oy + 0.5, PAGE_W * z - 1, PAGE_H * z - 1)
      }
    }
  }

  private drawSelection(page: Page, moving: { dx: number; dy: number } | null) {
    const b = this.selBox(page)
    if (!b) return
    const { ctx } = this
    const z = this.view.z
    const dx = moving?.dx ?? 0
    const dy = moving?.dy ?? 0
    ctx.save()
    ctx.strokeStyle = paperIsDark() ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)'
    ctx.lineWidth = 1.2 / z
    ctx.setLineDash([5 / z, 4 / z])
    ctx.strokeRect(b[0] + dx - 6 / z, b[1] + dy - 6 / z, b[2] - b[0] + 12 / z, b[3] - b[1] + 12 / z)
    ctx.restore()
  }

  /* ---------- Object bounds and hits ---------- */

  objBox(o: Obj): [number, number, number, number] {
    switch (o.type) {
      case 'graph':
      case 'image':
        return [o.x, o.y, o.x + o.w, o.y + o.h]
      case 'shape': {
        const r = o.size / 2 + 2
        return [Math.min(o.x1, o.x2) - r, Math.min(o.y1, o.y2) - r, Math.max(o.x1, o.x2) + r, Math.max(o.y1, o.y2) + r]
      }
      case 'text': {
        const m = this.objSizes.get(o.id)
        const lines = Math.max(1, o.text.split('\n').length)
        return [o.x, o.y, o.x + (m?.w ?? o.w), o.y + (m?.h ?? lines * o.size * 1.4 + 8)]
      }
      case 'math': {
        const m = this.objSizes.get(o.id)
        return [o.x, o.y, o.x + (m?.w ?? Math.max(40, o.latex.length * o.size * 0.5)), o.y + (m?.h ?? o.size * 1.8)]
      }
    }
  }

  private shapeHit(o: ShapeObj, x: number, y: number, r: number) {
    const R = r + o.size / 2
    if (o.shape === 'line' || o.shape === 'arrow') return segHit(x, y, o.x1, o.y1, o.x2, o.y2, R)
    if (o.shape === 'rect') {
      const [a, b, c, d] = [Math.min(o.x1, o.x2), Math.min(o.y1, o.y2), Math.max(o.x1, o.x2), Math.max(o.y1, o.y2)]
      return segHit(x, y, a, b, c, b, R) || segHit(x, y, c, b, c, d, R) || segHit(x, y, c, d, a, d, R) || segHit(x, y, a, d, a, b, R)
    }
    const cx = (o.x1 + o.x2) / 2
    const cy = (o.y1 + o.y2) / 2
    const rx = Math.abs(o.x2 - o.x1) / 2
    const ry = Math.abs(o.y2 - o.y1) / 2
    let px = cx + rx
    let py = cy
    for (let k = 1; k <= 48; k++) {
      const t = (k / 48) * Math.PI * 2
      const nx = cx + rx * Math.cos(t)
      const ny = cy + ry * Math.sin(t)
      if (segHit(x, y, px, py, nx, ny, R)) return true
      px = nx
      py = ny
    }
    return false
  }

  objectAt(page: Page, x: number, y: number, r = 6): Obj | null {
    for (let k = page.objects.length - 1; k >= 0; k--) {
      const o = page.objects[k]
      if (o.type === 'shape') {
        if (this.shapeHit(o, x, y, r)) return o
        continue
      }
      const b = this.objBox(o)
      if (x >= b[0] - r && x <= b[2] + r && y >= b[1] - r && y <= b[3] + r) return o
    }
    return null
  }

  selBox(page: Page): [number, number, number, number] | null {
    if (!this.sel) return null
    let b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
    const grow = (q: [number, number, number, number]) => {
      b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])]
    }
    for (const s of page.strokes) if (this.sel.strokes.has(s.id)) grow(strokeBox(s))
    for (const o of page.objects) if (this.sel.objects.has(o.id)) grow(this.objBox(o))
    return Number.isFinite(b[0]) ? b : null
  }

  /* ---------- History ---------- */

  private snap(p: Page): Snap {
    return { strokes: p.strokes, objects: p.objects }
  }

  private setPage(i: number, patch: Partial<Page>, objectsChanged = false) {
    const p = { ...this.pages[i], ...patch }
    this.pages[i] = savePage(p)
    this.loadImages(this.pages[i])
    if (objectsChanged || 'objects' in patch) this.host.objects()
    this.requestDraw()
  }

  private push(pageId: string, before: Snap) {
    const { page } = this.pageById(pageId)
    if (!page) return
    const after = this.snap(page)
    if (after.strokes === before.strokes && after.objects === before.objects) return
    this.undoStack.push({ pageId, before, after })
    if (this.undoStack.length > 300) this.undoStack.shift()
    this.redoStack = []
    this.emitState()
  }

  undo(): void {
    const c = this.undoStack.pop()
    if (!c) return
    const { i } = this.pageById(c.pageId)
    if (i < 0) return this.undo()
    this.redoStack.push(c)
    this.sel = null
    this.setPage(i, { ...c.before }, true)
    this.emitState()
  }

  redo() {
    const c = this.redoStack.pop()
    if (!c) return
    const { i } = this.pageById(c.pageId)
    if (i < 0) return
    this.undoStack.push(c)
    this.sel = null
    this.setPage(i, { ...c.after }, true)
    this.emitState()
  }

  beginEdit(pageId: string) {
    const { page } = this.pageById(pageId)
    if (page && !this.editSnaps.has(pageId)) this.editSnaps.set(pageId, this.snap(page))
  }

  commitEdit(pageId: string) {
    const before = this.editSnaps.get(pageId)
    this.editSnaps.delete(pageId)
    if (before) this.push(pageId, before)
  }

  /* ---------- Objects (used by the React layer) ---------- */

  addObject(pageId: string, o: Obj, select = false) {
    const { i, page } = this.pageById(pageId)
    if (!page) return
    const before = this.snap(page)
    this.setPage(i, { objects: [...page.objects, o] })
    this.push(pageId, before)
    if (select) this.select({ pageId, strokes: new Set(), objects: new Set([o.id]) })
  }

  updateObject(pageId: string, o: Obj, commit = true) {
    const { i, page } = this.pageById(pageId)
    if (!page) return
    const before = this.snap(page)
    this.setPage(i, { objects: page.objects.map((x) => (x.id === o.id ? o : x)) })
    if (commit) this.push(pageId, before)
    this.emitState()
  }

  removeObject(pageId: string, id: string, commit = true) {
    const { i, page } = this.pageById(pageId)
    if (!page) return
    const before = this.snap(page)
    this.setPage(i, { objects: page.objects.filter((x) => x.id !== id) })
    if (commit) this.push(pageId, before)
    if (this.sel?.objects.has(id)) this.select(null)
  }

  getObject(pageId: string, id: string): Obj | undefined {
    return this.pageById(pageId).page?.objects.find((o) => o.id === id)
  }

  setActiveGraph(t: { pageId: string; id: string } | null) {
    this.activeGraph = t
    this.trace = null
    this.requestDraw()
  }

  /* ---------- Selection ---------- */

  select(s: Sel | null) {
    this.sel = s && (s.strokes.size || s.objects.size) ? s : null
    this.requestDraw()
    this.emitState()
  }

  deleteSelection() {
    if (!this.sel) return
    const { i, page } = this.pageById(this.sel.pageId)
    if (!page) return
    const before = this.snap(page)
    const s = this.sel
    this.setPage(i, { strokes: page.strokes.filter((x) => !s.strokes.has(x.id)), objects: page.objects.filter((x) => !s.objects.has(x.id)) })
    this.push(page.id, before)
    if (this.activeGraph && s.objects.has(this.activeGraph.id)) this.host.edit(null)
    this.select(null)
  }

  duplicateSelection() {
    if (!this.sel) return
    const { i, page } = this.pageById(this.sel.pageId)
    if (!page) return
    const before = this.snap(page)
    const s = this.sel
    const ns = page.strokes.filter((x) => s.strokes.has(x.id)).map((x) => ({ ...translateStroke(x, 24, 24), id: sid() }))
    const no = page.objects.filter((x) => s.objects.has(x.id)).map((x) => ({ ...moveObj(x, 24, 24), id: sid() }))
    this.setPage(i, { strokes: [...page.strokes, ...ns], objects: [...page.objects, ...no] })
    this.push(page.id, before)
    this.select({ pageId: page.id, strokes: new Set(ns.map((x) => x.id)), objects: new Set(no.map((x) => x.id)) })
  }

  recolorSelection(color: string) {
    if (!this.sel) return
    const { i, page } = this.pageById(this.sel.pageId)
    if (!page) return
    const before = this.snap(page)
    const s = this.sel
    this.setPage(i, {
      strokes: page.strokes.map((x) => (s.strokes.has(x.id) && x.tool === 'pen' ? { ...x, color } : x)),
      objects: page.objects.map((x) => (s.objects.has(x.id) && (x.type === 'shape' || x.type === 'text' || x.type === 'math') ? { ...x, color } : x)),
    })
    this.push(page.id, before)
  }

  async addImage(blob: Blob) {
    const bm = await createImageBitmap(blob)
    const asset = await putAsset(blob)
    this.bitmaps.set(asset, bm)
    const c = this.toWorld(this.vw / 2, this.vh / 2)
    const i = this.pageAt(c.y)
    const scale = Math.min(1, 520 / bm.width, 640 / bm.height)
    const w = bm.width * scale
    const h = bm.height * scale
    const o: Obj = { type: 'image', id: sid(), asset, w, h, x: clamp(c.x - w / 2, 10, PAGE_W - w - 10), y: clamp(c.y - this.top(i) - h / 2, 10, PAGE_H - h - 10) }
    this.addObject(this.pages[i].id, o, true)
  }

  setPages(note: Note, pages: Page[]) {
    this.note = note
    this.pages = pages
    for (const p of pages) this.loadImages(p)
    if (this.sel && !pages.some((p) => p.id === this.sel!.pageId)) this.sel = null
    this.clampView()
    this.applyView()
  }

  replacePage(p: Page) {
    if (this.g && 'page' in this.g && this.pages[this.g.page]?.id === p.id) return
    const { i } = this.pageById(p.id)
    if (i < 0) return
    this.pages[i] = p
    this.loadImages(p)
    this.host.objects()
    this.requestDraw()
  }

  setTool(t: Tool) {
    this.tool = t
    if (t !== 'lasso') this.select(null)
    this.root.dataset.tool = t
  }

  styleFor(t: Tool): ToolStyle {
    const key = t === 'pen' || t === 'hl' || t === 'text' ? t : 'shape'
    return this.styles[key]
  }

  setStyle(t: Tool, s: Partial<ToolStyle>) {
    const key = t === 'pen' || t === 'hl' || t === 'text' ? t : 'shape'
    this.styles = { ...this.styles, [key]: { ...this.styles[key], ...s } }
    localStorage.setItem('athena.styles', JSON.stringify(this.styles))
  }

  /* ---------- State for React ---------- */

  emitState() {
    if (this.stateRaf) return
    this.stateRaf = requestAnimationFrame(() => {
      this.stateRaf = 0
      let sel: EditorState['sel'] = null
      if (this.sel) {
        const { i, page } = this.pageById(this.sel.pageId)
        const b = page && this.selBox(page)
        if (b) {
          const { x, y, z } = this.view
          const dx = this.g?.k === 'move' ? this.g.dx : 0
          const dy = this.g?.k === 'move' ? this.g.dy : 0
          const singleId = this.sel.objects.size === 1 && this.sel.strokes.size === 0 ? [...this.sel.objects][0] : null
          sel = {
            pageId: this.sel.pageId,
            count: this.sel.strokes.size + this.sel.objects.size,
            single: singleId ? (page.objects.find((o) => o.id === singleId) ?? null) : null,
            rect: { x: (b[0] + dx - x) * z, y: (b[1] + dy + this.top(i) - y) * z, w: (b[2] - b[0]) * z, h: (b[3] - b[1]) * z },
          }
        }
      }
      const c = this.toWorld(this.vw / 2, this.vh / 3)
      this.host.state({ canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0, zoom: this.view.z, sel, page: this.pageAt(c.y) })
    })
  }

  /* ---------- Pointer input ---------- */

  private penMode() {
    const p = getPrefs()
    return p.penSeen && !p.fingerDraws
  }

  private onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-ui]')) return
    if (e.pointerType === 'mouse' && e.button === 2) return
    cancelAnimationFrame(this.inertia)
    const pt = this.rel(e)
    this.pointers.set(e.pointerId, { ...pt, type: e.pointerType, t: performance.now() })
    try {
      this.root.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (e.pointerType === 'pen' && !getPrefs().penSeen) setPrefs({ penSeen: true })

    const touches = [...this.pointers.entries()].filter(([, p]) => p.type === 'touch')
    if (e.pointerType === 'touch') {
      if (touches.length >= 2) {
        // A second finger: whatever the first one started becomes a pinch.
        if (this.g && this.g.k === 'draw' && performance.now() - this.g.t0 < 260) this.cancelLive()
        else if (this.g && this.g.k === 'draw') this.finishDraw()
        else if (this.g && this.g.k === 'erase') this.finishErase()
        const [a, b] = touches
        const pa = a[1]
        const pb = b[1]
        const cx = (pa.x + pb.x) / 2
        const cy = (pa.y + pb.y) / 2
        const w = this.toWorld(cx, cy)
        this.g = { k: 'pinch', a: a[0], b: b[0], d0: Math.hypot(pa.x - pb.x, pa.y - pb.y) || 1, z0: this.view.z, wx: w.x, wy: w.y }
        return
      }
      if (this.penMode() || this.tool === 'hand') {
        this.startPan(e.pointerId, pt)
        return
      }
    }
    if (e.pointerType === 'mouse' && (e.button === 1 || this.spaceDown)) {
      this.startPan(e.pointerId, pt)
      return
    }
    if (this.g) return

    // An open graph takes the pointer: drag to move its view, tap to read off a point.
    if (this.activeGraph) {
      const { i, page } = this.pageById(this.activeGraph.pageId)
      const g = page?.objects.find((o) => o.id === this.activeGraph!.id)
      if (g && g.type === 'graph') {
        const l = this.local(pt.x, pt.y, i)
        if (l.x >= g.x && l.x <= g.x + g.w && l.y >= g.y && l.y <= g.y + g.h) {
          this.g = { k: 'graph', id: e.pointerId, page: i, obj: g.id, lx: pt.x, ly: pt.y, sx: pt.x, sy: pt.y, moved: false }
          return
        }
      }
    }

    const eraserButton = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0)
    const tool: Tool = eraserButton ? 'eraser' : this.tool
    const l = this.local(pt.x, pt.y)
    const page = this.pages[l.i]
    if (!page) return
    // Off the paper (the desk around the pages) only moves the view.
    if (tool !== 'hand' && (l.x < -4 || l.x > PAGE_W + 4 || l.y < -4 || l.y > PAGE_H + 4)) {
      this.startPan(e.pointerId, pt)
      return
    }
    // Keep focus where the editor puts it (a new text box), and end any other editing.
    e.preventDefault()
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) document.activeElement.blur()

    switch (tool) {
      case 'hand':
        this.startPan(e.pointerId, pt)
        return
      case 'pen':
      case 'hl': {
        const sim = e.pointerType !== 'pen'
        const pr = sim ? 0.5 : e.pressure || 0.5
        const edge = this.rulerEdge(l.x, l.y + this.top(l.i))
        this.g = { k: 'draw', id: e.pointerId, page: l.i, pts: [l.x, l.y, pr], sim, tool, edge, t0: performance.now() }
        this.drawLive()
        return
      }
      case 'eraser':
        this.g = { k: 'erase', id: e.pointerId, page: l.i, before: this.snap(page), changed: false }
        this.eraseAt(l.i, l.x, l.y)
        return
      case 'lasso': {
        if (this.sel && this.sel.pageId === page.id) {
          const b = this.selBox(page)
          const pad = 8 / this.view.z
          if (b && l.x >= b[0] - pad && l.x <= b[2] + pad && l.y >= b[1] - pad && l.y <= b[3] + pad) {
            this.g = { k: 'move', id: e.pointerId, page: l.i, x0: l.x, y0: l.y, dx: 0, dy: 0 }
            return
          }
        }
        this.g = { k: 'lasso', id: e.pointerId, page: l.i, poly: [l.x, l.y], sx: pt.x, sy: pt.y, moved: false }
        return
      }
      case 'line':
      case 'arrow':
      case 'rect':
      case 'ellipse': {
        const s = this.snapPt(l.x, l.y)
        this.g = { k: 'shape', id: e.pointerId, page: l.i, shape: tool, x1: s.x, y1: s.y, x2: s.x, y2: s.y }
        return
      }
      case 'text': {
        const hit = this.objectAt(page, l.x, l.y)
        if (hit && hit.type === 'text') {
          this.host.edit({ pageId: page.id, id: hit.id })
          return
        }
        const st = this.styles.text
        const o: Obj = { type: 'text', id: sid(), x: l.x, y: l.y - st.size * 0.7, w: Math.min(320, PAGE_W - l.x - 16), text: '', size: st.size, color: st.color }
        this.beginEdit(page.id)
        const before = this.editSnaps.get(page.id)!
        this.setPage(l.i, { objects: [...page.objects, o] })
        this.editSnaps.set(page.id, before)
        this.host.edit({ pageId: page.id, id: o.id })
        return
      }
      case 'math': {
        const hit = this.objectAt(page, l.x, l.y)
        if (hit && hit.type === 'math') this.host.edit({ pageId: page.id, id: hit.id })
        else this.host.requestMath(page.id, l.x, l.y)
        return
      }
      case 'graph': {
        const hit = this.objectAt(page, l.x, l.y)
        if (hit && hit.type === 'graph') {
          this.host.edit({ pageId: page.id, id: hit.id })
          return
        }
        const w = 360
        const h = 280
        const s = this.snapPt(clamp(l.x - w / 2, 10, PAGE_W - w - 10), clamp(l.y - h / 2, 10, PAGE_H - h - 10), true)
        const o: GraphObj = {
          type: 'graph',
          id: sid(),
          x: s.x,
          y: s.y,
          w,
          h,
          fns: [{ id: sid(), expr: '', color: '#2f6fde' }],
          view: { x0: -6, x1: 6, y0: -4.67, y1: 4.67 },
          show: { zeros: true, extrema: true, intersections: true },
        }
        this.addObject(page.id, o)
        this.host.edit({ pageId: page.id, id: o.id })
        return
      }
    }
  }

  private startPan(id: number, pt: { x: number; y: number }) {
    this.g = { k: 'pan', id, lx: pt.x, ly: pt.y, vx: 0, vy: 0, t: performance.now() }
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId)
    if (!p) return
    const pt = this.rel(e)
    p.x = pt.x
    p.y = pt.y
    const g = this.g
    if (!g) return
    if (g.k === 'pinch') {
      if (e.pointerId !== g.a && e.pointerId !== g.b) return
      const a = this.pointers.get(g.a)
      const b = this.pointers.get(g.b)
      if (!a || !b) return
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      this.view.z = clamp(g.z0 * (d / g.d0), 0.2, 6)
      this.view.x = g.wx - cx / this.view.z
      this.view.y = g.wy - cy / this.view.z
      this.clampView()
      this.applyView()
      return
    }
    if ('id' in g && g.id !== e.pointerId) return
    switch (g.k) {
      case 'pan': {
        const now = performance.now()
        const dx = pt.x - g.lx
        const dy = pt.y - g.ly
        const dt = Math.max(1, now - g.t)
        g.vx = g.vx * 0.6 + (dx / dt) * 0.4
        g.vy = g.vy * 0.6 + (dy / dt) * 0.4
        g.lx = pt.x
        g.ly = pt.y
        g.t = now
        this.view.x -= dx / this.view.z
        this.view.y -= dy / this.view.z
        this.clampView()
        this.applyView()
        return
      }
      case 'draw': {
        const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
        const r = this.root.getBoundingClientRect()
        for (const ev of evs.length ? evs : [e]) {
          const l = this.local(ev.clientX - r.left, ev.clientY - r.top, g.page)
          const pr = g.sim ? 0.5 : ev.pressure || 0.5
          const n = g.pts.length
          if (Math.hypot(l.x - g.pts[n - 3], l.y - g.pts[n - 2]) < 0.35 / this.view.z) continue
          g.pts.push(l.x, l.y, pr)
        }
        this.drawLive()
        return
      }
      case 'erase': {
        const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e]
        const r = this.root.getBoundingClientRect()
        for (const ev of evs.length ? evs : [e]) {
          const l = this.local(ev.clientX - r.left, ev.clientY - r.top, g.page)
          this.eraseAt(g.page, l.x, l.y)
        }
        this.drawEraserCursor(pt.x, pt.y)
        return
      }
      case 'lasso': {
        const l = this.local(pt.x, pt.y, g.page)
        g.poly.push(l.x, l.y)
        if (Math.hypot(pt.x - g.sx, pt.y - g.sy) > 6) g.moved = true
        this.drawLasso(g)
        return
      }
      case 'move': {
        const l = this.local(pt.x, pt.y, g.page)
        g.dx = l.x - g.x0
        g.dy = l.y - g.y0
        this.moveDomObjects(g.dx, g.dy)
        this.requestDraw()
        this.emitState()
        return
      }
      case 'shape': {
        const l = this.local(pt.x, pt.y, g.page)
        let s = this.snapPt(l.x, l.y)
        if (e.shiftKey && (g.shape === 'line' || g.shape === 'arrow')) {
          // Shift: lock to 15° steps.
          const a = Math.round(Math.atan2(s.y - g.y1, s.x - g.x1) / (Math.PI / 12)) * (Math.PI / 12)
          const d = Math.hypot(s.x - g.x1, s.y - g.y1)
          s = { x: g.x1 + d * Math.cos(a), y: g.y1 + d * Math.sin(a) }
        }
        g.x2 = s.x
        g.y2 = s.y
        this.drawShapePreview(g)
        return
      }
      case 'graph': {
        const { page } = { page: this.pages[g.page] }
        const o = page.objects.find((x) => x.id === g.obj)
        if (!o || o.type !== 'graph') return
        if (Math.hypot(pt.x - g.sx, pt.y - g.sy) > 5) g.moved = true
        if (!g.moved) return
        const dxw = (pt.x - g.lx) / this.view.z
        const dyw = (pt.y - g.ly) / this.view.z
        g.lx = pt.x
        g.ly = pt.y
        const ux = ((o.view.x1 - o.view.x0) / o.w) * dxw
        const uy = ((o.view.y1 - o.view.y0) / o.h) * dyw
        const next: GraphObj = { ...o, view: { x0: o.view.x0 - ux, x1: o.view.x1 - ux, y0: o.view.y0 + uy, y1: o.view.y1 + uy } }
        this.trace = null
        this.updateGraphQuiet(g.page, next)
        return
      }
      case 'resize': {
        const page = this.pages[g.page]
        const dx = (pt.x - g.sx) / this.view.z
        const dy = (pt.y - g.sy) / this.view.z
        const o = g.obj
        let next: Obj = o
        if (o.type === 'graph') {
          const w = Math.max(160, o.w + dx)
          const h = Math.max(120, o.h + dy)
          // Keep the scale: grow the window, not the units.
          const ux = (o.view.x1 - o.view.x0) / o.w
          const uy = (o.view.y1 - o.view.y0) / o.h
          next = { ...o, w, h, view: { x0: o.view.x0, x1: o.view.x0 + ux * w, y0: o.view.y1 - uy * h, y1: o.view.y1 } }
        } else if (o.type === 'image') {
          const w = Math.max(40, o.w + dx)
          next = { ...o, w, h: (o.h / o.w) * w }
        } else if (o.type === 'text') next = { ...o, w: Math.max(60, o.w + dx) }
        else if (o.type === 'math') next = { ...o, size: clamp(o.size * (1 + dx / 200), 10, 96) }
        const i = g.page
        this.pages[i] = { ...page, objects: page.objects.map((x) => (x.id === o.id ? next : x)) }
        this.host.objects()
        this.requestDraw()
        this.emitState()
        return
      }
    }
  }

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    const g = this.g
    if (!g) return
    if (g.k === 'pinch') {
      if (e.pointerId === g.a || e.pointerId === g.b) {
        // Continue panning with the finger that is left.
        const rest = [...this.pointers.entries()].find(([, p]) => p.type === 'touch')
        if (rest) this.startPan(rest[0], rest[1])
        else this.g = null
      }
      return
    }
    if ('id' in g && g.id !== e.pointerId) return
    this.g = null
    switch (g.k) {
      case 'pan':
        if (Math.hypot(g.vx, g.vy) > 0.25 && performance.now() - g.t < 80) this.fling(g.vx, g.vy)
        return
      case 'draw':
        this.g = g
        this.finishDraw()
        return
      case 'erase':
        this.g = g
        this.finishErase()
        return
      case 'lasso':
        this.clearLive()
        this.finishLasso(g)
        return
      case 'move':
        this.finishMove(g)
        return
      case 'shape':
        this.clearLive()
        this.finishShape(g)
        return
      case 'graph':
        if (!g.moved) this.traceAt(g.page, g.obj, this.rel(e))
        else {
          const o = this.pages[g.page].objects.find((x) => x.id === g.obj)
          if (o) this.updateObject(this.pages[g.page].id, o, false)
        }
        return
      case 'resize': {
        const page = this.pages[g.page]
        this.setPage(g.page, { objects: page.objects })
        this.push(page.id, g.before)
        return
      }
    }
  }

  private onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    if (this.g && 'id' in this.g && this.g.id === e.pointerId) {
      if (this.g.k === 'draw') this.cancelLive()
      else if (this.g.k === 'erase') this.finishErase()
      else {
        this.g = null
        this.clearLive()
      }
    } else if (this.g?.k === 'pinch') this.g = null
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const pt = this.rel(e)
    if (this.activeGraph) {
      const { i, page } = this.pageById(this.activeGraph.pageId)
      const o = page?.objects.find((x) => x.id === this.activeGraph!.id)
      if (o && o.type === 'graph') {
        const l = this.local(pt.x, pt.y, i)
        if (l.x >= o.x && l.x <= o.x + o.w && l.y >= o.y && l.y <= o.y + o.h) {
          const f = Math.exp((e.deltaY * (e.deltaMode ? 30 : 1)) / 400)
          const cx = o.view.x0 + ((l.x - o.x) / o.w) * (o.view.x1 - o.view.x0)
          const cy = o.view.y1 - ((l.y - o.y) / o.h) * (o.view.y1 - o.view.y0)
          const next: GraphObj = { ...o, view: { x0: cx + (o.view.x0 - cx) * f, x1: cx + (o.view.x1 - cx) * f, y0: cy + (o.view.y0 - cy) * f, y1: cy + (o.view.y1 - cy) * f } }
          this.trace = null
          this.updateGraphQuiet(i, next)
          this.graphSaveSoon(i)
          return
        }
      }
    }
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? this.vh : 1
    if (e.ctrlKey || e.metaKey) {
      this.zoomBy(Math.exp((-e.deltaY * k) / 300), pt.x, pt.y)
      return
    }
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
    const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY
    this.view.x += (dx * k) / this.view.z
    this.view.y += (dy * k) / this.view.z
    this.clampView()
    this.applyView()
  }

  private graphTimer = 0
  private graphSaveSoon(i: number) {
    window.clearTimeout(this.graphTimer)
    this.graphTimer = window.setTimeout(() => {
      const p = this.pages[i]
      if (p) this.setPage(i, { objects: p.objects })
    }, 400)
  }

  private updateGraphQuiet(i: number, next: GraphObj) {
    const page = this.pages[i]
    this.pages[i] = { ...page, objects: page.objects.map((x) => (x.id === next.id ? next : x)) }
    this.host.objects()
    this.requestDraw()
  }

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (e.code === 'Space') this.spaceDown = true
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) this.redo()
      else this.undo()
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      this.redo()
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) {
      e.preventDefault()
      this.deleteSelection()
    } else if (mod && e.key.toLowerCase() === 'd' && this.sel) {
      e.preventDefault()
      this.duplicateSelection()
    } else if (e.key === 'Escape') {
      this.select(null)
    } else if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault()
      this.zoomBy(1.2)
    } else if (mod && e.key === '-') {
      e.preventDefault()
      this.zoomBy(1 / 1.2)
    } else if (mod && e.key === '0') {
      e.preventDefault()
      this.fitWidth()
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') this.spaceDown = false
  }

  private fling(vx: number, vy: number) {
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(32, now - last)
      last = now
      vx *= Math.pow(0.94, dt / 16)
      vy *= Math.pow(0.94, dt / 16)
      this.view.x -= (vx * dt) / this.view.z
      this.view.y -= (vy * dt) / this.view.z
      this.clampView()
      this.applyView()
      if (Math.hypot(vx, vy) > 0.02) this.inertia = requestAnimationFrame(step)
    }
    this.inertia = requestAnimationFrame(step)
  }

  /* ---------- Gestures: finishing ---------- */

  private livePts(g: Extract<Gesture, { k: 'draw' }>): number[] {
    if (!g.edge || g.pts.length < 6) return g.pts
    // Along the ruler: every point lands on its edge.
    const out = g.pts.slice()
    const top = this.top(g.page)
    for (let i = 0; i < out.length; i += 3) {
      const wx = out[i]
      const wy = out[i + 1] + top
      const t = (wx - g.edge.ox) * g.edge.dx + (wy - g.edge.oy) * g.edge.dy
      out[i] = g.edge.ox + t * g.edge.dx
      out[i + 1] = g.edge.oy + t * g.edge.dy - top
    }
    return out
  }

  private finishDraw() {
    const g = this.g
    if (!g || g.k !== 'draw') return
    this.g = null
    const pts = this.livePts(g)
    const st = this.styles[g.tool]
    const s: Stroke = { id: sid(), tool: g.tool, color: st.color, size: st.size, sim: g.sim, pts: pts.map((v) => Math.round(v * 10) / 10) }
    const page = this.pages[g.page]
    const before = this.snap(page)
    this.setPage(g.page, { strokes: [...page.strokes, s] })
    this.push(page.id, before)
    // Keep the live stroke on screen until the main canvas has painted it.
    requestAnimationFrame(() => this.clearLive())
  }

  private cancelLive() {
    this.g = null
    this.clearLive()
  }

  private finishErase() {
    const g = this.g
    if (!g || g.k !== 'erase') return
    this.g = null
    this.clearLive()
    if (g.changed) {
      const page = this.pages[g.page]
      this.setPage(g.page, { strokes: page.strokes, objects: page.objects })
      this.push(page.id, g.before)
    }
  }

  private eraseAt(i: number, x: number, y: number) {
    const g = this.g
    if (!g || g.k !== 'erase') return
    const page = this.pages[i]
    const r = Math.max(3, 9 / this.view.z)
    const strokes = page.strokes.filter((s) => !strokeHit(s, x, y, r))
    const objects = page.objects.filter((o) => !(o.type === 'shape' && this.shapeHit(o, x, y, r)))
    if (strokes.length !== page.strokes.length || objects.length !== page.objects.length) {
      g.changed = true
      this.pages[i] = { ...page, strokes, objects }
      if (objects.length !== page.objects.length) this.host.objects()
      this.requestDraw()
    }
  }

  private finishLasso(g: Extract<Gesture, { k: 'lasso' }>) {
    const page = this.pages[g.page]
    if (!g.moved) {
      // A tap: pick the topmost thing under the pointer.
      const [x, y] = [g.poly[0], g.poly[1]]
      const r = 8 / this.view.z
      const o = this.objectAt(page, x, y, r)
      if (o) {
        this.select({ pageId: page.id, strokes: new Set(), objects: new Set([o.id]) })
        return
      }
      for (let k = page.strokes.length - 1; k >= 0; k--) {
        if (strokeHit(page.strokes[k], x, y, r)) {
          this.select({ pageId: page.id, strokes: new Set([page.strokes[k].id]), objects: new Set() })
          return
        }
      }
      this.select(null)
      return
    }
    const poly = g.poly
    const strokes = new Set<string>()
    for (const s of page.strokes) {
      let inside = 0
      let total = 0
      for (let i = 0; i < s.pts.length; i += 6) {
        total++
        if (pointInPoly(s.pts[i], s.pts[i + 1], poly)) inside++
      }
      if (total && inside / total >= 0.6) strokes.add(s.id)
    }
    const objects = new Set<string>()
    for (const o of page.objects) {
      const b = this.objBox(o)
      if (pointInPoly((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, poly)) objects.add(o.id)
    }
    this.select({ pageId: page.id, strokes, objects })
  }

  private moveDomObjects(dx: number, dy: number) {
    if (!this.sel) return
    for (const id of this.sel.objects) {
      const el = this.layer.querySelector<HTMLElement>(`[data-obj="${id}"]`)
      if (el) el.style.translate = `${dx}px ${dy}px`
    }
  }

  private finishMove(g: Extract<Gesture, { k: 'move' }>) {
    const sel = this.sel
    this.moveDomObjects(0, 0)
    if (!sel || (Math.abs(g.dx) < 0.5 && Math.abs(g.dy) < 0.5)) {
      this.requestDraw()
      return
    }
    const page = this.pages[g.page]
    const before = this.snap(page)
    this.setPage(g.page, {
      strokes: page.strokes.map((s) => (sel.strokes.has(s.id) ? translateStroke(s, g.dx, g.dy) : s)),
      objects: page.objects.map((o) => (sel.objects.has(o.id) ? moveObj(o, g.dx, g.dy) : o)),
    })
    this.push(page.id, before)
    this.emitState()
  }

  private finishShape(g: Extract<Gesture, { k: 'shape' }>) {
    if (Math.hypot(g.x2 - g.x1, g.y2 - g.y1) < 3) return
    const st = this.styles.shape
    const o: ShapeObj = { type: 'shape', id: sid(), shape: g.shape, x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, color: st.color, size: st.size }
    this.addObject(this.pages[g.page].id, o)
  }

  startResize(e: PointerEvent, pageId: string, id: string) {
    const { i, page } = this.pageById(pageId)
    const o = page?.objects.find((x) => x.id === id)
    if (!o) return
    const pt = this.rel(e)
    this.pointers.set(e.pointerId, { ...pt, type: e.pointerType, t: performance.now() })
    try {
      this.root.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    this.g = { k: 'resize', id: e.pointerId, page: i, obj: o, sx: pt.x, sy: pt.y, before: this.snap(page) }
  }

  private traceAt(i: number, id: string, pt: { x: number; y: number }) {
    const page = this.pages[i]
    const o = page.objects.find((x) => x.id === id)
    if (!o || o.type !== 'graph') return
    const l = this.local(pt.x, pt.y, i)
    const xv = o.view.x0 + ((l.x - o.x) / o.w) * (o.view.x1 - o.view.x0)
    const yv = o.view.y1 - ((l.y - o.y) / o.h) * (o.view.y1 - o.view.y0)
    const data = graphData(o)
    // Snap to a found point (zero, extreme, intersection) when one is close.
    const tol = ((o.view.x1 - o.view.x0) / o.w) * 14
    const near = data.found.find((p) => Math.abs(p.x - xv) < tol && Math.abs(p.y - yv) < ((o.view.y1 - o.view.y0) / o.h) * 14)
    if (near) {
      this.trace = { id, x: near.x, y: near.y, label: near.label }
      this.requestDraw()
      return
    }
    let best: { x: number; y: number; label: string } | null = null
    let bd = Infinity
    for (const d of data.defs) {
      if (d.type !== 'fn') continue
      const v = d.f(xv)
      if (!Number.isFinite(v)) continue
      const dist = Math.abs(v - yv)
      if (dist < bd) {
        bd = dist
        best = { x: xv, y: v, label: d.name }
      }
    }
    this.trace = best ? { id, ...best } : null
    this.requestDraw()
  }

  /* ---------- Live layer ---------- */

  private drawLive() {
    if (this.liveRaf) return
    this.liveRaf = requestAnimationFrame(() => {
      this.liveRaf = 0
      const g = this.g
      if (!g || g.k !== 'draw') return
      const { lctx, dpr } = this
      const { x, y, z } = this.view
      lctx.setTransform(1, 0, 0, 1, 0, 0)
      lctx.clearRect(0, 0, this.live.width, this.live.height)
      lctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * -x * z, dpr * (this.top(g.page) - y) * z)
      const st = this.styles[g.tool]
      const outline = getStroke(pointsOf(this.livePts(g)), { ...strokeOptions({ tool: g.tool, size: st.size, sim: g.sim }, getPrefs().pressure), last: false })
      lctx.globalAlpha = g.tool === 'hl' ? 0.42 : 1
      lctx.fillStyle = g.tool === 'hl' ? st.color : inkColor(st.color, paperIsDark())
      lctx.fill(outlineToPath(outline))
      lctx.globalAlpha = 1
    })
  }

  private clearLive() {
    this.lctx.setTransform(1, 0, 0, 1, 0, 0)
    this.lctx.clearRect(0, 0, this.live.width, this.live.height)
  }

  private drawEraserCursor(sx: number, sy: number) {
    const { lctx, dpr } = this
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    lctx.clearRect(0, 0, this.vw, this.vh)
    lctx.strokeStyle = 'rgba(128,128,128,0.9)'
    lctx.lineWidth = 1.2
    lctx.beginPath()
    lctx.arc(sx, sy, 9, 0, Math.PI * 2)
    lctx.stroke()
  }

  private drawLasso(g: Extract<Gesture, { k: 'lasso' }>) {
    const { lctx, dpr } = this
    const { x, y, z } = this.view
    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.clearRect(0, 0, this.live.width, this.live.height)
    lctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * -x * z, dpr * (this.top(g.page) - y) * z)
    lctx.strokeStyle = paperIsDark() ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.65)'
    lctx.fillStyle = paperIsDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
    lctx.lineWidth = 1.4 / z
    lctx.setLineDash([6 / z, 5 / z])
    lctx.beginPath()
    for (let i = 0; i < g.poly.length; i += 2) (i ? lctx.lineTo : lctx.moveTo).call(lctx, g.poly[i], g.poly[i + 1])
    lctx.closePath()
    lctx.fill()
    lctx.stroke()
    lctx.setLineDash([])
  }

  private drawShapePreview(g: Extract<Gesture, { k: 'shape' }>) {
    const { lctx, dpr } = this
    const { x, y, z } = this.view
    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.clearRect(0, 0, this.live.width, this.live.height)
    lctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * -x * z, dpr * (this.top(g.page) - y) * z)
    const st = this.styles.shape
    drawShapeRaw(lctx, g.shape, g.x1, g.y1, g.x2, g.y2, st.size, inkColor(st.color, paperIsDark()))
    // Measurements, in squares and degrees, like a protractor would show.
    const dx = (g.x2 - g.x1) / GRID
    const dy = (g.y1 - g.y2) / GRID
    let label: string
    if (g.shape === 'line' || g.shape === 'arrow') {
      const len = Math.hypot(dx, dy)
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI
      if (ang < 0) ang += 360
      label = `${fmtShort(len)} rutor · ${fmtShort(Math.round(ang * 10) / 10)}°`
    } else label = `${fmtShort(Math.abs(dx))} × ${fmtShort(Math.abs(dy))} rutor`
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sx = (g.x2 - x) * z + 14
    const sy = (g.y2 + this.top(g.page) - y) * z - 14
    lctx.font = '600 12px Inter Variable, Inter, system-ui, sans-serif'
    const w = lctx.measureText(label).width
    lctx.fillStyle = 'rgba(0,0,0,0.78)'
    lctx.beginPath()
    lctx.roundRect(sx - 8, sy - 15, w + 16, 24, 12)
    lctx.fill()
    lctx.fillStyle = '#fff'
    lctx.textBaseline = 'middle'
    lctx.fillText(label, sx, sy - 3)
  }

  /* ---------- Snapping ---------- */

  snapPt(x: number, y: number, force = false) {
    if (!getPrefs().snap && !force) return { x, y }
    const s = GRID / 2
    return { x: Math.round(x / s) * s, y: Math.round(y / s) * s }
  }

  /** If a pen stroke starts along the ruler's edge, return that edge (world coordinates). */
  private rulerEdge(wx: number, wy: number) {
    if (!this.ruler.on) return null
    const { x, y, a } = this.ruler
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const u = (wx - x) * dx + (wy - y) * dy
    const v = -(wx - x) * dy + (wy - y) * dx
    const L = RULER_LEN / 2
    if (Math.abs(u) > L + 10) return null
    const tol = 16 / this.view.z
    for (const side of [-RULER_W / 2, RULER_W / 2]) {
      if (Math.abs(v - side) < tol) {
        const off = side + (side < 0 ? -1.5 : 1.5)
        return { ox: x - dy * off, oy: y + dx * off, dx, dy }
      }
    }
    return null
  }
}

export const RULER_LEN = 600
export const RULER_W = 66

export function moveObj(o: Obj, dx: number, dy: number): Obj {
  if (o.type === 'shape') return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy }
  return { ...o, x: o.x + dx, y: o.y + dy }
}
