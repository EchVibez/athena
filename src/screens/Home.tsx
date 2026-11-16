import { useMemo } from 'react'
import { Icon, Mark } from '../components/Icon'
import { NoteRow } from '../components/NoteRow'
import { SyncDot } from '../components/Sidebar'
import { Empty } from '../components/ui'
import { useLinkIndex } from '../lib/links'
import { href } from '../lib/router'
import { useNotes } from '../lib/store'
import type { Note, VaultId } from '../lib/types'
import { setUI, useUI } from '../lib/ui'
import { longDate, plural, relTime } from '../lib/util'

export function Home() {
  const notes = useNotes()
  const idx = useLinkIndex()
  const ui = useUI()
  const by = useMemo(() => {
    const m: Record<VaultId, Note[]> = { fysik: [], matte: [], inkorg: [] }
    for (const n of notes) m[n.vault].push(n)
    return m
  }, [notes])
  const recent = useMemo(() => [...notes].sort((a, b) => b.updated - a.updated).slice(0, 6), [notes])
  const practice = useMemo(
    () =>
      notes
        .filter((n) => n.kind === 'uppgift' && n.status !== 'lost')
        .sort((a, b) => (a.status === 'osaker' ? -1 : 0) - (b.status === 'osaker' ? -1 : 0) || b.updated - a.updated)
        .slice(0, 6),
    [notes],
  )
  const links = (v: VaultId) => by[v].reduce((s, n) => s + (idx.out.get(n.id)?.size ?? 0), 0)

  return (
    <div className="page home">
      <header className="top">
        <a className="brand" href={href({ name: 'home' })}>
          <Mark size={24} />
          <span className="wordmark">Athena</span>
        </a>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => setUI({ switcher: true })} aria-label="Sök">
            <Icon name="search" />
          </button>
          <a className="icon-btn" href={href({ name: 'settings' })} aria-label="Inställningar">
            <Icon name="settings" />
          </a>
        </div>
      </header>

      <div className="head rv" style={{ ['--d' as any]: 0 }}>
        <h1 className="title">{longDate()}</h1>
        <p className="subtitle">
          {plural(notes.length, 'anteckning', 'anteckningar')} i dina valv · <SyncDot />
        </p>
      </div>

      <div className="vault-cards rv" style={{ ['--d' as any]: 80 }}>
        {(['fysik', 'matte'] as const).map((v) => {
          const list = by[v]
          const last = list.reduce((m, n) => Math.max(m, n.updated), 0)
          return (
            <a key={v} className={`vcard v-${v}`} href={href({ name: 'vault', vault: v })} onClick={() => setUI({ lastVault: v })}>
              <div className="vcard-icon">
                <Icon name={v === 'fysik' ? 'atom' : 'sigma'} size={26} />
              </div>
              <div className="vcard-name">{v === 'fysik' ? 'Fysik' : 'Matte'}</div>
              <div className="vcard-meta">
                {plural(list.length, 'anteckning', 'anteckningar')} · {plural(links(v), 'länk', 'länkar')}
              </div>
              <div className="vcard-last">{last ? `Senast ${relTime(last)}` : 'Tomt än så länge'}</div>
            </a>
          )
        })}
      </div>

      {by.inkorg.length > 0 && (
        <a className="inbox-line rv" style={{ ['--d' as any]: 140 }} href={href({ name: 'vault', vault: 'inkorg' })}>
          <Icon name="inbox" size={20} />
          <span>{plural(by.inkorg.length, 'anteckning väntar', 'anteckningar väntar')} på att läggas i Fysik eller Matte</span>
          <Icon name="next" size={18} />
        </a>
      )}

      <section className="section rv" style={{ ['--d' as any]: 180 }}>
        <div className="label">Fortsätt</div>
        {recent.length ? (
          <div className="list">
            {recent.map((n) => (
              <NoteRow key={n.id} note={n} showVault />
            ))}
          </div>
        ) : (
          <Empty title="Inget här än" sub="Tryck på plus för att skriva din första anteckning, eller importera material under Inställningar." />
        )}
      </section>

      {practice.length > 0 && (
        <section className="section rv" style={{ ['--d' as any]: 240 }}>
          <div className="label">Att öva på</div>
          <div className="list">
            {practice.map((n) => (
              <NoteRow key={n.id} note={n} showVault />
            ))}
          </div>
        </section>
      )}

      <div className="fade" />
      <button className={`fab${ui.newNote ? ' hidden' : ''}`} onClick={() => setUI({ newNote: { vault: ui.lastVault } })} aria-label="Ny anteckning">
        <Icon name="plus" size={28} />
      </button>
    </div>
  )
}
