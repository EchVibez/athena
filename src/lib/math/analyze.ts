/* Numerical analysis for the graphs: zeros, extreme points and intersections, the way
   GeoGebra's Nollställe/Extrempunkt/Skärning tools work, found by sampling and refining. */

export interface Found {
  x: number
  y: number
  kind: 'zero' | 'max' | 'min' | 'cross'
}

const N = 1200

function bisect(f: (x: number) => number, a: number, b: number): number | null {
  let fa = f(a)
  let fb = f(b)
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null
  if (fa === 0) return a
  if (fb === 0) return b
  if (fa * fb > 0) return null
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2
    const fm = f(m)
    if (!Number.isFinite(fm)) return null
    if (fa * fm <= 0) {
      b = m
      fb = fm
    } else {
      a = m
      fa = fm
    }
  }
  return (a + b) / 2
}

/** Golden-section search for a local minimum of g on [a, b]. */
function goldenMin(g: (x: number) => number, a: number, b: number) {
  const r = (Math.sqrt(5) - 1) / 2
  let c = b - r * (b - a)
  let d = a + r * (b - a)
  for (let i = 0; i < 90; i++) {
    if (g(c) < g(d)) b = d
    else a = c
    c = b - r * (b - a)
    d = a + r * (b - a)
  }
  return (a + b) / 2
}

function dedupe(list: Found[], tol: number) {
  const out: Found[] = []
  for (const p of list.sort((a, b) => a.x - b.x)) {
    if (!out.some((q) => q.kind === p.kind && Math.abs(q.x - p.x) < tol)) out.push(p)
  }
  return out
}

export function zeros(f: (x: number) => number, x0: number, x1: number, kind: Found['kind'] = 'zero', yOf?: (x: number) => number): Found[] {
  const out: Found[] = []
  const h = (x1 - x0) / N
  const tol = h * 2
  let px = x0
  let pv = f(x0)
  for (let i = 1; i <= N; i++) {
    const x = x0 + i * h
    const v = f(x)
    if (Number.isFinite(v) && Number.isFinite(pv)) {
      if (v === 0) out.push({ x, y: 0, kind })
      else if (pv * v < 0) {
        // A sign change across a jump (tan, 1/x) is not a zero.
        const r = bisect(f, px, x)
        if (r !== null && Math.abs(f(r)) < 1e-6 * (1 + Math.abs(pv) + Math.abs(v))) out.push({ x: r, y: 0, kind })
      }
    }
    px = x
    pv = v
  }
  // Touching zeros (x² at 0): a local minimum of |f| that reaches 0.
  const g = (x: number) => Math.abs(f(x))
  for (let i = 1; i < N; i++) {
    const a = x0 + (i - 1) * h
    const b = x0 + (i + 1) * h
    const m = x0 + i * h
    const gm = g(m)
    if (gm < g(a) && gm <= g(b)) {
      const x = goldenMin(g, a, b)
      const scale = 1e-7 * (1 + Math.abs(f(a)) + Math.abs(f(b)))
      if (g(x) < scale) out.push({ x, y: 0, kind })
    }
  }
  return dedupe(out, tol).map((p) => ({ ...p, y: yOf ? yOf(p.x) : 0 }))
}

export function extrema(f: (x: number) => number, x0: number, x1: number): Found[] {
  const out: Found[] = []
  const h = (x1 - x0) / N
  for (let i = 1; i < N; i++) {
    const a = x0 + (i - 1) * h
    const m = x0 + i * h
    const b = x0 + (i + 1) * h
    const fa = f(a)
    const fm = f(m)
    const fb = f(b)
    if (![fa, fm, fb].every(Number.isFinite)) continue
    if (fm > fa && fm >= fb) {
      const x = goldenMin((t) => -f(t), a, b)
      out.push({ x, y: f(x), kind: 'max' })
    } else if (fm < fa && fm <= fb) {
      const x = goldenMin(f, a, b)
      out.push({ x, y: f(x), kind: 'min' })
    }
  }
  // Flat stretches (constant functions) produce no extreme points.
  return dedupe(out, h * 2).filter((p) => {
    const d = Math.abs(f(p.x + h * 3) - p.y) + Math.abs(f(p.x - h * 3) - p.y)
    return d > 1e-9 * (1 + Math.abs(p.y))
  })
}

export function intersections(f: (x: number) => number, g: (x: number) => number, x0: number, x1: number): Found[] {
  return zeros((x) => f(x) - g(x), x0, x1, 'cross', f)
}
