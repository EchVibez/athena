import { useEffect, useState } from 'react'
import { Calculator } from './components/Calculator'
import { Mark } from './components/Icon'
import { NewNoteSheet } from './components/NewNoteSheet'
import { QuickSwitcher } from './components/QuickSwitcher'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/ui'
import { usePrefs } from './lib/prefs'
import { useRoute } from './lib/router'
import { getNote, isReady, useVersion } from './lib/store'
import type { VaultId } from './lib/types'
import { setUI, useUI } from './lib/ui'
import { GraphScreen } from './screens/GraphScreen'
import { Home } from './screens/Home'
import { NoteView } from './screens/NoteView'
import { Settings } from './screens/Settings'
import { Trash } from './screens/Trash'
import { VaultView } from './screens/VaultView'

export default function App() {
  const route = useRoute()
  const ui = useUI()
  const prefs = usePrefs()
  useVersion()
  const [intro, setIntro] = useState(() => !sessionStorage.getItem('athena.intro'))

  useEffect(() => {
    if (!intro) return
    sessionStorage.setItem('athena.intro', '1')
    const t = window.setTimeout(() => setIntro(false), 1300)
    return () => window.clearTimeout(t)
  }, [intro])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'o' || e.key.toLowerCase() === 'p')) {
        e.preventDefault()
        setUI({ switcher: !ui.switcher })
      } else if (mod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault()
        setUI({ newNote: { vault: ui.lastVault } })
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [ui.switcher, ui.lastVault])

  useEffect(() => {
    setUI({ drawer: false })
    window.scrollTo(0, 0)
  }, [route])

  if (!isReady()) return <div className="boot-blank" />

  let vault: VaultId | null = null
  let screen: React.ReactNode
  switch (route.name) {
    case 'home':
      screen = <Home />
      break
    case 'vault':
      vault = route.vault
      screen = <VaultView vault={route.vault} />
      break
    case 'graph':
      vault = route.vault === 'alla' ? ui.lastVault : route.vault
      screen = <GraphScreen vault={route.vault} />
      break
    case 'note':
      vault = getNote(route.id)?.vault ?? ui.lastVault
      screen = <NoteView key={route.id} id={route.id} />
      break
    case 'settings':
      screen = <Settings />
      break
    case 'trash':
      screen = <Trash />
      break
  }
  const withSidebar = vault !== null
  const showSidebar = withSidebar && (prefs.sidebar || route.name !== 'note')

  return (
    <div className={`shell${showSidebar ? ' has-sb' : ''}${withSidebar ? ' sb-route' : ''}${route.name === 'note' ? ' r-note' : ''}`}>
      {withSidebar && <Sidebar vault={vault!} />}
      {ui.drawer && <div className="drawer-scrim" onClick={() => setUI({ drawer: false })} />}
      <main className="main">{screen}</main>
      <NewNoteSheet />
      <QuickSwitcher />
      <Calculator />
      {ui.toast && <Toast key={ui.toast.id} text={ui.toast.text} />}
      {intro && (
        <div className="intro">
          <Mark size={64} draw />
        </div>
      )}
    </div>
  )
}
