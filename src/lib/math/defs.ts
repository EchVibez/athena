import { compile, MathError, parse, usesVar, type Node, type Scope } from './expr'

/* What a line typed into a graph means: a function, a vertical line, a point or a constant. */

export type Def =
  | { type: 'fn'; name: string; label: string; f: (x: number) => number }
  | { type: 'vline'; label: string; x: number }
  | { type: 'point'; label: string; x: number; y: number }
  | { type: 'var'; label: string; name: string; value: number }
  | { type: 'empty' }
  | { type: 'error'; msg: string }

const FN_NAMES = ['f', 'g', 'h', 'p', 'q', 'r', 's', 'k', 'm', 'n']

interface Raw {
  kind: 'fn' | 'vline' | 'point' | 'var' | 'empty'
  name?: string
  rhs: string
  explicitName: boolean
}

function classify(src: string): Raw {
  const s = src.trim()
  if (!s) return { kind: 'empty', rhs: '', explicitName: false }
  let m = s.match(/^([\p{L}][\p{L}\p{N}_]*)\s*\(\s*x\s*\)\s*=\s*(.+)$/u)
  if (m) return { kind: 'fn', name: m[1], rhs: m[2], explicitName: true }
  m = s.match(/^y\s*=\s*(.+)$/)
  if (m) return { kind: 'fn', rhs: m[1], explicitName: false }
  m = s.match(/^x\s*=\s*(.+)$/)
  if (m) return { kind: 'vline', rhs: m[1], explicitName: false }
  m = s.match(/^([\p{Lu}][\p{L}\p{N}_]*)\s*=\s*(\(.+\))$/u)
  if (m) return { kind: 'point', name: m[1], rhs: m[2], explicitName: true }
  if (/^\(.+\)$/.test(s) && /[;,]\s/.test(s)) return { kind: 'point', rhs: s, explicitName: false }
  if (/^\(.+;.+\)$/.test(s)) return { kind: 'point', rhs: s, explicitName: false }
  m = s.match(/^([\p{L}][\p{L}\p{N}_]*)\s*=\s*(.+)$/u)
  if (m && m[1] !== 'x' && m[1] !== 'y') return { kind: 'var', name: m[1], rhs: m[2], explicitName: true }
  return { kind: 'fn', rhs: s, explicitName: false }
}

export function defineAll(lines: string[], opts: { deg?: boolean } = {}): Def[] {
  const raws = lines.map(classify)
  const used = new Set(raws.filter((r) => r.kind === 'fn' && r.name).map((r) => r.name!))
  let auto = 0
  for (const r of raws) {
    if (r.kind === 'fn' && !r.name) {
      while (used.has(FN_NAMES[auto] ?? `f${auto}`)) auto++
      r.name = FN_NAMES[auto] ?? `f${auto}`
      used.add(r.name)
    }
  }
  const scope: Scope = { vars: {}, fns: {}, deg: opts.deg }
  // Functions may call each other; bind them through a table filled in below.
  const table: Record<string, (x: number) => number> = {}
  for (const r of raws) if (r.kind === 'fn' && r.name) scope.fns[r.name] = (x) => (table[r.name!] ? table[r.name!](x) : NaN)

  // Constants first (a = 2), so functions can use them.
  const out: Def[] = raws.map(() => ({ type: 'empty' }) as Def)
  raws.forEach((r, i) => {
    if (r.kind !== 'var') return
    try {
      const node = parse(r.rhs, scope)
      if (usesVar(node, 'x')) throw new MathError('En konstant kan inte bero på x')
      const v = compile(node, scope)(0)
      scope.vars[r.name!] = v
      out[i] = { type: 'var', label: r.name!, name: r.name!, value: v }
    } catch (e) {
      out[i] = { type: 'error', msg: (e as Error).message }
    }
  })

  raws.forEach((r, i) => {
    if (r.kind === 'var' || r.kind === 'empty') return
    try {
      if (r.kind === 'fn') {
        const node: Node = parse(r.rhs, scope)
        const f = compile(node, scope)
        table[r.name!] = f
        out[i] = { type: 'fn', name: r.name!, label: `${r.name}(x)`, f }
      } else if (r.kind === 'vline') {
        const v = compile(parse(r.rhs, scope), scope)(0)
        out[i] = { type: 'vline', label: `x = ${r.rhs}`, x: v }
      } else if (r.kind === 'point') {
        const node = parse(r.rhs, scope)
        if (node.k !== 'tuple' || node.items.length !== 2) throw new MathError('Skriv en punkt som (2; 3) eller (2, 3)')
        const x = compile(node.items[0], scope)(0)
        const y = compile(node.items[1], scope)(0)
        out[i] = { type: 'point', label: r.name ?? '', x, y }
      }
    } catch (e) {
      out[i] = { type: 'error', msg: (e as Error).message }
    }
  })
  return out
}

/* ---------- The calculator ---------- */

export interface CalcState {
  vars: Record<string, number>
  fnSrc: Record<string, string>
  ans: number
}

export function newCalc(): CalcState {
  return { vars: {}, fnSrc: {}, ans: 0 }
}

export function calc(line: string, st: CalcState, deg: boolean): { text: string; value?: number } {
  const s = line.trim()
  if (!s) return { text: '' }
  const scope: Scope = { vars: { ...st.vars, ans: st.ans }, fns: {}, deg }
  for (const [name, src] of Object.entries(st.fnSrc)) {
    const f = compile(parse(src, scope), scope)
    scope.fns[name] = f
  }
  let m = s.match(/^([\p{L}][\p{L}\p{N}_]*)\s*\(\s*x\s*\)\s*=\s*(.+)$/u)
  if (m) {
    parse(m[2], { ...scope, fns: { ...scope.fns, [m[1]]: () => 0 } })
    st.fnSrc[m[1]] = m[2]
    return { text: `${m[1]}(x) = ${m[2]}` }
  }
  m = s.match(/^([\p{L}][\p{L}\p{N}_]*)\s*=\s*(.+)$/u)
  if (m && m[1] !== 'x') {
    const v = compile(parse(m[2], scope), scope)(0)
    st.vars[m[1]] = v
    st.ans = v
    return { text: `${m[1]} = `, value: v }
  }
  const node = parse(s, scope)
  const v = compile(node, scope)(st.vars.x ?? 0)
  st.ans = v
  return { text: '', value: v }
}
