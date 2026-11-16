import { useEffect, useRef, useState } from 'react'
import { calc, newCalc, type CalcState } from '../lib/math/defs'
import { fmt } from '../lib/math/expr'
import { setPrefs, usePrefs } from '../lib/prefs'
import { setUI, toast, useUI } from '../lib/ui'
import { isTouchDevice } from '../lib/util'
import { Icon } from './Icon'

interface Line {
  input: string
  out: string
  err?: boolean
}

const KEYS: [string, string][] = [
  ['sin(', 'sin'],
  ['cos(', 'cos'],
  ['tan(', 'tan'],
  ['√(', '√'],
  ['^', 'xʸ'],
  ['ln(', 'ln'],
  ['lg(', 'lg'],
  ['π', 'π'],
  ['(', '('],
  [')', ')'],
  ['7', '7'],
  ['8', '8'],
  ['9', '9'],
  ['/', '÷'],
  ['²', 'x²'],
  ['4', '4'],
  ['5', '5'],
  ['6', '6'],
  ['·', '×'],
  ['·10^', 'EE'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['-', '−'],
  ['ans', 'ans'],
  ['0', '0'],
  [',', ','],
  ['⌫', '⌫'],
  ['+', '+'],
  ['=', '='],
]

let state: CalcState = newCalc()
let history: Line[] = []

export function Calculator() {
  const ui = useUI()
  const prefs = usePrefs()
  const [lines, setLines] = useState<Line[]>(history)
  const [input, setInput] = useState('')
  const [pad, setPad] = useState(isTouchDevice())
  const ref = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ui.calc && !isTouchDevice()) window.setTimeout(() => ref.current?.focus(), 60)
  }, [ui.calc])
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [lines])

  const run = () => {
    const s = input.trim()
    if (!s) return
    let line: Line
    try {
      const r = calc(s, state, prefs.deg)
      line = { input: s, out: r.value !== undefined ? r.text + fmt(r.value, 10) : r.text }
    } catch (e) {
      line = { input: s, out: (e as Error).message, err: true }
    }
    history = [...history, line].slice(-60)
    setLines(history)
    setInput('')
  }

  const press = (k: string) => {
    const el = ref.current
    if (k === '=') return run()
    if (k === '⌫') {
      setInput((v) => v.slice(0, -1))
      return
    }
    if (!el) return setInput((v) => v + k)
    const a = el.selectionStart ?? input.length
    const b = el.selectionEnd ?? input.length
    const next = input.slice(0, a) + k + input.slice(b)
    setInput(next)
    requestAnimationFrame(() => {
      if (!isTouchDevice()) el.focus()
      el.setSelectionRange(a + k.length, a + k.length)
    })
  }

  if (!ui.calc) return null
  return (
    <div className="calc" data-ui role="dialog" aria-label="Miniräknare">
      <div className="calc-head">
        <span className="calc-title">Miniräknare</span>
        <button className={`chip-btn small${prefs.deg ? ' on' : ''}`} onClick={() => setPrefs({ deg: !prefs.deg })} title="Grader eller radianer">
          {prefs.deg ? 'DEG' : 'RAD'}
        </button>
        <button className="icon-btn" onClick={() => setPad(!pad)} aria-label="Knappar">
          <Icon name="calc" size={18} />
        </button>
        <button className="icon-btn" onClick={() => setUI({ calc: false })} aria-label="Stäng">
          <Icon name="close" size={18} />
        </button>
      </div>
      <div className="calc-lines" ref={list}>
        {!lines.length && <div className="calc-hint">Skriv t.ex. 9,82·3,55 eller sin(30) eller (50/3,6)/1,5. Spara värden med a = 2,5. ans är senaste svaret.</div>}
        {lines.map((l, i) => (
          <button
            key={i}
            className={`calc-line${l.err ? ' err' : ''}`}
            onClick={() => {
              const v = l.out.replace(/^.*= /, '')
              if (!l.err) {
                void navigator.clipboard?.writeText(v).then(() => toast('Kopierat'), () => {})
                setInput((s) => s + v.replace(/·10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/, (_, e) => '·10^' + e.replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c: string) => '-0123456789'['⁻⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c)])))
              }
            }}
          >
            <span className="calc-in">{l.input}</span>
            <span className="calc-out">{l.err || l.out.includes(' = ') ? l.out : '= ' + l.out}</span>
          </button>
        ))}
      </div>
      <div className="calc-input">
        <input
          ref={ref}
          value={input}
          inputMode={pad ? 'none' : 'decimal'}
          placeholder="Uttryck…"
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run()
            else if (e.key === 'Escape') setUI({ calc: false })
            else if (e.key === 'ArrowUp' && !input && history.length) setInput(history[history.length - 1].input)
          }}
        />
        <button className="calc-eq" onClick={run} aria-label="Räkna">
          =
        </button>
      </div>
      {pad && (
        <div className="calc-pad">
          {KEYS.map(([k, label]) => (
            <button key={label} className={`ck${/^[0-9,]$/.test(k) ? ' num' : ''}${k === '=' ? ' eq' : ''}`} onClick={() => press(k)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
