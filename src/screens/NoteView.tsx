import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { LinkPicker } from '../components/LinkPicker'
import { Empty, Menu, Sheet, useMenu } from '../components/ui'
import { Notebook } from '../ink/Notebook'
import { useLinkIndex } from '../lib/links'
import { setPrefs, usePrefs } from '../lib/prefs'
import { back, go, href } from '../lib/router'
import { addLink, deleteNote, updateNote, useNote } from '../lib/store'
import { kindName, vaultName } from '../lib/types'
import { setUI, toast } from '../lib/ui'
import { TextNote } from '../text/TextNote'
import { NotePanel } from './NotePanel'

export function NoteView({ id }: { id: string }) {
  const note = useNote(id)
  const prefs = usePrefs()
  const idx = useLinkIndex()
  const [title, setTitle] = useState(note?.title ?? '')
  const [sheet, setSheet] = useState(false)
  const [picking, setPicking] = useState(false)
  const menu = useMenu()
  const wide = useWide()

  useEffect(() => setTitle(note?.title ?? ''), [note?.id, note?.title])

  if (!note)
    return (
      <div className="page">
        <Empty title="Anteckningen finns inte" sub="Den kan ha tagits bort, eller så har den inte synkats hit än.">
          <a className="wide" style={{ maxWidth: 240, marginTop: 20 }} href={href({ name: 'home' })}>
            Till startsidan
          </a>
        </Empty>
      </div>
    )

  const links = (idx.out.get(note.id)?.size ?? 0) + (idx.in.get(note.id)?.size ?? 0)
  const panelOpen = wide && prefs.rightPanel

  return (
    <div className={`noteview${panelOpen ? ' with-panel' : ''}`}>
      <header className="note-top" data-ui>
        <button className="icon-btn" onClick={() => back({ name: 'vault', vault: note.vault })} aria-label="Tillbaka">
          <Icon name="back" />
        </button>
        <button className="icon-btn only-mobile-hidden" onClick={() => setPrefs({ sidebar: !prefs.sidebar })} aria-label="Visa eller göm sidopanelen">
          <Icon name="sidebar" />
        </button>
        <div className="note-titles">
          <input
            className="note-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== note.title && void updateNote(note.id, { title: title.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Titel"
          />
          <a className="note-meta" href={href({ name: 'vault', vault: note.vault })}>
            {vaultName(note.vault)}
            {note.folder ? ` · ${note.folder}` : ''} · {kindName(note.kind)}
          </a>
        </div>
        <div className="note-actions">
          <button className="icon-btn" onClick={() => setPicking(true)} aria-label="Länka" title="Länka till en annan anteckning">
            <Icon name="link" />
          </button>
          <button
            className={`icon-btn badge-btn${(wide ? panelOpen : sheet) ? ' on' : ''}`}
            onClick={() => (wide ? setPrefs({ rightPanel: !prefs.rightPanel }) : setSheet(true))}
            aria-label="Egenskaper och länkar"
            title="Egenskaper och länkar"
          >
            <Icon name="panel" />
            {links > 0 && <span className="badge">{links}</span>}
          </button>
          <button className="icon-btn" onClick={menu.open} aria-label="Mer">
            <Icon name="more" />
          </button>
        </div>
      </header>

      <div className="note-body">
        <div className="note-main">{note.format === 'ink' ? <Notebook note={note} /> : <TextNote note={note} />}</div>
        {panelOpen && (
          <aside className="note-side">
            <NotePanel note={note} />
          </aside>
        )}
      </div>

      {!wide && (
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Egenskaper">
          <NotePanel note={note} />
        </Sheet>
      )}

      <LinkPicker
        open={picking}
        from={note}
        onClose={() => setPicking(false)}
        onPick={(to) => {
          void addLink(note.id, to)
          setPicking(false)
          toast('Länkad')
        }}
      />

      {menu.anchor && (
        <Menu
          anchor={menu.anchor}
          onClose={menu.close}
          items={[
            ...(note.vault !== 'fysik' ? [{ label: 'Flytta till Fysik', icon: 'atom', onClick: () => void updateNote(note.id, { vault: 'fysik' }) }] : []),
            ...(note.vault !== 'matte' ? [{ label: 'Flytta till Matte', icon: 'sigma', onClick: () => void updateNote(note.id, { vault: 'matte' }) }] : []),
            { label: 'Visa i grafen', icon: 'network', onClick: () => go({ name: 'graph', vault: note.vault }) },
            { label: 'Miniräknare', icon: 'calc', onClick: () => setUI({ calc: true }) },
            'sep',
            {
              label: 'Flytta till papperskorgen',
              icon: 'trash',
              danger: true,
              onClick: () => {
                void deleteNote(note.id)
                toast('Flyttad till papperskorgen')
                go({ name: 'vault', vault: note.vault }, true)
              },
            },
          ]}
        />
      )}
    </div>
  )
}

function useWide() {
  const q = '(min-width: 980px)'
  const [wide, setWide] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const m = matchMedia(q)
    const f = () => setWide(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return wide
}
