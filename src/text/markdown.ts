import katex from 'katex'
import { Marked } from 'marked'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const md = new Marked({
  gfm: true,
  breaks: true,
  async: false,
  renderer: {
    // Raw HTML in a note is shown as text, never run.
    html(token: { text: string }) {
      return esc(token.text)
    },
  },
})

/** Markdown with [[wiki links]], $inline$ and $$display$$ formulas. */
export function renderMarkdown(src: string, resolve: (title: string) => { id: string } | null): string {
  const parts: string[] = []
  const hold = (html: string) => {
    parts.push(html)
    return `${parts.length - 1}`
  }
  let s = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => hold(katex.renderToString(t.trim(), { displayMode: true, throwOnError: false })))
  s = s.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, pre, t) => pre + hold(katex.renderToString(t, { throwOnError: false })))
  s = s.replace(/\[\[([^\]|#\n]+)(#[^\]|\n]*)?(?:\|([^\]\n]*))?\]\]/g, (_, title: string, _h, alias?: string) => {
    const t = title.trim()
    const label = esc((alias ?? t).trim())
    const hit = resolve(t)
    return hold(hit ? `<a class="wikilink" data-id="${hit.id}">${label}</a>` : `<a class="wikilink unresolved" data-title="${esc(t)}">${label}</a>`)
  })
  s = s.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_, pre, tag) => pre + hold(`<span class="md-tag">#${esc(tag)}</span>`))
  let html = md.parse(s) as string
  html = html.replace(/(\d+)/g, (_, i) => parts[+i])
  return html
}
