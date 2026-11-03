import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AlarmClock, AlertTriangle, ClipboardCheck, PackageOpen, Plus, Save, Sparkles, Users } from 'lucide-react'
import type { Item } from '../types'
import { useStore } from '../lib/store'
import { itemLabel } from '../lib/search'
import { useNow, when } from '../lib/time'
import { sortItems } from '../components/ItemPicker'
import { IssueRow } from '../components/IssueRow'
import { Empty, Sheet, Swatch, useAction } from '../components/ui'
import { describeActivity } from './History'
import { ExportButton } from './Export'

export const isLow = (i: Item) => i.active && i.track_stock && (i.in_store === 0 || i.in_store <= i.low_threshold)

export function DashboardPage() {
  const { data, d, act } = useStore()
  const now = useNow()
  const { busy, run } = useAction()
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [counting, setCounting] = useState(false)
  const [counts, setCounts] = useState<Record<string, string>>({})

  const items = useMemo(() => sortItems(data.items.filter((i) => i.active)), [data.items])
  const byCat = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of items) { if (!m.has(i.category)) m.set(i.category, []); m.get(i.category)!.push(i) }
    return [...m.entries()]
  }, [items])
  const low = items.filter(isLow)
  const units = d.outstanding.reduce((n, i) => n + d.outQty(i), 0)
  const overdue = d.outstanding.filter((i) => d.isOverdue(i, now)).length
  const people = new Set(d.outstanding.map((i) => i.volunteer_id)).size

  const saveCounts = () => run(async () => {
    const changes = Object.entries(counts).filter(([id, v]) => {
      const it = d.itemById.get(id)
      return v.trim() !== '' && it && (!it.track_stock || Number(v) !== it.in_store)
    })
    for (const [id, v] of changes) await act.setStock(d.itemById.get(id)!, Math.max(0, parseInt(v, 10) || 0), 'stock count')
    setCounts({})
    setCounting(false)
    return changes.length
  }, 'Stock count saved')

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard & stock</h1>
          <p className="muted">Live totals. “In store” is what should be on the shelves now.</p>
        </div>
        <div className="row-wrap">
          {!counting
            ? <button className="btn" onClick={() => setCounting(true)}><ClipboardCheck /> Count stock</button>
            : <><button className="btn" onClick={() => { setCounting(false); setCounts({}) }}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={saveCounts}><Save /> Save counts</button></>}
          <button className="btn" onClick={() => setEditing('new')}><Plus /> Add item</button>
          <ExportButton kind="items" label="Export" />
        </div>
      </div>

      <div className="stats">
        <Link to="/outstanding" className="card stat"><span className="stat-label"><PackageOpen /> Items out now</span><span className="stat-value">{units}</span></Link>
        <Link to="/outstanding" className="card stat"><span className="stat-label"><Users /> People holding kit</span><span className="stat-value">{people}</span></Link>
        <Link to="/outstanding" className={`card stat ${overdue ? 'tone-danger' : ''}`}><span className="stat-label"><AlarmClock /> Overdue</span><span className="stat-value">{overdue}</span></Link>
        <div className={`card stat ${low.length ? 'tone-warn' : 'tone-ok'}`}><span className="stat-label"><AlertTriangle /> Low stock</span><span className="stat-value">{low.length}</span></div>
      </div>

      {counting && (
        <div className="banner banner-info"><ClipboardCheck /><span>Type the number physically on the shelf for each item you count. Leave blank to skip. Items not yet counted will start being tracked.</span></div>
      )}
      {!counting && low.length > 0 && (
        <div className="banner banner-warn">
          <AlertTriangle />
          <span><strong>Running low:</strong> {low.map((i) => `${itemLabel(i)} (${i.in_store})`).join(', ')}</span>
        </div>
      )}

      {items.length === 0 && (
        <div className="card">
          <Empty icon={Sparkles} title="No items yet">
            <p>Start from the cleaned-up catalogue built from the 2025 sheet, or import a stock list in Setup.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={() => run(() => act.addStarterCatalogue(), 'Starter catalogue added')}>Add starter catalogue</button>
          </Empty>
        </div>
      )}

      {byCat.map(([cat, list]) => (
        <section key={cat} className="card">
          <div className="card-head"><h2>{cat}</h2><span className="subtle">{list[0].returnable ? 'Returnable' : 'Consumable'}</span></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th className="r">In store</th><th className="r">Out</th>{list[0].returnable && <th className="r">Total</th>}<th style={{ width: '28%' }} /></tr></thead>
              <tbody>
                {list.map((i) => {
                  const out = d.outByItem.get(i.id) ?? 0
                  const total = i.in_store + out
                  return (
                    <tr key={i.id} className={counting ? '' : 'clickable'} onClick={() => !counting && setEditing(i)}>
                      <td><span className="row" style={{ fontWeight: 650 }}><Swatch category={i.category} name={i.name} />{i.name}</span>{i.unit_tracking && <span className="subtle"> · per-radio optional</span>}</td>
                      <td className="r num">
                        {counting
                          ? <input className="input" style={{ width: 84, minHeight: 40, textAlign: 'right' }} inputMode="numeric" placeholder={i.track_stock ? String(i.in_store) : '—'} value={counts[i.id] ?? ''} onChange={(e) => setCounts({ ...counts, [i.id]: e.target.value.replace(/\D/g, '') })} aria-label={`Count for ${itemLabel(i)}`} />
                          : i.track_stock ? <strong>{i.in_store}</strong> : <span className="subtle">not counted</span>}
                      </td>
                      <td className="r num">{out || <span className="subtle">0</span>}</td>
                      {list[0].returnable && <td className="r num">{i.track_stock ? total : '—'}</td>}
                      <td>
                        {isLow(i) ? <span className="badge badge-warn">Low</span>
                          : i.track_stock && i.returnable && total > 0 ? <div className={`meter`} title={`${out} of ${total} out`}><span style={{ width: `${(out / total) * 100}%` }} /></div> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {editing && <ItemSheet item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} now={now} />}
    </main>
  )
}

function ItemSheet({ item, onClose, now }: { item: Item | null; onClose: () => void; now: number }) {
  const { data, d, act } = useStore()
  const { busy, run } = useAction()
  const [f, setF] = useState({
    category: item?.category ?? '', name: item?.name ?? '', returnable: item?.returnable ?? true,
    unit_tracking: item?.unit_tracking ?? false, low_threshold: String(item?.low_threshold ?? 0), active: item?.active ?? true,
  })
  const [count, setCount] = useState('')
  const [reason, setReason] = useState('')
  const categories = [...new Set(data.items.map((i) => i.category))]
  const out = item ? d.outstanding.filter((i) => i.item_id === item.id) : []
  const history = item ? data.activity.filter((a) => a.item_id === item.id).slice(0, 30) : []

  const save = async () => {
    const ok = await run(async () => {
      await act.saveItem({ ...(item ? { id: item.id } : {}), category: f.category.trim(), name: f.name.trim(), returnable: f.returnable, unit_tracking: f.unit_tracking, low_threshold: parseInt(f.low_threshold, 10) || 0, active: f.active })
      return true
    }, item ? 'Item saved' : 'Item added')
    if (ok) onClose()
  }

  return (
    <Sheet title={item ? itemLabel(item) : 'Add item'} subtitle={item ? `${item.category} · ${item.track_stock ? `${item.in_store} in store` : 'not counted yet'}` : 'Add to the catalogue'} onClose={onClose}>
      <div className="stack-lg">
        {item && (
          <div className="card card-pad stack" style={{ boxShadow: 'none' }}>
            <span className="section-title">Set stock count</span>
            <div className="row">
              <input className="input" style={{ width: 110 }} inputMode="numeric" placeholder={item.track_stock ? String(item.in_store) : 'count'} value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} aria-label="New count in store" />
              <input className="input grow" placeholder="Reason (restock, lost, recount…)" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <button className="btn" disabled={busy || count === ''} onClick={async () => { await run(() => act.setStock(item, parseInt(count, 10), reason), 'Count updated'); setCount(''); setReason('') }}>Update count</button>
          </div>
        )}
        <div className="grid-2">
          <label className="field"><span className="label">Category</span><input className="input" list="cat-list" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></label>
          <label className="field"><span className="label">Name</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Yellow" /></label>
        </div>
        <div className="seg" role="group" aria-label="Type">
          <button aria-pressed={f.returnable} onClick={() => setF({ ...f, returnable: true })}>Returnable</button>
          <button aria-pressed={!f.returnable} onClick={() => setF({ ...f, returnable: false })}>Consumable</button>
        </div>
        <div className="grid-2">
          <label className="field"><span className="label">Warn when in store is at or below</span><input className="input" inputMode="numeric" value={f.low_threshold} onChange={(e) => setF({ ...f, low_threshold: e.target.value.replace(/\D/g, '') })} /></label>
          <div className="stack" style={{ gap: 0 }}>
            <label className="check"><input type="checkbox" checked={f.unit_tracking} onChange={(e) => setF({ ...f, unit_tracking: e.target.checked })} /> Ask for box / WT no. / channel (optional)</label>
            {item && <label className="check"><input type="checkbox" checked={!f.active} onChange={(e) => setF({ ...f, active: !e.target.checked })} /> Hide from issuing (retired)</label>}
          </div>
        </div>
        <button className="btn btn-primary" disabled={busy || !f.category.trim() || !f.name.trim()} onClick={save}>{item ? 'Save item' : 'Add item'}</button>

        {out.length > 0 && (
          <section className="card"><div className="card-head"><span className="section-title">Out now</span></div><ul className="list">{out.map((i) => <li key={i.id}><IssueRow issue={i} now={now} showPerson /></li>)}</ul></section>
        )}
        {history.length > 0 && (
          <section className="stack">
            <span className="section-title">Item history</span>
            <ul className="list">{history.map((a) => <li key={a.id} style={{ padding: '8px 0' }}><div style={{ fontWeight: 600 }}>{describeActivity(a, d)}</div><div className="subtle">{when(a.at)} · {a.actor}{a.details ? ` · ${a.details}` : ''}</div></li>)}</ul>
          </section>
        )}
      </div>
    </Sheet>
  )
}
