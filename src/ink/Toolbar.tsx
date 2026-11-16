import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Menu, useMenu, type MenuItem } from '../components/ui'
import { HL_COLORS, INK_COLORS, inkColor } from '../lib/ink'
import { getPrefs, paperIsDark, setPrefs, usePrefs } from '../lib/prefs'
import type { Editor, Tool, ToolStyle } from './editor'

const TOOLS: { id: Tool; icon: string; name: string }[] = [
  { id: 'pen', icon: 'pen', name: 'Penna' },
  { id: 'hl', icon: 'marker', name: 'Överstrykning' },
  { id: 'eraser', icon: 'eraser', name: 'Suddgummi' },
  { id: 'lasso', icon: 'lasso', name: 'Markera' },
]
const SHAPES: { id: Tool; icon: string; name: string }[] = [
  { id: 'line', icon: 'line', name: 'Linje' },
  { id: 'arrow', icon: 'arrow', name: 'Pil (vektor)' },
  { id: 'rect', icon: 'rect', name: 'Rektangel' },
  { id: 'ellipse', icon: 'ellipse', name: 'Cirkel/ellips' },
]
const INSERT: { id: Tool; icon: string; name: string }[] = [
  { id: 'text', icon: 'text', name: 'Text' },
  { id: 'math', icon: 'formula', name: 'Formel' },
  { id: 'graph', icon: 'graph', name: 'Graf' },
  { id: 'hand', icon: 'hand', name: 'Flytta vyn' },
]

const SIZES: Record<string, number[]> = { pen: [1.6, 2.6, 4, 6.5], hl: [10, 18, 28], shape: [1.4, 2.2, 3.6], text: [14, 18, 24, 32] }

export function Toolbar({
  editor,
  tool,
  setTool,
  canUndo,
  canRedo,
  more,
}: {
  editor: Editor | null
  tool: Tool
  setTool: (t: Tool) => void
  canUndo: boolean
  canRedo: boolean
  more: (MenuItem | 'sep')[]
}) {
  const [, force] = useState(0)
  const [lastShape, setLastShape] = useState<Tool>('arrow')
  const opts = useMenu()
  const shapes = useMenu()
  const moreMenu = useMenu()
  usePrefs()
  const isShape = SHAPES.some((s) => s.id === tool)
  const shapeTool = isShape ? tool : lastShape
  const style: ToolStyle | null = editor && ['pen', 'hl', 'line', 'arrow', 'rect', 'ellipse', 'text'].includes(tool) ? editor.styleFor(tool) : null
  const key = tool === 'pen' || tool === 'hl' || tool === 'text' ? tool : 'shape'
  const colors = tool === 'hl' ? HL_COLORS : INK_COLORS
  const dark = paperIsDark()

  const pick = (t: Tool, e: React.MouseEvent<HTMLButtonElement>) => {
    if (t === tool && (t === 'pen' || t === 'hl' || t === 'text')) opts.open(e)
    else setTool(t)
  }

  return (
    <div className="toolbar" data-ui>
      <div className="tb-scroll">
        {TOOLS.map((t) => (
          <button key={t.id} className={`tb-btn${tool === t.id ? ' on' : ''}`} title={t.name} aria-label={t.name} onClick={(e) => pick(t.id, e)}>
            <Icon name={t.icon} />
          </button>
        ))}
        <button
          className={`tb-btn${isShape ? ' on' : ''}`}
          title="Former"
          aria-label="Former"
          onClick={(e) => {
            if (isShape) shapes.open(e)
            else setTool(shapeTool)
          }}
        >
          <Icon name={SHAPES.find((s) => s.id === shapeTool)?.icon ?? 'arrow'} />
          <span className="tb-caret" />
        </button>
        {INSERT.map((t) => (
          <button key={t.id} className={`tb-btn${tool === t.id ? ' on' : ''}`} title={t.name} aria-label={t.name} onClick={(e) => pick(t.id, e)}>
            <Icon name={t.icon} />
          </button>
        ))}
        <span className="tb-sep" />
        {style && (
          <button className="tb-swatch" title="Färg och storlek" aria-label="Färg och storlek" onClick={opts.open}>
            <span style={{ background: tool === 'hl' ? style.color : inkColor(style.color, dark), opacity: tool === 'hl' ? 0.75 : 1, width: tool === 'text' ? 16 : Math.min(18, 6 + style.size * (tool === 'hl' ? 0.45 : 2)), height: tool === 'text' ? 16 : Math.min(18, 6 + style.size * (tool === 'hl' ? 0.45 : 2)) }} />
          </button>
        )}
        <button className="tb-btn" title="Ångra (Ctrl Z)" aria-label="Ångra" disabled={!canUndo} onClick={() => editor?.undo()}>
          <Icon name="undo" />
        </button>
        <button className="tb-btn" title="Gör om (Ctrl Y)" aria-label="Gör om" disabled={!canRedo} onClick={() => editor?.redo()}>
          <Icon name="redo" />
        </button>
        <button className="tb-btn" title="Mer" aria-label="Mer" onClick={moreMenu.open}>
          <Icon name="more" />
        </button>
      </div>

      {opts.anchor && style && editor && (
        <Popover anchor={opts.anchor} onClose={opts.close}>
          <div className="pop-row">
            {colors.map((c) => (
              <button
                key={c}
                className={`dot${style.color === c ? ' on' : ''}`}
                style={{ background: tool === 'hl' ? c : inkColor(c, dark) }}
                aria-label="Färg"
                onClick={() => {
                  editor.setStyle(tool, { color: c })
                  if (editor.sel) editor.recolorSelection(c)
                  force((x) => x + 1)
                }}
              />
            ))}
          </div>
          <div className="pop-row">
            {SIZES[key].map((s) => (
              <button
                key={s}
                className={`size${Math.abs(style.size - s) < 0.01 ? ' on' : ''}`}
                aria-label={`Storlek ${s}`}
                onClick={() => {
                  editor.setStyle(tool, { size: s })
                  force((x) => x + 1)
                }}
              >
                {key === 'text' ? <span style={{ fontSize: Math.min(20, s * 0.75), fontWeight: 600 }}>Aa</span> : <i style={{ width: Math.min(26, s * (key === 'hl' ? 0.9 : 2.4) + 2), height: Math.min(26, s * (key === 'hl' ? 0.9 : 2.4) + 2), opacity: key === 'hl' ? 0.6 : 1 }} />}
              </button>
            ))}
          </div>
        </Popover>
      )}

      {shapes.anchor && editor && (
        <Popover anchor={shapes.anchor} onClose={shapes.close}>
          <div className="pop-row">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                className={`size${tool === s.id ? ' on' : ''}`}
                title={s.name}
                aria-label={s.name}
                onClick={() => {
                  setTool(s.id)
                  setLastShape(s.id)
                  shapes.close()
                }}
              >
                <Icon name={s.icon} />
              </button>
            ))}
          </div>
          <div className="pop-row">
            {INK_COLORS.map((c) => (
              <button
                key={c}
                className={`dot${editor.styleFor('line').color === c ? ' on' : ''}`}
                style={{ background: inkColor(c, dark) }}
                aria-label="Färg"
                onClick={() => {
                  editor.setStyle('line', { color: c })
                  force((x) => x + 1)
                }}
              />
            ))}
          </div>
          <div className="pop-row">
            {SIZES.shape.map((s) => (
              <button
                key={s}
                className={`size${Math.abs(editor.styleFor('line').size - s) < 0.01 ? ' on' : ''}`}
                aria-label={`Tjocklek ${s}`}
                onClick={() => {
                  editor.setStyle('line', { size: s })
                  force((x) => x + 1)
                }}
              >
                <i style={{ width: 22, height: s * 1.6, borderRadius: 2 }} />
              </button>
            ))}
          </div>
          <label className="pop-check">
            <input type="checkbox" checked={getPrefs().snap} onChange={(e) => setPrefs({ snap: e.target.checked })} /> Fäst mot rutnätet
          </label>
        </Popover>
      )}

      {moreMenu.anchor && <Menu anchor={moreMenu.anchor} items={more} onClose={moreMenu.close} />}
    </div>
  )
}

function Popover({ anchor, onClose, children }: { anchor: HTMLElement; onClose: () => void; children: React.ReactNode }) {
  const r = anchor.getBoundingClientRect()
  return (
    <>
      <div className="pop-scrim" onPointerDown={onClose} />
      <div className="popover" data-ui style={{ left: Math.max(10, Math.min(window.innerWidth - 290, r.left + r.width / 2 - 140)), bottom: window.innerHeight - r.top + 10 }}>
        {children}
      </div>
    </>
  )
}
