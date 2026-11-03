import { useState } from 'react'
import { KeyRound, Pencil, Plus, ShieldCheck, ShieldOff, Trash2, UserCog } from 'lucide-react'
import type { DeskUser } from '../types'
import { hashPin, useStore } from '../lib/store'
import { PersonSearch } from './PersonSearch'
import { Sheet, useAction } from './ui'

const validPin = (p: string) => /^\d{4,8}$/.test(p.trim())

function Roles({ u }: { u: DeskUser }) {
  if (u.is_admin) return <span className="badge badge-brand">Everything (admin)</span>
  return (
    <>
      {u.can_items && <span className="badge">Items</span>}
      {u.can_karyakar && <span className="badge">Karyakar check-in</span>}
      {!u.can_items && !u.can_karyakar && <span className="badge badge-warn">View only</span>}
    </>
  )
}

/** Setup: who may use the desk, what each person may do, and whether that is enforced. */
export function DeskUsersCard() {
  const { data, act, restricted, me, mode } = useStore()
  const { busy, run } = useAction()
  const [editing, setEditing] = useState<DeskUser | 'new' | null>(null)
  const [turningOn, setTurningOn] = useState(false)
  const users = [...data.desk_users].sort((a, b) => a.name.localeCompare(b.name))
  const admins = users.filter((u) => u.is_admin && u.pin_hash)

  return (
    <section className="card card-pad stack-lg">
      <div className="between" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 className="row"><UserCog size={20} /> Desk volunteers & permissions</h2>
          <p className="subtle" style={{ marginTop: 4 }}>
            {restricted
              ? 'Restrictions are ON: each person picks their name and enters their own PIN, and only sees what they’re allowed to do.'
              : 'Restrictions are OFF: anyone with the desk password can do everything. Add people below, then turn restrictions on.'}
          </p>
        </div>
        <button className="btn" onClick={() => setEditing('new')}><Plus /> Add person</button>
      </div>

      {users.length === 0 ? <p className="subtle">No desk volunteers listed yet.</p> : (
        <ul className="list">
          {users.map((u) => (
            <li key={u.id} className="between" style={{ padding: '10px 0', flexWrap: 'wrap' }}>
              <div className="grow" style={{ minWidth: 180 }}>
                <strong>{u.name}</strong>{me?.id === u.id && <span className="subtle"> (you)</span>}
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  <Roles u={u} />
                  {!u.pin_hash && <span className="badge badge-danger">No PIN</span>}
                </div>
              </div>
              <div className="row">
                <button className="icon-btn" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}><Pencil /></button>
                <button className="icon-btn" disabled={busy || me?.id === u.id}
                  onClick={() => confirm(`Remove ${u.name} from the desk list?`) && run(() => act.removeDeskUser(u.id), 'Removed')} aria-label={`Remove ${u.name}`}><Trash2 /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {restricted ? (
        <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} disabled={busy}
          onClick={() => confirm('Turn restrictions off? Anyone with the desk password will be able to do everything again.') && run(() => act.setRestricted(false), 'Restrictions turned off')}>
          <ShieldOff /> Turn restrictions off
        </button>
      ) : (
        <div className="stack">
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy || admins.length === 0} onClick={() => setTurningOn(true)}>
            <ShieldCheck /> Turn restrictions on
          </button>
          {admins.length === 0 && <span className="hint">Add at least one person with “Everything (admin)” and a PIN first — otherwise nobody could manage the app.</span>}
        </div>
      )}
      <p className="hint">
        Forgot every admin PIN? In Supabase → Table Editor → <code>events</code>, set <code>restrict_access</code> to false.
        {mode === 'live' && <> If adding a person fails, run <code>supabase/2-desk-permissions.sql</code> once in the SQL Editor.</>}
      </p>

      {editing && <DeskUserSheet user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {turningOn && <TurnOnSheet admins={admins} onClose={() => setTurningOn(false)} />}
    </section>
  )
}

function DeskUserSheet({ user, onClose }: { user: DeskUser | null; onClose: () => void }) {
  const { act, d } = useStore()
  const { busy, run } = useAction()
  const [name, setName] = useState(user?.name ?? '')
  const [volunteerId, setVolunteerId] = useState<string | null>(user?.volunteer_id ?? null)
  const [items, setItems] = useState(user?.can_items ?? true)
  const [karyakar, setKaryakar] = useState(user?.can_karyakar ?? false)
  const [admin, setAdmin] = useState(user?.is_admin ?? false)
  const [pin, setPin] = useState('')
  const person = volunteerId ? d.volById.get(volunteerId) : undefined
  const pinNeeded = !user?.pin_hash
  const pinOk = pin.trim() ? validPin(pin) : !pinNeeded

  const save = async () => {
    const ok = await run(async () => {
      await act.saveDeskUser({ id: user?.id, name, volunteer_id: volunteerId, can_items: items, can_karyakar: karyakar, is_admin: admin, pin: pin.trim() || undefined })
      return true
    }, user ? 'Saved' : `${name.trim()} added`)
    if (ok) onClose()
  }

  return (
    <Sheet title={user ? `Edit ${user.name}` : 'Add desk volunteer'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !name.trim() || !pinOk || (!items && !karyakar && !admin)} onClick={save}>Save</button></>}>
      <div className="stack">
        {!user && !person && (
          <div className="field">
            <span className="label">Find them in the directory (optional)</span>
            <PersonSearch compact autoFocus={false} allowAdd={false} placeholder="Name or Satsang ID" onSelect={(v) => { setVolunteerId(v.id); setName(v.full_name) }} />
          </div>
        )}
        <label className="field"><span className="label">Name shown on the desk</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>

        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 0 }}>
          <legend className="label" style={{ marginBottom: 4 }}>What can they do?</legend>
          <label className="check"><input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> Everything (admin) — incl. stock, setup, import, wipe and this list</label>
          <label className="check" style={{ opacity: admin ? 0.5 : 1 }}><input type="checkbox" disabled={admin} checked={admin || items} onChange={(e) => setItems(e.target.checked)} /> Issue & return items (and confirmed kit)</label>
          <label className="check" style={{ opacity: admin ? 0.5 : 1 }}><input type="checkbox" disabled={admin} checked={admin || karyakar} onChange={(e) => setKaryakar(e.target.checked)} /> Karyakar check-in & check-out</label>
        </fieldset>
        <p className="hint">Everyone can view Outstanding, Escalation, People, History and the Dashboard.</p>

        <label className="field">
          <span className="label row"><KeyRound size={14} /> {user?.pin_hash ? 'New PIN (leave blank to keep the current one)' : 'PIN (4–8 digits)'}</span>
          <input className="input" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 200 }} />
          {pin && !validPin(pin) && <span className="hint" style={{ color: 'var(--danger)' }}>Use 4 to 8 digits</span>}
          <span className="hint">Tell them their PIN in person. It’s stored scrambled, so nobody can look it up later — just set a new one.</span>
        </label>
      </div>
    </Sheet>
  )
}

function TurnOnSheet({ admins, onClose }: { admins: DeskUser[]; onClose: () => void }) {
  const { act } = useStore()
  const { busy, run } = useAction()
  const [who, setWho] = useState(admins[0]?.id ?? '')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const turnOn = async () => {
    const u = admins.find((a) => a.id === who)
    if (!u || (await hashPin(u.id, pin)) !== u.pin_hash) { setError('Wrong PIN for that admin'); return }
    const ok = await run(async () => { await act.setRestricted(true, u.id); return true }, 'Restrictions are on')
    if (ok) onClose()
  }

  return (
    <Sheet title="Turn restrictions on" subtitle="This device stays signed in as the admin you pick. Every other device will ask people to pick their name and PIN."
      onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !pin} onClick={turnOn}><ShieldCheck /> Turn on</button></>}>
      <div className="stack">
        <label className="field">
          <span className="label">You are</span>
          <select className="select" value={who} onChange={(e) => setWho(e.target.value)}>{admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </label>
        <label className="field">
          <span className="label">Your PIN</span>
          <input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value); setError('') }} style={{ maxWidth: 200 }} />
          {error && <span className="hint" role="alert" style={{ color: 'var(--danger)' }}>{error}</span>}
        </label>
      </div>
    </Sheet>
  )
}
