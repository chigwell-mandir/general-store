import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Copy, CornerDownLeft, Megaphone, PartyPopper, Phone } from 'lucide-react'
import type { Issue } from '../types'
import { useStore, type Derived } from '../lib/store'
import { itemLabel } from '../lib/search'
import { useNow, when } from '../lib/time'
import { copyText } from '../lib/clipboard'
import { Empty, FoldAll, FoldCard, useFolds, useToast } from '../components/ui'

type Group = { key: string; lead: string; phone: string | null; issues: Issue[] }

const NO_LEAD = '__none__'
const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function groupIssues(issues: Issue[], d: Derived): Group[] {
  const m = new Map<string, Group>()
  for (const i of issues) {
    const z = d.zoneLeadForIssue(i).lead
    const key = z?.id ?? NO_LEAD
    if (!m.has(key)) m.set(key, { key, lead: z?.name ?? 'No zone lead set', phone: z?.phone ?? null, issues: [] })
    m.get(key)!.issues.push(i)
  }
  return [...m.values()].sort((a, b) => (a.key === NO_LEAD ? 1 : b.key === NO_LEAD ? -1 : a.lead.localeCompare(b.lead)))
}

function leadText(g: Group, d: Derived) {
  const byPerson = new Map<string, Issue[]>()
  for (const i of g.issues) { if (!byPerson.has(i.volunteer_id)) byPerson.set(i.volunteer_id, []); byPerson.get(i.volunteer_id)!.push(i) }
  const units = g.issues.reduce((n, i) => n + d.outQty(i), 0)
  const lines = [`*${g.lead}* — ${units} item${units === 1 ? '' : 's'}, ${byPerson.size} ${byPerson.size === 1 ? 'person' : 'people'}`]
  for (const [vid, list] of byPerson) {
    const v = d.volById.get(vid)
    const meta = [v?.satsang_id && `SID ${v.satsang_id}`, v?.department, v?.phone].filter(Boolean).join(', ')
    lines.push(`• ${v?.full_name ?? 'Unknown'}${meta ? ` (${meta})` : ''}`)
    for (const i of list) {
      const it = d.itemById.get(i.item_id)
      const unit = i.unit_wt_no ? ` · WT ${i.unit_wt_no}` : ''
      lines.push(`   – ${d.outQty(i)} × ${it ? itemLabel(it) : 'item'}${unit} · out ${when(i.issued_at)}`)
    }
  }
  return lines.join('\n')
}

export function EscalationPage() {
  const { d } = useStore()
  const toast = useToast()
  const now = useNow()
  const [overdueOnly, setOverdueOnly] = useState(false)
  const folds = useFolds()

  const issues = useMemo(() => d.outstanding.filter((i) => !overdueOnly || d.isOverdue(i, now)), [d, overdueOnly, now])
  const groups = useMemo(() => groupIssues(issues, d), [issues, d])
  const header = `*General Store — items not returned*\n_${d.event.name} · ${dateFmt.format(now)}_`
  const all = [header, ...groups.map((g) => leadText(g, d))].join('\n\n') + '\n\nPlease ask your team to return these to the General Store desk. Thank you!'

  const copy = async (text: string, what: string) => {
    try { await copyText(text); toast.ok(`${what} copied — paste into WhatsApp`) } catch (e) { toast.err(e) }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Escalation</h1>
          <p className="muted">Per-lead summary of returnable items still out, ready to paste into WhatsApp.</p>
        </div>
        {groups.length > 0 && <button className="btn btn-primary" onClick={() => copy(all, 'Full summary')}><Copy /> Copy all</button>}
      </div>

      <div className="row-wrap" style={{ alignItems: 'center' }}>
        <label className="check"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue only (after {d.event.overdue_time})</label>
      </div>

      {groups.some((g) => g.key === NO_LEAD) && (
        <div className="banner banner-warn"><Megaphone /><span>Some people have no zone lead. Map their department to a lead in <Link to="/setup">Setup → Zone leads</Link>, or set one on their profile.</span></div>
      )}

      {groups.length === 0 && <div className="card"><Empty icon={PartyPopper} title="Nothing to escalate">{overdueOnly ? 'Nothing is overdue.' : 'Every returnable item is back.'}</Empty></div>}

      {groups.length > 1 && <div className="row" style={{ justifyContent: 'flex-end', marginBottom: -8 }}><FoldAll keys={groups.map((g) => g.key)} folds={folds} /></div>}
      {groups.map((g) => {
        const text = leadText(g, d)
        return (
          <FoldCard key={g.key} open={folds.isOpen(g.key)} onToggle={() => folds.toggle(g.key)}
            title={<h2>{g.lead}</h2>} count={`${g.issues.reduce((n, i) => n + d.outQty(i), 0)} out`}>
            <div className="stack" style={{ padding: '8px 16px 16px' }}>
              <div className="row-wrap">
                {g.phone && <a className="btn btn-sm" href={`tel:${g.phone.replace(/\s/g, '')}`}><Phone /> Call</a>}
                {g.key !== NO_LEAD && <Link className="btn btn-sm" to={`/return?lead=${g.key}`}><CornerDownLeft /> Return</Link>}
                <button className="btn btn-sm" onClick={() => copy(`${header}\n\n${text}`, g.lead)}><Copy /> Copy</button>
              </div>
              <div className="wa-preview">{text}</div>
            </div>
          </FoldCard>
        )
      })}
    </main>
  )
}
