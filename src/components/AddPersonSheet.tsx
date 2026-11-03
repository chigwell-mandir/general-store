import { useState } from 'react'
import type { Volunteer } from '../types'
import { useStore } from '../lib/store'
import { Sheet, useAction } from './ui'

/** Quick-add for someone who turns up but isn't in the mastersheet. Flagged "added at desk". */
export function AddPersonSheet({ initialName = '', initialSid = '', onClose, onAdded }: {
  initialName?: string
  initialSid?: string
  onClose: () => void
  onAdded: (v: Volunteer) => void
}) {
  const { act, d, data } = useStore()
  const { busy, run } = useAction()
  const [f, setF] = useState({ full_name: initialName, satsang_id: initialSid, phone: '', department: '', mandal: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const sidTaken = f.satsang_id.trim() && data.volunteers.find((v) => v.satsang_id === f.satsang_id.trim())

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = await run(() => act.addVolunteer({
      full_name: f.full_name.trim(),
      satsang_id: f.satsang_id.trim() || null,
      phone: f.phone.trim() || null,
      department: f.department.trim() || null,
      mandal: f.mandal.trim() || null,
      vcd: null,
      comments: null,
    }), `${f.full_name.trim()} added`)
    if (id) onAdded({ id, full_name: f.full_name.trim(), satsang_id: f.satsang_id.trim() || null, phone: f.phone.trim() || null, department: f.department.trim() || null, mandal: f.mandal.trim() || null, vcd: null, comments: null, added_at_desk: true, zone_lead_id: null, created_at: new Date().toISOString() })
  }

  return (
    <Sheet title="Add person" subtitle="For someone not in the mastersheet. They’ll be marked “added at desk”." onClose={onClose}>
      <form className="stack" onSubmit={save} id="add-person">
        <label className="field">
          <span className="label">Full name *</span>
          <input className="input" value={f.full_name} onChange={set('full_name')} required autoComplete="off" data-autofocus />
        </label>
        <div className="grid-2">
          <label className="field">
            <span className="label">Satsang ID</span>
            <input className="input" value={f.satsang_id} onChange={set('satsang_id')} inputMode="numeric" />
            {sidTaken && <span className="hint" style={{ color: 'var(--danger)' }}>Already belongs to {sidTaken.full_name}</span>}
          </label>
          <label className="field">
            <span className="label">Phone</span>
            <input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" />
          </label>
        </div>
        <div className="grid-2">
          <label className="field">
            <span className="label">Department</span>
            <input className="input" value={f.department} onChange={set('department')} list="dept-list" />
            <datalist id="dept-list">{d.departments.map((x) => <option key={x} value={x} />)}</datalist>
          </label>
          <label className="field">
            <span className="label">Mandal</span>
            <input className="input" value={f.mandal} onChange={set('mandal')} list="mandal-list" />
            <datalist id="mandal-list">
              {['Sanyukta Purush', 'Sanyukta Mahila', 'Yuvak', 'Yuvati', 'Kishore', 'Kishori', 'Bal', 'Balika'].map((x) => <option key={x} value={x} />)}
            </datalist>
          </label>
        </div>
      </form>
      <div className="sheet-foot">
        <button className="btn" onClick={onClose} type="button">Cancel</button>
        <button className="btn btn-primary" form="add-person" type="submit" disabled={busy || !f.full_name.trim() || !!sidTaken}>Add person</button>
      </div>
    </Sheet>
  )
}
