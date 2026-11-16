import { useRef, useState } from 'react'
import { RULER_LEN, RULER_W, type Editor } from './editor'

/* A ruler (draw along its edge for straight lines) and a protractor, both in page space,
   moved with a finger or the mouse and turned by their round handle. */

const CM = 794 / 21

function useDrag(editor: Editor, st: { x: number; y: number; a: number }, force: () => void) {
  const drag = useRef<{ id: number; mode: 'move' | 'turn'; lx: number; ly: number } | null>(null)
  const down = (mode: 'move' | 'turn') => (e: React.PointerEvent) => {
    if (e.pointerType === 'pen' && mode === 'move') return // the pen draws along the edge instead
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, mode, lx: e.clientX, ly: e.clientY }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    e.stopPropagation()
    const z = editor.view.z
    if (d.mode === 'move') {
      st.x += (e.clientX - d.lx) / z
      st.y += (e.clientY - d.ly) / z
    } else {
      const r = editor.root.getBoundingClientRect()
      const w = editor.toWorld(e.clientX - r.left, e.clientY - r.top)
      let a = Math.atan2(w.y - st.y, w.x - st.x)
      const deg = (a * 180) / Math.PI
      const snapTo = Math.round(deg / 15) * 15
      if (Math.abs(deg - snapTo) < 2) a = (snapTo * Math.PI) / 180
      st.a = a
    }
    d.lx = e.clientX
    d.ly = e.clientY
    force()
  }
  const up = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null
  }
  return { down, move, up, turning: () => drag.current?.mode === 'turn' }
}

export function Ruler({ editor }: { editor: Editor }) {
  const [, setV] = useState(0)
  const st = editor.ruler
  const { down, move, up, turning } = useDrag(editor, st, () => setV((v) => v + 1))
  const ticks: React.ReactNode[] = []
  const left = -RULER_LEN / 2 + 14
  for (let mm = 0; mm <= 150; mm++) {
    const x = left + (mm * CM) / 10
    if (x > RULER_LEN / 2 - 10) break
    const h = mm % 10 === 0 ? 16 : mm % 5 === 0 ? 11 : 7
    ticks.push(<line key={mm} x1={x} x2={x} y1={-RULER_W / 2} y2={-RULER_W / 2 + h} />)
    if (mm % 10 === 0)
      ticks.push(
        <text key={'t' + mm} x={x} y={-RULER_W / 2 + 28}>
          {mm / 10}
        </text>,
      )
  }
  const deg = Math.round(((((-st.a * 180) / Math.PI) % 360) + 360) % 360)
  return (
    <div className="measure" style={{ left: st.x, top: st.y, transform: `rotate(${st.a}rad)` }} onPointerDown={down('move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <svg className="ruler-svg" width={RULER_LEN} height={RULER_W} viewBox={`${-RULER_LEN / 2} ${-RULER_W / 2} ${RULER_LEN} ${RULER_W}`} style={{ left: -RULER_LEN / 2, top: -RULER_W / 2 }}>
        <rect x={-RULER_LEN / 2} y={-RULER_W / 2} width={RULER_LEN} height={RULER_W} rx={8} className="ruler-body" />
        <g className="ruler-ticks">{ticks}</g>
        <text x={0} y={RULER_W / 2 - 12} className="ruler-deg">
          {deg}°
        </text>
      </svg>
      <button className={`measure-turn${turning() ? ' on' : ''}`} style={{ left: RULER_LEN / 2 - 24, top: -14 }} onPointerDown={down('turn')} aria-label="Vrid linjalen" />
    </div>
  )
}

export function Protractor({ editor }: { editor: Editor }) {
  const [, setV] = useState(0)
  const st = editor.protractor
  const { down, move, up } = useDrag(editor, st, () => setV((v) => v + 1))
  const R = 180
  const marks: React.ReactNode[] = []
  for (let d = 0; d <= 180; d++) {
    const a = (Math.PI * d) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    const len = d % 10 === 0 ? 16 : d % 5 === 0 ? 11 : 6
    marks.push(<line key={d} x1={R * cos} y1={-R * sin} x2={(R - len) * cos} y2={-(R - len) * sin} />)
    if (d % 10 === 0) {
      marks.push(
        <text key={'o' + d} x={(R - 28) * cos} y={-(R - 28) * sin + 4}>
          {180 - d}
        </text>,
      )
      marks.push(
        <text key={'i' + d} className="inner" x={(R - 50) * cos} y={-(R - 50) * sin + 4}>
          {d}
        </text>,
      )
    }
  }
  return (
    <div className="measure" style={{ left: st.x, top: st.y, transform: `rotate(${st.a}rad)` }} onPointerDown={down('move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <svg className="prot-svg" width={R * 2 + 8} height={R + 22} viewBox={`${-R - 4} ${-R - 4} ${R * 2 + 8} ${R + 22}`} style={{ left: -R - 4, top: -R - 4 }}>
        <path d={`M ${-R} 0 A ${R} ${R} 0 0 1 ${R} 0 L ${R} 14 L ${-R} 14 Z`} className="ruler-body" />
        <g className="ruler-ticks">{marks}</g>
        <line x1={-R} x2={R} y1={0} y2={0} className="prot-base" />
        <circle cx={0} cy={0} r={3.5} className="prot-center" />
        <line x1={0} y1={0} x2={0} y2={-R + 60} className="prot-zero" />
      </svg>
      <button className="measure-turn" style={{ left: R - 6, top: -8 }} onPointerDown={down('turn')} aria-label="Vrid gradskivan" />
    </div>
  )
}
