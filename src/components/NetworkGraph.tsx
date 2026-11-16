import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { useEffect, useRef } from 'react'
import { neighbours, type LinkIndex } from '../lib/links'
import type { Note } from '../lib/types'
import { norm } from '../lib/util'

/* The graph view: every note a dot, every link a line, laid out by a force simulation,
   like Obsidian's. Grayscale; the kind of note shows in the dot's shape. */

interface N extends SimulationNodeDatum {
  id: string
  title: string
  kind: Note['kind']
  status?: Note['status']
  deg: number
  r: number
  focus?: boolean
}
type L = SimulationLinkDatum<N>

export function NetworkGraph({
  notes,
  idx,
  focus,
  depth = 1,
  query = '',
  onOpen,
  compact,
}: {
  notes: Note[]
  idx: LinkIndex
  focus?: string
  depth?: number
  query?: string
  onOpen: (id: string) => void
  compact?: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const sim = useRef<Simulation<N, L> | null>(null)
  const view = useRef({ x: 0, y: 0, k: compact ? 1 : 0.9 })
  const hover = useRef<string | null>(null)
  const data = useRef<{ nodes: N[]; links: L[] }>({ nodes: [], links: [] })
  const q = useRef(query)
  q.current = query
  const draw = useRef<() => void>(() => {})
  const fitted = useRef(false)
  const touched = useRef(false)
  const size = useRef({ w: 0, h: 0 })

  const fitAll = () => {
    const ns = data.current.nodes
    const { w, h } = size.current
    if (!ns.length || !w || !h) return
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const n of ns) {
      x0 = Math.min(x0, n.x! - n.r)
      x1 = Math.max(x1, n.x! + n.r)
      y0 = Math.min(y0, n.y! - n.r)
      y1 = Math.max(y1, n.y! + n.r + 16)
    }
    const pad = compact ? 24 : 80
    const k = Math.max(0.2, Math.min(compact ? 1.4 : 1.6, (w - pad * 2) / Math.max(1, x1 - x0), (h - pad * 2) / Math.max(1, y1 - y0)))
    view.current = { k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k }
  }

  // Build nodes and links; keep positions of nodes that already exist.
  useEffect(() => {
    let set = notes
    if (focus) {
      const keep = new Set([focus])
      let frontier = [focus]
      for (let d = 0; d < depth; d++) {
        const next: string[] = []
        for (const id of frontier) neighbours(idx, id).forEach((n) => !keep.has(n) && (keep.add(n), next.push(n)))
        frontier = next
      }
      set = notes.filter((n) => keep.has(n.id))
    }
    const ids = new Set(set.map((n) => n.id))
    const old = new Map(data.current.nodes.map((n) => [n.id, n]))
    const nodes: N[] = set.map((n) => {
      const deg = neighbours(idx, n.id).size
      const o = old.get(n.id)
      return {
        id: n.id,
        title: n.title,
        kind: n.kind,
        status: n.status,
        deg,
        r: (n.kind === 'sammanfattning' ? 7 : 4.2) + Math.sqrt(deg) * 1.9,
        focus: n.id === focus,
        x: o?.x ?? (Math.random() - 0.5) * 200,
        y: o?.y ?? (Math.random() - 0.5) * 200,
        vx: o?.vx,
        vy: o?.vy,
      }
    })
    const links: L[] = []
    idx.out.forEach((targets, from) => {
      if (!ids.has(from)) return
      targets.forEach((to) => ids.has(to) && links.push({ source: from, target: to }))
    })
    data.current = { nodes, links }
    sim.current?.stop()
    fitted.current = old.size > 0 && fitted.current
    const s = forceSimulation<N, L>(nodes)
      .force(
        'link',
        forceLink<N, L>(links)
          .id((d) => d.id)
          .distance(compact ? 52 : 92)
          .strength(0.4),
      )
      .force('charge', forceManyBody<N>().strength(compact ? -150 : -340).distanceMax(600))
      .force('collide', forceCollide<N>((d) => d.r + (compact ? 8 : 14)))
      .force('x', forceX<N>(0).strength(0.035))
      .force('y', forceY<N>(0).strength(0.045))
      .alpha(old.size ? 0.4 : 1)
      .alphaDecay(0.028)
      .on('tick', () => {
        // Once the layout has mostly settled, zoom so that everything fits (unless the user moved).
        if (!fitted.current && !touched.current && s.alpha() < 0.12) {
          fitted.current = true
          fitAll()
        }
        draw.current()
      })
    if (focus) {
      const f = nodes.find((n) => n.id === focus)
      if (f) {
        f.fx = 0
        f.fy = 0
      }
    }
    sim.current = s
    return () => {
      s.stop()
    }
  }, [notes, idx, focus, depth, compact])

  useEffect(() => draw.current(), [query])

  useEffect(() => {
    const canvas = cv.current!
    const box = wrap.current!
    const ctx = canvas.getContext('2d')!
    let w = 0
    let h = 0
    let dpr = 1
    const fit = () => {
      const r = box.getBoundingClientRect()
      w = r.width
      h = r.height
      size.current = { w, h }
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      draw.current()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(box)

    draw.current = () => {
      const css = getComputedStyle(document.documentElement)
      const fg = css.getPropertyValue('--fg').trim() || '#fff'
      const g1 = css.getPropertyValue('--g1').trim() || '#aaa'
      const g2 = css.getPropertyValue('--g2').trim() || '#777'
      const g3 = css.getPropertyValue('--g3').trim() || '#555'
      const bg = css.getPropertyValue('--bg').trim() || '#000'
      const { nodes, links } = data.current
      const v = view.current
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr * v.k, 0, 0, dpr * v.k, dpr * (w / 2 + v.x), dpr * (h / 2 + v.y))
      const hv = hover.current
      const near = hv ? new Set([hv, ...neighbours(idxRef.current, hv)]) : null
      const qq = norm(q.current.trim())
      const match = (n: N) => !qq || norm(n.title).includes(qq)
      ctx.lineWidth = 1 / v.k
      for (const l of links) {
        const a = l.source as N
        const b = l.target as N
        const lit = near && near.has(a.id) && near.has(b.id) && (a.id === hv || b.id === hv)
        ctx.strokeStyle = lit ? fg : g3
        ctx.globalAlpha = lit ? 0.9 : near || qq ? 0.25 : 0.55
        ctx.beginPath()
        ctx.moveTo(a.x!, a.y!)
        ctx.lineTo(b.x!, b.y!)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      for (const n of nodes) {
        const dim = (near && !near.has(n.id)) || !match(n)
        ctx.globalAlpha = dim ? 0.22 : 1
        const col = n.focus || n.id === hv ? fg : n.kind === 'uppgift' && n.status !== 'lost' ? g2 : g1
        ctx.beginPath()
        if (n.kind === 'uppgift') {
          const s = n.r * 0.95
          ctx.roundRect(n.x! - s, n.y! - s, s * 2, s * 2, s * 0.45)
        } else if (n.kind === 'losning') {
          const s = n.r * 1.15
          ctx.moveTo(n.x!, n.y! - s)
          ctx.lineTo(n.x! + s, n.y!)
          ctx.lineTo(n.x!, n.y! + s)
          ctx.lineTo(n.x! - s, n.y!)
          ctx.closePath()
        } else ctx.arc(n.x!, n.y!, n.r, 0, Math.PI * 2)
        if (n.kind === 'material') {
          ctx.fillStyle = bg
          ctx.fill()
          ctx.strokeStyle = col
          ctx.lineWidth = 1.8 / Math.max(0.6, v.k)
          ctx.stroke()
        } else {
          ctx.fillStyle = col
          ctx.fill()
        }
        if (n.kind === 'sammanfattning' || n.focus) {
          ctx.strokeStyle = col
          ctx.lineWidth = 1.2 / v.k
          ctx.beginPath()
          ctx.arc(n.x!, n.y!, n.r + 4, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      // Labels in screen space so they stay readable at any zoom.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = `500 ${compact ? 10.5 : 11.5}px Inter Variable, Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (const n of nodes) {
        const show = v.k > (compact ? 0.55 : 1.15) || n.id === hv || n.focus || (near && near.has(n.id)) || (qq && match(n)) || n.kind === 'sammanfattning' || n.deg >= 12
        if (!show) continue
        const dim = (near && !near.has(n.id)) || !match(n)
        const sx = w / 2 + v.x + n.x! * v.k
        const sy = h / 2 + v.y + (n.y! + n.r) * v.k + 5
        if (sx < -100 || sx > w + 100 || sy < -20 || sy > h + 20) continue
        ctx.globalAlpha = dim ? 0.3 : 1
        ctx.fillStyle = n.id === hv || n.focus ? fg : g1
        const t = n.title.length > 34 ? n.title.slice(0, 32) + '…' : n.title
        ctx.fillText(t, sx, sy)
      }
      ctx.globalAlpha = 1
    }
    fit()

    // Pan, zoom, drag nodes, open on click.
    const pts = new Map<number, { x: number; y: number }>()
    let drag: { node: N | null; id: number; sx: number; sy: number; moved: boolean } | null = null
    let pinch: { d0: number; k0: number } | null = null
    const toGraph = (cx: number, cy: number) => {
      const v = view.current
      return { x: (cx - w / 2 - v.x) / v.k, y: (cy - h / 2 - v.y) / v.k }
    }
    const nodeAt = (cx: number, cy: number) => {
      const p = toGraph(cx, cy)
      let best: N | null = null
      let bd = Infinity
      for (const n of data.current.nodes) {
        const d = Math.hypot(n.x! - p.x, n.y! - p.y)
        if (d < n.r + 8 / view.current.k && d < bd) {
          bd = d
          best = n
        }
      }
      return best
    }
    const rel = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      const p = rel(e)
      touched.current = true
      pts.set(e.pointerId, p)
      canvas.setPointerCapture(e.pointerId)
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: view.current.k }
        drag = null
        return
      }
      const node = nodeAt(p.x, p.y)
      drag = { node, id: e.pointerId, sx: p.x, sy: p.y, moved: false }
      if (node) {
        node.fx = node.x
        node.fy = node.y
        sim.current?.alphaTarget(0.25).restart()
      }
    }
    const move = (e: PointerEvent) => {
      const p = rel(e)
      const prev = pts.get(e.pointerId)
      if (prev) pts.set(e.pointerId, p)
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()]
        view.current.k = Math.max(0.15, Math.min(5, (pinch.k0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d0))
        draw.current()
        return
      }
      if (drag && drag.id === e.pointerId && prev) {
        if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 4) drag.moved = true
        if (drag.node) {
          const g = toGraph(p.x, p.y)
          drag.node.fx = g.x
          drag.node.fy = g.y
        } else {
          view.current.x += p.x - prev.x
          view.current.y += p.y - prev.y
          draw.current()
        }
        return
      }
      if (e.pointerType === 'mouse') {
        const n = nodeAt(p.x, p.y)
        const id = n?.id ?? null
        if (id !== hover.current) {
          hover.current = id
          canvas.style.cursor = id ? 'pointer' : 'grab'
          draw.current()
        }
      }
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch = null
      if (!drag || drag.id !== e.pointerId) return
      const d = drag
      drag = null
      if (d.node) {
        if (d.node.id !== focus) {
          d.node.fx = null
          d.node.fy = null
        }
        sim.current?.alphaTarget(0)
        if (!d.moved) onOpenRef.current(d.node.id)
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      touched.current = true
      const p = rel(e)
      const v = view.current
      const k = Math.max(0.15, Math.min(5, v.k * Math.exp(-e.deltaY / 400)))
      const gx = (p.x - w / 2 - v.x) / v.k
      const gy = (p.y - h / 2 - v.y) / v.k
      v.k = k
      v.x = p.x - w / 2 - gx * k
      v.y = p.y - h / 2 - gy * k
      draw.current()
    }
    const leave = () => {
      hover.current = null
      draw.current()
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('wheel', wheel, { passive: false })
    return () => {
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('wheel', wheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, focus])

  const idxRef = useRef(idx)
  idxRef.current = idx
  const onOpenRef = useRef(onOpen)
  onOpenRef.current = onOpen

  return (
    <div className={`netgraph${compact ? ' compact' : ''}`} ref={wrap}>
      <canvas ref={cv} />
    </div>
  )
}
