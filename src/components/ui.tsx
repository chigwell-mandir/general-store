import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Minus, Plus, X, XCircle, type LucideIcon } from 'lucide-react'

// ── Sheet: bottom sheet on phones, centred dialog on larger screens ─────
export function Sheet({ title, subtitle, onClose, children, footer }: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea, button:not(.icon-btn)')
    first?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [onClose])

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="subtle" style={{ marginTop: 4 }}>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        {children}
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ── Toasts ───────────────────────────────────────────────────────────────
type Toast = { id: number; kind: 'ok' | 'err'; text: string; action?: { label: string; run: () => void } }
const ToastCtx = createContext<{ ok: (t: string, action?: Toast['action']) => void; err: (e: unknown) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts.slice(-2), { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.action ? 6000 : 3500)
  }, [])
  const api = {
    ok: (text: string, action?: Toast['action']) => push({ kind: 'ok', text, action }),
    err: (e: unknown) => push({ kind: 'err', text: e instanceof Error ? e.message : String(e) }),
  }
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'ok' ? <CheckCircle2 /> : <XCircle />}
            <span className="grow">{t.text}</span>
            {t.action && (
              <button className="btn btn-sm" onClick={() => { t.action!.run(); setToasts((ts) => ts.filter((x) => x.id !== t.id)) }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export function useToast() {
  const t = useContext(ToastCtx)
  if (!t) throw new Error('useToast outside ToastProvider')
  return t
}

// ── Small pieces ─────────────────────────────────────────────────────────
export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon aria-hidden /></div>
      <h3>{title}</h3>
      {children && <div className="subtle" style={{ maxWidth: 360 }}>{children}</div>}
    </div>
  )
}

export function Stepper({ value, onChange, min = 1, max }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const clamp = (n: number) => Math.max(min, max !== undefined ? Math.min(max, n) : n)
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="Decrease quantity"><Minus /></button>
      <input
        inputMode="numeric" aria-label="Quantity" value={value}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); onChange(Number.isNaN(n) ? min : clamp(n)) }}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={max !== undefined && value >= max} aria-label="Increase quantity"><Plus /></button>
    </div>
  )
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? '')).toUpperCase()
}
export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return <span className={`avatar ${large ? 'avatar-lg' : ''}`} aria-hidden>{initials(name)}</span>
}

const SWATCHES: Record<string, string> = {
  yellow: '#facc15', green: '#22c55e', blue: '#3b82f6', orange: '#f97316', brown: '#92400e', red: '#ef4444',
  grey: '#9ca3af', purple: '#a855f7', 'blue volunteer': '#1d4ed8', 'mixed / random': 'conic-gradient(#f97316,#3b82f6,#22c55e,#facc15,#f97316)',
}
export function Swatch({ category, name }: { category: string; name: string }) {
  if (category !== 'Hi-Vis' && category !== 'Lanyards') return null
  const c = SWATCHES[name.toLowerCase()] ?? SWATCHES[name.toLowerCase().split(' ')[0]]
  if (!c) return null
  return <span className="swatch" style={{ background: c }} aria-hidden />
}

/** Wraps an async action so a button shows busy state and errors become toasts. */
export function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setBusy(true)
    try {
      const r = await fn()
      if (success) toast.ok(success)
      return r
    } catch (e) {
      toast.err(e)
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}
