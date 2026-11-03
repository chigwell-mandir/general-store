import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ClipboardList, Plus, Search, Trash2 } from 'lucide-react'
import type { KitRequirement } from '../types'
import { useStore } from '../lib/store'
import { itemLabel, normalise } from '../lib/search'
import { KitAddSheet } from '../components/KitAddSheet'
import { Empty, FoldAll, FoldCard, Swatch, useAction, useFolds } from '../components/ui'

export function useKitStatus() {
  const { d } = useStore()
  return (k: KitRequirement) => {
    const issued = (d.issuesByVol.get(k.volunteer_id) ?? []).filter((i) => i.item_id === k.item_id).reduce((n, i) => n + i.qty, 0)
    return { issued, done: issued >= k.qty }
  }
}

export function KitRow({ k, showPerson = true }: { k: KitRequirement; showPerson?: boolean }) {
  const { d, act } = useStore()
  const { busy, run } = useAction()
  const status = useKitStatus()(k)
  const item = d.itemById.get(k.item_id)
  const v = d.volById.get(k.volunteer_id)
  return (
    <div className="hold">
      <span className="qty-pill num">{k.qty}</span>
      <div className="hold-main">
        <div className="hold-title">
          {item && <Swatch category={item.category} name={item.name} />}{item ? itemLabel(item) : 'Unknown item'}
          {showPerson && v && <> <span className="muted" style={{ fontWeight: 500 }}>for</span> <Link to={`/people/${v.id}`} style={{ color: 'inherit' }}>{v.full_name}</Link></>}
          {status.done ? <span className="badge badge-ok">Issued</span> : status.issued > 0 ? <span className="badge badge-warn">{status.issued}/{k.qty} issued</span> : <span className="badge">Not yet issued</span>}
        </div>
        <div className="hold-sub"><span>Zone lead: {d.zoneLeadForVolunteer(v).lead?.name ?? '—'}</span>{v?.department && <span>{v.department}</span>}{k.note && <span>“{k.note}”</span>}</div>
      </div>
      <button className="icon-btn hold-actions" disabled={busy} onClick={() => confirm(`Remove ${item ? itemLabel(item) : 'this item'} from ${v?.full_name ?? 'their'} kit?`) && run(() => act.removeKit(k), 'Kit removed')} aria-label="Remove from kit"><Trash2 /></button>
    </div>
  )
}

export function KitPage() {
  const { data, d } = useStore()
  const status = useKitStatus()
  const [adding, setAdding] = useState(false)
  const [group, setGroup] = useState<'lead' | 'person'>('lead')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [q, setQ] = useState('')
  const folds = useFolds()

  const rows = useMemo(() => {
    const nq = normalise(q)
    return data.kit_requirements.filter((k) => {
      if (pendingOnly && status(k).done) return false
      if (!nq) return true
      const v = d.volById.get(k.volunteer_id)
      const it = d.itemById.get(k.item_id)
      return nq.split(' ').every((w) => normalise(`${v?.full_name} ${v?.satsang_id} ${v?.department} ${it && itemLabel(it)} ${d.zoneLeadForVolunteer(v).lead?.name ?? ''}`).includes(w))
    })
  }, [data.kit_requirements, d, q, pendingOnly, status])

  const groups = useMemo(() => {
    const m = new Map<string, KitRequirement[]>()
    for (const k of rows) {
      const v = d.volById.get(k.volunteer_id)
      const key = group === 'lead' ? d.zoneLeadForVolunteer(v).lead?.name ?? 'No zone lead set' : v?.full_name ?? '?'
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(k)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows, group, d])

  const done = data.kit_requirements.filter((k) => status(k).done).length

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Kit allocation</h1>
          <p className="muted">Items leads have confirmed each person needs. {data.kit_requirements.length > 0 && `${done} of ${data.kit_requirements.length} issued.`}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus /> Add confirmed kit</button>
      </div>

      <div className="row-wrap" style={{ alignItems: 'center' }}>
        <div className="search-box grow" style={{ minWidth: 220 }}>
          <Search aria-hidden />
          <input className="search-input compact" placeholder="Filter by person, item or lead" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter kit" />
        </div>
        <div className="seg" role="group" aria-label="Group by">
          <button aria-pressed={group === 'lead'} onClick={() => setGroup('lead')}>By zone lead</button>
          <button aria-pressed={group === 'person'} onClick={() => setGroup('person')}>By person</button>
        </div>
        <label className="check"><input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> Not yet issued</label>
      </div>

      {groups.length === 0 && (
        <div className="card"><Empty icon={ClipboardList} title={data.kit_requirements.length ? 'No matches' : 'No confirmed kit yet'}>When a zone lead confirms someone needs an item (e.g. “Vish needs a blue bib and an all-channel walkie”), add it here. It then shows up when issuing to that person.</Empty></div>
      )}
      {groups.length > 1 && <div className="row" style={{ justifyContent: 'flex-end', marginBottom: -8 }}><FoldAll keys={groups.map(([k]) => k)} folds={folds} /></div>}
      {groups.map(([key, list]) => (
        <FoldCard key={key} open={folds.isOpen(key)} onToggle={() => folds.toggle(key)} title={<h3>{key}</h3>}
          count={`${list.filter((k) => status(k).done).length}/${list.length} issued`}>
          <ul className="list">{list.map((k) => <li key={k.id}><KitRow k={k} showPerson={group === 'lead'} /></li>)}</ul>
        </FoldCard>
      ))}

      {adding && <KitAddSheet onClose={() => setAdding(false)} />}
    </main>
  )
}
