import { useEffect, useRef, useState } from 'react'
import { go } from '../lib/router'
import { addLink, createNote, folderList } from '../lib/store'
import { KINDS, VAULTS, type Kind, type VaultId } from '../lib/types'
import { setUI, useUI } from '../lib/ui'
import { Icon } from './Icon'
import { Segmented, Sheet } from './ui'

export function NewNoteSheet() {
  const ui = useUI()
  const d = ui.newNote
  const [title, setTitle] = useState('')
  const [vault, setVault] = useState<VaultId>('fysik')
  const [kind, setKind] = useState<Kind>('anteckning')
  const [format, setFormat] = useState<'ink' | 'text'>('ink')
  const [folder, setFolder] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!d) return
    setTitle(d.title ?? '')
    setVault(d.vault ?? ui.lastVault)
    setKind(d.kind ?? 'anteckning')
    setFormat(d.format ?? 'ink')
    setFolder(d.folder ?? '')
    window.setTimeout(() => input.current?.focus(), 360)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d])

  const close = () => setUI({ newNote: null })
  const create = async () => {
    const n = await createNote({ vault, kind, format, folder, title: title.trim() || (kind === 'uppgift' ? 'Ny uppgift' : 'Ny anteckning') })
    if (d?.linkFrom) await addLink(d.linkFrom, n.id)
    close()
    go({ name: 'note', id: n.id })
  }
  const folders = folderList(vault)

  return (
    <Sheet
      open={!!d}
      onClose={close}
      title="Ny anteckning"
      action={
        <button className="head-btn strong" onClick={create}>
          Skapa
        </button>
      }
    >
      <input
        ref={input}
        className="field-title"
        placeholder={kind === 'uppgift' ? 'Uppgift 3.14' : 'Titel'}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void create()}
      />
      <div className="label nn-label">Valv</div>
      <Segmented value={vault} onChange={setVault} options={VAULTS} />
      <div className="label nn-label">Typ</div>
      <div className="chips">
        {KINDS.map((k) => (
          <button key={k.id} className={`chip-btn${kind === k.id ? ' on' : ''}`} onClick={() => setKind(k.id)}>
            {k.name}
          </button>
        ))}
      </div>
      <div className="label nn-label">Format</div>
      <div className="formats">
        <button className={`format${format === 'ink' ? ' on' : ''}`} onClick={() => setFormat('ink')}>
          <Icon name="page" size={26} />
          <span>Ritblock</span>
          <small>Rutat papper, penna, grafer</small>
        </button>
        <button className={`format${format === 'text' ? ' on' : ''}`} onClick={() => setFormat('text')}>
          <Icon name="text" size={26} />
          <span>Text</span>
          <small>Skriv med [[länkar]] och formler</small>
        </button>
      </div>
      <div className="label nn-label">Mapp</div>
      <input className="field" list="nn-folders" placeholder="Valfritt, t.ex. Kap 4 – Kraft" value={folder} onChange={(e) => setFolder(e.target.value)} />
      <datalist id="nn-folders">
        {folders.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <button className="wide strong" style={{ marginTop: 26 }} onClick={create}>
        Skapa och öppna
      </button>
    </Sheet>
  )
}
