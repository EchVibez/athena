import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { NoteRow } from '../components/NoteRow'
import { Empty, Menu, useMenu } from '../components/ui'
import { href } from '../lib/router'
import { useNotes, updateNote } from '../lib/store'
import { KINDS, vaultName, type Kind, type Note, type VaultId } from '../lib/types'
import { setUI } from '../lib/ui'
import { fuzzy, plural } from '../lib/util'

export function VaultView({ vault }: { vault: VaultId }) {
  const notes = useNotes()
  const [kind, setKind] = useState<Kind | 'alla'>('alla')
  const [q, setQ] = useState('')
  useEffect(() => {
    if (vault !== 'inkorg') setUI({ lastVault: vault })
  }, [vault])
  const list = useMemo(() => notes.filter((n) => n.vault === vault && (kind === 'alla' || n.kind === kind)), [notes, vault, kind])
  const searched = useMemo(() => {
    if (!q.trim()) return null
    return list
      .map((n) => ({ n, s: Math.max(fuzzy(q, n.title) * 2, fuzzy(q, n.folder), fuzzy(q, n.tags.join(' ')), n.text ? fuzzy(q, n.text) * 0.3 : 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.n)
  }, [list, q])
  const groups = useMemo(() => {
    const m = new Map<string, Note[]>()
    for (const n of list) {
      const f = n.folder || ''
      if (!m.has(f)) m.set(f, [])
      m.get(f)!.push(n)
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : a[0].localeCompare(b[0], 'sv', { numeric: true })))
      .map(([f, ns]) => [f, ns.sort((a, b) => a.title.localeCompare(b.title, 'sv', { numeric: true }))] as const)
  }, [list])
  const tasks = notes.filter((n) => n.vault === vault && n.kind === 'uppgift')
  const solved = tasks.filter((n) => n.status === 'lost').length
  const kinds = KINDS.filter((k) => notes.some((n) => n.vault === vault && n.kind === k.id))

  return (
    <div className="page vault">
      <header className="top">
        <button className="icon-btn only-mobile" onClick={() => setUI({ drawer: true })} aria-label="Meny">
          <Icon name="menu" />
        </button>
        <a className="icon-btn only-mobile" href={href({ name: 'home' })} aria-label="Hem">
          <Icon name="home" />
        </a>
        <div className="top-actions">
          <a className="pill-btn" href={href({ name: 'graph', vault })}>
            <Icon name="network" size={18} />
            <span>Graf</span>
          </a>
          <button className="pill-btn strong" onClick={() => setUI({ newNote: { vault } })}>
            <Icon name="plus" size={18} />
            <span>Ny</span>
          </button>
        </div>
      </header>
      <div className="head">
        <h1 className="title">{vaultName(vault)}</h1>
        <p className="subtitle">
          {plural(notes.filter((n) => n.vault === vault).length, 'anteckning', 'anteckningar')}
          {tasks.length > 0 && ` · ${solved} av ${tasks.length} uppgifter lösta`}
        </p>
        {tasks.length > 0 && (
          <div className="bar">
            <i style={{ transform: `scaleX(${solved / tasks.length})` }} />
          </div>
        )}
      </div>

      <div className="search-field">
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Sök i ${vaultName(vault)}`} />
        {q && (
          <button className="icon-btn" onClick={() => setQ('')} aria-label="Rensa">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {kinds.length > 1 && (
        <div className="chips filter">
          <button className={`chip-btn${kind === 'alla' ? ' on' : ''}`} onClick={() => setKind('alla')}>
            Alla
          </button>
          {kinds.map((k) => (
            <button key={k.id} className={`chip-btn${kind === k.id ? ' on' : ''}`} onClick={() => setKind(k.id)}>
              {k.plural}
            </button>
          ))}
        </div>
      )}

      {searched ? (
        <section className="section tight">
          <div className="label">{plural(searched.length, 'träff', 'träffar')}</div>
          <div className="list">
            {searched.map((n) => (
              <Row key={n.id} n={n} vault={vault} />
            ))}
          </div>
        </section>
      ) : list.length === 0 ? (
        <Empty
          title={vault === 'inkorg' ? 'Inkorgen är tom' : `${vaultName(vault)} är tomt`}
          sub={vault === 'inkorg' ? 'Anteckningar du inte har sorterat hamnar här.' : 'Skapa en anteckning eller importera material under Inställningar.'}
        >
          {vault !== 'inkorg' && (
            <button className="wide" style={{ maxWidth: 260, marginTop: 20 }} onClick={() => setUI({ newNote: { vault } })}>
              Ny anteckning
            </button>
          )}
        </Empty>
      ) : (
        groups.map(([folder, ns]) => (
          <section key={folder} className="section tight">
            <div className="label">{folder || 'Utan mapp'}</div>
            <div className="list">
              {ns.map((n) => (
                <Row key={n.id} n={n} vault={vault} />
              ))}
            </div>
          </section>
        ))
      )}
      <div style={{ height: 120 }} />
    </div>
  )
}

function Row({ n, vault }: { n: Note; vault: VaultId }) {
  const m = useMenu()
  if (vault !== 'inkorg') return <NoteRow note={n} />
  return (
    <div className="inbox-row">
      <NoteRow note={n} />
      <button className="pill-btn" onClick={m.open}>
        Flytta
      </button>
      {m.anchor && (
        <Menu
          anchor={m.anchor}
          onClose={m.close}
          items={[
            { label: 'Till Fysik', icon: 'atom', onClick: () => void updateNote(n.id, { vault: 'fysik' }) },
            { label: 'Till Matte', icon: 'sigma', onClick: () => void updateNote(n.id, { vault: 'matte' }) },
          ]}
        />
      )}
    </div>
  )
}
