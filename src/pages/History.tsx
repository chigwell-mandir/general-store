import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { History, Search } from 'lucide-react'
import type { Activity, ActivityAction } from '../types'
import type { Derived } from '../lib/store'
import { useStore } from '../lib/store'
import { itemLabel, normalise } from '../lib/search'
import { when } from '../lib/time'
import { Empty } from '../components/ui'
import { ExportButton } from './Export'

const VERB: Record<ActivityAction, string> = {
  issue: 'Issued', return: 'Returned', void: 'Cancelled issue of', stock: 'Stock count for',
  kit_add: 'Kit confirmed:', kit_remove: 'Kit removed:', checkin: 'Karyakar checked in —', checkout: 'Karyakar checked out —',
  checkin_undo: 'Check-in/out undone —', person_add: 'Added person', person_edit: 'Updated', import: 'Import', setting: 'Settings changed',
}
const TONE: Partial<Record<ActivityAction, string>> = { issue: 'badge-brand', return: 'badge-ok', void: 'badge-danger', stock: 'badge-info', checkin: 'badge-ok' }

export function describeActivity(a: Activity, d: Derived) {
  const item = a.item_id ? d.itemById.get(a.item_id) : undefined
  const person = a.volunteer_id ? d.volById.get(a.volunteer_id) : undefined
  const what = item ? `${a.qty && a.action !== 'stock' ? `${a.qty} × ` : ''}${itemLabel(item)}` : ''
  const who = person?.full_name ?? ''
  switch (a.action) {
    case 'issue': return `${VERB.issue} ${what} to ${who}`
    case 'return': return `${who} returned ${what}`
    case 'void': return `${VERB.void} ${what} (${who})`
    case 'stock': return `${VERB.stock} ${what}: ${a.qty}`
    case 'kit_add': case 'kit_remove': return `${VERB[a.action]} ${what} for ${who}`
    case 'checkin': case 'checkout': case 'checkin_undo': case 'person_add': return `${VERB[a.action]} ${who}`
    case 'person_edit': return `${VERB.person_edit} ${who}`
    default: return VERB[a.action] ?? a.action
  }
}

const FILTERS: { key: string; label: string; actions: ActivityAction[] | null }[] = [
  { key: 'all', label: 'All', actions: null },
  { key: 'issue', label: 'Issues', actions: ['issue', 'void'] },
  { key: 'return', label: 'Returns', actions: ['return'] },
  { key: 'stock', label: 'Stock', actions: ['stock'] },
  { key: 'kit', label: 'Kit', actions: ['kit_add', 'kit_remove'] },
  { key: 'checkin', label: 'Karyakar check-in', actions: ['checkin', 'checkout', 'checkin_undo'] },
  { key: 'other', label: 'Other', actions: ['person_add', 'person_edit', 'import', 'setting'] },
]

export function ActivityList({ rows }: { rows: Activity[] }) {
  const { d } = useStore()
  if (rows.length === 0) return <Empty icon={History} title="Nothing logged yet" />
  return (
    <ul className="list">
      {rows.map((a) => (
        <li key={a.id} className="hold" style={{ minHeight: 56 }}>
          <span className={`badge ${TONE[a.action] ?? ''}`} style={{ minWidth: 72, justifyContent: 'center' }}>{a.action.replace('_', ' ')}</span>
          <div className="hold-main">
            <div style={{ fontWeight: 650 }}>
              {a.volunteer_id && d.volById.has(a.volunteer_id)
                ? <Link to={`/people/${a.volunteer_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{describeActivity(a, d)}</Link>
                : describeActivity(a, d)}
            </div>
            <div className="hold-sub"><span>{when(a.at)}</span><span>by {a.actor}</span>{a.details && <span>{a.details}</span>}</div>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function HistoryPage() {
  const { data, d } = useStore()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(150)

  const rows = useMemo(() => {
    const acts = FILTERS.find((f) => f.key === filter)?.actions
    const nq = normalise(q)
    return data.activity.filter((a) => {
      if (acts && !acts.includes(a.action)) return false
      if (!nq) return true
      return nq.split(' ').every((w) => normalise(`${describeActivity(a, d)} ${a.actor} ${a.details ?? ''}`).includes(w))
    })
  }, [data.activity, d, filter, q])

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>History</h1><p className="muted">Every action, newest first. Nothing is ever silently changed.</p></div>
        <ExportButton kind="issues" label="Export issue log" />
      </div>
      <div className="search-box">
        <Search aria-hidden />
        <input className="search-input compact" placeholder="Filter by person, item or desk volunteer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter history" />
      </div>
      <div className="chips" role="group" aria-label="Type">
        {FILTERS.map((f) => <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>)}
      </div>
      <section className="card"><ActivityList rows={rows.slice(0, limit)} /></section>
      {rows.length > limit && <button className="btn" onClick={() => setLimit(limit + 300)}>Show more ({rows.length - limit} older)</button>}
    </main>
  )
}
