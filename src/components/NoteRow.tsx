import { href } from '../lib/router'
import { STATUSES, kindName, vaultName, type Note } from '../lib/types'
import { relTime } from '../lib/util'

export function KindGlyph({ note, size = 12 }: { note: Note; size?: number }) {
  return <span className={`glyph k-${note.kind}${note.status === 'lost' ? ' solved' : ''}`} style={{ width: size, height: size }} />
}

export function NoteRow({ note, showVault, sub }: { note: Note; showVault?: boolean; sub?: string }) {
  const status = note.kind === 'uppgift' ? STATUSES.find((s) => s.id === note.status) : undefined
  return (
    <a className="nrow" href={href({ name: 'note', id: note.id })}>
      <KindGlyph note={note} />
      <span className="nrow-main">
        <span className="nrow-title">{note.title}</span>
        <span className="nrow-sub">
          {sub ?? [showVault ? vaultName(note.vault) : '', note.folder, kindName(note.kind), relTime(note.updated)].filter(Boolean).join(' · ')}
        </span>
      </span>
      {status && <span className={`status s-${status.id}`}>{status.name}</span>}
    </a>
  )
}
