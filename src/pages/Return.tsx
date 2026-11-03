import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronDown, CornerDownLeft, PartyPopper, Radio, ShieldUser, UserRound, X } from 'lucide-react'
import type { Issue, ZoneLead } from '../types'
import { useStore } from '../lib/store'
import { useNow } from '../lib/time'
import { PersonSearch } from '../components/PersonSearch'
import { PersonCard } from '../components/PersonCard'
import { IssueRow } from '../components/IssueRow'
import { Avatar, Empty, useAction } from '../components/ui'

/** Returns every outstanding unit in `issues`, one issue at a time. */
function useReturnAll() {
  const { d, act } = useStore()
  const { busy, run } = useAction()
  const returnAll = (issues: Issue[], label: string) =>
    run(async () => { for (const i of issues) await act.returnIssue(i, d.outQty(i)) }, label)
  return { busy, returnAll }
}

export function ReturnPage() {
  const { d } = useStore()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const [wt, setWt] = useState('')
  const person = d.volById.get(params.get('p') ?? '')
  const lead = d.zoneById.get(params.get('lead') ?? '')
  const clear = () => setParams({})

  if (lead) return <LeadView lead={lead} now={now} onClear={clear} />
  if (person) return <PersonView personId={person.id} now={now} onClear={clear} onOpenLead={(z) => setParams({ lead: z.id })} />

  const outBadge = (vId: string) => {
    const n = d.outstanding.filter((i) => i.volunteer_id === vId).reduce((s, i) => s + d.outQty(i), 0)
    return n > 0 ? <span className="badge badge-warn">{n} out</span> : null
  }
  const wtMatches = wt.trim()
    ? d.outstanding.filter((i) => i.unit_wt_no && i.unit_wt_no.replace(/^0+(?=\d)/, '').toLowerCase() === wt.trim().replace(/^0+(?=\d)/, '').toLowerCase())
    : []

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Return items</h1>
          <p className="muted">Search the person handing kit back — or a zone lead to return their whole team’s items.</p>
        </div>
      </div>
      <PersonSearch
        placeholder="Name, Satsang ID or zone lead"
        onSelect={(v) => setParams({ p: v.id })}
        onSelectLead={(z) => setParams({ lead: z.id })}
        badge={(v) => outBadge(v.id)}
        allowAdd={false}
      />

      <div className="search-box">
        <Radio aria-hidden />
        <input className="search-input compact" inputMode="numeric" placeholder="…or type a walkie WT number" value={wt} onChange={(e) => setWt(e.target.value)} aria-label="Walkie WT number" />
      </div>
      {wt.trim() && (
        <section className="card">
          {wtMatches.length === 0
            ? <p className="subtle card-pad">No walkie with WT {wt.trim()} is out.</p>
            : <ul className="list">{wtMatches.map((i) => <li key={i.id}><IssueRow issue={i} now={now} showPerson /></li>)}</ul>}
        </section>
      )}

      <section className="card">
        <div className="card-head"><span className="section-title">Everything still out · {d.outstanding.length}</span></div>
        {d.outstanding.length === 0
          ? <Empty icon={PartyPopper} title="All returned">No returnable items are out right now.</Empty>
          : <ul className="list">{[...d.outstanding].reverse().map((i) => <li key={i.id}><IssueRow issue={i} now={now} showPerson /></li>)}</ul>}
      </section>
    </main>
  )
}

function PersonView({ personId, now, onClear, onOpenLead }: { personId: string; now: number; onClear: () => void; onOpenLead: (z: ZoneLead) => void }) {
  const { d } = useStore()
  const { busy, returnAll } = useReturnAll()
  const person = d.volById.get(personId)!
  const mine = d.outstanding.filter((i) => i.volunteer_id === personId)
  const first = person.full_name.split(' ')[0]
  const asLead = d.leadByVol.get(personId)
  const team = asLead ? d.leadItems(asLead).team : []
  const teamUnits = team.reduce((n, i) => n + d.outQty(i), 0)
  return (
    <main className="page">
      <PersonCard v={person} onClear={onClear} />
      {asLead && (
        <div className="banner banner-info">
          <ShieldUser />
          <div className="grow stack" style={{ gap: 8 }}>
            <span><strong>{first} is zone lead {asLead.name}.</strong> {teamUnits ? `Their team has ${teamUnits} item${teamUnits === 1 ? '' : 's'} out.` : 'Nothing is out for their team.'}</span>
            <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => onOpenLead(asLead)}>Show own + team items</button>
          </div>
        </div>
      )}
      <section className="card">
        <div className="card-head">
          <span className="section-title">Still out with {first}</span>
          {mine.length > 1 && (
            <button className="btn btn-ok btn-sm" disabled={busy} onClick={() => returnAll(mine, `Everything returned for ${first}`)}>
              <CornerDownLeft /> Return all
            </button>
          )}
        </div>
        {mine.length === 0
          ? <Empty icon={PartyPopper} title="Nothing outstanding">{first} has returned everything.</Empty>
          : <ul className="list">{mine.map((i) => <li key={i.id}><IssueRow issue={i} now={now} /></li>)}</ul>}
      </section>
      <button className="btn btn-lg btn-block" onClick={onClear}>Done — next person</button>
    </main>
  )
}

/** Tappable section header with a chevron; children show only when open. */
function Fold({ open, onToggle, title, count, actions }: { open: boolean; onToggle: () => void; title: React.ReactNode; count?: number; actions?: React.ReactNode }) {
  return (
    <div className="fold-head">
      <button className="fold-toggle" onClick={onToggle} aria-expanded={open}>
        <ChevronDown className="fold-chevron" style={{ rotate: open ? '0deg' : '-90deg' }} aria-hidden />
        <span className="grow" style={{ minWidth: 0 }}>{title}</span>
        {count !== undefined && <span className="badge">{count}</span>}
      </button>
      {actions}
    </div>
  )
}

/** A zone lead: their own items, then their team members' items. Every list collapses. */
function LeadView({ lead, now, onClear }: { lead: ZoneLead; now: number; onClear: () => void }) {
  const { d } = useStore()
  const { busy, returnAll } = useReturnAll()
  const [confirmTeam, setConfirmTeam] = useState(false)
  const [ownOpen, setOwnOpen] = useState(true)
  const [teamOpen, setTeamOpen] = useState(true)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const { own, team } = d.leadItems(lead)
  const units = (xs: Issue[]) => xs.reduce((n, i) => n + d.outQty(i), 0)
  const byPerson = new Map<string, Issue[]>()
  for (const i of team) {
    if (!byPerson.has(i.volunteer_id)) byPerson.set(i.volunteer_id, [])
    byPerson.get(i.volunteer_id)!.push(i)
  }
  const toggleMember = (vid: string) => setClosed((c) => { const n = new Set(c); if (n.has(vid)) n.delete(vid); else n.add(vid); return n })
  const allClosed = byPerson.size > 0 && [...byPerson.keys()].every((k) => closed.has(k))

  return (
    <main className="page">
      <div className="between">
        <div>
          <h1>{lead.name}</h1>
          {lead.phone && <p className="muted"><a href={`tel:${lead.phone.replace(/\s/g, '')}`}>{lead.phone}</a></p>}
        </div>
        <button className="icon-btn" onClick={onClear} aria-label="Choose someone else"><X /></button>
      </div>

      <section className="card">
        <Fold
          open={ownOpen} onToggle={() => setOwnOpen(!ownOpen)} title={<h2>Items out</h2>} count={units(own)}
          actions={own.length > 1 && (
            <button className="btn btn-ok btn-sm" disabled={busy} onClick={() => returnAll(own, `${lead.name}’s items returned`)}><CornerDownLeft /> Return all</button>
          )}
        />
        {ownOpen && (own.length === 0
          ? <p className="subtle" style={{ padding: '0 16px 16px' }}>{lead.volunteer_id ? 'Nothing out.' : 'Not linked to their own directory entry — link them in Setup → Zone leads to see their own items.'}</p>
          : <ul className="list fold-body">{own.map((i) => <li key={i.id}><IssueRow issue={i} now={now} hideLead /></li>)}</ul>)}
      </section>

      <section className="card">
        <Fold
          open={teamOpen} onToggle={() => setTeamOpen(!teamOpen)} title={<h2>Team members</h2>} count={byPerson.size}
          actions={team.length > 0 && !confirmTeam && (
            <button className="btn btn-ok btn-sm" onClick={() => setConfirmTeam(true)}><CornerDownLeft /> Return all</button>
          )}
        />
        {confirmTeam && (
          <div className="banner banner-warn" style={{ margin: '0 16px 12px' }}>
            <div className="grow stack">
              <span>Mark all {units(team)} team items as returned? Only once you’ve got them all back.</span>
              <div className="row">
                <button className="btn btn-sm" onClick={() => setConfirmTeam(false)}>Cancel</button>
                <button className="btn btn-sm btn-ok" disabled={busy} onClick={async () => { await returnAll(team, `All team items returned for ${lead.name}`); setConfirmTeam(false) }}>Yes, return {units(team)}</button>
              </div>
            </div>
          </div>
        )}
        {teamOpen && (byPerson.size === 0 ? <p className="subtle" style={{ padding: '0 16px 16px' }}>No team items out.</p> : (
          <div className="fold-body">
            {byPerson.size > 1 && (
              <button className="btn btn-ghost btn-sm" style={{ margin: '0 8px 4px' }} onClick={() => setClosed(allClosed ? new Set() : new Set(byPerson.keys()))}>
                {allClosed ? 'Expand all' : 'Collapse all'}
              </button>
            )}
            {[...byPerson.entries()].map(([vid, issues]) => {
              const v = d.volById.get(vid)
              const open = !closed.has(vid)
              return (
                <div key={vid} className="member">
                  <div className="fold-head">
                    <button className="fold-toggle" onClick={() => toggleMember(vid)} aria-expanded={open}>
                      <ChevronDown className="fold-chevron" style={{ rotate: open ? '0deg' : '-90deg' }} aria-hidden />
                      <Avatar name={v?.full_name ?? '?'} />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 750, display: 'block' }}>{v?.full_name ?? 'Unknown person'}</span>
                        <span className="subtle">{[v?.satsang_id && `SID ${v.satsang_id}`, v?.department].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="badge badge-warn">{units(issues)} out</span>
                    </button>
                    {issues.length > 1 && open && (
                      <button className="btn btn-sm" disabled={busy} onClick={() => returnAll(issues, `All returned for ${v?.full_name.split(' ')[0] ?? 'person'}`)}><CornerDownLeft /> Return all</button>
                    )}
                    <Link to={`/people/${vid}`} className="icon-btn" aria-label={`Open ${v?.full_name ?? 'person'}’s profile`}><UserRound /></Link>
                  </div>
                  {open && <ul className="list">{issues.map((i) => <li key={i.id}><IssueRow issue={i} now={now} hideLead /></li>)}</ul>}
                </div>
              )
            })}
          </div>
        ))}
      </section>

      <button className="btn btn-lg btn-block" onClick={onClear}>Done</button>
    </main>
  )
}
