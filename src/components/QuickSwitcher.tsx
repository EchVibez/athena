import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { go, useRoute } from '../lib/router'
import { getNote, useNotes } from '../lib/store'
import { vaultName, type VaultId } from '../lib/types'
import { setUI, useUI } from '../lib/ui'
import { fuzzy } from '../lib/util'
import { Icon } from './Icon'
import { KindGlyph } from './NoteRow'

type Item = { key: string; title: string; sub: string; icon?: string; run: () => void; note?: ReturnType<typeof getNote> }

/** Ctrl K: jump to any note or run a command, like Obsidian's quick switcher. */
export function QuickSwitcher() {
  const ui = useUI()
  const notes = useNotes()
  const route = useRoute()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const vault: VaultId = route.name === 'vault' ? route.vault : route.name === 'note' ? (getNote(route.id)?.vault ?? ui.lastVault) : ui.lastVault

  useEffect(() => {
    if (ui.switcher) {
      setQ('')
      setI(0)
      window.setTimeout(() => input.current?.focus(), 30)
    }
  }, [ui.switcher])

  const items = useMemo<Item[]>(() => {
    const close = () => setUI({ switcher: false })
    const cmds: Item[] = [
      { key: 'c-new', title: 'Ny anteckning', sub: `i ${vaultName(vault)}`, icon: 'plus', run: () => setUI({ switcher: false, newNote: { vault, title: q.trim() || undefined } }) },
      { key: 'c-task', title: 'Ny uppgift', sub: `i ${vaultName(vault)}`, icon: 'pen', run: () => setUI({ switcher: false, newNote: { vault, kind: 'uppgift', title: q.trim() || undefined } }) },
      { key: 'c-graph', title: 'Öppna grafen', sub: vaultName(vault), icon: 'network', run: () => (close(), go({ name: 'graph', vault })) },
      { key: 'c-calc', title: 'Miniräknare', sub: '', icon: 'calc', run: () => setUI({ switcher: false, calc: true }) },
      { key: 'c-fy', title: 'Gå till Fysik', sub: '', icon: 'atom', run: () => (close(), go({ name: 'vault', vault: 'fysik' })) },
      { key: 'c-ma', title: 'Gå till Matte', sub: '', icon: 'sigma', run: () => (close(), go({ name: 'vault', vault: 'matte' })) },
      { key: 'c-set', title: 'Inställningar', sub: '', icon: 'settings', run: () => (close(), go({ name: 'settings' })) },
    ]
    const qq = q.trim()
    const noteItems: Item[] = notes
      .map((n) => ({
        n,
        s: qq ? Math.max(fuzzy(qq, n.title) * 2, fuzzy(qq, n.folder), fuzzy(qq, n.tags.map((t) => '#' + t).join(' ')), n.text ? fuzzy(qq, n.text) * 0.25 : 0) + (n.vault === vault ? 4 : 0) : n.updated / 1e12,
      }))
      .filter((x) => !qq || x.s > 4)
      .sort((a, b) => b.s - a.s)
      .slice(0, qq ? 40 : 12)
      .map(({ n }) => ({ key: n.id, title: n.title, sub: [vaultName(n.vault), n.folder].filter(Boolean).join(' · '), note: n, run: () => (close(), go({ name: 'note', id: n.id })) }))
    const matchingCmds = cmds.filter((c) => !qq || fuzzy(qq, c.title) > 3)
    return qq ? [...noteItems, ...matchingCmds, ...(noteItems.length ? [] : [cmds[0]])] : [...noteItems.slice(0, 8), ...cmds]
  }, [notes, q, vault])

  useEffect(() => setI(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' })
  }, [i])

  if (!ui.switcher) return null
  return createPortal(
    <div className="qs-root" onPointerDown={(e) => e.target === e.currentTarget && setUI({ switcher: false })}>
      <div className="qs" role="dialog" aria-label="Sök">
        <div className="qs-input">
          <Icon name="search" size={20} />
          <input
            ref={input}
            value={q}
            placeholder="Sök anteckningar eller kommandon…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setI((x) => Math.min(items.length - 1, x + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setI((x) => Math.max(0, x - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                items[i]?.run()
              } else if (e.key === 'Escape') setUI({ switcher: false })
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="qs-list" ref={listRef}>
          {items.map((it, k) => (
            <button key={it.key} className={`qs-item${k === i ? ' on' : ''}`} onMouseEnter={() => setI(k)} onClick={() => it.run()}>
              {it.note ? <KindGlyph note={it.note} /> : <Icon name={it.icon ?? 'note'} size={18} />}
              <span className="qs-title">{it.title}</span>
              <small>{it.sub}</small>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
