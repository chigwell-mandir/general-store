import { useEffect, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import type { Issue } from '../types'
import { useStore, type Derived } from '../lib/store'
import { itemLabel, normalise } from '../lib/search'
import { useNow, when } from '../lib/time'
import { copyText } from '../lib/clipboard'
import { IssueRow } from '../components/IssueRow'
import { FoldAll, FoldCard, useFolds, useToast } from '../components/ui'

type Group = { key: string; lead: string; issues: Issue[] }
const NO_LEAD = '__none__'
const stamp = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function groupByLead(issues: Issue[], d: Derived): Group[] {
  const m = new Map<string, Group>()
  for (const i of issues) {
    const z = d.zoneLeadForIssue(i).lead
    const key = z?.id ?? NO_LEAD
    if (!m.has(key)) m.set(key, { key, lead: z?.name ?? 'No zone lead set', issues: [] })
    m.get(key)!.issues.push(i)
  }
  return [...m.values()].sort((a, b) => (a.key === NO_LEAD ? 1 : b.key === NO_LEAD ? -1 : a.lead.localeCompare(b.lead)))
}

const byPerson = (issues: Issue[]) => {
  const m = new Map<string, Issue[]>()
  for (const i of issues) m.set(i.volunteer_id, [...(m.get(i.volunteer_id) ?? []), i])
  return [...m.entries()]
}

/** WhatsApp-ready text for one lead: *bold* name, then each person and what they have. */
function leadText(g: Group, d: Derived) {
  const units = g.issues.reduce((n, i) => n + d.outQty(i), 0)
  const lines = [`*${g.lead}* — ${units} item${units === 1 ? '' : 's'} not returned`]
  for (const [vid, list] of byPerson(g.issues)) {
    const v = d.volById.get(vid)
    lines.push(`• ${v?.full_name ?? 'Unknown'}${v?.phone ? ` (${v.phone})` : ''}`)
    for (const i of list) {
      const it = d.itemById.get(i.item_id)
      const forName = i.for_volunteer_id ? d.volById.get(i.for_volunteer_id)?.full_name : null
      lines.push(`   – ${d.outQty(i)} × ${it ? itemLabel(it) : 'item'}${i.unit_wt_no ? ` (WT ${i.unit_wt_no})` : ''}${forName ? ` for ${forName}` : ''} · out ${when(i.issued_at)}`)
    }
  }
  return lines.join('\n')
}

/** Everything still out, by zone lead — with a WhatsApp copy for each lead. */
export function OutPage() {
  const { d } = useStore()
  const now = useNow()
  const toast = useToast()
  const folds = useFolds(false)
  const [q, setQ] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [view, setView] = useState<'lead' | 'person'>('lead')
  const searching = q.trim().length > 0

  const issues = useMemo(() => {
    const words = normalise(q).split(' ').filter(Boolean)
    return d.outstanding.filter((i) => {
      if (overdueOnly && !d.isOverdue(i, now)) return false
      if (!words.length) return true
      const v = d.volById.get(i.volunteer_id)
      const it = d.itemById.get(i.item_id)
      const forName = i.for_volunteer_id ? d.volById.get(i.for_volunteer_id)?.full_name : ''
      const hay = normalise(`${v?.full_name} ${v?.satsang_id ?? ''} ${v?.department ?? ''} ${forName} ${it ? itemLabel(it) : ''} ${i.unit_wt_no ?? ''} ${d.zoneLeadForIssue(i).lead?.name ?? ''}`)
      return words.every((w) => hay.includes(w))
    })
  }, [d, q, overdueOnly, now])
  const groups = useMemo(() => groupByLead(issues, d), [issues, d])
  // A new search opens the matching groups once — they can still be folded afterwards
  useEffect(() => {
    folds.setAll(groups.map((g) => g.key), searching)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = issues.reduce((n, i) => n + d.outQty(i), 0)
  const overdue = d.outstanding.filter((i) => d.isOverdue(i, now)).length

  const header = `*General Store — items not returned*\n_${d.event.name} · ${stamp.format(now)}_`
  const copy = async (text: string, what: string) => {
    try { await copyText(text); toast.ok(`${what} copied — paste into WhatsApp`) } catch (e) { toast.err(e) }
  }

  return (
    <main className="page page-narrow">
      <div className="between">
        <h1>Out <span className="muted" style={{ fontWeight: 600 }}>· {total}</span></h1>
        {groups.length > 0 && (
          <button className="btn btn-sm" onClick={() => copy([header, ...groups.map((g) => leadText(g, d))].join('\n\n') + '\n\nPlease return these to the General Store desk. Thank you!', 'Everything')}>
            <Copy /> Copy all
          </button>
        )}
      </div>

      <input className="input" placeholder="Search anyone — name, SID, item, WT no. or lead" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      <div className="between" style={{ flexWrap: 'wrap' }}>
        <div className="seg" role="group" aria-label="Show">
          <button aria-pressed={view === 'lead'} onClick={() => setView('lead')}>By zone lead</button>
          <button aria-pressed={view === 'person'} onClick={() => setView('person')}>By person</button>
        </div>
        <label className="check"><input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} /> Overdue{overdue > 0 && ` (${overdue})`}</label>
      </div>
      {view === 'lead' && groups.length > 1 && <div className="row" style={{ justifyContent: 'flex-end', marginTop: -8 }}><FoldAll keys={groups.map((g) => g.key)} folds={folds} /></div>}

      {groups.length === 0 && <p className="subtle center" style={{ padding: 32 }}>{d.outstanding.length ? 'Nothing matches.' : 'Everything is back.'}</p>}

      {view === 'person' && issues.length > 0 && (
        <section className="card">
          {byPerson(issues)
            .sort(([a], [b]) => (d.volById.get(a)?.full_name ?? '').localeCompare(d.volById.get(b)?.full_name ?? ''))
            .map(([vid, list]) => (
              <div key={vid} className="member">
                <a href={`#/?p=${vid}`} className="member-name">
                  {d.volById.get(vid)?.full_name ?? 'Unknown'} <span className="subtle" style={{ fontWeight: 500 }}>· {d.zoneLeadForIssue(list[0]).lead?.name ?? 'no zone lead'}</span>
                </a>
                <ul className="list">{list.map((i) => <li key={i.id}><IssueRow issue={i} now={now} /></li>)}</ul>
              </div>
            ))}
        </section>
      )}

      {view === 'lead' && groups.map((g) => (
        <FoldCard key={g.key} open={folds.isOpen(g.key)} onToggle={() => folds.toggle(g.key)}
          title={<h3>{g.lead}</h3>} count={g.issues.reduce((n, i) => n + d.outQty(i), 0)}
          actions={<button className="icon-btn" onClick={() => copy(`${header}\n\n${leadText(g, d)}`, g.lead)} aria-label={`Copy ${g.lead}’s list for WhatsApp`}><Copy /></button>}>
          {byPerson(g.issues).map(([vid, list]) => (
            <div key={vid} className="member">
              <a href={`#/?p=${vid}`} className="member-name">{d.volById.get(vid)?.full_name ?? 'Unknown'}</a>
              <ul className="list">{list.map((i) => <li key={i.id}><IssueRow issue={i} now={now} /></li>)}</ul>
            </div>
          ))}
        </FoldCard>
      ))}
    </main>
  )
}
