import { useState } from 'react'
import { Link } from 'react-router'
import { MoreHorizontal, Undo2 } from 'lucide-react'
import type { Issue } from '../types'
import { useStore } from '../lib/store'
import { itemLabel } from '../lib/search'
import { clock, when } from '../lib/time'
import { Sheet, Stepper, Swatch, useAction } from './ui'

/** One issued line: quantity × item, time out, and a Return button. Extras only when they exist. */
export function IssueRow({ issue, now, showPerson, showReturn = true }: { issue: Issue; now: number; showPerson?: boolean; showReturn?: boolean; hideLead?: boolean }) {
  const { d, act } = useStore()
  const { busy, run } = useAction()
  const [sheet, setSheet] = useState(false)
  const item = d.itemById.get(issue.item_id)
  const person = d.volById.get(issue.volunteer_id)
  const forPerson = issue.for_volunteer_id ? d.volById.get(issue.for_volunteer_id) : undefined
  const left = d.outQty(issue)
  const returnable = item?.returnable ?? true
  const overdue = d.isOverdue(issue, now)
  const label = item ? itemLabel(item) : 'Unknown item'

  const extras = [
    forPerson && `for ${forPerson.full_name}`,
    issue.unit_wt_no && `WT ${issue.unit_wt_no}`,
    issue.unit_channel && `ch ${issue.unit_channel}`,
    issue.note && `“${issue.note}”`,
  ].filter(Boolean).join(' · ')

  let time = `${returnable ? 'Out' : 'Given'} ${when(issue.issued_at)}`
  if (issue.returned_at && left === 0) time += ` · back ${clock(issue.returned_at)}`
  else if (issue.returned_qty > 0) time += ` · ${issue.returned_qty} back`

  return (
    <div className="hold">
      <div className="hold-main">
        <div className="hold-title">
          {item && <Swatch category={item.category} name={item.name} />}
          <span>{issue.qty > 1 && `${left > 0 && left !== issue.qty ? `${left}/${issue.qty}` : issue.qty} × `}{label}</span>
        </div>
        {showPerson && person && <Link to={`/people/${person.id}`} className="hold-person">{person.full_name}</Link>}
        <div className={`hold-sub ${overdue ? 'is-overdue' : ''}`}>
          <span>{time}{overdue && ' · overdue'}</span>
          {extras && <span>{extras}</span>}
        </div>
      </div>
      <div className="hold-actions">
        {showReturn && returnable && left > 0 && (
          <button className="btn btn-sm btn-ok" disabled={busy}
            onClick={() => (left > 1 ? setSheet(true) : run(() => act.returnIssue(issue, 1), `${label} returned`))}>
            Return
          </button>
        )}
        {!returnable && <span className="subtle">used</span>}
        <button className="icon-btn" onClick={() => setSheet(true)} aria-label="More actions"><MoreHorizontal /></button>
      </div>
      {sheet && <IssueActions issue={issue} onClose={() => setSheet(false)} />}
    </div>
  )
}

function IssueActions({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const { d, act } = useStore()
  const { busy, run } = useAction()
  const item = d.itemById.get(issue.item_id)
  const person = d.volById.get(issue.volunteer_id)
  const left = d.outQty(issue)
  const [qty, setQty] = useState(left || 1)
  const [confirmVoid, setConfirmVoid] = useState(false)

  return (
    <Sheet title={item ? itemLabel(item) : 'Issue'} subtitle={`${issue.qty} to ${person?.full_name ?? 'unknown'} at ${clock(issue.issued_at)} by ${issue.issued_by}`} onClose={onClose}>
      <div className="stack">
        {left > 0 && (
          <>
            <div className="between">
              <span className="label">Return how many? <span className="hint">({left} out)</span></span>
              <Stepper value={qty} onChange={setQty} max={left} />
            </div>
            <button className="btn btn-ok btn-lg" disabled={busy} onClick={async () => { await run(() => act.returnIssue(issue, qty), `${qty} returned`); onClose() }}>
              Return {qty}
            </button>
          </>
        )}
        {!confirmVoid ? (
          <button className="btn btn-ghost" onClick={() => setConfirmVoid(true)}><Undo2 /> Cancel this issue (mistake)</button>
        ) : (
          <div className="banner banner-danger">
            <div className="grow stack">
              <span>Remove this issue and put {left || issue.qty} back in stock? It stays in History.</span>
              <div className="row">
                <button className="btn btn-sm" onClick={() => setConfirmVoid(false)}>Keep it</button>
                <button className="btn btn-sm btn-danger" disabled={busy} onClick={async () => { await run(() => act.voidIssue(issue.id), 'Issue cancelled'); onClose() }}>Yes, cancel it</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
