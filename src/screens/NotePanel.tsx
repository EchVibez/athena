import { useState } from 'react'
import { Icon } from '../components/Icon'
import { LinkPicker } from '../components/LinkPicker'
import { NetworkGraph } from '../components/NetworkGraph'
import { KindGlyph } from '../components/NoteRow'
import { Segmented } from '../components/ui'
import { useLinkIndex } from '../lib/links'
import { go, href } from '../lib/router'
import { addLink, createNote, folderList, getNote, removeLink, updateNote, useNotes } from '../lib/store'
import { KINDS, STATUSES, VAULTS, type Note } from '../lib/types'
import { relTime } from '../lib/util'

export function NotePanel({ note }: { note: Note }) {
  const idx = useLinkIndex()
  const notes = useNotes()
  const [picking, setPicking] = useState(false)
  const [tag, setTag] = useState('')
  const outgoing = [...(idx.out.get(note.id) ?? [])].map((id) => getNote(id)).filter((n): n is Note => !!n)
  const incoming = [...(idx.in.get(note.id) ?? [])].map((id) => getNote(id)).filter((n): n is Note => !!n)
  const explicit = new Set(note.links)
  const folders = folderList(note.vault)

  const makeSolution = async () => {
    const s = await createNote({ vault: note.vault, title: `Lösning – ${note.title}`, kind: 'losning', folder: note.folder, links: [note.id], tags: note.tags })
    await addLink(note.id, s.id)
    go({ name: 'note', id: s.id })
  }

  return (
    <div className="npanel">
      <div className="np-sec">
        <div className="label">Typ</div>
        <div className="chips">
          {KINDS.map((k) => (
            <button key={k.id} className={`chip-btn${note.kind === k.id ? ' on' : ''}`} onClick={() => void updateNote(note.id, { kind: k.id, status: k.id === 'uppgift' ? (note.status ?? 'olost') : note.status })}>
              {k.name}
            </button>
          ))}
        </div>
      </div>

      {note.kind === 'uppgift' && (
        <div className="np-sec">
          <div className="label">Status</div>
          <Segmented small value={note.status ?? 'olost'} options={STATUSES} onChange={(s) => void updateNote(note.id, { status: s })} />
          <button className="wide np-solve" onClick={makeSolution}>
            <Icon name="pen" size={18} /> Skapa lösning
          </button>
        </div>
      )}

      <div className="np-sec">
        <div className="label">Valv</div>
        <Segmented small value={note.vault} options={VAULTS} onChange={(v) => void updateNote(note.id, { vault: v })} />
      </div>

      <div className="np-sec">
        <div className="label">Mapp</div>
        <input className="field" list="np-folders" defaultValue={note.folder} key={note.id + note.folder} placeholder="t.ex. Kap 3 – Rörelse" onBlur={(e) => e.target.value.trim() !== note.folder && void updateNote(note.id, { folder: e.target.value.trim() })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        <datalist id="np-folders">
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </div>

      <div className="np-sec">
        <div className="label">Taggar</div>
        <div className="chips">
          {note.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
              <button aria-label={`Ta bort ${t}`} onClick={() => void updateNote(note.id, { tags: note.tags.filter((x) => x !== t) })}>
                <Icon name="close" size={12} />
              </button>
            </span>
          ))}
          <input
            className="tag-input"
            value={tag}
            placeholder="+ tagg"
            onChange={(e) => setTag(e.target.value.replace(/[#\s]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tag.trim()) {
                if (!note.tags.includes(tag.trim())) void updateNote(note.id, { tags: [...note.tags, tag.trim()] })
                setTag('')
              }
            }}
          />
        </div>
      </div>

      <div className="np-sec">
        <div className="np-row">
          <div className="label">Länkar</div>
          <button className="text-btn" onClick={() => setPicking(true)}>
            <Icon name="link" size={16} /> Länka
          </button>
        </div>
        {outgoing.length ? (
          outgoing.map((n) => (
            <div key={n.id} className="np-link">
              <a href={href({ name: 'note', id: n.id })}>
                <KindGlyph note={n} size={9} />
                <span>{n.title}</span>
              </a>
              {explicit.has(n.id) && (
                <button className="icon-btn" aria-label="Ta bort länken" onClick={() => void removeLink(note.id, n.id)}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="muted small">Inga länkar än.</div>
        )}
      </div>

      <div className="np-sec">
        <div className="label">Länkas från</div>
        {incoming.length ? (
          incoming.map((n) => (
            <div key={n.id} className="np-link">
              <a href={href({ name: 'note', id: n.id })}>
                <KindGlyph note={n} size={9} />
                <span>{n.title}</span>
              </a>
            </div>
          ))
        ) : (
          <div className="muted small">Inget länkar hit än.</div>
        )}
      </div>

      {outgoing.length + incoming.length > 0 && (
        <div className="np-sec">
          <div className="label">Lokal graf</div>
          <div className="np-graph">
            <NetworkGraph notes={notes} idx={idx} focus={note.id} depth={2} compact onOpen={(id) => id !== note.id && go({ name: 'note', id })} />
          </div>
        </div>
      )}

      <div className="np-sec muted small">
        Skapad {relTime(note.created)} · ändrad {relTime(note.updated)}
        {note.format === 'ink' && ` · ${note.pages.length} ${note.pages.length === 1 ? 'sida' : 'sidor'}`}
      </div>

      <LinkPicker
        open={picking}
        from={note}
        onClose={() => setPicking(false)}
        onPick={(id) => {
          void addLink(note.id, id)
          setPicking(false)
        }}
      />
    </div>
  )
}
