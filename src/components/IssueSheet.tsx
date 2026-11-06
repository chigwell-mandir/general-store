import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { Item, KitRequirement, Volunteer } from '../types'
import { InsufficientStockError } from '../lib/backend'
import { useStore } from '../lib/store'
import { itemLabel } from '../lib/search'
import { ItemPicker, stockLabel } from './ItemPicker'
import { PersonSearch } from './PersonSearch'
import { Sheet, Stepper, Swatch, useToast } from './ui'

const SIZES = ['S', 'M', 'L', 'XL', 'XXL']
const CHANNELS = ['1', '2', '3', '4', '5', '6', '7', '8', 'All channel']

/**
 * Give an item: pick it (unless already chosen), set quantity, done.
 * Extras (note, walkie details, which team member it's for) stay hidden until asked for.
 */
export function IssueSheet({ item: preset, person, kit, forTeam, onClose }: {
  item?: Item
  person: Volunteer
  kit?: KitRequirement
  /** The person is a zone lead collecting for their team: offer "for team member". */
  forTeam?: boolean
  onClose: () => void
}) {
  const { act, d } = useStore()
  const toast = useToast()
  const [item, setItem] = useState<Item | undefined>(preset)
  const [qty, setQty] = useState(kit?.qty ?? 1)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [unit, setUnit] = useState({ wt: '', channel: '', earpiece: false })
  const [size, setSize] = useState('')
  const [forPerson, setForPerson] = useState<Volunteer | null>(null)
  const [pickingFor, setPickingFor] = useState(false)
  const [short, setShort] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const first = person.full_name.split(' ')[0]

  if (!item) {
    return (
      <Sheet title={`Give to ${first}`} onClose={onClose}>
        <ItemPicker onPick={(i) => { setItem(i); setQty(1) }} />
      </Sheet>
    )
  }

  const onKit = kit ?? d.kitByVol.get(person.id)?.find((k) => k.item_id === item.id)
  const submit = async (force = false) => {
    setBusy(true)
    try {
      const id = await act.issue({
        p_item_id: item.id, p_volunteer_id: person.id, p_qty: qty, p_note: note,
        p_unit_wt_no: unit.wt, p_unit_channel: unit.channel, p_unit_earpiece: item.unit_tracking ? unit.earpiece : null,
        p_kit_id: onKit?.id ?? null, p_force: force,
        ...(forPerson ? { p_for_volunteer_id: forPerson.id } : {}),
        ...(size ? { p_item_size: size } : {}),
      })
      toast.ok(`Gave ${qty} × ${itemLabel(item)}${size ? ` (${size})` : ''} to ${first}${forPerson ? ` for ${forPerson.full_name.split(' ')[0]}` : ''}`, {
        label: 'Undo',
        run: () => act.voidIssue(id).then(() => toast.ok('Undone')).catch(toast.err),
      })
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
      subtitle={`${stockLabel(item)}${item.returnable ? '' : ' · not expected back'}`}
      onClose={onClose}
    >
      <div className="stack">
        <div className="between">
          <span className="label">How many?</span>
          <Stepper value={qty} onChange={(n) => { setQty(n); setShort(null) }} />
        </div>

        {forTeam && (
          forPerson ? (
            <div className="between chip-line">
              <span>For <strong>{forPerson.full_name}</strong></span>
              <button className="icon-btn" onClick={() => setForPerson(null)} aria-label="Remove team member"><X /></button>
            </div>
          ) : pickingFor ? (
            <PersonSearch compact allowAdd={false} placeholder="Which team member is it for?" onSelect={(v) => { setForPerson(v); setPickingFor(false) }} />
          ) : null
        )}
        {item.category === 'Hi-Vis' && (
          <div className="between">
            <span className="label">Size</span>
            <div className="row-wrap" role="group" aria-label="Size">
              {SIZES.map((s) => <button key={s} type="button" className="chip" aria-pressed={size === s} onClick={() => setSize(size === s ? '' : s)}>{s}</button>)}
            </div>
          </div>
        )}
        {item.unit_tracking && (
          <>
            <div className="row">
              <select className="select" aria-label="Channel" value={unit.channel} onChange={(e) => setUnit({ ...unit, channel: e.target.value })}>
                <option value="">Channel</option>
                {CHANNELS.map((c) => <option key={c} value={c}>{/^\d/.test(c) ? `Channel ${c}` : c}</option>)}
              </select>
              <input className="input" placeholder="WT no. (optional)" inputMode="numeric" value={unit.wt} onChange={(e) => setUnit({ ...unit, wt: e.target.value })} />
            </div>
            <label className="check"><input type="checkbox" checked={unit.earpiece} onChange={(e) => setUnit({ ...unit, earpiece: e.target.checked })} /> Earpiece</label>
          </>
        )}
        {showNote && <input className="input" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />}

        <div className="row-wrap">
          {forTeam && !forPerson && !pickingFor && <button className="btn btn-ghost btn-sm" onClick={() => setPickingFor(true)}>+ For a team member</button>}
          {!showNote && <button className="btn btn-ghost btn-sm" onClick={() => setShowNote(true)}>+ Note</button>}
          {!preset && <button className="btn btn-ghost btn-sm" onClick={() => setItem(undefined)}>Change item</button>}
        </div>

        {short !== null && (
          <div className="banner banner-warn" role="alert">
            <AlertTriangle />
            <span>Only {short} left by the stock count. If you’re holding it, the count is off — you can still give it.</span>
          </div>
        )}
      </div>
      <div className="sheet-foot">
        {short !== null
          ? <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => submit(true)}>Give anyway</button>
          : <button className="btn btn-primary btn-lg" data-autofocus disabled={busy} onClick={() => submit()}>Give {qty}</button>}
      </div>
    </Sheet>
  )
}
