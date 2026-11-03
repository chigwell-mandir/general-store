// Demo backend: same behaviour as the Supabase functions, stored in this browser only.
// Other tabs on the same device stay in sync, which is handy for trying multi-desk use.
import type { Activity, Issue, IssueArgs, Item, Snapshot, TableName, Volunteer } from '../../types'
import { TABLES } from '../../types'
import { DEMO_PEOPLE, starterCatalogue } from '../seed'
import { InsufficientStockError, type Backend } from './types'

const KEY = 'general-store-demo-v4'
type Row = Record<string, unknown>
type Db = Snapshot & { _seq: number }

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const now = () => new Date().toISOString()
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()

function seed(): Db {
  const db: Db = {
    _seq: 0,
    events: [{ id: 1, name: 'Diwali 2026 (demo)', overdue_time: '21:00', escalation_mode: 'zone' }],
    zone_leads: [],
    department_leads: [],
    volunteers: [],
    items: starterCatalogue().map((i) => ({ ...i, id: uid() })),
    kit_requirements: [],
    issues: [],
    checkins: [],
    activity: [],
  }
  db.volunteers = DEMO_PEOPLE.map(([full_name, satsang_id, mandal, department, phone]) => ({
    id: uid(), full_name, satsang_id, mandal, department, phone,
    vcd: 'Yes', comments: null, added_at_desk: false, zone_lead_id: null, created_at: now(),
  }))
  const vid = (name: string) => db.volunteers.find((v) => v.full_name === name)!.id
  const zl1 = { id: uid(), name: 'Rakeshbhai (Zone A)', phone: '07700 900201', volunteer_id: vid('Rakesh Thakkar'), created_at: now() }
  const zl2 = { id: uid(), name: 'Bhaveshbhai (Zone B)', phone: '07700 900202', volunteer_id: vid('Bhavesh Mehta'), created_at: now() }
  db.zone_leads = [zl1, zl2]
  db.department_leads = [
    { department: 'Security', zone_lead_id: zl1.id },
    { department: 'Car Park/Security', zone_lead_id: zl1.id },
    { department: 'Shoe Racks', zone_lead_id: zl2.id },
    { department: 'AV', zone_lead_id: zl2.id },
  ]
  const person = (name: string) => db.volunteers.find((v) => v.full_name === name)!
  const item = (cat: string, name: string) => db.items.find((i) => i.category === cat && i.name === name)!
  const kit = (who: string, cat: string, name: string, by: string) => {
    const k = { id: uid(), volunteer_id: person(who).id, item_id: item(cat, name).id, qty: 1, confirmed_by: by, note: null, created_at: now(), created_by: 'Demo' }
    db.kit_requirements.push(k)
    return k
  }
  kit('Vish Patel', 'Hi-Vis', 'Blue', 'Chiragbhai')
  kit('Vish Patel', 'Walkies', 'Walkie talkie (all channel)', 'Chiragbhai')
  const k3 = kit('Arjun Mistry', 'Hi-Vis', 'Yellow', 'Chiragbhai')
  kit('Meera Desai', 'Equipment', 'Counter / clicker', 'Hetalben')

  const give = (who: string, it: Item, qty: number, mins: number, extra: Partial<Issue> = {}) => {
    const iss: Issue = {
      id: uid(), item_id: it.id, volunteer_id: person(who).id, qty, returned_qty: 0, issued_at: minutesAgo(mins),
      issued_by: 'Demo desk', returned_at: null, returned_by: null, note: null, unit_box: null, unit_wt_no: null,
      unit_channel: null, unit_earpiece: null, zone_lead_id: null, kit_id: null, ...extra,
    }
    if (it.track_stock) it.in_store -= qty
    db.issues.push(iss)
    db.activity.unshift({ id: ++db._seq, at: iss.issued_at, actor: 'Demo desk', action: 'issue', volunteer_id: iss.volunteer_id, item_id: it.id, qty, details: null })
  }
  give('Arjun Mistry', item('Hi-Vis', 'Yellow'), 1, 190, { kit_id: k3.id })
  give('Dev Raval', item('Hi-Vis', 'Yellow'), 2, 150)
  give('Kiran Joshi', item('Equipment', 'Counter / clicker'), 1, 95)
  give('Rohan Parekh', item('Walkies', 'Walkie talkie (all channel)'), 1, 60, { unit_wt_no: '07', unit_box: '1', unit_channel: 'All', unit_earpiece: true })
  give('Priya Amin', item('Consumables', 'Gloves'), 2, 40)
  give('Rakesh Thakkar', item('Equipment', 'Megaphone'), 1, 120)
  give('Rakesh Thakkar', item('Walkies', 'Walkie talkie (all channel)'), 1, 118, { unit_wt_no: '01' })
  db.checkins.push({ id: uid(), volunteer_id: person('Arjun Mistry').id, checked_in_at: minutesAgo(200), checked_in_by: 'Demo desk', checked_out_at: null, checked_out_by: null })
  return db
}

export function createDemoBackend(): Backend {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(KEY) : null

  const read = (): Db => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw) as Db
    } catch { /* fall through to a fresh seed */ }
    const db = seed()
    write(db, [])
    return db
  }
  function write(db: Db, changed: TableName[]) {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full or blocked */ }
    changed.forEach((t) => channel?.postMessage(t))
  }
  const matches = (row: Row, match: Row) => Object.entries(match).every(([k, v]) => row[k] === v)
  const table = (db: Db, t: TableName) => db[t] as unknown as Row[]

  function withDefaults(db: Db, t: TableName, row: Row): Row {
    const r = { ...row }
    if (t === 'activity') { r.id = ++db._seq; r.at ??= now() }
    else if (t !== 'department_leads' && t !== 'events') r.id ??= uid()
    if (t === 'volunteers' || t === 'zone_leads' || t === 'kit_requirements') r.created_at ??= now()
    if (t === 'checkins') r.checked_in_at ??= now()
    return r
  }

  const log = (db: Db, a: Omit<Activity, 'id' | 'at'>) => {
    db.activity.unshift({ ...a, id: ++db._seq, at: now() })
  }

  return {
    mode: 'demo',
    async hasSession() { return true },
    async signIn() {},
    async signOut() {},

    async load<T>(t: TableName) {
      const db = read()
      return structuredClone(db[t]) as unknown as T[]
    },
    subscribe(onChange) {
      if (!channel) return () => {}
      const h = (e: MessageEvent) => TABLES.includes(e.data) && onChange(e.data)
      channel.addEventListener('message', h)
      return () => channel.removeEventListener('message', h)
    },

    async insert(t, rows) {
      const db = read()
      if (t === 'volunteers') {
        for (const r of rows) {
          if (r.satsang_id && db.volunteers.some((v) => v.satsang_id === r.satsang_id)) throw new Error(`Satsang ID ${r.satsang_id} already exists`)
        }
      }
      table(db, t).push(...rows.map((r) => withDefaults(db, t, r)))
      write(db, [t])
    },
    async upsert(t, rows, onConflict) {
      const db = read()
      const keys = onConflict.split(',').map((k) => k.trim())
      const list = table(db, t)
      for (const r of rows) {
        const existing = list.find((x) => keys.every((k) => x[k] === r[k] && r[k] != null))
        if (existing) Object.assign(existing, r)
        else list.push(withDefaults(db, t, r))
      }
      write(db, [t])
    },
    async update(t, match, patch) {
      const db = read()
      table(db, t).filter((r) => matches(r, match)).forEach((r) => Object.assign(r, patch))
      write(db, [t])
    },
    async remove(t, match) {
      const db = read()
      const list = table(db, t)
      ;(db as Record<string, unknown>)[t] = list.filter((r) => !matches(r, match))
      if (t === 'zone_leads') {
        db.department_leads = db.department_leads.filter((d) => d.zone_lead_id !== match.id)
        db.volunteers.forEach((v: Volunteer) => { if (v.zone_lead_id === match.id) v.zone_lead_id = null })
        db.issues.forEach((i) => { if (i.zone_lead_id === match.id) i.zone_lead_id = null })
      }
      if (t === 'kit_requirements') db.issues.forEach((i) => { if (i.kit_id === match.id) i.kit_id = null })
      write(db, [t, 'department_leads', 'volunteers', 'issues'])
    },

    async clear(t) {
      const db = read()
      ;(db as Record<string, unknown>)[t] = []
      write(db, [t])
    },

    async issueItem(a: IssueArgs) {
      const db = read()
      if (!a.p_qty || a.p_qty < 1) throw new Error('Quantity must be at least 1')
      const item = db.items.find((i) => i.id === a.p_item_id)
      if (!item) throw new Error('Item not found')
      if (item.track_stock) {
        if (item.in_store < a.p_qty && !a.p_force) throw new InsufficientStockError(item.in_store)
        item.in_store = Math.max(item.in_store - a.p_qty, 0)
      }
      const clean = (s?: string | null) => (s && s.trim()) || null
      const id = uid()
      db.issues.push({
        id, item_id: item.id, volunteer_id: a.p_volunteer_id, qty: a.p_qty, returned_qty: 0,
        issued_at: now(), issued_by: a.p_issued_by, returned_at: null, returned_by: null,
        note: clean(a.p_note), unit_box: clean(a.p_unit_box), unit_wt_no: clean(a.p_unit_wt_no),
        unit_channel: clean(a.p_unit_channel), unit_earpiece: a.p_unit_earpiece ?? null,
        zone_lead_id: a.p_zone_lead_id ?? null, kit_id: a.p_kit_id ?? null,
      })
      const details = [clean(a.p_note), clean(a.p_unit_wt_no) && `WT ${clean(a.p_unit_wt_no)}`, a.p_force && 'issued beyond counted stock'].filter(Boolean).join(' · ')
      log(db, { actor: a.p_issued_by, action: 'issue', volunteer_id: a.p_volunteer_id, item_id: item.id, qty: a.p_qty, details: details || null })
      write(db, ['items', 'issues', 'activity'])
      return id
    },
    async returnIssue(issueId, qty, by) {
      const db = read()
      const iss = db.issues.find((i) => i.id === issueId)
      if (!iss) throw new Error('That issue no longer exists')
      const left = iss.qty - iss.returned_qty
      if (qty < 1 || qty > left) throw new Error(`Only ${left} still out`)
      iss.returned_qty += qty
      iss.returned_at = now()
      iss.returned_by = by
      const item = db.items.find((i) => i.id === iss.item_id)
      if (item?.track_stock) item.in_store += qty
      log(db, { actor: by, action: 'return', volunteer_id: iss.volunteer_id, item_id: iss.item_id, qty, details: iss.returned_qty < iss.qty ? `${iss.qty - iss.returned_qty} still out` : null })
      write(db, ['items', 'issues', 'activity'])
    },
    async voidIssue(issueId, by) {
      const db = read()
      const iss = db.issues.find((i) => i.id === issueId)
      if (!iss) throw new Error('That issue no longer exists')
      const item = db.items.find((i) => i.id === iss.item_id)
      if (item?.track_stock) item.in_store += iss.qty - iss.returned_qty
      db.issues = db.issues.filter((i) => i.id !== issueId)
      log(db, { actor: by, action: 'void', volunteer_id: iss.volunteer_id, item_id: iss.item_id, qty: iss.qty, details: 'Issue cancelled (entered by mistake)' })
      write(db, ['items', 'issues', 'activity'])
    },
    async setStockCount(itemId, count, by, reason) {
      const db = read()
      if (count < 0) throw new Error('Count must be 0 or more')
      const item = db.items.find((i) => i.id === itemId)
      if (!item) throw new Error('Item not found')
      const from = item.track_stock ? `${item.in_store} → ${count}` : `first count: ${count}`
      item.in_store = count
      item.track_stock = true
      log(db, { actor: by, action: 'stock', volunteer_id: null, item_id: itemId, qty: count, details: [from, reason?.trim()].filter(Boolean).join(' · ') })
      write(db, ['items', 'activity'])
    },
  }
}

export function resetDemo() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
