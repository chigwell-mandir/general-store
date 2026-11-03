import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LogIn, LogOut, Undo2 } from 'lucide-react'
import type { Volunteer } from '../types'
import { useStore } from '../lib/store'
import { clock, when } from '../lib/time'
import { normalise } from '../lib/search'
import { AddPersonSheet } from '../components/AddPersonSheet'
import { PersonCard } from '../components/PersonCard'
import { FoldAll, FoldCard, useAction, useFolds } from '../components/ui'

/** On-the-day karyakar (KK) registration: check in on arrival, check out when leaving. Separate from kit. */
export function CheckinPage() {
  const { d, data, act } = useStore()
  const { busy, run } = useAction()
  const [person, setPerson] = useState<Volunteer | null>(null)

  const checkins = useMemo(() => [...data.checkins].sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at)), [data.checkins])
  const onSite = checkins.filter((c) => !c.checked_out_at)
  const checkedOut = checkins
    .filter((c) => c.checked_out_at)
    .sort((a, b) => b.checked_out_at!.localeCompare(a.checked_out_at!))
  const c = person ? d.checkinByVol.get(person.id) : undefined
  const first = (v: Volunteer) => v.full_name.split(' ')[0]

  return (
    <main className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>Karyakar</h1>
          <p className="muted">{onSite.length} checked in · {checkedOut.length} checked out · {data.volunteers.length} registered</p>
        </div>
      </div>


      {person && (
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
            <Link to={`/?p=${person.id}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>Open {first(person)} at the item desk</Link>
          </div>
        </div>
      )}

      <KaryakarLists onOpen={(v) => { setPerson(v); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
    </main>
  )
}

type Status = 'all' | 'not' | 'in' | 'out'
const NO_LEAD = '__none__'

/** Status of one karyakar today. */
function useStateOf() {
  const { d } = useStore()
  return (v: Volunteer): Exclude<Status, 'all'> => {
    const c = d.checkinByVol.get(v.id)
    return !c ? 'not' : c.checked_out_at ? 'out' : 'in'
  }
}

/**
 * The list of karyakars, either grouped by zone lead (with "18 / 40 in" per team) or as one list.
 * Each list sits in its own scrolling window so the page itself stays short.
 */
function KaryakarLists({ onOpen }: { onOpen: (v: Volunteer) => void }) {
  const { d, data } = useStore()
  const stateOf = useStateOf()
  const folds = useFolds(false)
  const [view, setView] = useState<'team' | 'all'>('team')
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => {
    const words = normalise(q).split(' ').filter(Boolean)
    return [...data.volunteers]
      .filter((v) => !dept || v.department === dept)
      .filter((v) => status === 'all' || stateOf(v) === status)
      .filter((v) => !words.length || words.every((w) => normalise(`${v.full_name} ${v.satsang_id ?? ''} ${v.department ?? ''}`).includes(w)))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [data.volunteers, d, q, dept, status]) // eslint-disable-line react-hooks/exhaustive-deps

  const teams = useMemo(() => {
    const m = new Map<string, { key: string; name: string; all: Volunteer[]; shown: Volunteer[] }>()
    const shown = new Set(rows.map((v) => v.id))
    for (const v of data.volunteers) {
      const lead = d.zoneLeadForVolunteer(v).lead
      const key = lead?.id ?? NO_LEAD
      if (!m.has(key)) m.set(key, { key, name: lead?.name ?? 'No zone lead set', all: [], shown: [] })
      const t = m.get(key)!
      t.all.push(v)
      if (shown.has(v.id)) t.shown.push(v)
    }
    // The zone lead first, then their team A–Z
    for (const t of m.values()) {
      const z = d.zoneById.get(t.key)
      const leadVid = z ? d.leadVolId(z) : null
      t.shown.sort((a, b) => (a.id === leadVid ? -1 : b.id === leadVid ? 1 : a.full_name.localeCompare(b.full_name)))
    }
    return [...m.values()].filter((t) => t.shown.length).sort((a, b) => (a.key === NO_LEAD ? 1 : b.key === NO_LEAD ? -1 : a.name.localeCompare(b.name)))
  }, [data.volunteers, rows, d])
  const filtering = q.trim() !== '' || dept !== '' || status !== 'all'
  // When a filter changes, open the matching teams once — they can still be folded afterwards
  const filterKey = `${q}|${dept}|${status}`
  useEffect(() => {
    folds.setAll(teams.map((t) => t.key), filtering)
  }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="stack">
      <div className="between" style={{ flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="Show">
          <button aria-pressed={view === 'team'} onClick={() => setView('team')}>By team</button>
          <button aria-pressed={view === 'all'} onClick={() => setView('all')}>Everyone</button>
        </div>
        {view === 'team' && <FoldAll keys={teams.map((t) => t.key)} folds={folds} />}
      </div>
      <div className="row-wrap">
        <input className="search-input compact grow" style={{ minWidth: 160, paddingLeft: 16 }} placeholder="Search name, SID or department" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search karyakars" />
        <select className="select" style={{ width: 'auto', maxWidth: '100%' }} value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {d.departments.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="chips">
        {([['all', 'Everyone'], ['not', 'Not in yet'], ['in', 'Checked in'], ['out', 'Checked out']] as [Status, string][]).map(([k, label]) => (
          <button key={k} className="chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{label}</button>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="stack-sm" style={{ alignItems: 'center' }}>
          <p className="subtle">No one matches.</p>
          {q.trim() && <button className="btn btn-sm" onClick={() => setAdding(true)}>Add “{q.trim()}” as a new person</button>}
        </div>
      )}
      {adding && <AddPersonSheet initialName={/^\d+$/.test(q.trim()) ? '' : q.trim()} initialSid={/^\d+$/.test(q.trim()) ? q.trim() : ''} onClose={() => setAdding(false)} onAdded={(v) => { setAdding(false); setQ(''); onOpen(v) }} />}

      {view === 'team' && teams.map((t) => {
        const inNow = t.all.filter((v) => stateOf(v) === 'in').length
        return (
          <FoldCard key={t.key} open={folds.isOpen(t.key)} onToggle={() => folds.toggle(t.key)}
            title={<h3>{t.name}</h3>} count={`${inNow} / ${t.all.length} in`}>
            <BulkBar people={t.shown} label={filtering ? 'shown' : 'in this team'} />
            <KaryakarList people={t.shown} onOpen={onOpen} />
          </FoldCard>
        )
      })}

      {view === 'all' && rows.length > 0 && (
        <FoldCard title={<h3>{filtering ? 'Matching karyakars' : 'All karyakars'}</h3>} count={rows.length}>
          <BulkBar people={rows} label={filtering ? 'shown' : 'registered'} />
          <KaryakarList people={rows} onOpen={onOpen} showLead />
        </FoldCard>
      )}
    </section>
  )
}

/** Check in / out everyone in a list, after a confirm. */
function BulkBar({ people, label }: { people: Volunteer[]; label: string }) {
  const { act } = useStore()
  const stateOf = useStateOf()
  const { busy, run } = useAction()
  const [confirm, setConfirm] = useState<'in' | 'out' | null>(null)
  const toIn = people.filter((v) => stateOf(v) === 'not')
  const toOut = people.filter((v) => stateOf(v) === 'in')
  if (!toIn.length && !toOut.length) return null
  return (
    <div style={{ padding: '8px 16px' }}>
      {confirm ? (
        <div className="banner banner-warn">
          <div className="grow stack">
            <span>{confirm === 'in' ? `Check in ${toIn.length} not yet in?` : `Check out ${toOut.length} still checked in?`} Time recorded as now.</span>
            <div className="row">
              <button className="btn btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-sm btn-primary" disabled={busy} onClick={async () => {
                await run(async () => (confirm === 'in' ? act.checkInMany(toIn) : act.checkOutMany(toOut)), confirm === 'in' ? `${toIn.length} checked in` : `${toOut.length} checked out`)
                setConfirm(null)
              }}>Yes</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="row-wrap">
          <button className="btn btn-sm" disabled={!toIn.length} onClick={() => setConfirm('in')}><LogIn /> Check in all {label} ({toIn.length})</button>
          <button className="btn btn-sm" disabled={!toOut.length} onClick={() => setConfirm('out')}><LogOut /> Check out all {label} ({toOut.length})</button>
        </div>
      )}
    </div>
  )
}

/** A scrolling window of karyakars with one-tap check in / out. */
function KaryakarList({ people, onOpen, showLead }: { people: Volunteer[]; onOpen: (v: Volunteer) => void; showLead?: boolean }) {
  const { d, act } = useStore()
  const stateOf = useStateOf()
  const { busy, run } = useAction()
  return (
    <ul className="list scroll-window">
      {people.map((v) => {
        const s = stateOf(v)
        const c = d.checkinByVol.get(v.id)
        const first = v.full_name.split(' ')[0]
        return (
          <li key={v.id} className="hold">
            <button className="hold-main kk-name" onClick={() => onOpen(v)}>
              <span className="hold-title">{v.full_name}{d.leadByVol.has(v.id) && <span className="tag" style={{ marginLeft: 8 }}>Zone lead</span>}</span>
              <span className="hold-sub">
                <span>{[v.department, showLead && d.zoneLeadForVolunteer(v).lead?.name].filter(Boolean).join(' · ') || '—'}</span>
                {c && <span>in {clock(c.checked_in_at)}{c.checked_out_at && ` · out ${clock(c.checked_out_at)}`}</span>}
              </span>
            </button>
            <div className="hold-actions">
              {s === 'not' && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => act.checkIn(v), `${first} checked in`)}>Check in</button>}
              {s === 'in' && c && <button className="btn btn-sm btn-ok" disabled={busy} onClick={() => run(() => act.checkOut(c), `${first} checked out`)}>Check out</button>}
              {s === 'out' && <span className="subtle">checked out</span>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
