import { useState } from 'react'
import { Link } from 'react-router'
import { Clock, CornerDownLeft, MoreHorizontal, Undo2 } from 'lucide-react'
import type { Issue } from '../types'
import { useStore } from '../lib/store'
import { itemLabel } from '../lib/search'
import { clock, when } from '../lib/time'
import { Sheet, Stepper, Swatch, useAction } from './ui'

/** One issued line: what, how many, since when, with one-tap return. */
export function IssueRow({ issue, now, showPerson, showReturn = true, hideLead }: { issue: Issue; now: number; showPerson?: boolean; showReturn?: boolean; hideLead?: boolean }) {
  const { d, act, can } = useStore()
  const { busy, run } = useAction()
  const [sheet, setSheet] = useState(false)
  if (!can('items')) showReturn = false
  const item = d.itemById.get(issue.item_id)
  const person = d.volById.get(issue.volunteer_id)
  const left = d.outQty(issue)
  const returnable = item?.returnable ?? true
  const overdue = d.isOverdue(issue, now)
  const confirmer = d.confirmerForIssue(issue)
  const zl = d.zoneLeadForIssue(issue)
  const unit = [issue.unit_wt_no && `WT ${issue.unit_wt_no}`, issue.unit_box && `Box ${issue.unit_box}`, issue.unit_channel && `Ch ${issue.unit_channel}`, issue.unit_earpiece && 'earpiece'].filter(Boolean).join(' · ')

  let status
  if (!returnable) status = <span className="badge">Consumable</span>
  else if (left === 0) status = <span className="badge badge-ok">Returned {issue.returned_at && clock(issue.returned_at)}</span>
  else if (overdue) status = <span className="badge badge-danger"><Clock /> Overdue</span>
  else if (issue.returned_qty > 0) status = <span className="badge badge-warn">{issue.returned_qty} back · {left} out</span>

  return (
    <div className={`hold ${overdue ? 'overdue' : ''}`}>
      <span className="qty-pill num" aria-label={`Quantity ${issue.qty}`}>{left > 0 && left !== issue.qty ? `${left}/${issue.qty}` : issue.qty}</span>
      <div className="hold-main">
        <div className="hold-title">
          {item && <Swatch category={item.category} name={item.name} />}
          {item ? itemLabel(item) : 'Unknown item'}
          {status}
        </div>
        {showPerson && person && (
          <Link to={`/people/${person.id}`} className="hold-person">{person.full_name}{person.department && <span> · {person.department}</span>}</Link>
        )}
        <div className="hold-sub">
          <span>{returnable ? 'Out' : 'Issued'} {when(issue.issued_at)}{issue.returned_at && ` · back ${when(issue.returned_at)}`}</span>
          {unit && <span>{unit}</span>}
          {returnable && left > 0 && !hideLead && <span>Zone lead: {zl.lead?.name ?? '—'}</span>}
          {confirmer && <span>Kit by {confirmer}</span>}
          {issue.note && <span>“{issue.note}”</span>}
        </div>
      </div>
      <div className="hold-actions">
      {showReturn && returnable && left > 0 && (
        <button
          className="btn btn-ok"
          disabled={busy}
          onClick={() => (left > 1 ? setSheet(true) : run(() => act.returnIssue(issue, 1), `${item ? itemLabel(item) : 'Item'} returned`))}
        >
          <CornerDownLeft /> Return
        </button>
      )}
      {can('items') && <button className="icon-btn" onClick={() => setSheet(true)} aria-label="More actions"><MoreHorizontal /></button>}
      </div>
      {sheet && <IssueActions issue={issue} onClose={() => setSheet(false)} />}
    </div>
  )
}

function IssueActions({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const { d, act, data } = useStore()
  const { busy, run } = useAction()
  const item = d.itemById.get(issue.item_id)
  const person = d.volById.get(issue.volunteer_id)
  const left = d.outQty(issue)
  const [qty, setQty] = useState(left || 1)
  const [confirmVoid, setConfirmVoid] = useState(false)

  return (
    <Sheet title={item ? itemLabel(item) : 'Issue'} subtitle={`${issue.qty} issued to ${person?.full_name ?? 'unknown'} at ${clock(issue.issued_at)} by ${issue.issued_by}`} onClose={onClose}>
      <div className="stack">
        {left > 0 && (
          <div className="card card-pad stack" style={{ boxShadow: 'none' }}>
            <div className="between">
              <div>
                <div className="label">Return how many?</div>
                <div className="hint">{left} still out</div>
              </div>
              <Stepper value={qty} onChange={setQty} max={left} />
            </div>
            <button className="btn btn-ok btn-lg" disabled={busy} onClick={async () => { await run(() => act.returnIssue(issue, qty), `${qty} returned`); onClose() }}>
              <CornerDownLeft /> Return {qty}
            </button>
          </div>
        )}
        {left > 0 && (
          <label className="field">
            <span className="label">Escalate to zone lead</span>
            <select className="select" value={issue.zone_lead_id ?? ''} onChange={(e) => run(() => act.setIssueZoneLead(issue, e.target.value || null), 'Zone lead updated')}>
              <option value="">Default (from person / department)</option>
              {data.zone_leads.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </label>
        )}
        <hr className="divider" />
        {!confirmVoid ? (
          <button className="btn btn-danger" onClick={() => setConfirmVoid(true)}><Undo2 /> Cancel this issue (entered by mistake)</button>
        ) : (
          <div className="banner banner-danger">
            <div className="grow stack">
              <span>This removes the issue and puts {left || issue.qty} back into stock. It stays in the audit log.</span>
              <div className="row">
                <button className="btn btn-sm" onClick={() => setConfirmVoid(false)}>Keep it</button>
                <button className="btn btn-sm btn-danger" disabled={busy} onClick={async () => { await run(() => act.voidIssue(issue.id), 'Issue cancelled'); onClose() }}>Yes, cancel issue</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
