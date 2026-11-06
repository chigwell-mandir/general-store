import { Link } from 'react-router'
import { X } from 'lucide-react'
import type { Volunteer } from '../types'
import { useStore } from '../lib/store'

/** Who the desk is dealing with — just the essentials. */
export function PersonCard({ v, onClear, showProfileLink = true }: { v: Volunteer; onClear?: () => void; showProfileLink?: boolean }) {
  const { d } = useStore()
  const lead = d.zoneLeadForVolunteer(v).lead
  const asLead = d.leadByVol.get(v.id)

  return (
    <div className="person-head">
      <div className="grow" style={{ minWidth: 0 }}>
        <h1 className="person-name">{v.full_name}</h1>
        <p className="muted">
          {[v.satsang_id ? `SID ${v.satsang_id}` : null, v.department].filter(Boolean).join(' · ')}
          {v.phone && <> · <a href={`tel:${v.phone.replace(/\s/g, '')}`}>{v.phone}</a></>}
        </p>
        {!showProfileLink && v.email && <p className="subtle">{v.email}</p>}
        <p className="subtle">
          {asLead ? 'Zone lead' : `Zone lead: ${lead?.name ?? 'not set'}`}
          {v.added_at_desk && ' · added at desk'}
          {showProfileLink && <> · <Link to={`/people/${v.id}`}>profile</Link></>}
        </p>
        {v.comments && <p className="subtle" style={{ marginTop: 4 }}>“{v.comments}”</p>}
      </div>
      {onClear && <button className="icon-btn" onClick={onClear} aria-label="Choose someone else"><X /></button>}
    </div>
  )
}
