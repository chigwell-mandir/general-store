import { useState } from 'react'
import type { Item, Volunteer } from '../types'
import { useStore } from '../lib/store'
import { itemLabel } from '../lib/search'
import { ItemPicker } from './ItemPicker'
import { PersonSearch } from './PersonSearch'
import { Sheet, Stepper, Swatch, useAction } from './ui'

const LAST_CONFIRMER = 'general-store-last-confirmer'

/** Record that a named lead has confirmed a person needs an item. */
export function KitAddSheet({ person: fixed, onClose }: { person?: Volunteer; onClose: () => void }) {
  const { act, d } = useStore()
  const { busy, run } = useAction()
  const [person, setPerson] = useState<Volunteer | undefined>(fixed)
  const [item, setItem] = useState<Item | null>(null)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [by, setBy] = useState(() => { try { return localStorage.getItem(LAST_CONFIRMER) ?? '' } catch { return '' } })

  const save = async (another: boolean) => {
    if (!person || !item || !by.trim()) return
    try { localStorage.setItem(LAST_CONFIRMER, by.trim()) } catch { /* ignore */ }
    const ok = await run(async () => {
      await act.addKit({ volunteer_id: person.id, item_id: item.id, qty, confirmed_by: by, note: note.trim() || null })
      return true
    }, `Kit added for ${person.full_name.split(' ')[0]}`)
    if (!ok) return
    if (another) { setItem(null); setQty(1); setNote(''); if (!fixed) setPerson(undefined) } else onClose()
  }

  return (
    <Sheet title="Add confirmed kit" subtitle="A lead has confirmed this person will need this item." onClose={onClose}>
      <div className="stack-lg">
        {!person ? (
          <div className="field"><span className="label">Volunteer</span><PersonSearch compact onSelect={setPerson} /></div>
        ) : (
          <div className="between card card-pad" style={{ boxShadow: 'none' }}>
            <div><div style={{ fontWeight: 750 }}>{person.full_name}</div><div className="subtle">{[person.satsang_id && `SID ${person.satsang_id}`, person.department].filter(Boolean).join(' · ')}</div></div>
            {!fixed && <button className="btn btn-sm" onClick={() => setPerson(undefined)}>Change</button>}
          </div>
        )}

        {person && (!item ? (
          <div className="field"><span className="label">Item</span><ItemPicker onPick={setItem} /></div>
        ) : (
          <div className="between card card-pad" style={{ boxShadow: 'none' }}>
            <div className="row" style={{ fontWeight: 750 }}><Swatch category={item.category} name={item.name} />{itemLabel(item)}</div>
            <div className="row"><Stepper value={qty} onChange={setQty} /><button className="btn btn-sm" onClick={() => setItem(null)}>Change</button></div>
          </div>
        ))}

        {person && item && (
          <>
            <label className="field">
              <span className="label">Confirmed by (lead) *</span>
              <input className="input" value={by} onChange={(e) => setBy(e.target.value)} list="confirmers" placeholder="e.g. Chiragbhai" />
              <datalist id="confirmers">{d.confirmers.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="field">
              <span className="label">Note (optional)</span>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </>
        )}
      </div>
      <div className="sheet-foot">
        <button className="btn" disabled={busy || !person || !item || !by.trim()} onClick={() => save(true)}>Save & add another</button>
        <button className="btn btn-primary" disabled={busy || !person || !item || !by.trim()} onClick={() => save(false)}>Save</button>
      </div>
    </Sheet>
  )
}
