import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LogIn, LogOut, Undo2, UserCheck, UserRoundX, Users } from 'lucide-react'
import type { Volunteer } from '../types'
import { useStore } from '../lib/store'
import { clock, when } from '../lib/time'
import { normalise } from '../lib/search'
import { PersonSearch } from '../components/PersonSearch'
import { PersonCard } from '../components/PersonCard'
import { Avatar, Empty, useAction } from '../components/ui'
import { ExportButton } from './Export'

/** On-the-day karyakar (KK) registration: check in on arrival, check out when leaving. Separate from kit. */
export function CheckinPage() {
  const { d, data, act } = useStore()
  const { busy, run } = useAction()
  const [person, setPerson] = useState<Volunteer | null>(null)
  const [tab, setTab] = useState<'in' | 'out' | 'all'>('in')

  const checkins = useMemo(() => [...data.checkins].sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at)), [data.checkins])
  const onSite = checkins.filter((c) => !c.checked_out_at)
  const checkedOut = checkins
    .filter((c) => c.checked_out_at)
    .sort((a, b) => b.checked_out_at!.localeCompare(a.checked_out_at!))
  const c = person ? d.checkinByVol.get(person.id) : undefined
  const first = (v: Volunteer) => v.full_name.split(' ')[0]
  const statusBadge = (v: Volunteer) => {
    const ci = d.checkinByVol.get(v.id)
    if (!ci) return null
    return ci.checked_out_at ? <span className="badge">Checked out</span> : <span className="badge badge-ok">Checked in</span>
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Karyakar check-in / check-out</h1>
          <p className="muted">Karyakar registration on the day. Kit is issued separately on the Issue tab.</p>
        </div>
        <ExportButton kind="karyakar" label="Export to Excel" />
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card stat tone-ok"><span className="stat-label"><UserCheck /> Checked in</span><span className="stat-value">{onSite.length}</span></div>
        <div className="card stat"><span className="stat-label"><UserRoundX /> Checked out</span><span className="stat-value">{checkedOut.length}</span></div>
        <div className="card stat"><span className="stat-label"><Users /> Registered</span><span className="stat-value">{data.volunteers.length}</span></div>
      </div>

      {!person ? (
        <PersonSearch onSelect={setPerson} badge={statusBadge} placeholder="Search name or Satsang ID" />
      ) : (
        <div className="stack">
          <PersonCard v={person} onClear={() => setPerson(null)} />
          <div className="card card-pad stack">
            {!c && (
              <button className="btn btn-primary btn-lg" disabled={busy} onClick={async () => { await run(() => act.checkIn(person), `${first(person)} checked in`); setPerson(null) }}>
                <LogIn /> Check in
              </button>
            )}
            {c && !c.checked_out_at && (
              <>
                <p className="muted">Checked in at <strong>{when(c.checked_in_at)}</strong> by {c.checked_in_by}</p>
                <button className="btn btn-ok btn-lg" disabled={busy} onClick={async () => { await run(() => act.checkOut(c), `${first(person)} checked out`); setPerson(null) }}>
                  <LogOut /> Check out
                </button>
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => run(() => act.undoCheckin(c), 'Check-in removed')}>
                  <Undo2 /> Undo check-in (mistake)
                </button>
              </>
            )}
            {c?.checked_out_at && (
              <>
                <p className="muted">
                  Checked in <strong>{when(c.checked_in_at)}</strong> by {c.checked_in_by} · checked out <strong>{when(c.checked_out_at)}</strong> by {c.checked_out_by}
                </p>
                <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => run(() => act.undoCheckout(c), 'Check-out undone')}>
                  <Undo2 /> Undo check-out (mistake)
                </button>
              </>
            )}
            <Link to={`/?p=${person.id}`} className="btn">Issue kit to {first(person)}</Link>
          </div>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <div className="seg" role="group" aria-label="Show">
            <button aria-pressed={tab === 'in'} onClick={() => setTab('in')}>In ({onSite.length})</button>
            <button aria-pressed={tab === 'out'} onClick={() => setTab('out')}>Out ({checkedOut.length})</button>
            <button aria-pressed={tab === 'all'} onClick={() => setTab('all')}>Everyone ({data.volunteers.length})</button>
          </div>
        </div>
        {tab === 'all' ? <EveryoneList onOpen={setPerson} /> : (tab === 'in' ? onSite : checkedOut).length === 0 ? (
          <Empty icon={UserCheck} title={tab === 'in' ? 'No one checked in' : 'No one checked out yet'} />
        ) : (
          <ul className="list" style={{ marginTop: 8 }}>
            {(tab === 'in' ? onSite : checkedOut).map((ci) => {
              const v = d.volById.get(ci.volunteer_id)
              return (
                <li key={ci.id}>
                  <button className="result" onClick={() => v && setPerson(v)}>
                    <Avatar name={v?.full_name ?? '?'} />
                    <div className="grow">
                      <div className="result-name">{v?.full_name ?? 'Unknown'}</div>
                      <div className="result-meta">
                        {v?.department ?? '—'} · in {clock(ci.checked_in_at)}
                        {ci.checked_out_at && ` · out ${clock(ci.checked_out_at)}`}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

type Status = 'all' | 'not' | 'in' | 'out'

/** Every registered karyakar, filterable, with one-tap and bulk check-in / check-out. */
function EveryoneList({ onOpen }: { onOpen: (v: Volunteer) => void }) {
  const { d, data, act } = useStore()
  const { busy, run } = useAction()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [limit, setLimit] = useState(100)
  const [confirm, setConfirm] = useState<'in' | 'out' | null>(null)

  const stateOf = (v: Volunteer): Exclude<Status, 'all'> => {
    const c = d.checkinByVol.get(v.id)
    return !c ? 'not' : c.checked_out_at ? 'out' : 'in'
  }
  const rows = useMemo(() => {
    const words = normalise(q).split(' ').filter(Boolean)
    return [...data.volunteers]
      .filter((v) => !dept || v.department === dept)
      .filter((v) => status === 'all' || stateOf(v) === status)
      .filter((v) => !words.length || words.every((w) => normalise(`${v.full_name} ${v.satsang_id ?? ''}`).includes(w)))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [data.volunteers, d, q, dept, status]) // eslint-disable-line react-hooks/exhaustive-deps
  const toIn = rows.filter((v) => stateOf(v) === 'not')
  const toOut = rows.filter((v) => stateOf(v) === 'in')
  const scope = dept || q.trim() || status !== 'all' ? 'shown' : 'registered'

  return (
    <div className="stack" style={{ padding: 16, paddingTop: 12 }}>
      <div className="row-wrap">
        <input className="input grow" style={{ minWidth: 180 }} placeholder="Filter by name or Satsang ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter karyakars" />
        <select className="select" style={{ width: 'auto', maxWidth: '100%' }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {d.departments.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="chips">
        {([['all', 'Everyone'], ['not', 'Not checked in'], ['in', 'Checked in'], ['out', 'Checked out']] as [Status, string][]).map(([k, label]) => (
          <button key={k} className="chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{label}</button>
        ))}
      </div>

      {confirm ? (
        <div className="banner banner-warn">
          <div className="grow stack">
            <span>{confirm === 'in' ? `Check in all ${toIn.length} ${scope} karyakars who aren’t checked in yet?` : `Check out all ${toOut.length} ${scope} karyakars who are still checked in?`} The time is recorded as now.</span>
            <div className="row">
              <button className="btn btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-sm btn-primary" disabled={busy} onClick={async () => {
                await run(async () => { const n = confirm === 'in' ? await act.checkInMany(toIn) : await act.checkOutMany(toOut); return n }, confirm === 'in' ? `${toIn.length} checked in` : `${toOut.length} checked out`)
                setConfirm(null)
              }}>Yes, {confirm === 'in' ? `check in ${toIn.length}` : `check out ${toOut.length}`}</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row-wrap">
          <button className="btn" disabled={!toIn.length} onClick={() => setConfirm('in')}><LogIn /> Check in all {scope} ({toIn.length})</button>
          <button className="btn" disabled={!toOut.length} onClick={() => setConfirm('out')}><LogOut /> Check out all {scope} ({toOut.length})</button>
        </div>
      )}

      {rows.length === 0 ? <p className="subtle">No one matches.</p> : (
        <ul className="list" style={{ margin: '0 -16px' }}>
          {rows.slice(0, limit).map((v) => {
            const s = stateOf(v)
            const c = d.checkinByVol.get(v.id)
            return (
              <li key={v.id} className="hold" style={{ minHeight: 60, padding: '8px 16px' }}>
                <button className="row grow" style={{ border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', gap: 12, minWidth: 0, padding: 0 }} onClick={() => onOpen(v)}>
                  <Avatar name={v.full_name} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700, display: 'block' }}>{v.full_name}</span>
                    <span className="subtle">
                      {[v.satsang_id && `SID ${v.satsang_id}`, v.department].filter(Boolean).join(' · ')}
                      {c && ` · in ${clock(c.checked_in_at)}`}{c?.checked_out_at && ` · out ${clock(c.checked_out_at)}`}
                    </span>
                  </span>
                </button>
                <div className="hold-actions">
                  {s === 'not' && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => act.checkIn(v), `${v.full_name.split(' ')[0]} checked in`)}><LogIn /> Check in</button>}
                  {s === 'in' && c && <button className="btn btn-sm btn-ok" disabled={busy} onClick={() => run(() => act.checkOut(c), `${v.full_name.split(' ')[0]} checked out`)}><LogOut /> Check out</button>}
                  {s === 'out' && <span className="badge">Checked out</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {rows.length > limit && <button className="btn" onClick={() => setLimit(limit + 200)}>Show more ({rows.length - limit})</button>}
    </div>
  )
}
