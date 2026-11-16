/* A small expression language for the calculator and the graphs.
   Swedish habits are welcome: 3,5 is a decimal number, ; separates arguments,
   · × ÷ − ² ³ √ π work, and 2x, 3(x+1), sin x are understood. */

export type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; n: string }
  | { k: 'call'; f: string; args: Node[] }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { k: 'neg'; a: Node }
  | { k: 'fact'; a: Node }
  | { k: 'abs'; a: Node }
  | { k: 'tuple'; items: Node[] }

type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }

export class MathError extends Error {}

const FUNCS: Record<string, number> = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, arcsin: 1, arccos: 1, arctan: 1,
  sinh: 1, cosh: 1, tanh: 1, sqrt: 1, rot: 1, cbrt: 1, ln: 1, log: -1, lg: 1, exp: 1,
  abs: 1, floor: 1, ceil: 1, round: -1, sign: 1, sgn: 1, min: -1, max: -1, nroot: 2,
}
const CONSTS: Record<string, number> = { pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI * 2 }

export const isFunc = (n: string) => n in FUNCS

const SUP: Record<string, string> = { '²': '2', '³': '3', '¹': '1', '⁰': '0', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }

function tokenize(src: string, known: Set<string>): Tok[] {
  const s = src.replace(/−/g, '-').replace(/[·×∙]/g, '*').replace(/÷/g, '/').replace(/≈/g, '=')
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let j = i
      while (j < s.length && /[0-9]/.test(s[j])) j++
      if ((s[j] === '.' || s[j] === ',') && /[0-9]/.test(s[j + 1] ?? '')) {
        j++
        while (j < s.length && /[0-9]/.test(s[j])) j++
      }
      // 1.5e-3 (only when the e is directly followed by a number)
      if ((s[j] === 'e' || s[j] === 'E') && /^[eE][+-]?[0-9]/.test(s.slice(j, j + 3))) {
        j++
        if (s[j] === '+' || s[j] === '-') j++
        while (j < s.length && /[0-9]/.test(s[j])) j++
      }
      out.push({ t: 'num', v: parseFloat(s.slice(i, j).replace(',', '.')) })
      i = j
      continue
    }
    if (c in SUP) {
      let j = i
      let d = ''
      while (j < s.length && s[j] in SUP) d += SUP[s[j++]]
      out.push({ t: 'op', v: '^' }, { t: 'num', v: parseInt(d, 10) })
      i = j
      continue
    }
    if (/[\p{L}_]/u.test(c)) {
      let j = i
      while (j < s.length && /[\p{L}\p{N}_]/u.test(s[j]) && !(s[j] in SUP)) j++
      const w = s.slice(i, j)
      i = j
      for (const part of splitWord(w, known)) out.push({ t: 'id', v: part })
      continue
    }
    if (c === '√') {
      out.push({ t: 'id', v: 'sqrt' })
      i++
      continue
    }
    if ('+-*/^()[]|!,;=%'.includes(c)) {
      out.push({ t: 'op', v: c === '[' ? '(' : c === ']' ? ')' : c })
      i++
      continue
    }
    throw new MathError(`Okänt tecken "${c}"`)
  }
  return out
}

function splitWord(w: string, known: Set<string>): string[] {
  const lw = w.toLowerCase()
  if (known.has(w) || lw in FUNCS || w in CONSTS || lw === 'pi' || lw === 'ans') return [lw in FUNCS || lw === 'pi' || lw === 'ans' ? lw : w]
  // sinx, cos2x, lnx: a function name followed by more letters
  for (let n = Math.min(6, w.length - 1); n >= 2; n--) {
    const pre = lw.slice(0, n)
    if (pre in FUNCS) return [pre, ...splitWord(w.slice(n), known)]
  }
  if (/^\d/.test(w)) return [w]
  // Unknown run of letters: one variable per letter, as in maths (xy = x·y).
  return [...w].flatMap((ch) => (/\p{N}/u.test(ch) ? [] : [ch]))
}

class Parser {
  i = 0
  absDepth = 0
  constructor(
    private toks: Tok[],
    private known: Set<string>,
  ) {}

  peek() {
    return this.toks[this.i]
  }
  isOp(v: string) {
    const t = this.toks[this.i]
    return !!t && t.t === 'op' && t.v === v
  }
  eat(v: string) {
    if (!this.isOp(v)) throw new MathError(`Förväntade "${v}"`)
    this.i++
  }

  parse(): Node {
    const n = this.expr()
    if (this.i < this.toks.length) {
      const t = this.toks[this.i]
      throw new MathError(`Oväntat "${t.t === 'num' ? t.v : t.v}"`)
    }
    return n
  }

  expr(): Node {
    let a = this.term()
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as any).v as '+' | '-'
      a = { k: 'bin', op, a, b: this.term() }
    }
    return a
  }

  startsOperand(): boolean {
    const t = this.peek()
    if (!t) return false
    if (t.t === 'num' || t.t === 'id') return true
    return t.v === '(' || (t.v === '|' && this.absDepth === 0)
  }

  term(): Node {
    let a = this.unary()
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.i++] as any).v as '*' | '/'
        a = { k: 'bin', op, a, b: this.unary() }
      } else if (this.isOp('%')) {
        this.i++
        a = { k: 'bin', op: '/', a, b: { k: 'num', v: 100 } }
      } else if (this.startsOperand()) {
        a = { k: 'bin', op: '*', a, b: this.power() }
      } else break
    }
    return a
  }

  unary(): Node {
    if (this.isOp('-')) {
      this.i++
      return { k: 'neg', a: this.unary() }
    }
    if (this.isOp('+')) {
      this.i++
      return this.unary()
    }
    return this.power()
  }

  power(): Node {
    const base = this.postfix()
    if (this.isOp('^')) {
      this.i++
      return { k: 'bin', op: '^', a: base, b: this.unary() }
    }
    return base
  }

  postfix(): Node {
    let a = this.primary()
    while (this.isOp('!')) {
      this.i++
      a = { k: 'fact', a }
    }
    return a
  }

  args(): Node[] {
    this.eat('(')
    const list: Node[] = []
    if (this.isOp(')')) {
      this.i++
      return list
    }
    for (;;) {
      list.push(this.expr())
      if (this.isOp(';') || this.isOp(',')) {
        this.i++
        continue
      }
      this.eat(')')
      return list
    }
  }

  primary(): Node {
    const t = this.peek()
    if (!t) throw new MathError('Uttrycket tar slut för tidigt')
    if (t.t === 'num') {
      this.i++
      return { k: 'num', v: t.v }
    }
    if (t.t === 'id') {
      this.i++
      const name = t.v
      const isF = name in FUNCS || (this.known.has(name) && this.knownFn(name))
      if (isF) {
        if (this.isOp('(')) {
          const args = this.args()
          return { k: 'call', f: name, args }
        }
        // sin x, √2, ln 5
        return { k: 'call', f: name, args: [this.power()] }
      }
      if (name in CONSTS || name === 'pi') return { k: 'num', v: CONSTS[name] ?? Math.PI }
      return { k: 'var', n: name }
    }
    if (t.v === '(') {
      this.i++
      const first = this.expr()
      if (this.isOp(';') || this.isOp(',')) {
        const items = [first]
        while (this.isOp(';') || this.isOp(',')) {
          this.i++
          items.push(this.expr())
        }
        this.eat(')')
        return { k: 'tuple', items }
      }
      this.eat(')')
      return first
    }
    if (t.v === '|') {
      this.i++
      this.absDepth++
      const a = this.expr()
      this.absDepth--
      this.eat('|')
      return { k: 'abs', a }
    }
    throw new MathError(`Oväntat "${t.v}"`)
  }

  knownFn(name: string) {
    return this.fnNames.has(name)
  }
  fnNames = new Set<string>()
}

export interface Scope {
  vars: Record<string, number>
  fns: Record<string, (x: number) => number>
  deg?: boolean
}

export function parse(src: string, scope?: Partial<Scope>): Node {
  const known = new Set<string>([...Object.keys(scope?.vars ?? {}), ...Object.keys(scope?.fns ?? {})])
  const p = new Parser(tokenize(src, known), known)
  p.fnNames = new Set(Object.keys(scope?.fns ?? {}))
  return p.parse()
}

function fact(n: number) {
  if (n < 0 || !Number.isInteger(n)) return gamma(n + 1)
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
  z -= 1
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  let x = c[0]
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i)
  const t = z + g + 0.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
}

/** Turn a tree into a fast function of x (and the scope). */
export function compile(node: Node, scope: Partial<Scope> = {}): (x: number) => number {
  const vars = scope.vars ?? {}
  const fns = scope.fns ?? {}
  const D = scope.deg ? Math.PI / 180 : 1
  const R = scope.deg ? 180 / Math.PI : 1
  const c = (n: Node): ((x: number) => number) => {
    switch (n.k) {
      case 'num': {
        const v = n.v
        return () => v
      }
      case 'var': {
        if (n.n === 'x') return (x) => x
        if (n.n in vars) {
          const name = n.n
          return () => vars[name]
        }
        if (n.n === 't') return (x) => x
        throw new MathError(`Okänd variabel "${n.n}"`)
      }
      case 'neg': {
        const a = c(n.a)
        return (x) => -a(x)
      }
      case 'abs': {
        const a = c(n.a)
        return (x) => Math.abs(a(x))
      }
      case 'fact': {
        const a = c(n.a)
        return (x) => fact(a(x))
      }
      case 'tuple':
        throw new MathError('En punkt kan inte räknas som ett tal')
      case 'bin': {
        const a = c(n.a)
        const b = c(n.b)
        switch (n.op) {
          case '+':
            return (x) => a(x) + b(x)
          case '-':
            return (x) => a(x) - b(x)
          case '*':
            return (x) => a(x) * b(x)
          case '/':
            return (x) => a(x) / b(x)
          case '^':
            return (x) => {
              const base = a(x)
              const ex = b(x)
              // Real odd roots of negatives: (-8)^(1/3) = -2
              if (base < 0 && !Number.isInteger(ex)) {
                const inv = 1 / ex
                if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) return -Math.pow(-base, ex)
              }
              return Math.pow(base, ex)
            }
        }
      }
      // falls through (unreachable)
      case 'call': {
        const call = n as Extract<Node, { k: 'call' }>
        const args = call.args.map(c)
        const f = call.f
        if (f in fns) {
          const g = fns[f]
          const a0 = args[0]
          if (!a0) throw new MathError(`${f}( ) behöver ett värde`)
          return (x) => g(a0(x))
        }
        const a = args[0]
        const b = args[1]
        const need = (k: number) => {
          if (args.length < k) throw new MathError(`${f} behöver ${k === 1 ? 'ett värde' : k + ' värden'}`)
        }
        need(1)
        switch (f) {
          case 'sin':
            return (x) => Math.sin(a(x) * D)
          case 'cos':
            return (x) => Math.cos(a(x) * D)
          case 'tan':
            return (x) => Math.tan(a(x) * D)
          case 'asin':
          case 'arcsin':
            return (x) => Math.asin(a(x)) * R
          case 'acos':
          case 'arccos':
            return (x) => Math.acos(a(x)) * R
          case 'atan':
          case 'arctan':
            return (x) => Math.atan(a(x)) * R
          case 'sinh':
            return (x) => Math.sinh(a(x))
          case 'cosh':
            return (x) => Math.cosh(a(x))
          case 'tanh':
            return (x) => Math.tanh(a(x))
          case 'sqrt':
          case 'rot':
            return (x) => Math.sqrt(a(x))
          case 'cbrt':
            return (x) => Math.cbrt(a(x))
          case 'nroot':
            need(2)
            return (x) => {
              const v = a(x)
              const k = b(x)
              return v < 0 && Math.round(k) % 2 === 1 ? -Math.pow(-v, 1 / k) : Math.pow(v, 1 / k)
            }
          case 'ln':
            return (x) => Math.log(a(x))
          case 'lg':
            return (x) => Math.log10(a(x))
          case 'log':
            if (b) return (x) => Math.log(b(x)) / Math.log(a(x))
            return (x) => Math.log10(a(x))
          case 'exp':
            return (x) => Math.exp(a(x))
          case 'abs':
            return (x) => Math.abs(a(x))
          case 'floor':
            return (x) => Math.floor(a(x))
          case 'ceil':
            return (x) => Math.ceil(a(x))
          case 'round':
            if (b) return (x) => Math.round(a(x) * 10 ** b(x)) / 10 ** b(x)
            return (x) => Math.round(a(x))
          case 'sign':
          case 'sgn':
            return (x) => Math.sign(a(x))
          case 'min':
            return (x) => Math.min(...args.map((g) => g(x)))
          case 'max':
            return (x) => Math.max(...args.map((g) => g(x)))
        }
        throw new MathError(`Okänd funktion "${f}"`)
      }
    }
  }
  return c(node)
}

export function usesVar(node: Node, name: string): boolean {
  switch (node.k) {
    case 'var':
      return node.n === name
    case 'num':
      return false
    case 'neg':
    case 'abs':
    case 'fact':
      return usesVar(node.a, name)
    case 'bin':
      return usesVar(node.a, name) || usesVar(node.b, name)
    case 'call':
      return node.args.some((a) => usesVar(a, name))
    case 'tuple':
      return node.items.some((a) => usesVar(a, name))
  }
}

/* ---------- Number formatting (Swedish) ---------- */

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) =>
  String(n)
    .split('')
    .map((d) => (d === '-' ? '⁻' : SUPS[+d]))
    .join('')

export function fmt(v: number, sig = 8): string {
  if (Number.isNaN(v)) return 'odefinierat'
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞'
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e9 || a < 1e-5) {
    const ex = Math.floor(Math.log10(a))
    let m = v / 10 ** ex
    m = parseFloat(m.toPrecision(Math.min(sig, 6)))
    if (Math.abs(m) >= 10) return fmt(v, sig - 1)
    return `${String(m).replace('.', ',').replace('-', '−')}·10${sup(ex)}`
  }
  let s = parseFloat(v.toPrecision(sig)).toString()
  if (s.includes('e')) s = v.toFixed(6)
  return s.replace('.', ',').replace('-', '−')
}

/** Fewer digits, for labels on a graph. */
export const fmtShort = (v: number) => fmt(Math.abs(v) < 1e-10 ? 0 : v, 4)
