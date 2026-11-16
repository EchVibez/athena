import { useMemo, useState } from 'react'
import { href, useRoute } from '../lib/router'
import { getNote, useNotes } from '../lib/store'
import { useSync } from '../lib/sync'
import { VAULTS, type Note, type VaultId } from '../lib/types'
import { setUI, useUI } from '../lib/ui'
import { Icon, Mark } from './Icon'
import { KindGlyph } from './NoteRow'

export function SyncDot() {
  const s = useSync()
  const text =
    s.state === 'local'
      ? 'Bara på den här enheten'
      : s.state === 'signedout'
        ? 'Inte inloggad'
        : s.state === 'syncing'
          ? 'Synkar…'
          : s.state === 'offline'
            ? 'Offline – sparas lokalt'
            : s.state === 'error'
              ? 'Synkfel'
              : s.pending
                ? `${s.pending} väntar`
                : 'Synkad'
  return (
    <a className={`sync s-${s.state}`} href={href({ name: 'settings' })} title={s.error ?? text}>
      <i />
      <span>{text}</span>
    </a>
  )
}

export function Sidebar({ vault }: { vault: VaultId }) {
  const notes = useNotes()
  const route = useRoute()
  const ui = useUI()
  const activeId = route.name === 'note' ? route.id : undefined
  const counts = useMemo(() => {
    const c: Record<string, number> = { fysik: 0, matte: 0, inkorg: 0 }
    for (const n of notes) c[n.vault]++
    return c
  }, [notes])
  const tree = useMemo(() => {
    const list = notes.filter((n) => n.vault === vault)
    const folders = new Map<string, Note[]>()
    const loose: Note[] = []
    for (const n of list) {
      if (n.folder) {
        if (!folders.has(n.folder)) folders.set(n.folder, [])
        folders.get(n.folder)!.push(n)
      } else loose.push(n)
    }
    const byTitle = (a: Note, b: Note) => a.title.localeCompare(b.title, 'sv', { numeric: true })
    return {
      folders: [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0], 'sv', { numeric: true })).map(([f, ns]) => [f, ns.sort(byTitle)] as const),
      loose: loose.sort((a, b) => b.updated - a.updated),
    }
  }, [notes, vault])
  const active = activeId ? getNote(activeId) : undefined
  const [closed, setClosed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('athena.closed') || '[]'))
    } catch {
      return new Set()
    }
  })
  const toggle = (f: string) => {
    const s = new Set(closed)
    if (s.has(f)) s.delete(f)
    else s.add(f)
    setClosed(s)
    localStorage.setItem('athena.closed', JSON.stringify([...s]))
  }

  return (
    <aside className={`sidebar${ui.drawer ? ' open' : ''}`}>
      <div className="sb-top">
        <a className="sb-brand" href={href({ name: 'home' })} onClick={() => setUI({ drawer: false })}>
          <Mark size={22} />
          <span>Athena</span>
        </a>
        <button className="icon-btn sb-close" onClick={() => setUI({ drawer: false })} aria-label="Stäng">
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="sb-vaults">
        {VAULTS.filter((v) => v.id !== 'inkorg' || counts.inkorg > 0).map((v) => (
          <a key={v.id} className={`sb-vault${v.id === vault ? ' on' : ''}`} href={href({ name: 'vault', vault: v.id })}>
            <span>{v.name}</span>
            <small>{counts[v.id]}</small>
          </a>
        ))}
      </div>
      <div className="sb-actions">
        <button onClick={() => setUI({ switcher: true, drawer: false })}>
          <Icon name="search" size={18} />
          <span>Sök</span>
          <kbd>Ctrl K</kbd>
        </button>
        <button onClick={() => setUI({ newNote: { vault }, drawer: false })}>
          <Icon name="plus" size={18} />
          <span>Ny anteckning</span>
        </button>
        <a href={href({ name: 'graph', vault })} className={route.name === 'graph' ? 'on' : ''}>
          <Icon name="network" size={18} />
          <span>Graf</span>
        </a>
      </div>
      <nav className="sb-tree">
        {tree.folders.map(([folder, list]) => {
          const open = !closed.has(vault + '/' + folder) || list.some((n) => n.id === activeId)
          return (
            <div key={folder} className="sb-folder">
              <button className="sb-fhead" onClick={() => toggle(vault + '/' + folder)}>
                <Icon name="down" size={14} className={open ? '' : 'rot'} />
                <span>{folder}</span>
                <small>{list.length}</small>
              </button>
              {open &&
                list.map((n) => (
                  <a key={n.id} className={`sb-note${n.id === activeId ? ' on' : ''}`} href={href({ name: 'note', id: n.id })} onClick={() => setUI({ drawer: false })}>
                    <KindGlyph note={n} size={9} />
                    <span>{n.title}</span>
                  </a>
                ))}
            </div>
          )
        })}
        {tree.loose.length > 0 && (
          <div className="sb-folder">
            {tree.folders.length > 0 && <div className="sb-loose">Utan mapp</div>}
            {tree.loose.map((n) => (
              <a key={n.id} className={`sb-note${n.id === activeId ? ' on' : ''}`} href={href({ name: 'note', id: n.id })} onClick={() => setUI({ drawer: false })}>
                <KindGlyph note={n} size={9} />
                <span>{n.title}</span>
              </a>
            ))}
          </div>
        )}
        {!tree.folders.length && !tree.loose.length && <div className="sb-empty">Inga anteckningar i {VAULTS.find((v) => v.id === vault)?.name} än.</div>}
        {active && active.vault !== vault && <div className="sb-empty">Den öppna anteckningen ligger i ett annat valv.</div>}
      </nav>
      <div className="sb-foot">
        <button onClick={() => setUI({ calc: true, drawer: false })}>
          <Icon name="calc" size={18} />
          <span>Miniräknare</span>
        </button>
        <a href={href({ name: 'trash' })}>
          <Icon name="trash" size={18} />
          <span>Papperskorg</span>
        </a>
        <a href={href({ name: 'settings' })}>
          <Icon name="settings" size={18} />
          <span>Inställningar</span>
        </a>
        <SyncDot />
      </div>
    </aside>
  )
}
