/* Line icons drawn for Athena: 24×24, 1.6 stroke, round joins. */

const P: Record<string, string> = {
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  down: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
  menu: 'M4 7h16M4 12h16M4 17h16',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  pen: 'M4 20l1.2-4.6L16.6 4a1.9 1.9 0 0 1 2.7 0l.7.7a1.9 1.9 0 0 1 0 2.7L8.6 18.8 4 20zM14.5 6.1l3.4 3.4',
  marker: 'M9 15l-3.5 3.5H3v-2.5L6.5 12.5M9 15l7.5-7.5a2 2 0 0 0 0-2.8l-.2-.2a2 2 0 0 0-2.8 0L6 12M9 15l-3-3M13 21h8',
  eraser: 'M8.5 20H20M4.6 15.4l8.8-8.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19.1a3 3 0 0 1-4.2 0l-2.2-2.2a1.2 1.2 0 0 1 0-1.5zM9 11l5 5',
  lasso: 'M7 16.5c-2.4-1-4-2.9-4-5C3 8 7 5 12 5s9 3 9 6.5-4 6.5-9 6.5c-1 0-2-.1-2.9-.3M7 16.5c-.6 1.5.4 3 2 3.5M7 16.5c.8-.2 1.5 0 2.1.7',
  shapes: 'M4 20L11 6l7 14H4zM15.5 9.5a3.5 3.5 0 1 0 0-.01',
  line: 'M5 19L19 5',
  arrow: 'M5 19L19 5M10 5h9v9',
  rect: 'M4.5 6.5h15v11h-15z',
  ellipse: 'M12 18.5c4.4 0 8-2.9 8-6.5s-3.6-6.5-8-6.5S4 8.4 4 12s3.6 6.5 8 6.5z',
  text: 'M5 6.5V5h14v1.5M12 5v14M9.5 19h5',
  formula: 'M17.5 5.5h-11l6 6.5-6 6.5h11',
  graph: 'M4 4v16h16M7 15c2-6 4-8 6-5s4 1 6-4',
  hand: 'M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11.5V5a1.5 1.5 0 0 1 3 0v6.5M14 11.5V6.5a1.5 1.5 0 0 1 3 0V14c0 3.9-2.7 7-6.5 7-2.5 0-4-1-5.5-3.2L3.4 14.6a1.5 1.5 0 0 1 2.3-1.9L8 15',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  network: 'M12 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 6.2L6 16.3M13 6.2l5 10.1M7 18h10',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2.3 1.3L14.5 21h-4l-.3-2.3a7 7 0 0 1-2.3-1.3l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.7a7 7 0 0 1 2.3-1.3L10.5 3h4l.3 2.3a7 7 0 0 1 2.3 1.3l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z',
  calc: 'M6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3zM8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18.3h.01M12 18.3h.01M15.5 18.3h.01',
  ruler: 'M3.5 15.5L15.5 3.5l5 5-12 12zM7 12l2 2M9.5 9.5l1.5 1.5M12 7l2 2M14.5 4.5l1.5 1.5',
  protractor: 'M3 18a9 9 0 0 1 18 0zM12 18v-3M7 18a5 5 0 0 1 10 0M5.6 11.6l1.6 1.6M18.4 11.6l-1.6 1.6M12 9v1.5',
  trash: 'M5 7h14M10 4h4M7 7l.8 12.2A1.9 1.9 0 0 0 9.7 21h4.6a1.9 1.9 0 0 0 1.9-1.8L17 7M10 11v6M14 11v6',
  folder: 'M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v7.8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z',
  note: 'M7 3.5h7.5L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5zM14 3.5V8.5h5',
  page: 'M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5zM5 8.5h14M5 13.5h14M9.5 3.5v17M14.5 3.5v17',
  image: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5zM3.5 16l5-5 4.5 4.5M13 13.5l2-2 5.5 5.5M15.5 9a1 1 0 1 0 0-.01',
  panel: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5zM15 4.5v15',
  sidebar: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5zM9 4.5v15',
  cloud: 'M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.6a4 4 0 0 1-.5 9.9z',
  inbox: 'M4 13.5l2.4-7.2A1.5 1.5 0 0 1 7.8 5.3h8.4a1.5 1.5 0 0 1 1.4 1L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18zM4 13.5h4.5l1 2h5l1-2H20',
  atom: 'M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM12 21c1.7 0 3-4 3-9s-1.3-9-3-9-3 4-3 9 1.3 9 3 9zM4.2 16.5c.9 1.5 5 .6 9.3-1.9s7.2-5.6 6.3-7.1-5-.6-9.3 1.9-7.2 5.6-6.3 7.1zM4.2 7.5c-.9 1.5 2 4.6 6.3 7.1s8.4 3.4 9.3 1.9-2-4.6-6.3-7.1-8.4-3.4-9.3-1.9z',
  sigma: 'M17.5 5.5h-11l6 6.5-6 6.5h11',
  copy: 'M9 9h10.5v10.5H9zM15 9V4.5H4.5V15H9',
  move: 'M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',
  resize: 'M20 14v6h-6M20 20l-7-7',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  home: 'M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15V15h-6v5.5H5.5A1.5 1.5 0 0 1 4 19z',
  restore: 'M4 12a8 8 0 1 0 2.4-5.7L4 8.7M4 4v4.7h4.7',
  tag: 'M3.5 12.2V4.5A1 1 0 0 1 4.5 3.5h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0zM8 8h.01',
}

export function Icon({ name, size = 22, className, style }: { name: keyof typeof P | string; size?: number; className?: string; style?: React.CSSProperties }) {
  const d = P[name] ?? P.note
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/* The Athena mark: three linked notes forming an A. */
export function Mark({ size = 28, draw = false }: { size?: number; draw?: boolean }) {
  return (
    <svg className={draw ? 'mark draw' : 'mark'} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path className="mark-edge" d="M32 10L12 52M32 10l20 42M19 38h26" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" pathLength={100} />
      <circle className="mark-node" cx="32" cy="10" r="6" fill="currentColor" />
      <circle className="mark-node n2" cx="12" cy="52" r="6" fill="currentColor" />
      <circle className="mark-node n3" cx="52" cy="52" r="6" fill="currentColor" />
    </svg>
  )
}
