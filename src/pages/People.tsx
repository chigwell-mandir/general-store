import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ClipboardList, Pencil, Plus, Search, Users } from 'lucide-react'
import type { Volunteer } from '../types'
import { useStore } from '../lib/store'
import { useNow } from '../lib/time'
import { PersonCard } from '../components/PersonCard'
import { IssueRow } from '../components/IssueRow'
import { KitAddSheet } from '../components/KitAddSheet'
import { AddPersonSheet } from '../components/AddPersonSheet'
import { Avatar, Empty, Sheet, useAction } from '../components/ui'
import { ActivityList } from './History'
import { KitRow } from './Kit'

export function PeoplePage() {
  const { data, d } = useStore()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'holding' | 'desk'>('all')
  const [limit, setLimit] = useState(60)
  const [adding, setAdding] = useState(false)
  const holding = useMemo(() => new Set(d.outstanding.map((i) => i.volunteer_id)), [d])

  const list = useMemo(() => {
    let rows: Volunteer[] = q.trim() ? d.searchPeople(q, 200) : [...data.volunteers].sort((a, b) => a.full_name.localeCompare(b.full_name))
    if (filter === 'holding') rows = rows.filter((v) => holding.has(v.id))
    if (filter === 'desk') rows = rows.filter((v) => v.added_at_desk)
    return rows
  }, [q, d, data.volunteers, filter, holding])

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>People</h1><p className="muted">{data.volunteers.length} in the directory.</p></div>
        <button className="btn" onClick={() => setAdding(true)}><Plus /> Add person</button>
      </div>
      <div className="search-box">
        <Search aria-hidden />
        <input className="search-input" placeholder="Search name or Satsang ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Everyone</button>
        <button className="chip" aria-pressed={filter === 'holding'} onClick={() => setFilter('holding')}>Holding items ({holding.size})</button>
        <button className="chip" aria-pressed={filter === 'desk'} onClick={() => setFilter('desk')}>Added at desk ({data.volunteers.filter((v) => v.added_at_desk).length})</button>
      </div>
      <section className="card">
        {list.length === 0 ? <Empty icon={Users} title={data.volunteers.length ? 'No one matches' : 'Directory is empty'}>{!data.volunteers.length && <>Import the mastersheet in <Link to="/setup">Setup</Link>.</>}</Empty> : (
          <ul className="list">
            {list.slice(0, limit).map((v) => {
              const n = d.outstanding.filter((i) => i.volunteer_id === v.id).reduce((s, i) => s + d.outQty(i), 0)
              const kit = d.kitByVol.get(v.id)?.length ?? 0
              return (
                <li key={v.id}>
                  <Link to={`/people/${v.id}`} className="result" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Avatar name={v.full_name} />
                    <div className="grow">
                      <div className="result-name">{v.full_name}</div>
                      <div className="result-meta">{[v.satsang_id ? `SID ${v.satsang_id}` : 'No SID', v.department, v.mandal].filter(Boolean).join(' · ')}</div>
                    </div>
                    {kit > 0 && <span className="badge"><ClipboardList /> {kit}</span>}
                    {n > 0 && <span className="badge badge-warn">{n} out</span>}
                    {v.added_at_desk && <span className="badge badge-warn">Desk</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {list.length > limit && <button className="btn" onClick={() => setLimit(limit + 200)}>Show more</button>}
      {adding && <AddPersonSheet onClose={() => setAdding(false)} onAdded={(v) => navigate(`/people/${v.id}`)} />}
    </main>
  )
}

export function ProfilePage() {
  const { id } = useParams()
  const { d, data, act } = useStore()
  const now = useNow()
  const navigate = useNavigate()
  const { run } = useAction()
  const [addingKit, setAddingKit] = useState(false)
  const [editing, setEditing] = useState(false)
  const v = d.volById.get(id ?? '')

  if (!v) return <main className="page"><Empty icon={Users} title="Person not found"><Link to="/people">Back to people</Link></Empty></main>

  const kit = d.kitByVol.get(v.id) ?? []
  const issues = [...(d.issuesByVol.get(v.id) ?? [])].sort((a, b) => b.issued_at.localeCompare(a.issued_at))
  const out = issues.filter((i) => d.outQty(i) > 0)
  const past = issues.filter((i) => d.outQty(i) === 0)
  const activity = data.activity.filter((a) => a.volunteer_id === v.id)
  const deptLead = d.zoneLeadForVolunteer({ ...v, zone_lead_id: null }).lead

  return (
    <main className="page">
      <div className="row">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginLeft: -8 }}><ArrowLeft /> Back</button>
        <div className="grow" />
        <Link className="btn btn-sm btn-primary" to={`/?p=${v.id}`}>Issue to {v.full_name.split(' ')[0]}</Link>
        {out.length > 0 && <Link className="btn btn-sm" to={`/return?p=${v.id}`}>Return</Link>}
      </div>
      <PersonCard v={v} showProfileLink={false} />

      <div className="grid-2">
        <label className="field card card-pad">
          <span className="label">Zone lead (for escalation)</span>
          <select className="select" value={v.zone_lead_id ?? ''} onChange={(e) => {
            const z = e.target.value || null
            run(() => act.updateVolunteer(v, { zone_lead_id: z }, `Zone lead set to ${z ? d.zoneById.get(z)?.name : 'department default'}`), 'Zone lead updated')
          }}>
            <option value="">From department{deptLead ? ` — ${deptLead.name}` : ' (none mapped)'}</option>
            {data.zone_leads.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <span className="hint">Choose a lead to override the department default for this person.</span>
        </label>
        <div className="card card-pad between">
          <div><span className="label">Details</span><p className="subtle">{v.added_at_desk ? 'Added at the desk — not from the mastersheet.' : 'From the mastersheet import.'}</p></div>
          <button className="btn btn-sm" onClick={() => setEditing(true)}><Pencil /> Edit</button>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <span className="section-title"><ClipboardList size={14} /> Confirmed kit</span>
          <button className="btn btn-sm" onClick={() => setAddingKit(true)}><Plus /> Add</button>
        </div>
        {kit.length === 0 ? <p className="subtle card-pad">No confirmed kit.</p> : <ul className="list">{kit.map((k) => <li key={k.id}><KitRow k={k} showPerson={false} /></li>)}</ul>}
      </section>

      <section className="card">
        <div className="card-head"><span className="section-title">Holding now · {out.length}</span></div>
        {out.length === 0 ? <p className="subtle card-pad">Nothing out.</p> : <ul className="list">{out.map((i) => <li key={i.id}><IssueRow issue={i} now={now} /></li>)}</ul>}
      </section>

      {past.length > 0 && (
        <section className="card">
          <div className="card-head"><span className="section-title">Returned & consumables · {past.length}</span></div>
          <ul className="list">{past.map((i) => <li key={i.id}><IssueRow issue={i} now={now} showReturn={false} /></li>)}</ul>
        </section>
      )}

      <section className="card">
        <div className="card-head"><span className="section-title">Full history</span></div>
        <ActivityList rows={activity} />
      </section>

      {addingKit && <KitAddSheet person={v} onClose={() => setAddingKit(false)} />}
      {editing && <EditPersonSheet v={v} onClose={() => setEditing(false)} />}
    </main>
  )
}

function EditPersonSheet({ v, onClose }: { v: Volunteer; onClose: () => void }) {
  const { act, data } = useStore()
  const { busy, run } = useAction()
  const [f, setF] = useState({ full_name: v.full_name, satsang_id: v.satsang_id ?? '', phone: v.phone ?? '', department: v.department ?? '', mandal: v.mandal ?? '', comments: v.comments ?? '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const sidTaken = f.satsang_id.trim() && data.volunteers.find((x) => x.satsang_id === f.satsang_id.trim() && x.id !== v.id)
  const save = async () => {
    const ok = await run(async () => {
      await act.updateVolunteer(v, {
        full_name: f.full_name.trim(), satsang_id: f.satsang_id.trim() || null, phone: f.phone.trim() || null,
        department: f.department.trim() || null, mandal: f.mandal.trim() || null, comments: f.comments.trim() || null,
      }, 'Details edited')
      return true
    }, 'Saved')
    if (ok) onClose()
  }
  return (
    <Sheet title="Edit details" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.full_name.trim() || !!sidTaken} onClick={save}>Save</button></>}>
      <div className="stack">
        <label className="field"><span className="label">Full name</span><input className="input" value={f.full_name} onChange={set('full_name')} /></label>
        <div className="grid-2">
          <label className="field"><span className="label">Satsang ID</span><input className="input" value={f.satsang_id} onChange={set('satsang_id')} inputMode="numeric" />{sidTaken && <span className="hint" style={{ color: 'var(--danger)' }}>Already belongs to {sidTaken.full_name}</span>}</label>
          <label className="field"><span className="label">Phone</span><input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" /></label>
          <label className="field"><span className="label">Department</span><input className="input" value={f.department} onChange={set('department')} /></label>
          <label className="field"><span className="label">Mandal</span><input className="input" value={f.mandal} onChange={set('mandal')} /></label>
        </div>
        <label className="field"><span className="label">Comments</span><input className="input" value={f.comments} onChange={set('comments')} /></label>
      </div>
    </Sheet>
  )
}
