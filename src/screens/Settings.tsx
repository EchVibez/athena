import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Segmented, Switch } from '../components/ui'
import { setPrefs, usePrefs } from '../lib/prefs'
import { back } from '../lib/router'
import { useNotes, wipeLocal } from '../lib/store'
import { config, restartSync, signIn, signOut, signUp, syncNow, useSync } from '../lib/sync'
import { download, exportBackup, importZip } from '../lib/transfer'
import { PAPERS } from '../lib/types'
import { toast } from '../lib/ui'
import { relTime } from '../lib/util'

export function Settings() {
  const prefs = usePrefs()
  const sync = useSync()
  const notes = useNotes()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const runImport = async (f: File) => {
    setBusy('Läser paketet…')
    try {
      const r = await importZip(f, (d, t) => setBusy(`Importerar sida ${d} av ${t}…`))
      toast(r.added ? `Importerade ${r.added} anteckningar (${r.pages} sidor)` : 'Allt i paketet fanns redan')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page settings">
      <header className="top">
        <button className="icon-btn" onClick={() => back()} aria-label="Tillbaka">
          <Icon name="back" />
        </button>
      </header>
      <div className="head">
        <h1 className="title">Inställningar</h1>
      </div>

      <section className="section">
        <div className="label">Konto och synk</div>
        <Account />
        {sync.state !== 'local' && (
          <div className="group">
            <div className="opt">
              <span className="opt-label">Status</span>
              <span className="opt-value">
                {sync.state === 'synced' ? `Synkad ${sync.last ? relTime(sync.last) : ''}` : sync.state === 'syncing' ? 'Synkar…' : sync.state === 'offline' ? 'Offline' : sync.state === 'error' ? 'Fel' : 'Inte inloggad'}
              </span>
            </div>
            {sync.error && <div className="opt-note err">{sync.error}</div>}
            {sync.pending > 0 && (
              <div className="opt">
                <span className="opt-label">Väntar på att skickas</span>
                <span className="opt-value">{sync.pending}</span>
              </div>
            )}
            {sync.email && (
              <button className="wide" style={{ marginTop: 14 }} onClick={() => void syncNow()}>
                Synka nu
              </button>
            )}
          </div>
        )}
        <Connection />
      </section>

      <section className="section">
        <div className="label">Utseende</div>
        <div className="group">
          <div className="opt">
            <span className="opt-label">Tema</span>
            <Segmented
              small
              value={prefs.theme}
              onChange={(t) => setPrefs({ theme: t })}
              options={[
                { id: 'system', name: 'Auto' },
                { id: 'dark', name: 'Mörkt' },
                { id: 'light', name: 'Ljust' },
              ]}
            />
          </div>
          <div className="opt">
            <span className="opt-label">Papperet</span>
            <Segmented
              small
              value={prefs.paperTone}
              onChange={(t) => setPrefs({ paperTone: t })}
              options={[
                { id: 'light', name: 'Vitt' },
                { id: 'dark', name: 'Mörkt' },
                { id: 'auto', name: 'Som temat' },
              ]}
            />
          </div>
          <div className="opt">
            <span className="opt-label">Nya ritblock</span>
            <Segmented small value={prefs.paper} onChange={(p) => setPrefs({ paper: p })} options={PAPERS} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="label">Ritning</div>
        <div className="group">
          <div className="opt">
            <span className="opt-label">Tryckkänslighet</span>
            <Switch on={prefs.pressure} onChange={(v) => setPrefs({ pressure: v })} />
          </div>
          <div className="opt">
            <span className="opt-label">Fäst former mot rutnätet</span>
            <Switch on={prefs.snap} onChange={(v) => setPrefs({ snap: v })} />
          </div>
          <div className="opt">
            <span className="opt-label">
              Rita med fingret
              <small>{prefs.penSeen ? 'En penna har använts här, så fingret flyttar och zoomar.' : 'Fingret ritar tills en penna används.'}</small>
            </span>
            <Switch on={prefs.fingerDraws || !prefs.penSeen} onChange={(v) => setPrefs({ fingerDraws: v, penSeen: v ? prefs.penSeen : true })} />
          </div>
          <div className="opt">
            <span className="opt-label">Vinklar i miniräknaren</span>
            <Segmented
              small
              value={prefs.deg ? 'deg' : 'rad'}
              onChange={(v) => setPrefs({ deg: v === 'deg' })}
              options={[
                { id: 'deg', name: 'Grader' },
                { id: 'rad', name: 'Radianer' },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="label">Data</div>
        <div className="group">
          <button className="opt opt-btn" onClick={() => file.current?.click()} disabled={!!busy}>
            <span className="opt-label">
              Importera paket eller säkerhetskopia
              <small>En .zip från Athena, t.ex. lärarens material.</small>
            </span>
            <Icon name="upload" size={20} />
          </button>
          <button
            className="opt opt-btn"
            disabled={!!busy}
            onClick={async () => {
              setBusy('Packar…')
              try {
                download(await exportBackup(), `athena-${new Date().toISOString().slice(0, 10)}.zip`)
              } finally {
                setBusy(null)
              }
            }}
          >
            <span className="opt-label">
              Spara säkerhetskopia
              <small>{notes.length} anteckningar med sidor och bilder, som en .zip.</small>
            </span>
            <Icon name="download" size={20} />
          </button>
        </div>
        {busy && <div className="opt-note">{busy}</div>}
        <input
          ref={file}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void runImport(f)
          }}
        />
        <button
          className="wide ghost"
          style={{ marginTop: 18 }}
          onClick={async () => {
            if (!confirm(sync.email ? 'Rensa allt på den här enheten? Det som redan är synkat finns kvar i ditt konto.' : 'Rensa allt på den här enheten? Utan konto går det inte att få tillbaka.')) return
            await wipeLocal()
            location.reload()
          }}
        >
          Rensa data på den här enheten
        </button>
      </section>
      <p className="about">Athena · dina valv för fysik och matte</p>
    </div>
  )
}

function Account() {
  const sync = useSync()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [err, setErr] = useState<string | null>(null)
  const [wait, setWait] = useState(false)
  if (sync.state === 'local')
    return (
      <div className="card-note">
        Synk är inte inställd än. Allt sparas på den här enheten tills du kopplar in Supabase nedan.
      </div>
    )
  if (sync.email)
    return (
      <div className="group">
        <div className="opt">
          <span className="opt-label">Inloggad som</span>
          <span className="opt-value">{sync.email}</span>
        </div>
        <button className="wide ghost" onClick={() => void signOut()}>
          Logga ut
        </button>
      </div>
    )
  return (
    <form
      className="auth"
      onSubmit={async (e) => {
        e.preventDefault()
        setErr(null)
        setWait(true)
        try {
          if (mode === 'in') await signIn(email.trim(), pw)
          else {
            const confirmMail = await signUp(email.trim(), pw)
            if (confirmMail) setErr('Kolla din e-post och bekräfta kontot, logga sedan in här.')
          }
        } catch (x) {
          setErr((x as Error).message)
        } finally {
          setWait(false)
        }
      }}
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { id: 'in', name: 'Logga in' },
          { id: 'up', name: 'Skapa konto' },
        ]}
      />
      <input className="field" type="email" autoComplete="email" placeholder="E-post" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="field" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="Lösenord" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
      {err && <div className="opt-note err">{err}</div>}
      <button className="wide strong" disabled={wait}>
        {wait ? 'Vänta…' : mode === 'in' ? 'Logga in' : 'Skapa konto'}
      </button>
    </form>
  )
}

function Connection() {
  const prefs = usePrefs()
  const fromBuild = !!import.meta.env.VITE_SUPABASE_URL
  const [open, setOpen] = useState(!config())
  const [url, setUrl] = useState(prefs.supabaseUrl)
  const [key, setKey] = useState(prefs.supabaseKey)
  if (fromBuild && !open)
    return (
      <button className="text-btn small" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
        Avancerat: annan Supabase-server
      </button>
    )
  if (!open)
    return (
      <button className="text-btn small" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
        Ändra Supabase-anslutning
      </button>
    )
  return (
    <div className="group conn">
      <div className="opt-note">Fyll i från Supabase → Project Settings → API. Använd den publika anon-nyckeln, aldrig service_role.</div>
      <input className="field" placeholder="Project URL (https://….supabase.co)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <input className="field" placeholder="anon / publishable key" value={key} onChange={(e) => setKey(e.target.value)} />
      <button
        className="wide"
        onClick={async () => {
          setPrefs({ supabaseUrl: url.trim(), supabaseKey: key.trim() })
          await restartSync()
          setOpen(false)
          toast('Anslutningen sparad')
        }}
      >
        Spara anslutning
      </button>
    </div>
  )
}
