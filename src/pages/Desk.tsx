import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Plus, X } from 'lucide-react'
import type { Issue, Item, KitRequirement, Volunteer, ZoneLead } from '../types'
import { useStore } from '../lib/store'
import { itemLabel } from '../lib/search'
import { useNow } from '../lib/time'
import { PersonSearch } from '../components/PersonSearch'
import { PersonCard } from '../components/PersonCard'
import { IssueRow } from '../components/IssueRow'
import { IssueSheet } from '../components/IssueSheet'
import { FoldCard, useAction } from '../components/ui'

/**
 * The one screen for items: search a person (or zone lead), see what they have,
 * return it, give more. Selection lives in the URL so Back works.
 */
export function DeskPage() {
  const { d } = useStore()
  const [params, setParams] = useSearchParams()
  const person = d.volById.get(params.get('p') ?? '')
  const lead = d.zoneById.get(params.get('lead') ?? '')
  const clear = () => setParams({})
  const openLead = (z: ZoneLead) => setParams(z.volunteer_id ? { p: z.volunteer_id } : { lead: z.id })

  if (person) return <PersonDesk person={person} onClear={clear} />
  if (lead) return <UnlinkedLead lead={lead} onClear={clear} />

  return (
    <main className="page page-narrow">
      <h1>Desk</h1>
      <PersonSearch placeholder="Name, Satsang ID or zone lead" onSelect={(v) => setParams({ p: v.id })} onSelectLead={openLead} />
      <p className="subtle center">Search the person (or zone lead) in front of you to give or take back items.</p>
    </main>
  )
}

function useReturnAll() {
  const { d, act } = useStore()
  const { busy, run } = useAction()
  return { busy, returnAll: (issues: Issue[], label: string) => run(async () => { for (const i of issues) await act.returnIssue(i, d.outQty(i)) }, label) }
}

function PersonDesk({ person, onClear }: { person: Volunteer; onClear: () => void }) {
  const { d } = useStore()
  const now = useNow()
  const { busy, returnAll } = useReturnAll()
  const [giving, setGiving] = useState<{ item?: Item; kit?: KitRequirement } | null>(null)
  const asLead = d.leadByVol.get(person.id)
  const first = person.full_name.split(' ')[0]

  const has = d.outstanding.filter((i) => i.volunteer_id === person.id)
  const mine = d.issuesByVol.get(person.id) ?? []
  const needs = (d.kitByVol.get(person.id) ?? []).filter((k) => mine.filter((i) => i.item_id === k.item_id).reduce((n, i) => n + i.qty, 0) < k.qty)

  return (
    <main className="page page-narrow">
      <PersonCard v={person} onClear={onClear} />

      <section className="stack-sm">
        <div className="between">
          <h2>Has now</h2>
          {has.length > 1 && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => returnAll(has, `All returned for ${first}`)}>Return all</button>}
        </div>
        {has.length === 0
          ? <p className="subtle">Nothing out.</p>
          : <ul className="list plain">{has.map((i) => <li key={i.id}><IssueRow issue={i} now={now} /></li>)}</ul>}
      </section>

      {needs.length > 0 && (
        <section className="stack-sm">
          <h2>Still needs</h2>
          <div className="row-wrap">
            {needs.map((k) => {
              const item = d.itemById.get(k.item_id)
              return item && (
                <button key={k.id} className="btn" onClick={() => setGiving({ item, kit: k })}>
                  <Plus /> {k.qty > 1 && `${k.qty} × `}{itemLabel(item)}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <button className="btn btn-primary btn-lg btn-block" onClick={() => setGiving({})}><Plus /> Give {asLead ? 'items' : 'an item'}</button>

      {asLead && <TeamSection lead={asLead} now={now} />}

      <button className="btn btn-block" onClick={onClear}>Done — next person</button>

      {giving && <IssueSheet person={person} item={giving.item} kit={giving.kit} forTeam={!!asLead} onClose={() => setGiving(null)} />}
    </main>
  )
}

/** Everything the zone lead's team members still have, folded by default. */
function TeamSection({ lead, now, open = false }: { lead: ZoneLead; now: number; open?: boolean }) {
  const { d } = useStore()
  const { busy, returnAll } = useReturnAll()
  const [confirm, setConfirm] = useState(false)
  const { team } = d.leadItems(lead)
  const byPerson = new Map<string, Issue[]>()
  for (const i of team) byPerson.set(i.volunteer_id, [...(byPerson.get(i.volunteer_id) ?? []), i])
  const units = team.reduce((n, i) => n + d.outQty(i), 0)

  return (
    <FoldCard defaultOpen={open} title={<h3>Team members</h3>} count={units ? `${units} out` : 'none out'}
      actions={units > 0 && !confirm && <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)}>Return all</button>}>
      {confirm && (
        <div className="banner banner-warn" style={{ margin: 12 }}>
          <div className="grow stack">
            <span>Mark all {units} team items as returned?</span>
            <div className="row">
              <button className="btn btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
              <button className="btn btn-sm btn-ok" disabled={busy} onClick={async () => { await returnAll(team, 'Team items returned'); setConfirm(false) }}>Yes, return {units}</button>
            </div>
          </div>
        </div>
      )}
      {byPerson.size === 0 && <p className="subtle card-pad">Nothing out for the team.</p>}
      {[...byPerson.entries()].map(([vid, issues]) => (
        <div key={vid} className="member">
          <Link to={`/?p=${vid}`} className="member-name">{d.volById.get(vid)?.full_name ?? 'Unknown'}</Link>
          <ul className="list">{issues.map((i) => <li key={i.id}><IssueRow issue={i} now={now} /></li>)}</ul>
        </div>
      ))}
    </FoldCard>
  )
}

/** A zone lead not yet linked to their own directory entry: team only. */
function UnlinkedLead({ lead, onClear }: { lead: ZoneLead; onClear: () => void }) {
  const now = useNow()
  return (
    <main className="page page-narrow">
      <div className="person-head">
        <div className="grow">
          <h1 className="person-name">{lead.name}</h1>
          <p className="subtle">Zone lead · to give items to them, link them to their own entry in More → Setup → Zone leads.</p>
        </div>
        <button className="icon-btn" onClick={onClear} aria-label="Choose someone else"><X /></button>
      </div>
      <TeamSection lead={lead} now={now} open />
    </main>
  )
}
