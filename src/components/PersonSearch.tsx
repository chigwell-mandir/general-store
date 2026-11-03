import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import type { Volunteer, ZoneLead } from '../types'
import { useStore } from '../lib/store'
import { normalise } from '../lib/search'
import { AddPersonSheet } from './AddPersonSheet'

function Highlight({ text, q }: { text: string; q: string }) {
  const nq = normalise(q)
  if (!nq || /^\d+$/.test(nq)) return <>{text}</>
  const i = text.toLowerCase().indexOf(nq)
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + nq.length)}</mark>{text.slice(i + nq.length)}</>
}

/** Big search-as-you-type box over the volunteer directory (name fuzzy, Satsang ID exact). */
export function PersonSearch({ onSelect, onSelectLead, autoFocus = true, placeholder = 'Search name or Satsang ID', compact, allowAdd = true, badge }: {
  onSelect: (v: Volunteer) => void
  /** When given, zone leads also appear (above people) and can be picked. */
  onSelectLead?: (z: ZoneLead) => void
  autoFocus?: boolean
  placeholder?: string
  compact?: boolean
  allowAdd?: boolean
  badge?: (v: Volunteer) => React.ReactNode
}) {
  const { d } = useStore()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [adding, setAdding] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const leads = useMemo(() => (onSelectLead ? d.searchLeads(q) : []), [d, q, onSelectLead])
  // A linked zone lead appears once (as the lead), not again as a person
  const results = useMemo(() => {
    const shown = new Set(leads.map((z) => z.volunteer_id).filter(Boolean))
    return d.searchPeople(q).filter((v) => !shown.has(v.id))
  }, [d, q, leads])
  const total = leads.length + results.length

  useEffect(() => setActive(0), [q])
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])

  const pick = (v: Volunteer) => {
    setQ('')
    onSelect(v)
  }
  const pickLead = (z: ZoneLead) => {
    setQ('')
    onSelectLead?.(z)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, total - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && active < leads.length) { e.preventDefault(); pickLead(leads[active]) }
    else if (e.key === 'Enter' && results[active - leads.length]) { e.preventDefault(); pick(results[active - leads.length]) }
    else if (e.key === 'Escape') setQ('')
  }

  return (
    <div>
      <div className="search-box">
        <Search aria-hidden />
        <input
          ref={input}
          className={`search-input ${compact ? 'compact' : ''}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={total > 0}
          aria-controls="person-results"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {q && (
          <button className="icon-btn search-clear" onClick={() => { setQ(''); input.current?.focus() }} aria-label="Clear search"><X /></button>
        )}
      </div>

      {q.trim() && (
        <div className="results" id="person-results" role="listbox">
          {leads.map((z, i) => {
            const { own, team } = d.leadItems(z)
            const n = [...own, ...team].reduce((s, x) => s + d.outQty(x), 0)
            return (
              <button key={z.id} role="option" aria-selected={i === active} className="result" onClick={() => pickLead(z)} onMouseEnter={() => setActive(i)}>
                <div className="grow">
                  <div className="result-name"><Highlight text={z.name} q={q} /></div>
                  <div className="result-meta">Their items and their team’s{n ? ` · ${n} out` : ''}</div>
                </div>
                <span className="tag">Zone lead</span>
              </button>
            )
          })}
          {results.map((v, j) => {
            const i = j + leads.length
            return (
            <button key={v.id} role="option" aria-selected={i === active} className="result" onClick={() => pick(v)} onMouseEnter={() => setActive(i)}>
              <div className="grow">
                <div className="result-name"><Highlight text={v.full_name} q={q} /></div>
                <div className="result-meta">
                  {v.satsang_id ? `SID ${v.satsang_id}` : 'No Satsang ID'}
                  {v.department && ` · ${v.department}`}
                </div>
              </div>
              {d.leadByVol.has(v.id) && <span className="tag">Zone lead</span>}
              {badge?.(v)}

            </button>
            )
          })}
          {total === 0 && (
            <div className="result" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="result-name">No one matches “{q.trim()}”</div>
                <div className="result-meta">Try first name only, or their Satsang ID.</div>
              </div>
            </div>
          )}
          {allowAdd && (
            <div className="result-foot">
              <span className="subtle grow">Not in the mastersheet?</span>
              <button className="btn btn-sm" onClick={() => setAdding(true)}><UserPlus /> Add person</button>
            </div>
          )}
        </div>
      )}

      {adding && (
        <AddPersonSheet
          initialName={/^\d+$/.test(q.trim()) ? '' : q.trim()}
          initialSid={/^\d+$/.test(q.trim()) ? q.trim() : ''}
          onClose={() => setAdding(false)}
          onAdded={(v) => { setAdding(false); pick(v) }}
        />
      )}
    </div>
  )
}
