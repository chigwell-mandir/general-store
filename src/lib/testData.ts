/* eslint-disable @typescript-eslint/no-explicit-any */
// Loads last year's workbook ("General Store - 2025.xlsx") as TEST data:
// people, zone leads (the "Zone-lead" department, departments shared out between them),
// karyakar check-ins from "Diwali In/Out", and the Hi-Vis / Walkies / Misc logs as issues
// dated yesterday at their logged times. The workbook is only read.
import { backend } from './backend'
import { cleanSid, parseVolunteers, readSheets } from './importers'
import { normalise } from './search'
import { starterCatalogue } from './seed'

const ACTOR = '2025 test data'
type Cell = string | number | null

export async function loadTestData(file: File, dryRun = false) {
  const sheets = await readSheets(file)
  const tab = (n: string) => (sheets.find((s) => s.name.trim().toLowerCase() === n.toLowerCase())?.rows ?? []) as Cell[][]
  if (!tab('Registrations').length) throw new Error('This doesn’t look like the 2025 workbook — no “Registrations” tab found.')
  const report: Record<string, unknown> = {}

  // Event day = yesterday, so logged clock times are all in the past
  const base = new Date(); base.setDate(base.getDate() - 1); base.setHours(0, 0, 0, 0)
  const at = (frac: number) => new Date(base.getTime() + frac * 86400000).toISOString()
  const isFrac = (c: Cell) => typeof c === 'number' && c > 0 && c < 1
  const filled = (c: Cell) => c !== null && c !== undefined && String(c).trim() !== ''

  // ── 1. People ──
  const vol = parseVolunteers(sheets)
  report.people = vol.people.length
  if (!dryRun) {
    const withId = vol.people.filter((p) => p.satsang_id).map((p) => ({ ...p, added_at_desk: false }))
    for (let i = 0; i < withId.length; i += 500) await backend.upsert('volunteers', withId.slice(i, i + 500), 'satsang_id')
    const noId = vol.people.filter((p) => !p.satsang_id).map((p) => ({ ...p, added_at_desk: false }))
    if (noId.length) await backend.insert('volunteers', noId)
  }
  const people = dryRun ? vol.people.map((p, i) => ({ ...p, id: `dry-${i}` })) : await backend.load<any>('volunteers')
  const bySid = new Map(people.filter((p: any) => p.satsang_id).map((p: any) => [p.satsang_id, p]))
  const byName = new Map<string, any[]>()
  for (const p of people) { const k = normalise(p.full_name); byName.set(k, [...(byName.get(k) ?? []), p]) }
  // Ambiguous names → prefer someone in the row's department; unknown names → added at desk (like a walk-in)
  const newPeople = new Map<string, any>()
  const titled = (n: string) => n.trim().toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase())
  const who = (sid: Cell, name: Cell, dept?: Cell) => {
    const s = cleanSid(sid as any)
    if (s && bySid.has(s)) return bySid.get(s)
    const key = normalise(String(name ?? '').replace(/\b(bhai|ben|sec)\b/gi, ''))
    if (!key) return null
    const exact = byName.get(key)
    const pool = exact ?? people.filter((p: any) => normalise(p.full_name).split(' ')[0] === key.split(' ')[0] && key.split(' ').length === 1)
    if (pool.length) return pool.find((p: any) => dept && normalise(p.department).includes(normalise(String(dept)))) ?? pool[0]
    if (!newPeople.has(key)) newPeople.set(key, { id: crypto.randomUUID(), full_name: titled(String(name)), satsang_id: null, department: dept ? String(dept) : null, added_at_desk: true })
    return newPeople.get(key)
  }

  // ── 2. Zone leads: the people whose department is Zone-lead ──
  const leadsPeople = people.filter((p: any) => /zone/i.test(p.department ?? ''))
  report.zoneLeads = leadsPeople.map((p: any) => p.full_name)
  const depts = new Map<string, number>()
  for (const p of people) if (p.department && !/zone/i.test(p.department)) depts.set(p.department, (depts.get(p.department) ?? 0) + 1)
  const deptList = [...depts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d)
  if (!dryRun && leadsPeople.length) {
    const leads = leadsPeople.map((p: any) => ({ id: crypto.randomUUID(), name: p.full_name, phone: p.phone, volunteer_id: p.id }))
    await backend.insert('zone_leads', leads)
    await backend.upsert('department_leads', deptList.map((d, i) => ({ department: d, zone_lead_id: leads[i % leads.length].id })), 'department')
  }

  // ── 3. Karyakar check-ins from "Diwali In / Diwali Out" ──
  const reg = tab('Registrations')
  const h = reg.findIndex((r) => r.some((c) => /satsang/i.test(String(c ?? ''))))
  const head = reg[h].map((c) => String(c ?? '').toLowerCase())
  const iSid = head.findIndex((c) => /satsang/.test(c)), iName = head.findIndex((c) => /full name/.test(c))
  const iIn = head.findIndex((c) => /diwali in/.test(c)), iOut = head.findIndex((c) => /diwali out/.test(c))
  const checkins: any[] = []
  const seen = new Set<string>()
  reg.slice(h + 1).forEach((r, k) => {
    if (!/^y/i.test(String(r[iIn] ?? '').trim())) return
    const p = who(r[iSid], r[iName])
    if (!p || seen.has(p.id)) return
    seen.add(p.id)
    const inAt = at((7 * 60 + (k % 150)) / 1440) // spread 07:00–09:30
    const out = /^y/i.test(String(r[iOut] ?? '').trim())
    checkins.push({ volunteer_id: p.id, checked_in_at: inAt, checked_in_by: ACTOR, checked_out_at: out ? at((21 * 60 + 30 + (k % 90)) / 1440) : null, checked_out_by: out ? ACTOR : null })
  })
  report.checkins = { total: checkins.length, stillIn: checkins.filter((c) => !c.checked_out_at).length }

  // ── 4. Issue logs (Diwali side of Hi-Vis, Walkies, Misc) ──
  if (!dryRun && (await backend.load<any>('items')).length === 0) await backend.insert('items', starterCatalogue())
  const items = await backend.load<any>('items')
  const item = (cat: string, name: string) => items.find((i: any) => i.category === cat && i.name === name)
  const issues: any[] = []
  const skipped: string[] = []
  let slot = 0
  const addIssue = (itemRow: any, p: any, qty: number, inC: Cell, outC: Cell, extra: Record<string, unknown> = {}) => {
    if (!itemRow) { skipped.push('unknown item'); return }
    const issuedFrac = isFrac(inC) ? (inC as number) : (9 * 60 + 3 * slot++) / 1440 // "Yes" with no time → morning
    const returned = filled(outC)
    let retFrac = isFrac(outC) ? (outC as number) : issuedFrac + 3 / 24
    if (retFrac <= issuedFrac) retFrac += 1 // returned next morning
    issues.push({
      id: crypto.randomUUID(), item_id: itemRow.id, volunteer_id: p.id, qty, returned_qty: returned ? qty : 0,
      issued_at: at(issuedFrac), issued_by: ACTOR, returned_at: returned ? at(retFrac) : null, returned_by: returned ? ACTOR : null,
      note: null, unit_box: null, unit_wt_no: null, unit_channel: null, unit_earpiece: null, zone_lead_id: null, kit_id: null, ...extra,
    })
  }

  for (const r of tab('Hi-Vis').slice(2)) {
    if (!filled(r[0])) continue
    const p = who(r[4], r[3]); if (!p) { skipped.push(`Hi-Vis: ${r[3] || r[4]}`); continue }
    const colour = String(r[0]).toLowerCase().startsWith('y') ? 'Yellow' : String(r[0]).trim()
    addIssue(item('Hi-Vis', colour), p, Number(r[2]) || 1, r[5], r[6])
  }
  for (const r of tab('Walkies').slice(2)) {
    if (!filled(r[1]) && !filled(r[3]) && !filled(r[4])) continue
    const p = who(r[4], r[3], r[2]); if (!p) { skipped.push(`Walkie: ${r[3] || r[4] || '(no name)'}`); continue }
    const label = String(r[1] ?? '').trim()
    const all = /all/i.test(label) || /all/i.test(String(r[2] ?? ''))
    const outC = typeof r[7] === 'number' && r[7] >= 1 ? 'yes' : r[7] // "9", "11" = returned, time unknown
    addIssue(item('Walkies', 'Walkie talkie'), p, 1, r[6], outC, {
      unit_channel: all ? 'All channel' : filled(r[9]) ? String(Math.round(Number(r[9]))) : null,
      unit_earpiece: /yes/i.test(String(r[8] ?? '')) ? true : null,
      note: !all && label ? label : (filled(r[8]) && !/yes/i.test(String(r[8])) ? String(r[8]) : null),
    })
  }
  const miscItem = (name: string) => /counter/i.test(name) ? item('Equipment', 'Counter / clicker') : /first aid/i.test(name) ? item('Equipment', 'First aid box') : /metal/i.test(name) ? item('Equipment', 'Metal detector') : null
  for (const r of tab('Misc').slice(2)) {
    if (!filled(r[0])) continue
    const p = who(r[3], r[2]); if (!p) { skipped.push(`Misc: ${r[0]} → ${r[2] || r[3] || '(no name)'}`); continue }
    addIssue(miscItem(String(r[0])), p, Number(r[1]) || 1, r[4], r[5])
  }
  report.issues = { total: issues.length, stillOut: issues.filter((i) => i.returned_qty < i.qty).length }
  report.skipped = skipped
  report.addedAtDesk = [...newPeople.values()].map((p) => p.full_name)

  // ── 5. Write issues, stock, check-ins, history ──
  if (!dryRun) {
    if (newPeople.size) await backend.insert('volunteers', [...newPeople.values()])
    if (issues.length) await backend.insert('issues', issues)
    for (const it of items.filter((i: any) => i.track_stock && i.returnable)) {
      const out = issues.filter((i) => i.item_id === it.id).reduce((n, i) => n + i.qty - i.returned_qty, 0)
      if (out) await backend.update('items', { id: it.id }, { in_store: Math.max(0, it.in_store - out) })
    }
    if (checkins.length) await backend.insert('checkins', checkins)
    const acts: any[] = []
    for (const i of issues) {
      acts.push({ at: i.issued_at, actor: ACTOR, action: 'issue', volunteer_id: i.volunteer_id, item_id: i.item_id, qty: i.qty, details: 'Test data from 2025 sheet' })
      if (i.returned_at) acts.push({ at: i.returned_at, actor: ACTOR, action: 'return', volunteer_id: i.volunteer_id, item_id: i.item_id, qty: i.qty, details: null })
    }
    for (const c of checkins) {
      acts.push({ at: c.checked_in_at, actor: ACTOR, action: 'checkin', volunteer_id: c.volunteer_id, item_id: null, qty: null, details: 'Karyakar checked in' })
      if (c.checked_out_at) acts.push({ at: c.checked_out_at, actor: ACTOR, action: 'checkout', volunteer_id: c.volunteer_id, item_id: null, qty: null, details: 'Karyakar checked out' })
    }
    acts.push({ at: new Date().toISOString(), actor: ACTOR, action: 'import', volunteer_id: null, item_id: null, qty: null, details: `Test data loaded from the 2025 workbook: ${vol.people.length} people, ${issues.length} issues, ${checkins.length} check-ins` })
    for (let i = 0; i < acts.length; i += 500) await backend.insert('activity', acts.slice(i, i + 500))
  }
  return report
}
