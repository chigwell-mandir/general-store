import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LogIn, LogOut, Undo2, UserCheck, UserRoundX, Users } from 'lucide-react'
import type { Volunteer } from '../types'
import { useStore } from '../lib/store'
import { clock, when } from '../lib/time'
import { PersonSearch } from '../components/PersonSearch'
import { PersonCard } from '../components/PersonCard'
import { Avatar, Empty, useAction } from '../components/ui'
import { ExportButton } from './Export'

/** On-the-day karyakar (KK) registration: check in on arrival, check out when leaving. Separate from kit. */
export function CheckinPage() {
  const { d, data, act } = useStore()
  const { busy, run } = useAction()
  const [person, setPerson] = useState<Volunteer | null>(null)
  const [tab, setTab] = useState<'in' | 'out'>('in')

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
            <button aria-pressed={tab === 'in'} onClick={() => setTab('in')}>Checked in ({onSite.length})</button>
            <button aria-pressed={tab === 'out'} onClick={() => setTab('out')}>Checked out ({checkedOut.length})</button>
          </div>
        </div>
        {(tab === 'in' ? onSite : checkedOut).length === 0 ? (
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
