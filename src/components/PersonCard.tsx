import { Link } from 'react-router'
import { BadgeCheck, Building2, ChevronRight, IdCard, Phone, ShieldUser, Users, X } from 'lucide-react'
import type { Volunteer } from '../types'
import { useStore } from '../lib/store'
import { clock } from '../lib/time'
import { Avatar } from './ui'

/** Who the desk is dealing with: mastersheet details at a glance. */
export function PersonCard({ v, onClear, showProfileLink = true }: { v: Volunteer; onClear?: () => void; showProfileLink?: boolean }) {
  const { d } = useStore()
  const zl = d.zoneLeadForVolunteer(v)
  const checkin = d.checkinByVol.get(v.id)

  return (
    <div className="card card-pad">
      <div className="person">
        <Avatar name={v.full_name} large />
        <div className="grow">
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="person-name">{v.full_name}</div>
              <div className="row-wrap" style={{ marginTop: 6 }}>
                <span className="badge badge-brand"><IdCard /> {v.satsang_id ? `SID ${v.satsang_id}` : 'No Satsang ID'}</span>
                {v.added_at_desk && <span className="badge badge-warn">Added at desk</span>}
                {checkin && !checkin.checked_out_at && <span className="badge badge-ok"><BadgeCheck /> Checked in {clock(checkin.checked_in_at)}</span>}
                {v.vcd && <span className="badge">VCD: {v.vcd}</span>}
              </div>
            </div>
            {onClear && <button className="icon-btn" onClick={onClear} aria-label="Choose a different person"><X /></button>}
          </div>
          <div className="facts">
            {v.department && <span><Building2 aria-hidden /> {v.department}</span>}
            {v.mandal && <span><Users aria-hidden /> {v.mandal}</span>}
            {v.phone && <span><Phone aria-hidden /> <a href={`tel:${v.phone.replace(/\s/g, '')}`}>{v.phone}</a></span>}
            <span><ShieldUser aria-hidden /> Zone lead: {zl.lead ? <strong>{zl.lead.name}</strong> : <em>not set</em>}{zl.manual && ' (manual)'}</span>
          </div>
          {v.comments && <div className="note-box">{v.comments}</div>}
        </div>
      </div>
      {showProfileLink && (
        <Link to={`/people/${v.id}`} className="btn btn-ghost btn-sm" style={{ marginTop: 10, marginLeft: -8 }}>
          Full profile & history <ChevronRight />
        </Link>
      )}
    </div>
  )
}
