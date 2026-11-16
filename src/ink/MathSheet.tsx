import katex from 'katex'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Sheet } from '../components/ui'

const PALETTE: { label: string; tex: string; insert: string; back?: number }[] = [
  { label: 'a/b', tex: '\\frac{a}{b}', insert: '\\frac{}{}', back: 3 },
  { label: '√', tex: '\\sqrt{x}', insert: '\\sqrt{}', back: 1 },
  { label: 'xⁿ', tex: 'x^{n}', insert: '^{}', back: 1 },
  { label: 'xₙ', tex: 'x_{n}', insert: '_{}', back: 1 },
  { label: '·', tex: '\\cdot', insert: '\\cdot ' },
  { label: 'Δ', tex: '\\Delta', insert: '\\Delta ' },
  { label: 'π', tex: '\\pi', insert: '\\pi ' },
  { label: 'ρ', tex: '\\rho', insert: '\\rho ' },
  { label: 'μ', tex: '\\mu', insert: '\\mu ' },
  { label: 'α', tex: '\\alpha', insert: '\\alpha ' },
  { label: 'θ', tex: '\\theta', insert: '\\theta ' },
  { label: '≈', tex: '\\approx', insert: '\\approx ' },
  { label: '≤', tex: '\\le', insert: '\\le ' },
  { label: '≥', tex: '\\ge', insert: '\\ge ' },
  { label: '±', tex: '\\pm', insert: '\\pm ' },
  { label: '°', tex: '^\\circ', insert: '^\\circ ' },
  { label: 'vektor', tex: '\\vec{F}', insert: '\\vec{}', back: 1 },
  { label: 'enhet', tex: '\\text{m/s}', insert: '\\text{}', back: 1 },
  { label: '⇒', tex: '\\Rightarrow', insert: '\\Rightarrow ' },
  { label: '∞', tex: '\\infty', insert: '\\infty ' },
]

const READY: Record<string, string[]> = {
  Fysik: [
    'v = \\frac{\\Delta s}{\\Delta t}',
    'a = \\frac{\\Delta v}{\\Delta t}',
    'v = v_0 + a t',
    's = v_0 t + \\frac{a t^2}{2}',
    's = \\frac{v_0 + v}{2} \\cdot t',
    'F_R = m \\cdot a',
    'F_g = m \\cdot g',
    'F = k \\cdot \\Delta l',
    'F_f = \\mu \\cdot F_N',
    'F = G \\frac{m_1 m_2}{r^2}',
    '\\rho = \\frac{m}{V}',
    'p = \\frac{F}{A}',
    'p = \\rho g h',
  ],
  Matte: [
    'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    'x = -\\frac{p}{2} \\pm \\sqrt{\\left(\\frac{p}{2}\\right)^2 - q}',
    'k = \\frac{y_2 - y_1}{x_2 - x_1}',
    'y = kx + m',
    'a^2 + b^2 = c^2',
    '(a+b)^2 = a^2 + 2ab + b^2',
    'a^x \\cdot a^y = a^{x+y}',
    '\\sin v = \\frac{\\text{mot}}{\\text{hyp}}',
  ],
}

export function MathSheet({ open, initial, onClose, onSave, onDelete }: { open: boolean; initial: string; onClose: () => void; onSave: (latex: string) => void; onDelete?: () => void }) {
  const [tex, setTex] = useState(initial)
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (open) {
      setTex(initial)
      window.setTimeout(() => ta.current?.focus(), 350)
    }
  }, [open, initial])
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex || '\\text{Skriv en formel}', { throwOnError: true, displayMode: true })
    } catch (e) {
      return `<span class="math-err">${(e as Error).message.replace(/^KaTeX parse error: /, '').replace(/</g, '&lt;')}</span>`
    }
  }, [tex])

  const insert = (s: string, back = 0) => {
    const el = ta.current
    if (!el) return setTex((t) => t + s)
    const a = el.selectionStart
    const b = el.selectionEnd
    const next = tex.slice(0, a) + s + tex.slice(b)
    setTex(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = a + s.length - back
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Formel"
      action={
        <button className="head-btn strong" disabled={!tex.trim()} onClick={() => onSave(tex.trim())}>
          Klar
        </button>
      }
    >
      <div className="math-preview" dangerouslySetInnerHTML={{ __html: html }} />
      <textarea
        ref={ta}
        className="math-input"
        value={tex}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="t.ex. v = \frac{\Delta s}{\Delta t}"
        onChange={(e) => setTex(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSave(tex.trim())
        }}
      />
      <div className="palette">
        {PALETTE.map((p) => (
          <button key={p.label} className="pal" title={p.tex} onClick={() => insert(p.insert, p.back)}>
            {p.label}
          </button>
        ))}
      </div>
      {Object.entries(READY).map(([group, list]) => (
        <div key={group} className="ready">
          <div className="label">{group}</div>
          <div className="ready-list">
            {list.map((t) => (
              <button key={t} className="ready-item" onClick={() => setTex(t)} dangerouslySetInnerHTML={{ __html: katex.renderToString(t, { throwOnError: false }) }} />
            ))}
          </div>
        </div>
      ))}
      {onDelete && (
        <button className="wide ghost" onClick={onDelete}>
          Ta bort formeln
        </button>
      )}
    </Sheet>
  )
}
