export const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

let seq = 0
/** Short id for things that live inside a page (strokes, objects). */
export const sid = (): string => Date.now().toString(36) + (seq++ % 1296).toString(36).padStart(2, '0') + Math.random().toString(36).slice(2, 6)

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number) {
  let t: number | undefined
  const d = (...a: Parameters<T>) => {
    window.clearTimeout(t)
    t = window.setTimeout(() => fn(...a), ms)
  }
  d.flush = () => {
    window.clearTimeout(t)
  }
  return d
}

const MONTHS = ['jan', 'feb', 'mars', 'apr', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec']

export function relTime(ms: number): string {
  const d = Date.now() - ms
  if (d < 60_000) return 'nyss'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min sedan`
  const a = new Date(ms)
  const now = new Date()
  const sameDay = a.toDateString() === now.toDateString()
  const hhmm = `${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`
  if (sameDay) return `idag ${hhmm}`
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (a.toDateString() === y.toDateString()) return `igår ${hhmm}`
  return `${a.getDate()} ${MONTHS[a.getMonth()]}${a.getFullYear() !== now.getFullYear() ? ' ' + a.getFullYear() : ''}`
}

export function longDate(d = new Date()): string {
  const days = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']
  const months = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
  return `${days[d.getDay()][0].toUpperCase() + days[d.getDay()].slice(1)} ${d.getDate()} ${months[d.getMonth()]}`
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Small fuzzy score: substring beats subsequence; 0 means no match. */
export function fuzzy(q: string, text: string): number {
  if (!q) return 1
  const a = norm(q)
  const b = norm(text)
  const i = b.indexOf(a)
  if (i >= 0) return 100 - i + (i === 0 ? 50 : 0)
  let j = 0
  let score = 0
  for (let k = 0; k < b.length && j < a.length; k++) {
    if (b[k] === a[j]) {
      j++
      score += 1
    }
  }
  return j === a.length ? score : 0
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches
}
