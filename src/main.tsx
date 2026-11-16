import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import App from './App'
import { applyTheme } from './lib/prefs'
import { init } from './lib/store'
import { startSync } from './lib/sync'

async function boot() {
  applyTheme()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  await init()
  void startSync()

  if (import.meta.env.DEV) {
    // Handy in development: window.athena.importUrl('/@fs/…/paket.zip')
    const { importZip } = await import('./lib/transfer')
    ;(window as any).athena = {
      importUrl: async (url: string) => importZip(await (await fetch(url)).blob(), (d, t) => console.log(`import ${d}/${t}`)),
    }
  }

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  }
}

boot()
