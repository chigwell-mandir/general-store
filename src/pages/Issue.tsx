import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Check, ClipboardList, PackageMinus, UserRoundCheck } from 'lucide-react'
import type { Item, KitRequirement, Volunteer } from '../types'
import { useStore } from '../lib/store'
import { itemLabel } from '../lib/search'
import { clock, useNow } from '../lib/time'
import { PersonSearch } from '../components/PersonSearch'
import { PersonCard } from '../components/PersonCard'
import { ItemPicker } from '../components/ItemPicker'
import { IssueSheet } from '../components/IssueSheet'
import { IssueRow } from '../components/IssueRow'
import { FoldCard, Swatch } from '../components/ui'

/** Remembers the selected person in the URL so Back and refresh behave. */
export function usePersonParam() {
  const [params, setParams] = useSearchParams()
  const { d } = useStore()
  const person = d.volById.get(params.get('p') ?? '')
  const setPerson = (v: Volunteer | null) => setParams(v ? { p: v.id } : {}, { replace: false })
  return [person, setPerson] as const
}

export function IssuePage() {
  const { d } = useStore()
  const now = useNow()
  const [person, setPerson] = usePersonParam()
  const [picking, setPicking] = useState<{ item: Item; kit?: KitRequirement } | null>(null)

  const kit = person ? d.kitByVol.get(person.id) ?? [] : []
  const theirIssues = useMemo(
    () => (person ? [...(d.issuesByVol.get(person.id) ?? [])].sort((a, b) => b.issued_at.localeCompare(a.issued_at)) : []),
    [d, person],
  )
  const issuedQty = (k: KitRequirement) => theirIssues.filter((i) => i.item_id === k.item_id).reduce((n, i) => n + i.qty, 0)
  const lastIssued = (k: KitRequirement) => theirIssues.find((i) => i.item_id === k.item_id)?.issued_at

  if (!person) {
    const recent = [...d.outstanding].sort((a, b) => b.issued_at.localeCompare(a.issued_at)).slice(0, 5)
    return (
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Issue items</h1>
            <p className="muted">Search for the volunteer collecting kit.</p>
          </div>
        </div>
        <PersonSearch onSelect={setPerson} />
        {recent.length > 0 && (
          <FoldCard title={<h3>Latest still out</h3>} count={recent.length}>
            <ul className="list">{recent.map((i) => <li key={i.id}><IssueRow issue={i} now={now} showPerson showReturn={false} /></li>)}</ul>
          </FoldCard>
        )}
      </main>
    )
  }

  return (
    <main className="page">
      <PersonCard v={person} onClear={() => setPerson(null)} />

      <section className="stack">
        <div className="between">
          <h2 className="row"><ClipboardList size={20} /> Confirmed kit</h2>
          {kit.length > 0 && <span className="subtle">{kit.filter((k) => issuedQty(k) >= k.qty).length}/{kit.length} issued</span>}
        </div>
        {kit.length === 0 ? (
          <p className="subtle">No confirmed kit for {person.full_name.split(' ')[0]}. You can still issue anything below.</p>
        ) : (
          <div className="kit-grid">
            {kit.map((k) => {
              const item = d.itemById.get(k.item_id)
              if (!item) return null
              const done = issuedQty(k) >= k.qty
              const at = lastIssued(k)
              return (
                <button key={k.id} className={`kit-tile ${done ? 'done' : ''}`} onClick={() => !done && setPicking({ item, kit: k })} aria-disabled={done}>
                  <span className="tile-icon">{done ? <Check /> : <PackageMinus />}</span>
                  <span className="grow">
                    <span className="tile-title row"><Swatch category={item.category} name={item.name} />{k.qty > 1 && `${k.qty} × `}{itemLabel(item)}</span>
                    <span className="tile-sub" style={{ display: 'block' }}>
                      {done ? `Issued ${at ? clock(at) : ''}` : 'Tap to issue'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="stack">
        <h2>Issue another item</h2>
        <ItemPicker onPick={(item) => setPicking({ item })} />
      </section>

      {theirIssues.length > 0 && (
        <FoldCard title={<h3>Their items</h3>} count={theirIssues.length}>
          <ul className="list">{theirIssues.map((i) => <li key={i.id}><IssueRow issue={i} now={now} /></li>)}</ul>
        </FoldCard>
      )}

      <button className="btn btn-lg btn-block" onClick={() => { setPerson(null); window.scrollTo({ top: 0 }) }}>
        <UserRoundCheck /> Done — next person
      </button>

      {picking && <IssueSheet item={picking.item} kit={picking.kit} person={person} onClose={() => setPicking(null)} />}
    </main>
  )
}
