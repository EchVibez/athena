import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Segmented } from '../components/ui'
import { resolveTitle } from '../lib/links'
import { go } from '../lib/router'
import { allNotes, createNote, updateNote } from '../lib/store'
import type { Note } from '../lib/types'
import { fuzzy } from '../lib/util'
import { renderMarkdown } from './markdown'

export function TextNote({ note }: { note: Note }) {
  const [mode, setMode] = useState<'read' | 'edit'>(note.text?.trim() ? 'read' : 'edit')
  const [text, setText] = useState(note.text ?? '')
  const saveT = useRef<number | undefined>(undefined)
  const ta = useRef<HTMLTextAreaElement>(null)
  const [ac, setAc] = useState<{ q: string; start: number; i: number } | null>(null)

  useEffect(() => {
    setText(note.text ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id])

  // Text changed on another device while this one is only reading.
  useEffect(() => {
    if (mode === 'read' && note.text !== undefined && note.text !== text) setText(note.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.text])

  const save = (v: string) => {
    window.clearTimeout(saveT.current)
    saveT.current = window.setTimeout(() => void updateNote(note.id, { text: v }), 500)
  }
  useEffect(() => () => window.clearTimeout(saveT.current), [])

  const html = useMemo(
    () =>
      renderMarkdown(text || '*Tom anteckning. Tryck på Redigera.*', (t) => {
        const n = resolveTitle(t, note.vault)
        return n ? { id: n.id } : null
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, note.vault, allNotes().length],
  )

  useLayoutEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, 320) + 'px'
  })

  const suggestions = useMemo(() => {
    if (!ac) return []
    return allNotes()
      .filter((n) => n.id !== note.id)
      .map((n) => ({ n, s: fuzzy(ac.q, n.title) + (n.vault === note.vault ? 5 : 0) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 7)
      .map((x) => x.n)
  }, [ac, note.id, note.vault])

  const onInput = (v: string, caret: number) => {
    setText(v)
    save(v)
    const before = v.slice(0, caret)
    const open = before.lastIndexOf('[[')
    if (open >= 0 && !before.slice(open).includes(']]') && !before.slice(open).includes('\n')) setAc({ q: before.slice(open + 2), start: open + 2, i: 0 })
    else setAc(null)
  }

  const pick = (title: string) => {
    const el = ta.current
    if (!el || !ac) return
    const caret = el.selectionStart
    const after = text.slice(caret)
    const close = after.startsWith(']]') ? '' : ']]'
    const v = text.slice(0, ac.start) + title + close + after
    setText(v)
    save(v)
    setAc(null)
    const pos = ac.start + title.length + 2
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  const onClick = async (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a.wikilink') as HTMLElement | null
    if (!a) return
    e.preventDefault()
    if (a.dataset.id) go({ name: 'note', id: a.dataset.id })
    else if (a.dataset.title) {
      const n = await createNote({ vault: note.vault, title: a.dataset.title, folder: note.folder })
      go({ name: 'note', id: n.id })
    }
  }

  return (
    <div className="textnote">
      <div className="tn-bar">
        <Segmented
          small
          value={mode}
          onChange={(m) => {
            if (m === 'read') void updateNote(note.id, { text })
            setMode(m)
          }}
          options={[
            { id: 'read', name: 'Läs' },
            { id: 'edit', name: 'Redigera' },
          ]}
        />
      </div>
      {mode === 'read' ? (
        <article className="md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <div className="tn-edit">
          <textarea
            ref={ta}
            className="tn-area"
            value={text}
            spellCheck
            autoFocus
            placeholder={'Skriv här. [[Titel]] länkar till en annan anteckning, $v = s/t$ blir en formel, # Rubrik, - lista.'}
            onChange={(e) => onInput(e.target.value, e.target.selectionStart)}
            onBlur={() => window.setTimeout(() => setAc(null), 150)}
            onKeyDown={(e) => {
              if (!ac || !suggestions.length) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setAc({ ...ac, i: (ac.i + 1) % suggestions.length })
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setAc({ ...ac, i: (ac.i - 1 + suggestions.length) % suggestions.length })
              } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                pick(suggestions[ac.i].title)
              } else if (e.key === 'Escape') setAc(null)
            }}
          />
          {ac && suggestions.length > 0 && (
            <div className="ac">
              {suggestions.map((n, i) => (
                <button key={n.id} className={i === ac.i ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(n.title)}>
                  <span>{n.title}</span>
                  <small>{n.folder || (n.vault === 'fysik' ? 'Fysik' : n.vault === 'matte' ? 'Matte' : 'Inkorg')}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
