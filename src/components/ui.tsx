import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/* ---------- Sheet: a bottom sheet on phones, a centred card on larger screens ---------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  action,
  wide,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  action?: ReactNode
  wide?: boolean
  className?: string
}) {
  const [shown, setShown] = useState(open)
  const [inn, setInn] = useState(false)
  useEffect(() => {
    if (open) {
      setShown(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setInn(true)))
      return () => cancelAnimationFrame(r)
    }
    setInn(false)
    const t = window.setTimeout(() => setShown(false), 380)
    return () => window.clearTimeout(t)
  }, [open])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [open, onClose])
  if (!shown) return null
  return createPortal(
    <div className={`sheet-root${inn ? ' in' : ''}`}>
      <div className="scrim" onClick={onClose} />
      <div className={`sheet${wide ? ' wide' : ''}${className ? ' ' + className : ''}`} role="dialog" aria-modal="true">
        <div className="grab" />
        {(title || action) && (
          <div className="sheet-head">
            <button className="head-btn" onClick={onClose}>
              Stäng
            </button>
            <div className="sheet-title">{title}</div>
            <div className="sheet-action">{action}</div>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Segmented control ---------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  small,
}: {
  value: T
  options: { id: T; name: ReactNode }[]
  onChange: (v: T) => void
  small?: boolean
}) {
  const i = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  )
  return (
    <div className={`seg${small ? ' small' : ''}`} style={{ ['--n' as any]: options.length, ['--i' as any]: i }}>
      <span className="seg-sel" />
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)} type="button">
          {o.name}
        </button>
      ))}
    </div>
  )
}

/* ---------- Popover menu anchored to a button ---------- */

export interface MenuItem {
  label: string
  icon?: string
  onClick: () => void
  danger?: boolean
  checked?: boolean
  disabled?: boolean
}

export function Menu({ anchor, items, onClose, align = 'right' }: { anchor: HTMLElement | null; items: (MenuItem | 'sep')[]; onClose: () => void; align?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const r = anchor.getBoundingClientRect()
    const m = ref.current.getBoundingClientRect()
    let left = align === 'right' ? r.right - m.width : r.left
    left = Math.max(8, Math.min(window.innerWidth - m.width - 8, left))
    let top = r.bottom + 6
    if (top + m.height > window.innerHeight - 8) top = Math.max(8, r.top - m.height - 6)
    setPos({ top, left })
  }, [anchor, align])
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor?.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', key)
    }
  }, [anchor, onClose])
  return createPortal(
    <div ref={ref} className="menu" style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }} role="menu">
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            className={`menu-item${it.danger ? ' danger' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              onClose()
              it.onClick()
            }}
          >
            {it.icon && <Icon name={it.icon} size={18} />}
            <span>{it.label}</span>
            {it.checked && <Icon name="check" size={16} className="menu-check" />}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}

export function useMenu() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return {
    anchor,
    open: (e: { currentTarget: HTMLElement }) => setAnchor((a) => (a ? null : e.currentTarget)),
    close: () => setAnchor(null),
  }
}

/* ---------- Small pieces ---------- */

export function Empty({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
      {children}
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)} />
}

export function Toast({ text }: { text: string }) {
  return <div className="toast">{text}</div>
}
