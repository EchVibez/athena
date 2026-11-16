import katex from 'katex'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Menu, useMenu, type MenuItem } from '../components/ui'
import { inkColor, INK_COLORS } from '../lib/ink'
import { getPrefs, paperIsDark, setPrefs, usePrefs } from '../lib/prefs'
import { addPage, loadPages, movePage, onPageChanged, removePage, updateNote } from '../lib/store'
import { PAGE_GAP, PAGE_H, PAGE_W, PAPERS, type GraphObj, type MathObj, type Note, type Obj, type Page, type TextObj } from '../lib/types'
import { setUI, toast } from '../lib/ui'
import { sid } from '../lib/util'
import { Editor, type EditorState, type Tool } from './editor'
import { GraphPanel } from './GraphPanel'
import { MathSheet } from './MathSheet'
import { Protractor, Ruler } from './Measure'
import { Toolbar } from './Toolbar'

const STEP = PAGE_H + PAGE_GAP

export function Notebook({ note }: { note: Note }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const edRef = useRef<Editor | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pages, setPages] = useState<Page[] | null>(null)
  const [st, setSt] = useState<EditorState>({ canUndo: false, canRedo: false, zoom: 1, sel: null, page: 0 })
  const [tool, setToolState] = useState<Tool>(() => (localStorage.getItem('athena.tool') as Tool) || 'pen')
  const [, setObjV] = useState(0)
  const [editing, setEditing] = useState<{ pageId: string; id: string } | null>(null)
  const [mathReq, setMathReq] = useState<{ pageId: string; x: number; y: number; id?: string; latex: string } | null>(null)
  const [graph, setGraph] = useState<{ pageId: string; id: string } | null>(null)
  const [measure, setMeasure] = useState({ ruler: false, protractor: false })
  const prefs = usePrefs()
  const ed = edRef.current

  const pageKey = note.pages.join(',')
  useEffect(() => {
    let alive = true
    loadPages(note).then((ps) => alive && setPages(ps))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, pageKey])

  useEffect(() => {
    if (!pages) return
    if (edRef.current) {
      edRef.current.setPages(note, [...pages])
      setObjV((v) => v + 1)
      return
    }
    const e = new Editor(rootRef.current!, canvasRef.current!, liveRef.current!, layerRef.current!, note, [...pages], {
      state: setSt,
      objects: () => setObjV((v) => v + 1),
      edit: (t) => {
        const ed = edRef.current!
        if (!t) {
          setEditing(null)
          setGraph(null)
          ed.setActiveGraph(null)
          return
        }
        const o = ed.getObject(t.pageId, t.id)
        if (!o) return
        if (o.type === 'text') {
          ed.beginEdit(t.pageId)
          setEditing(t)
        } else if (o.type === 'math') setMathReq({ pageId: t.pageId, x: o.x, y: o.y, id: o.id, latex: o.latex })
        else if (o.type === 'graph') {
          ed.select(null)
          ed.setActiveGraph(t)
          setGraph(t)
        }
      },
      requestMath: (pageId, x, y) => setMathReq({ pageId, x, y, latex: '' }),
    })
    e.setTool(tool)
    edRef.current = e
    setObjV((v) => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages])

  useEffect(
    () => () => {
      edRef.current?.destroy()
      edRef.current = null
    },
    [],
  )

  // Another device changed a page that is open here.
  useEffect(() => {
    const offs = note.pages.map((id) => onPageChanged(id, (p) => edRef.current?.replacePage(p)))
    return () => offs.forEach((f) => f())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey])

  useEffect(() => {
    if (edRef.current) {
      edRef.current.note = note
      edRef.current.requestDraw()
    }
  }, [note])

  useEffect(() => {
    edRef.current?.requestDraw()
  }, [prefs.theme, prefs.paperTone, prefs.pressure])

  // Keep measured sizes of text and formulas for selection and hit testing.
  useLayoutEffect(() => {
    const e = edRef.current
    const layer = layerRef.current
    if (!e || !layer) return
    layer.querySelectorAll<HTMLElement>('[data-obj]').forEach((el) => {
      e.objSizes.set(el.dataset.obj!, { w: el.offsetWidth, h: el.offsetHeight })
    })
  })

  // Make room for the graph panel: slide the graph into the part of the screen left free.
  useEffect(() => {
    const e = edRef.current
    if (!e || !graph) return
    const o = e.getObject(graph.pageId, graph.id)
    if (!o) return
    const narrow = e.vw <= 760
    const t = window.setTimeout(() => e.reveal(graph.pageId, e.objBox(o), narrow ? { right: 0, bottom: e.vh * 0.46 + 8 } : { right: 374, bottom: 70 }), 60)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph?.id])

  const setTool = (t: Tool) => {
    setToolState(t)
    localStorage.setItem('athena.tool', t)
    edRef.current?.setTool(t)
    if (graph && t !== 'graph') closeGraph()
  }

  const closeGraph = () => {
    edRef.current?.setActiveGraph(null)
    setGraph(null)
  }

  const finishText = (pageId: string, id: string) => {
    const e = edRef.current
    if (!e) return
    const o = e.getObject(pageId, id) as TextObj | undefined
    if (o && !o.text.trim()) e.removeObject(pageId, id, false)
    e.commitEdit(pageId)
    setEditing(null)
  }

  const livePages = ed?.pages ?? pages ?? []
  const dark = paperIsDark()

  const more: (MenuItem | 'sep')[] = useMemo(
    () => [
      { label: measure.ruler ? 'Göm linjalen' : 'Linjal', icon: 'ruler', onClick: () => toggleMeasure('ruler') },
      { label: measure.protractor ? 'Göm gradskivan' : 'Gradskiva', icon: 'protractor', onClick: () => toggleMeasure('protractor') },
      { label: 'Miniräknare', icon: 'calc', onClick: () => setUI({ calc: true }) },
      { label: 'Infoga bild', icon: 'image', onClick: () => fileRef.current?.click() },
      'sep' as const,
      { label: 'Ny sida', icon: 'plus', onClick: () => void addPageAfter(livePages[livePages.length - 1]?.id) },
      { label: 'Anpassa bredd', icon: 'fit', onClick: () => edRef.current?.fitWidth() },
      ...PAPERS.map((p) => ({ label: `Papper: ${p.name}`, checked: note.paper === p.id, onClick: () => void updateNote(note.id, { paper: p.id }) })),
      'sep' as const,
      ...(prefs.penSeen
        ? [{ label: 'Rita med fingret', checked: prefs.fingerDraws, onClick: () => setPrefs({ fingerDraws: !getPrefs().fingerDraws }) }]
        : []),
      { label: 'Tryckkänslighet', checked: prefs.pressure, onClick: () => setPrefs({ pressure: !getPrefs().pressure }) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [measure, note.paper, prefs.penSeen, prefs.fingerDraws, prefs.pressure, livePages.length],
  )

  function toggleMeasure(k: 'ruler' | 'protractor') {
    const e = edRef.current
    if (!e) return
    const on = !measure[k]
    const c = e.toWorld(e.vw / 2, e.vh / 2)
    const m = k === 'ruler' ? e.ruler : e.protractor
    if (on) {
      m.x = c.x
      m.y = c.y + (k === 'protractor' ? 90 : 0)
    }
    m.on = on
    setMeasure((s) => ({ ...s, [k]: on }))
  }

  async function addPageAfter(after?: string) {
    const p = await addPage(note.id, after)
    if (p) {
      const i = note.pages.indexOf(after ?? '') + 1
      window.setTimeout(() => edRef.current?.scrollToPage(Math.max(0, i)), 120)
    }
  }

  const graphObj = graph && ed ? (ed.getObject(graph.pageId, graph.id) as GraphObj | undefined) : undefined
  const sel = st.sel

  return (
    <div className="nb-wrap">
      <div className="nb" ref={rootRef} data-tool={tool}>
        <canvas ref={canvasRef} className="nb-canvas" />
        <div className="nb-layer" ref={layerRef}>
          {livePages.map((p, i) => (
            <PageSlot
              key={p.id}
              page={p}
              index={i}
              count={livePages.length}
              note={note}
              dark={dark}
              editing={editing}
              onTextChange={(o) => edRef.current?.updateObject(p.id, o, false)}
              onTextDone={(id) => finishText(p.id, id)}
              onAddAfter={() => void addPageAfter(p.id)}
            />
          ))}
          {pages && (
            <button className="add-page" data-ui style={{ top: livePages.length * STEP - PAGE_GAP + 28 }} onClick={() => void addPageAfter(livePages[livePages.length - 1]?.id)}>
              <Icon name="plus" size={18} /> Ny sida
            </button>
          )}
          {ed && sel?.single && (sel.single.type === 'graph' || sel.single.type === 'image' || sel.single.type === 'text' || sel.single.type === 'math') && (
            <ResizeHandle editor={ed} pageId={sel.pageId} obj={sel.single} />
          )}
          {ed && measure.ruler && <Ruler editor={ed} />}
          {ed && measure.protractor && <Protractor editor={ed} />}
        </div>
        <canvas ref={liveRef} className="nb-live" />
        {!pages && <div className="nb-loading">Öppnar…</div>}
      </div>

      {sel && ed && !graph && (
        <div className="sel-bar" data-ui style={{ left: Math.max(8, Math.min(sel.rect.x + sel.rect.w / 2, (rootRef.current?.clientWidth ?? 400) - 8)), top: Math.max(8, sel.rect.y - 58) }}>
          {sel.single && (sel.single.type === 'graph' || sel.single.type === 'math' || sel.single.type === 'text') && (
            <button onClick={() => ed.host.edit({ pageId: sel.pageId, id: sel.single!.id })}>
              <Icon name="edit" size={18} />
              <span>Redigera</span>
            </button>
          )}
          {INK_COLORS.slice(0, 4).map((c) => (
            <button key={c} className="sel-dot" aria-label="Färg" onClick={() => ed.recolorSelection(c)}>
              <i style={{ background: inkColor(c, dark) }} />
            </button>
          ))}
          <button onClick={() => ed.duplicateSelection()} aria-label="Duplicera">
            <Icon name="copy" size={18} />
          </button>
          <button onClick={() => ed.deleteSelection()} aria-label="Ta bort">
            <Icon name="trash" size={18} />
          </button>
        </div>
      )}

      <Toolbar editor={ed} tool={tool} setTool={setTool} canUndo={st.canUndo} canRedo={st.canRedo} more={more} />

      {graphObj && graph && ed && (
        <GraphPanel
          obj={graphObj}
          onChange={(o, commit) => ed.updateObject(graph.pageId, o, commit)}
          onClose={closeGraph}
          onDelete={() => {
            ed.removeObject(graph.pageId, graph.id)
            closeGraph()
          }}
        />
      )}

      <MathSheet
        open={!!mathReq}
        initial={mathReq?.latex ?? ''}
        onClose={() => setMathReq(null)}
        onDelete={
          mathReq?.id
            ? () => {
                ed?.removeObject(mathReq.pageId, mathReq.id!)
                setMathReq(null)
              }
            : undefined
        }
        onSave={(latex) => {
          const e = edRef.current
          if (e && mathReq) {
            if (mathReq.id) {
              const o = e.getObject(mathReq.pageId, mathReq.id) as MathObj | undefined
              if (o) e.updateObject(mathReq.pageId, { ...o, latex })
            } else {
              const size = 24
              const o: MathObj = { type: 'math', id: sid(), x: mathReq.x, y: Math.max(4, mathReq.y - size), latex, size, color: e.styles.text.color }
              e.addObject(mathReq.pageId, o)
            }
          }
          setMathReq(null)
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f || !edRef.current) return
          try {
            await edRef.current.addImage(f)
            setTool('lasso')
          } catch {
            toast('Bilden kunde inte läsas.')
          }
        }}
      />
    </div>
  )
}

function PageSlot({
  page,
  index,
  count,
  note,
  dark,
  editing,
  onTextChange,
  onTextDone,
  onAddAfter,
}: {
  page: Page
  index: number
  count: number
  note: Note
  dark: boolean
  editing: { pageId: string; id: string } | null
  onTextChange: (o: TextObj) => void
  onTextDone: (id: string) => void
  onAddAfter: () => void
}) {
  const menu = useMenu()
  const items: (MenuItem | 'sep')[] = [
    { label: 'Ny sida efter den här', icon: 'plus', onClick: onAddAfter },
    { label: 'Flytta upp', icon: 'back', disabled: index === 0, onClick: () => void movePage(note.id, page.id, -1) },
    { label: 'Flytta ned', icon: 'next', disabled: index === count - 1, onClick: () => void movePage(note.id, page.id, 1) },
    'sep',
    { label: 'Ta bort sidan', icon: 'trash', danger: true, disabled: count <= 1, onClick: () => confirm('Ta bort sidan och allt på den?') && void removePage(note.id, page.id) },
  ]
  return (
    <div className="page-slot" style={{ top: index * STEP, width: PAGE_W, height: PAGE_H }}>
      {page.objects.map((o) => (
        <ObjView key={o.id} o={o} dark={dark} editing={editing?.pageId === page.id && editing.id === o.id} onTextChange={onTextChange} onTextDone={onTextDone} />
      ))}
      <div className="page-tag" data-ui>
        <span>{index + 1}</span>
        <button onClick={menu.open} aria-label="Sidans meny">
          <Icon name="more" size={18} />
        </button>
      </div>
      {menu.anchor && <Menu anchor={menu.anchor} items={items} onClose={menu.close} />}
    </div>
  )
}

function ObjView({ o, dark, editing, onTextChange, onTextDone }: { o: Obj; dark: boolean; editing: boolean; onTextChange: (o: TextObj) => void; onTextDone: (id: string) => void }) {
  if (o.type === 'text') {
    const style: React.CSSProperties = { left: o.x, top: o.y, width: o.w, fontSize: o.size, color: inkColor(o.color, dark) }
    if (editing) return <TextEdit o={o} style={style} onChange={onTextChange} onDone={() => onTextDone(o.id)} />
    return (
      <div className="obj-text" data-obj={o.id} style={style}>
        {o.text}
      </div>
    )
  }
  if (o.type === 'math') return <MathView o={o} dark={dark} />
  return null
}

function MathView({ o, dark }: { o: MathObj; dark: boolean }) {
  const html = useMemo(() => katex.renderToString(o.latex, { throwOnError: false, displayMode: false }), [o.latex])
  return <div className="obj-math" data-obj={o.id} style={{ left: o.x, top: o.y, fontSize: o.size, color: inkColor(o.color, dark) }} dangerouslySetInnerHTML={{ __html: html }} />
}

function TextEdit({ o, style, onChange, onDone }: { o: TextObj; style: React.CSSProperties; onChange: (o: TextObj) => void; onDone: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = el.scrollHeight + 'px'
  })
  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return (
    <textarea
      ref={ref}
      className="obj-text editing"
      data-ui
      data-obj={o.id}
      style={style}
      value={o.text}
      placeholder="Skriv…"
      onChange={(e) => onChange({ ...o, text: e.target.value })}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur()
      }}
    />
  )
}

function ResizeHandle({ editor, pageId, obj }: { editor: Editor; pageId: string; obj: Obj }) {
  const { i } = editor.pageById(pageId)
  if (i < 0) return null
  const b = editor.objBox(obj)
  return (
    <div
      className="resize-handle"
      data-ui
      style={{ left: b[2], top: b[3] + i * STEP }}
      onPointerDown={(e) => {
        e.stopPropagation()
        editor.startResize(e.nativeEvent, pageId, obj.id)
      }}
    >
      <Icon name="resize" size={14} />
    </div>
  )
}
