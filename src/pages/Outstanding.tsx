import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlarmClock, Megaphone, PackageOpen, PartyPopper, Search, Users } from 'lucide-react'
import type { Issue } from '../types'
import { useStore } from '../lib/store'
import { itemLabel, normalise } from '../lib/search'
import { useNow } from '../lib/time'
import { IssueRow } from '../components/IssueRow'
import { Avatar, Empty, Swatch } from '../components/ui'
import { ExportButton } from './Export'

export function OutstandingPage() {
  const { d } = useStore()
  const now = useNow()
  const [view, setView] = useState<'person' | 'item'>('person')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const nq = normalise(q)
    return d.outstanding.filter((i) => {
      if (onlyOverdue && !d.isOverdue(i, now)) return false
      if (!nq) return true
      const v = d.volById.get(i.volunteer_id)
      const it = d.itemById.get(i.item_id)
      const hay = normalise(`${v?.full_name} ${v?.satsang_id} ${v?.department} ${it && itemLabel(it)} ${i.unit_wt_no ?? ''} ${d.zoneLeadForIssue(i).lead?.name ?? ''}`)
      return nq.split(' ').every((w) => hay.includes(w))
    })
  }, [d, q, onlyOverdue, now])

  const groups = useMemo(() => {
    const m = new Map<string, Issue[]>()
    for (const i of rows) {
      const k = view === 'person' ? i.volunteer_id : i.item_id
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(i)
    }
    return [...m.entries()]
  }, [rows, view])

  const overdue = d.outstanding.filter((i) => d.isOverdue(i, now)).length
  const units = d.outstanding.reduce((n, i) => n + d.outQty(i), 0)
  const people = new Set(d.outstanding.map((i) => i.volunteer_id)).size

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Outstanding</h1>
          <p className="muted">Returnable items still out. Overdue after {d.event.overdue_time}.</p>
        </div>
        <div className="row-wrap">
          <Link to="/escalation" className="btn"><Megaphone /> Escalation summary</Link>
          <ExportButton kind="issues" label="Export" />
        </div>
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card stat"><span className="stat-label"><PackageOpen /> Items out</span><span className="stat-value">{units}</span></div>
        <div className="card stat"><span className="stat-label"><Users /> People</span><span className="stat-value">{people}</span></div>
        <button className={`card stat ${overdue ? 'tone-danger' : ''}`} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => setOnlyOverdue(!onlyOverdue)} aria-pressed={onlyOverdue}>
          <span className="stat-label"><AlarmClock /> Overdue {onlyOverdue && '· filtered'}</span><span className="stat-value">{overdue}</span>
        </button>
      </div>

      <div className="row-wrap" style={{ alignItems: 'center' }}>
        <div className="search-box grow" style={{ minWidth: 220 }}>
          <Search aria-hidden />
          <input className="search-input compact" placeholder="Filter by person, item, WT no., lead…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter outstanding" />
        </div>
        <div className="seg" role="group" aria-label="Group by">
          <button aria-pressed={view === 'person'} onClick={() => setView('person')}>By person</button>
          <button aria-pressed={view === 'item'} onClick={() => setView('item')}>By item</button>
        </div>
        <label className="check"><input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} /> Overdue only</label>
      </div>

      {groups.length === 0 && (
        <div className="card">
          {d.outstanding.length === 0
            ? <Empty icon={PartyPopper} title="Everything is back">No returnable items are out.</Empty>
            : <Empty icon={Search} title="No matches">Try a different filter.</Empty>}
        </div>
      )}

      {groups.map(([key, issues]) => {
        if (view === 'person') {
          const v = d.volById.get(key)
          const zl = d.zoneLeadForVolunteer(v)
          return (
            <section key={key} className="card">
              <div className="card-head" style={{ paddingBottom: 8 }}>
                <Link to={`/people/${key}`} className="row grow" style={{ color: 'inherit', textDecoration: 'none', gap: 12 }}>
                  <Avatar name={v?.full_name ?? '?'} />
                  <div className="grow">
                    <div style={{ fontWeight: 750 }}>{v?.full_name ?? 'Unknown person'}</div>
                    <div className="subtle">{[v?.satsang_id && `SID ${v.satsang_id}`, v?.department, v?.phone].filter(Boolean).join(' · ')}</div>
                  </div>
                </Link>
                {zl.lead
                  ? <Link to={`/return?lead=${zl.lead.id}`} className="badge badge-info" style={{ textDecoration: 'none' }} title="See this zone lead’s whole team">{zl.lead.name}</Link>
                  : <span className="badge">No zone lead</span>}
              </div>
              <ul className="list">{issues.map((i) => <li key={i.id}><IssueRow issue={i} now={now} /></li>)}</ul>
            </section>
          )
        }
        const it = d.itemById.get(key)
        const n = issues.reduce((s, i) => s + d.outQty(i), 0)
        return (
          <section key={key} className="card">
            <div className="card-head" style={{ paddingBottom: 8 }}>
              <h3 className="row">{it && <Swatch category={it.category} name={it.name} />}{it ? itemLabel(it) : 'Unknown item'}</h3>
              <span className="badge badge-warn">{n} out</span>
            </div>
            <ul className="list">{issues.map((i) => <li key={i.id}><IssueRow issue={i} now={now} showPerson /></li>)}</ul>
          </section>
        )
      })}
    </main>
  )
}
