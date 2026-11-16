import { Icon } from '../components/Icon'
import { KindGlyph } from '../components/NoteRow'
import { Empty } from '../components/ui'
import { back } from '../lib/router'
import { deletedNotes, purgeNote, restoreNote, useVersion } from '../lib/store'
import { vaultName } from '../lib/types'
import { relTime } from '../lib/util'

export function Trash() {
  useVersion()
  const list = deletedNotes()
    .filter((n) => n.title)
    .sort((a, b) => b.updated - a.updated)
  return (
    <div className="page">
      <header className="top">
        <button className="icon-btn" onClick={() => back()} aria-label="Tillbaka">
          <Icon name="back" />
        </button>
      </header>
      <div className="head">
        <h1 className="title">Papperskorg</h1>
        <p className="subtitle">Borttagna anteckningar kan läggas tillbaka.</p>
      </div>
      {list.length ? (
        <div className="list section tight">
          {list.map((n) => (
            <div key={n.id} className="nrow static">
              <KindGlyph note={n} />
              <span className="nrow-main">
                <span className="nrow-title">{n.title}</span>
                <span className="nrow-sub">
                  {vaultName(n.vault)} · borttagen {relTime(n.updated)}
                </span>
              </span>
              <button className="pill-btn" onClick={() => void restoreNote(n.id)}>
                <Icon name="restore" size={16} /> Återställ
              </button>
              <button className="icon-btn" aria-label="Radera för gott" onClick={() => confirm(`Radera "${n.title}" för gott? Det går inte att ångra.`) && void purgeNote(n.id)}>
                <Icon name="trash" size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Papperskorgen är tom" />
      )}
    </div>
  )
}
