export type VaultId = 'fysik' | 'matte' | 'inkorg'
export type Kind = 'anteckning' | 'uppgift' | 'losning' | 'material' | 'sammanfattning'
export type Format = 'ink' | 'text'
export type Paper = 'rutor' | 'linjer' | 'prickar' | 'blank'
export type Status = 'olost' | 'osaker' | 'lost'

export interface Note {
  id: string
  vault: VaultId
  title: string
  kind: Kind
  format: Format
  folder: string
  tags: string[]
  /** Outgoing links made with the link button (note ids). */
  links: string[]
  status?: Status
  /** Markdown body, for text notes. */
  text?: string
  /** Ordered page ids, for ink notes. */
  pages: string[]
  paper: Paper
  importKey?: string
  created: number
  updated: number
  deleted?: boolean
}

export interface Stroke {
  id: string
  tool: 'pen' | 'hl'
  color: string
  size: number
  /** Pressure was simulated (mouse, finger) rather than measured (pen). */
  sim: boolean
  /** Flat list x, y, pressure, … in page units. */
  pts: number[]
}

export interface TextObj {
  type: 'text'
  id: string
  x: number
  y: number
  w: number
  text: string
  size: number
  color: string
}

export interface MathObj {
  type: 'math'
  id: string
  x: number
  y: number
  latex: string
  size: number
  color: string
}

export interface GraphFn {
  id: string
  expr: string
  color: string
}

export interface GraphObj {
  type: 'graph'
  id: string
  x: number
  y: number
  w: number
  h: number
  fns: GraphFn[]
  view: { x0: number; x1: number; y0: number; y1: number }
  show: { zeros: boolean; extrema: boolean; intersections: boolean }
}

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse'

export interface ShapeObj {
  type: 'shape'
  id: string
  shape: ShapeKind
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  size: number
}

export interface ImageObj {
  type: 'image'
  id: string
  x: number
  y: number
  w: number
  h: number
  asset: string
}

export type Obj = TextObj | MathObj | GraphObj | ShapeObj | ImageObj

export interface Page {
  id: string
  noteId: string
  /** Asset id of a scanned/imported page drawn under everything. */
  bg?: string
  paper?: Paper
  strokes: Stroke[]
  objects: Obj[]
  updated: number
  deleted?: boolean
}

export interface AssetMeta {
  id: string
  mime: string
  size: number
  updated: number
  deleted?: boolean
}

export const VAULTS: { id: VaultId; name: string }[] = [
  { id: 'fysik', name: 'Fysik' },
  { id: 'matte', name: 'Matte' },
  { id: 'inkorg', name: 'Inkorg' },
]

export const KINDS: { id: Kind; name: string; plural: string }[] = [
  { id: 'anteckning', name: 'Anteckning', plural: 'Anteckningar' },
  { id: 'uppgift', name: 'Uppgift', plural: 'Uppgifter' },
  { id: 'losning', name: 'Lösning', plural: 'Lösningar' },
  { id: 'material', name: 'Material', plural: 'Material' },
  { id: 'sammanfattning', name: 'Sammanfattning', plural: 'Sammanfattningar' },
]

export const STATUSES: { id: Status; name: string }[] = [
  { id: 'olost', name: 'Inte löst' },
  { id: 'osaker', name: 'Osäker' },
  { id: 'lost', name: 'Löst' },
]

export const PAPERS: { id: Paper; name: string }[] = [
  { id: 'rutor', name: 'Rutor' },
  { id: 'linjer', name: 'Linjer' },
  { id: 'prickar', name: 'Prickar' },
  { id: 'blank', name: 'Blank' },
]

export const vaultName = (v: VaultId) => VAULTS.find((x) => x.id === v)?.name ?? v
export const kindName = (k: Kind) => KINDS.find((x) => x.id === k)?.name ?? k

/** A4 at 96 dpi, the same size the imported OneNote pages have. */
export const PAGE_W = 794
export const PAGE_H = 1123
export const PAGE_GAP = 32
export const GRID = 20
