import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useStore } from '../lib/store'
import { PersonSearch } from '../components/PersonSearch'
import { BrandMark } from '../components/Layout'

export function LoginPage() {
  const { act } = useStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try { await act.signIn(password) } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <form className="card login-card stack-lg" onSubmit={submit}>
        <div className="row" style={{ gap: 12 }}>
          <BrandMark />
          <div><h1 style={{ fontSize: '1.35rem' }}>General Store</h1><p className="subtle">Desk sign-in</p></div>
        </div>
        <label className="field">
          <span className="label">Desk password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus required />
          {error && <span className="hint" role="alert" style={{ color: 'var(--danger)' }}>{error}</span>}
        </label>
        <button className="btn btn-primary btn-lg" disabled={busy || !password}><Lock /> Sign in</button>
        <p className="subtle">Ask the store lead for today’s password. This device stays signed in.</p>
      </form>
    </div>
  )
}

/** Desk volunteer picks their own name (from the directory, or typed). Saved on this device. */
export function DeskNameForm({ onDone }: { onDone?: () => void }) {
  const { desk, setDesk } = useStore()
  const [typed, setTyped] = useState('')
  return (
    <div className="stack">
      {desk && <p className="muted">Currently: <strong>{desk}</strong></p>}
      <PersonSearch compact allowAdd={false} placeholder="Find your name" onSelect={(v) => { setDesk(v.full_name); onDone?.() }} />
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { setDesk(typed.trim()); onDone?.() } }}>
        <input className="input" placeholder="…or type your name" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type your name" />
        <button className="btn" disabled={!typed.trim()}>Use</button>
      </form>
    </div>
  )
}

export function DeskNamePage() {
  return (
    <div className="login">
      <div className="card login-card stack-lg">
        <div className="row" style={{ gap: 12 }}>
          <BrandMark />
          <div><h1 style={{ fontSize: '1.35rem' }}>Who’s on the desk?</h1><p className="subtle">Your name is recorded on each issue and return.</p></div>
        </div>
        <DeskNameForm />
      </div>
    </div>
  )
}

/** When access is restricted: pick yourself from the desk volunteer list and enter your PIN. */
export function DeskUserSignInPage() {
  const { data, act } = useStore()
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const users = [...data.desk_users].sort((a, b) => a.name.localeCompare(b.name))
    .filter((u) => !q.trim() || u.name.toLowerCase().includes(q.trim().toLowerCase()))
  const person = data.desk_users.find((u) => u.id === chosen)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chosen) return
    setBusy(true)
    setError('')
    try { await act.signInDeskUser(chosen, pin); window.location.hash = '#/' } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <div className="card login-card stack-lg">
        <div className="row" style={{ gap: 12 }}>
          <BrandMark />
          <div><h1 style={{ fontSize: '1.35rem' }}>Who’s on the desk?</h1><p className="subtle">Only listed desk volunteers can use the app today.</p></div>
        </div>
        {!person ? (
          <div className="stack">
            <input className="input" placeholder="Find your name" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Find your name" />
            <div className="stack" style={{ gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {users.map((u) => (
                <button key={u.id} className="btn" style={{ justifyContent: 'flex-start' }} onClick={() => { setChosen(u.id); setPin(''); setError('') }}>{u.name}</button>
              ))}
              {users.length === 0 && <p className="subtle">Not on the list? Ask an admin to add you in Setup.</p>}
            </div>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <div className="between"><strong>{person.name}</strong><button type="button" className="btn btn-sm" onClick={() => setChosen(null)}>Not you?</button></div>
            <label className="field">
              <span className="label">Your PIN</span>
              <input className="input" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
              {error && <span className="hint" role="alert" style={{ color: 'var(--danger)' }}>{error}</span>}
            </label>
            <button className="btn btn-primary btn-lg" disabled={busy || !pin}><Lock /> Start</button>
          </form>
        )}
      </div>
    </div>
  )
}
