import { useState } from 'react'
import { AlertTriangle, ChevronDown, Radio } from 'lucide-react'
import type { Item, KitRequirement, Volunteer } from '../types'
import { InsufficientStockError } from '../lib/backend'
import { useStore } from '../lib/store'
import { itemLabel } from '../lib/search'
import { Sheet, Stepper, Swatch, useToast } from './ui'
import { stockLabel } from './ItemPicker'

/** Confirm an issue: quantity, optional note, optional radio details. */
export function IssueSheet({ item, person, kit, onClose, onIssued }: {
  item: Item
  person: Volunteer
  kit?: KitRequirement
  onClose: () => void
  onIssued?: () => void
}) {
  const { act, data, d } = useStore()
  const toast = useToast()
  const [qty, setQty] = useState(kit?.qty ?? 1)
  const [note, setNote] = useState('')
  const [unit, setUnit] = useState({ box: '', wt: '', channel: '', earpiece: false })
  const [zoneLead, setZoneLead] = useState('')
  const [more, setMore] = useState(false)
  const [short, setShort] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const onKit = kit ?? d.kitByVol.get(person.id)?.find((k) => k.item_id === item.id)
  const defaultLead = d.zoneLeadForVolunteer(person).lead

  const submit = async (force = false) => {
    setBusy(true)
    try {
      const id = await act.issue({
        p_item_id: item.id, p_volunteer_id: person.id, p_qty: qty, p_note: note,
        p_unit_box: unit.box, p_unit_wt_no: unit.wt, p_unit_channel: unit.channel,
        p_unit_earpiece: item.unit_tracking && (unit.box || unit.wt || unit.channel || unit.earpiece) ? unit.earpiece : null,
        p_zone_lead_id: zoneLead || null, p_kit_id: onKit?.id ?? null, p_force: force,
      })
      toast.ok(`Issued ${qty} × ${itemLabel(item)} to ${person.full_name.split(' ')[0]}`, {
        label: 'Undo',
        run: () => act.voidIssue(id).then(() => toast.ok('Issue cancelled')).catch(toast.err),
      })
      onIssued?.()
      onClose()
    } catch (e) {
      if (e instanceof InsufficientStockError) setShort(e.available)
      else toast.err(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={<span className="row"><Swatch category={item.category} name={item.name} />{itemLabel(item)}</span>}
      subtitle={`${item.category} · ${stockLabel(item)} · ${item.returnable ? 'must be returned' : 'consumable — not expected back'}`}
      onClose={onClose}
    >
      <div className="stack">
        <div className="between">
          <div>
            <div className="label">Quantity</div>
            {onKit ? <div className="hint">On their confirmed kit ({onKit.qty})</div> : <div className="hint">Extra issue — not on their confirmed kit</div>}
          </div>
          <Stepper value={qty} onChange={(n) => { setQty(n); setShort(null) }} />
        </div>

        {item.unit_tracking && (
          <fieldset className="card card-pad" style={{ margin: 0, boxShadow: 'none', background: 'var(--surface-2)' }}>
            <legend className="section-title" style={{ padding: '0 6px' }}><Radio size={14} /> Radio details (optional)</legend>
            <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field"><span className="label">WT number</span><input className="input" value={unit.wt} onChange={(e) => setUnit({ ...unit, wt: e.target.value })} inputMode="numeric" /></label>
              <label className="field"><span className="label">Box</span><input className="input" value={unit.box} onChange={(e) => setUnit({ ...unit, box: e.target.value })} /></label>
              <label className="field"><span className="label">Channel</span><input className="input" value={unit.channel} onChange={(e) => setUnit({ ...unit, channel: e.target.value })} /></label>
              <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={unit.earpiece} onChange={(e) => setUnit({ ...unit, earpiece: e.target.checked })} /> Earpiece</label>
            </div>
          </fieldset>
        )}

        <label className="field">
          <span className="label">Note (optional)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={onKit ? 'e.g. swapped size' : 'e.g. why this extra item is needed'} />
        </label>

        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', marginLeft: -8 }} onClick={() => setMore(!more)} aria-expanded={more}>
          <ChevronDown style={{ rotate: more ? '180deg' : '0deg', transition: 'rotate 150ms' }} /> Escalate to a different zone lead
        </button>
        {more && (
          <label className="field">
            <span className="label">Zone lead for this item</span>
            <select className="select" value={zoneLead} onChange={(e) => setZoneLead(e.target.value)}>
              <option value="">Default{defaultLead ? ` — ${defaultLead.name}` : ' (none set for their department)'}</option>
              {data.zone_leads.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </label>
        )}

        {short !== null && (
          <div className="banner banner-warn" role="alert">
            <AlertTriangle />
            <div className="grow">
              <strong>Only {short} left according to the stock count.</strong> If you are physically holding the item, the count is wrong — you can still issue it (it will be logged).
            </div>
          </div>
        )}
      </div>
      <div className="sheet-foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        {short !== null
          ? <button className="btn btn-primary" disabled={busy} onClick={() => submit(true)}>Issue anyway</button>
          : <button className="btn btn-primary btn-lg" data-autofocus disabled={busy} onClick={() => submit()}>Issue {qty}</button>}
      </div>
    </Sheet>
  )
}
