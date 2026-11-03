import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, FlaskConical, Info, Database, Download, FileSpreadsheet, Pencil, Plus, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import type { ZoneLead } from '../types'
import { useStore } from '../lib/store'
import { normalise } from '../lib/search'
import { backend } from '../lib/backend'
import { resetDemo } from '../lib/backend/demo'
import { downloadStockTemplate, parseStock, parseVolunteers, readSheets, type StockRow, type VolunteerImport } from '../lib/importers'
import { Sheet, useAction, useToast } from '../components/ui'
import { PersonSearch } from '../components/PersonSearch'
import { ExportButton } from './Export'
import { Link } from 'react-router'

export function SetupPage() {
  const { mode } = useStore()
  return (
    <main className="page">
      <div className="page-head"><div><h1>Setup & import</h1><p className="muted">Event settings, zone leads, mastersheet and stock imports, backups.</p></div></div>
      <EventSettingsCard />
      <ZoneLeadsCard />
      <VolunteerImportCard />
      <StockImportCard />
      <BackupCard />
      <TestDataCard />
      <StartFreshCard />
      {mode === 'demo' && <DemoCard />}
    </main>
  )
}

function EventSettingsCard() {
  const { d, act } = useStore()
  const { busy, run } = useAction()
  const [name, setName] = useState(d.event.name)
  const [time, setTime] = useState(d.event.overdue_time)
  const dirty = name !== d.event.name || time !== d.event.overdue_time
  return (
    <section className="card card-pad stack">
      <h2>Event</h2>
      <div className="grid-2">
        <label className="field"><span className="label">Event name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span className="label">Items overdue after</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /><span className="hint">Returnables still out after this time show red. Change if the store closes earlier or later.</span></label>
      </div>
      <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !dirty || !name.trim()} onClick={() => run(() => act.saveEvent({ name: name.trim(), overdue_time: time }), 'Event settings saved')}>Save</button>
    </section>
  )
}

function ZoneLeadsCard() {
  const { data, d, act } = useStore()
  const { busy, run } = useAction()
  const [editing, setEditing] = useState<ZoneLead | 'new' | null>(null)
  const [showDepts, setShowDepts] = useState(false)
  const deptCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of data.volunteers) if (v.department) m.set(v.department.trim(), (m.get(v.department.trim()) ?? 0) + 1)
    return m
  }, [data.volunteers])
  const mapped = new Map(data.department_leads.map((x) => [normalise(x.department), x]))
  const unmapped = d.departments.filter((dep) => !mapped.has(normalise(dep))).length

  return (
    <section className="card card-pad stack-lg">
      <div className="between">
        <div><h2>Zone leads</h2><p className="subtle">Unreturned items escalate to the zone lead for the person’s department. You can override per person (profile) or per item.</p></div>
        <button className="btn" onClick={() => setEditing('new')}><Plus /> Add zone lead</button>
      </div>
      {data.zone_leads.length === 0 ? <p className="subtle">No zone leads yet.</p> : (
        <ul className="list">
          {data.zone_leads.map((z) => (
            <li key={z.id} className="between" style={{ padding: '10px 0' }}>
              <div><strong>{z.name}</strong><div className="subtle">{[z.phone ?? 'No phone', `${data.department_leads.filter((x) => x.zone_lead_id === z.id).length} departments`, z.volunteer_id && d.volById.get(z.volunteer_id) ? `is ${d.volById.get(z.volunteer_id)!.full_name}` : 'not linked to a person'].join(' · ')}</div></div>
              <div className="row">
                <button className="icon-btn" onClick={() => setEditing(z)} aria-label={`Edit ${z.name}`}><Pencil /></button>
                <button className="icon-btn" disabled={busy} onClick={() => confirm(`Remove ${z.name}? Their departments will become unassigned.`) && run(() => act.removeZoneLead(z), 'Zone lead removed')} aria-label={`Remove ${z.name}`}><Trash2 /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {d.departments.length > 0 && data.zone_leads.length > 0 && (
        <div className="stack">
          <button className="fold-toggle" style={{ marginLeft: -8 }} onClick={() => setShowDepts(!showDepts)} aria-expanded={showDepts}>
            <ChevronDown className="fold-chevron" style={{ rotate: showDepts ? '0deg' : '-90deg' }} aria-hidden />
            <span className="section-title grow">Department → zone lead ({d.departments.length})</span>
            {unmapped > 0 && <span className="badge badge-warn">{unmapped} unassigned</span>}
          </button>
          {showDepts && <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Department</th><th className="r">People</th><th>Zone lead</th></tr></thead>
              <tbody>
                {d.departments.map((dep) => (
                  <tr key={dep}>
                    <td style={{ fontWeight: 600 }}>{dep}</td>
                    <td className="r num">{deptCounts.get(dep) ?? 0}</td>
                    <td style={{ minWidth: 180 }}>
                      <select className="select" style={{ minHeight: 40 }} value={mapped.get(normalise(dep))?.zone_lead_id ?? ''} onChange={(e) => run(() => act.setDeptLead(mapped.get(normalise(dep))?.department ?? dep, e.target.value || null))} aria-label={`Zone lead for ${dep}`}>
                        <option value="">— Not assigned —</option>
                        {data.zone_leads.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </div>
      )}
      {editing && <ZoneLeadSheet lead={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

function ZoneLeadSheet({ lead, onClose }: { lead: ZoneLead | null; onClose: () => void }) {
  const { act, d } = useStore()
  const { busy, run } = useAction()
  const [name, setName] = useState(lead?.name ?? '')
  const [phone, setPhone] = useState(lead?.phone ?? '')
  const [personId, setPersonId] = useState<string | null>(lead?.volunteer_id ?? null)
  const person = personId ? d.volById.get(personId) : undefined
  const takenBy = personId ? d.leadByVol.get(personId) : undefined
  const save = async () => {
    const ok = await run(async () => { await act.saveZoneLead({ id: lead?.id, name: name.trim(), phone: phone.trim() || null, volunteer_id: personId }); return true }, 'Zone lead saved')
    if (ok) onClose()
  }
  return (
    <Sheet title={lead ? 'Edit zone lead' : 'Add zone lead'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !name.trim() || (!!takenBy && takenBy.id !== lead?.id)} onClick={save}>Save</button></>}>
      <div className="stack">
        <label className="field"><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rakeshbhai (Zone A)" /></label>
        <label className="field"><span className="label">Phone (optional)</span><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></label>
        <div className="field">
          <span className="label">Their own entry in the directory (optional)</span>
          <span className="hint">Link this so the lead’s own items show alongside their team’s when returning.</span>
          {person ? (
            <div className="between card card-pad" style={{ boxShadow: 'none' }}>
              <div><strong>{person.full_name}</strong><div className="subtle">{[person.satsang_id && `SID ${person.satsang_id}`, person.department].filter(Boolean).join(' · ')}</div></div>
              <button className="btn btn-sm" onClick={() => setPersonId(null)}>Unlink</button>
            </div>
          ) : (
            <PersonSearch compact autoFocus={false} allowAdd={false} placeholder="Find the lead in the directory" onSelect={(v) => {
              setPersonId(v.id)
              if (!name.trim()) setName(v.full_name)
              if (!phone.trim() && v.phone) setPhone(v.phone)
            }} />
          )}
          {takenBy && takenBy.id !== lead?.id && <span className="hint" style={{ color: 'var(--danger)' }}>Already linked to zone lead {takenBy.name}</span>}
        </div>
      </div>
    </Sheet>
  )
}

function FilePick({ label, onFile }: { label: string; onFile: (f: File) => void }) {
  return (
    <label className="btn" style={{ alignSelf: 'flex-start' }}>
      <Upload /> {label}
      <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </label>
  )
}

function VolunteerImportCard() {
  const { data, act } = useStore()
  const toast = useToast()
  const { busy, run } = useAction()
  const [preview, setPreview] = useState<(VolunteerImport & { file: string }) | null>(null)

  const load = async (f: File) => {
    try { setPreview({ ...parseVolunteers(await readSheets(f)), file: f.name }) } catch (e) { toast.err(e) }
  }
  const existing = new Set(data.volunteers.map((v) => v.satsang_id).filter(Boolean))
  const updates = preview?.people.filter((p) => p.satsang_id && existing.has(p.satsang_id)).length ?? 0

  return (
    <section className="card card-pad stack">
      <h2 className="row"><FileSpreadsheet size={20} /> Volunteer mastersheet</h2>
      <p className="subtle">Upload the Registrations export (.xlsx or .csv). People are matched on Satsang ID, so re-importing updates details without duplicating anyone. The file itself is never changed.</p>
      <FilePick label="Choose mastersheet file" onFile={load} />
      {preview && (
        <div className="stack card card-pad" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
          <div><strong>{preview.file}</strong> · sheet “{preview.sheet}”</div>
          <div className="row-wrap">
            <span className="badge badge-brand">{preview.people.length} people</span>
            <span className="badge">{preview.people.length - updates} new</span>
            <span className="badge">{updates} updated</span>
            {preview.skipped > 0 && <span className="badge badge-warn">{preview.skipped} skipped</span>}
          </div>
          <div className="subtle">Columns found: {preview.columns.join(', ')}. Phone numbers get their leading 0 back; mandal and department spellings are tidied.</div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>SID</th><th>Mandal</th><th>Phone</th><th>Department</th></tr></thead>
              <tbody>{preview.people.slice(0, 5).map((p, i) => <tr key={i}><td>{p.full_name}</td><td className="num">{p.satsang_id ?? '—'}</td><td>{p.mandal ?? ''}</td><td className="num">{p.phone ?? ''}</td><td>{p.department ?? ''}</td></tr>)}</tbody>
            </table>
          </div>
          {preview.warnings.length > 0 && (
            <details>
              <summary className="subtle" style={{ cursor: 'pointer' }}><AlertTriangle size={14} style={{ verticalAlign: -2 }} /> {preview.warnings.length} things to check</summary>
              <ul className="subtle">{preview.warnings.slice(0, 50).map((w, i) => <li key={i}>{w}</li>)}</ul>
            </details>
          )}
          <div className="row">
            <button className="btn" onClick={() => setPreview(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={async () => { await run(() => act.importVolunteers(preview.people), `${preview.people.length} volunteers imported`); setPreview(null) }}>Import {preview.people.length} people</button>
          </div>
        </div>
      )}
    </section>
  )
}

function StockImportCard() {
  const { data, act } = useStore()
  const toast = useToast()
  const { busy, run } = useAction()
  const [preview, setPreview] = useState<{ file: string; sheet: string; rows: StockRow[]; warnings: string[] } | null>(null)

  const load = async (f: File) => {
    try { setPreview({ ...parseStock(await readSheets(f), data.items), file: f.name }) } catch (e) { toast.err(e) }
  }
  const apply = () => run(async () => {
    for (const r of preview!.rows) {
      if (!r.existing) {
        await act.saveItem({ category: r.category, name: r.name, returnable: r.returnable ?? true, low_threshold: r.low ?? 0 })
      } else if (r.low !== null || r.returnable !== null) {
        await act.saveItem({ id: r.existing.id, category: r.existing.category, name: r.existing.name, ...(r.low !== null && { low_threshold: r.low }), ...(r.returnable !== null && { returnable: r.returnable }) })
      }
    }
    // Re-read items so newly created ones have ids, then apply counts
    const items = await backend.load<(typeof data.items)[number]>('items')
    for (const r of preview!.rows) {
      if (r.count === null) continue
      const it = items.find((i) => normalise(i.category) === normalise(r.category) && normalise(i.name) === normalise(r.name))
      if (it && (!it.track_stock || it.in_store !== r.count)) await act.setStock(it, r.count, 'imported stock count')
    }
    setPreview(null)
  }, 'Stock imported')

  return (
    <section className="card card-pad stack">
      <h2 className="row"><Database size={20} /> Stock list & counts</h2>
      <p className="subtle">Counts can be entered on the Dashboard (“Count stock”), or here from a spreadsheet. Download the template — it lists the current catalogue — fill in Quantity, then upload it. New rows become new items.</p>
      <div className="row-wrap">
        <button className="btn" onClick={() => downloadStockTemplate(data.items)}><Download /> Download template</button>
        <FilePick label="Upload stock sheet" onFile={load} />
        <button className="btn btn-ghost" disabled={busy} onClick={() => run(async () => { const n = await act.addStarterCatalogue(); toast.ok(n ? `${n} starter items added` : 'Starter catalogue already present') })}><Sparkles /> Add starter catalogue</button>
      </div>
      {preview && (
        <div className="stack card card-pad" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
          <div><strong>{preview.file}</strong> · sheet “{preview.sheet}”</div>
          <div className="row-wrap">
            <span className="badge badge-brand">{preview.rows.length} rows</span>
            <span className="badge">{preview.rows.filter((r) => !r.existing).length} new items</span>
            <span className="badge">{preview.rows.filter((r) => r.count !== null).length} counts</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th className="r">Now</th><th className="r">New count</th></tr></thead>
              <tbody>{preview.rows.slice(0, 60).map((r, i) => (
                <tr key={i}><td>{r.category} · {r.name} {!r.existing && <span className="badge badge-info">new</span>}</td><td className="r num">{r.existing?.track_stock ? r.existing.in_store : '—'}</td><td className="r num">{r.count ?? '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {preview.warnings.length > 0 && <ul className="subtle">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          <div className="row">
            <button className="btn" onClick={() => setPreview(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={apply}>Apply</button>
          </div>
        </div>
      )}
    </section>
  )
}

function BackupCard() {
  return (
    <section className="card card-pad stack">
      <h2 className="row"><Download size={20} /> Backup & export</h2>
      <p className="subtle">Download a full backup at the end of each day, or export just the issue log, karyakar check-ins or item list.</p>
      <div className="row-wrap">
        <ExportButton kind="everything" label="Download full backup" />
        <Link to="/export" className="btn btn-ghost">More export options</Link>
      </div>
    </section>
  )
}

function TestDataCard() {
  const { data, act } = useStore()
  const { busy, run } = useAction()
  const [file, setFile] = useState<File | null>(null)
  const hasData = data.volunteers.length > 0 || data.issues.length > 0
  return (
    <section className="card card-pad stack">
      <h2 className="row"><FlaskConical size={20} /> Test data (2025)</h2>
      <p className="subtle">
        Fills the app with last year’s workbook so you can try everything or demo it: about 460 people, the 7 “Zone-lead” people as zone leads
        (departments shared out between them for testing), karyakar check-ins from “Diwali In/Out”, and the Hi-Vis, Walkies and Misc logs as
        issues dated yesterday. Use <strong>Start fresh</strong> below to clear it again before adding your 2026 data.
      </p>
      {hasData ? (
        <div className="banner banner-info"><Info /><span>The app already has data ({data.volunteers.length} people, {data.issues.length} issues). Start fresh first, then load test data.</span></div>
      ) : !file ? (
        <FilePick label="Choose General Store - 2025.xlsx" onFile={setFile} />
      ) : (
        <div className="row-wrap">
          <span className="badge badge-brand">{file.name}</span>
          <button className="btn" onClick={() => setFile(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={async () => {
            await run(async () => { const r = await act.loadTestData(file); return r }, 'Test data loaded')
            setFile(null)
          }}>Load test data</button>
        </div>
      )}
    </section>
  )
}

function StartFreshCard() {
  const { data, act } = useStore()
  const { busy, run } = useAction()
  const [keepCatalogue, setKeepCatalogue] = useState(true)
  const [keepCounts, setKeepCounts] = useState(false)
  const [typed, setTyped] = useState('')
  const counts = `${data.volunteers.length} people, ${data.issues.length} issues, ${data.checkins.length} check-ins, ${data.kit_requirements.length} kit entries, ${data.zone_leads.length} zone leads`
  return (
    <section className="card card-pad stack" style={{ borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--line))' }}>
      <h2 className="row" style={{ color: 'var(--danger)' }}><AlertTriangle size={20} /> Start fresh</h2>
      <p className="subtle">
        Use this to get a <strong>blank app</strong> to set up by hand, to clear test data, or before importing your 2026 data.
        Untick “Keep the item catalogue” for a completely empty app.
      </p>
      <p className="subtle">
        Permanently deletes everything for this event — {counts} and the whole history — ready to import the official
        mastersheet. Every device sees the empty app straight away. <strong>This can’t be undone</strong>, so download a backup first.
      </p>
      <ExportButton kind="everything" label="1. Download full backup" />
      <label className="check"><input type="checkbox" checked={keepCatalogue} onChange={(e) => setKeepCatalogue(e.target.checked)} /> Keep the item catalogue (item names and categories)</label>
      {keepCatalogue && <label className="check" style={{ marginLeft: 32 }}><input type="checkbox" checked={keepCounts} onChange={(e) => setKeepCounts(e.target.checked)} /> Keep the current stock counts too</label>}
      <label className="field">
        <span className="label">2. Type WIPE to confirm</span>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" style={{ maxWidth: 220 }} />
      </label>
      <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} disabled={busy || typed.trim().toUpperCase() !== 'WIPE'}
        onClick={async () => { await run(() => act.wipe({ keepCatalogue, keepCounts: keepCatalogue && keepCounts }), 'Everything wiped — ready for fresh data'); setTyped('') }}>
        <Trash2 /> 3. Wipe all data
      </button>
    </section>
  )
}

function DemoCard() {
  return (
    <section className="card card-pad stack">
      <h2>Demo mode</h2>
      <p className="subtle">This copy isn’t connected to the database yet — everything is stored in this browser only. Other tabs on this device stay in sync, so you can try two “desks” side by side.</p>
      <button className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => { if (confirm('Reset all demo data back to the sample data?')) { resetDemo(); location.reload() } }}><RotateCcw /> Reset demo data</button>
    </section>
  )
}
