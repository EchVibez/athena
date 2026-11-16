import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { defineAll } from '../lib/math/defs'
import { fmtShort } from '../lib/math/expr'
import type { GraphObj } from '../lib/types'
import { sid } from '../lib/util'
import { GRAPH_COLORS, graphData } from './render'

const num = (s: string) => parseFloat(s.replace(',', '.').replace('−', '-'))

export function GraphPanel({ obj, onChange, onClose, onDelete }: { obj: GraphObj; onChange: (o: GraphObj, commit: boolean) => void; onClose: () => void; onDelete: () => void }) {
  const defs = useMemo(() => defineAll(obj.fns.map((f) => f.expr)), [obj.fns])
  const found = graphData(obj).found
  const set = (patch: Partial<GraphObj>, commit = true) => onChange({ ...obj, ...patch }, commit)

  const setFn = (i: number, expr: string, commit = false) => set({ fns: obj.fns.map((f, k) => (k === i ? { ...f, expr } : f)) }, commit)

  const autoY = () => {
    const ys: number[] = []
    for (const d of defs) {
      if (d.type !== 'fn') continue
      for (let k = 0; k <= 200; k++) {
        const v = d.f(obj.view.x0 + ((obj.view.x1 - obj.view.x0) * k) / 200)
        if (Number.isFinite(v)) ys.push(v)
      }
    }
    if (!ys.length) return
    ys.sort((a, b) => a - b)
    let lo = ys[Math.floor(ys.length * 0.02)]
    let hi = ys[Math.floor(ys.length * 0.98)]
    if (hi - lo < 1e-9) {
      lo -= 1
      hi += 1
    }
    const pad = (hi - lo) * 0.12
    set({ view: { ...obj.view, y0: Math.min(lo - pad, 0 - pad * 0.2), y1: Math.max(hi + pad, 0 + pad * 0.2) } })
  }

  const square = () => {
    const ux = (obj.view.x1 - obj.view.x0) / obj.w
    const cy = (obj.view.y0 + obj.view.y1) / 2
    const half = (ux * obj.h) / 2
    set({ view: { ...obj.view, y0: cy - half, y1: cy + half } })
  }

  return (
    <div className="graph-panel" data-ui>
      <div className="gp-head">
        <div className="gp-title">Graf</div>
        <button className="head-btn strong" onClick={onClose}>
          Klar
        </button>
      </div>
      <div className="gp-body">
        {obj.fns.map((f, i) => {
          const d = defs[i]
          return (
            <div key={f.id} className="gp-fn">
              <button
                className="gp-color"
                style={{ background: f.color }}
                aria-label="Byt färg"
                onClick={() => set({ fns: obj.fns.map((x, k) => (k === i ? { ...x, color: GRAPH_COLORS[(GRAPH_COLORS.indexOf(x.color) + 1) % GRAPH_COLORS.length] } : x)) })}
              />
              <div className="gp-field">
                <ExprInput value={f.expr} onChange={(v) => setFn(i, v)} onCommit={(v) => setFn(i, v, true)} placeholder={i === 0 ? 'f(x) = x² − 2x − 3' : 'g(x) = 2x + 1   ·   A = (1; 2)'} autoFocus={!f.expr && i === obj.fns.length - 1} />
                {d?.type === 'error' && f.expr.trim() && <div className="gp-err">{d.msg}</div>}
                {d?.type === 'fn' && <div className="gp-hint">{d.label}</div>}
                {d?.type === 'var' && <div className="gp-hint">{d.name} = {fmtShort(d.value)}</div>}
              </div>
              <button className="icon-btn" aria-label="Ta bort raden" onClick={() => set({ fns: obj.fns.filter((_, k) => k !== i) })}>
                <Icon name="close" size={18} />
              </button>
            </div>
          )
        })}
        <button className="gp-add" onClick={() => set({ fns: [...obj.fns, { id: sid(), expr: '', color: GRAPH_COLORS[obj.fns.length % GRAPH_COLORS.length] }] })}>
          <Icon name="plus" size={18} /> Lägg till funktion, punkt eller linje
        </button>

        <div className="label gp-label">Visa</div>
        <div className="chips">
          {(
            [
              ['zeros', 'Nollställen'],
              ['extrema', 'Max/min'],
              ['intersections', 'Skärningar'],
            ] as const
          ).map(([k, name]) => (
            <button key={k} className={`chip-btn${obj.show[k] ? ' on' : ''}`} onClick={() => set({ show: { ...obj.show, [k]: !obj.show[k] } })}>
              {name}
            </button>
          ))}
        </div>

        {found.length > 0 && (
          <div className="gp-found">
            {found.map((p, k) => (
              <div key={k} className="gp-pt">
                <span>{p.label}</span>
                <b>
                  ({fmtShort(p.x)}; {fmtShort(p.y)})
                </b>
              </div>
            ))}
          </div>
        )}

        <div className="label gp-label">Fönster</div>
        <div className="gp-win">
          {(['x0', 'x1', 'y0', 'y1'] as const).map((k) => (
            <label key={k}>
              <span>{k === 'x0' ? 'x min' : k === 'x1' ? 'x max' : k === 'y0' ? 'y min' : 'y max'}</span>
              <NumInput
                value={obj.view[k]}
                onCommit={(v) => {
                  const view = { ...obj.view, [k]: v }
                  if (view.x1 > view.x0 && view.y1 > view.y0) set({ view })
                }}
              />
            </label>
          ))}
        </div>
        <div className="chips">
          <button className="chip-btn" onClick={() => set({ view: { x0: -6, x1: 6, y0: (-6 * obj.h) / obj.w, y1: (6 * obj.h) / obj.w } })}>
            Standard
          </button>
          <button className="chip-btn" onClick={autoY}>
            Anpassa y
          </button>
          <button className="chip-btn" onClick={square}>
            Lika skala
          </button>
        </div>
        <p className="gp-tip">Dra i grafen för att flytta, scrolla för att zooma. Tryck på en kurva för att läsa av ett värde.</p>
        <button className="wide ghost" onClick={onDelete}>
          Ta bort grafen
        </button>
      </div>
    </div>
  )
}

function ExprInput({ value, onChange, onCommit, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; onCommit: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <input
      className="gp-input"
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      autoFocus={autoFocus}
      onChange={(e) => onChange(prettify(e.target.value))}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/** Small typing comforts: x^2 shows as x², * as ·. */
function prettify(s: string) {
  return s
    .replace(/\^2(?![0-9.,])/g, '²')
    .replace(/\^3(?![0-9.,])/g, '³')
    .replace(/\*/g, '·')
    .replace(/sqrt/g, '√')
}

function NumInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(fmtShort(value))
  useEffect(() => setText(fmtShort(value)), [value])
  return (
    <input
      className="gp-num"
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = num(text)
        if (Number.isFinite(v)) onCommit(v)
        else setText(fmtShort(value))
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}
