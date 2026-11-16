import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { NetworkGraph } from '../components/NetworkGraph'
import { Empty, Segmented } from '../components/ui'
import { useLinkIndex } from '../lib/links'
import { go, href } from '../lib/router'
import { useNotes } from '../lib/store'
import { KINDS, type Kind, type VaultId } from '../lib/types'
import { setUI } from '../lib/ui'

export function GraphScreen({ vault }: { vault: VaultId | 'alla' }) {
  const notes = useNotes()
  const idx = useLinkIndex()
  const [q, setQ] = useState('')
  const [hidden, setHidden] = useState<Set<Kind>>(new Set())
  const [orphans, setOrphans] = useState(true)
  const shown = useMemo(
    () =>
      notes.filter(
        (n) =>
          (vault === 'alla' || n.vault === vault) &&
          !hidden.has(n.kind) &&
          (orphans || (idx.out.get(n.id)?.size ?? 0) + (idx.in.get(n.id)?.size ?? 0) > 0),
      ),
    [notes, vault, hidden, orphans, idx],
  )
  return (
    <div className="graphscreen">
      <header className="graph-top">
        <button className="icon-btn only-mobile" onClick={() => setUI({ drawer: true })} aria-label="Meny">
          <Icon name="menu" />
        </button>
        <a className="icon-btn" href={href(vault === 'alla' ? { name: 'home' } : { name: 'vault', vault })} aria-label="Tillbaka">
          <Icon name="back" />
        </a>
        <Segmented
          small
          value={vault}
          onChange={(v) => go({ name: 'graph', vault: v }, true)}
          options={[
            { id: 'fysik', name: 'Fysik' },
            { id: 'matte', name: 'Matte' },
            { id: 'alla', name: 'Båda' },
          ]}
        />
        <div className="search-field small">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Markera…" />
        </div>
      </header>
      {shown.length ? (
        <NetworkGraph notes={shown} idx={idx} query={q} onOpen={(id) => go({ name: 'note', id })} />
      ) : (
        <Empty title="Inget att visa" sub="Skapa anteckningar och länka ihop dem – då växer nätverket här." />
      )}
      <div className="legend">
        {KINDS.map((k) => (
          <button
            key={k.id}
            className={hidden.has(k.id) ? 'off' : ''}
            onClick={() => {
              const s = new Set(hidden)
              if (s.has(k.id)) s.delete(k.id)
              else s.add(k.id)
              setHidden(s)
            }}
          >
            <span className={`glyph k-${k.id}`} />
            {k.plural}
          </button>
        ))}
        <button className={orphans ? '' : 'off'} onClick={() => setOrphans(!orphans)}>
          Utan länkar
        </button>
      </div>
    </div>
  )
}
