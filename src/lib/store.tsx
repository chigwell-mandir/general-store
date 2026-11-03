import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  Activity, ActivityAction, Checkin, EventSettings, Issue, IssueArgs, Item, KitRequirement,
  Snapshot, TableName, Volunteer, ZoneLead,
} from '../types'
import { TABLES } from '../types'
import { backend } from './backend'
import { uid } from './backend/demo'
import { createPeopleSearch, normalise } from './search'
import { starterCatalogue } from './seed'
import { deadlineFor } from './time'

const EMPTY: Snapshot = {
  events: [], zone_leads: [], department_leads: [], volunteers: [], items: [],
  kit_requirements: [], issues: [], checkins: [], activity: [],
}
const DEFAULT_EVENT: EventSettings = { id: 1, name: 'General Store', overdue_time: '21:00' }
const DESK_KEY = 'general-store-desk-name'

export type VolunteerInput = Pick<Volunteer, 'full_name' | 'satsang_id' | 'mandal' | 'phone' | 'department' | 'vcd' | 'comments'>

function useDerived(data: Snapshot) {
  return useMemo(() => {
    const event = data.events[0] ?? DEFAULT_EVENT
    const itemById = new Map(data.items.map((i) => [i.id, i]))
    const volById = new Map(data.volunteers.map((v) => [v.id, v]))
    const zoneById = new Map(data.zone_leads.map((z) => [z.id, z]))
    const leadByVol = new Map(data.zone_leads.filter((z) => z.volunteer_id).map((z) => [z.volunteer_id!, z]))
    const deptLead = new Map(data.department_leads.map((d) => [normalise(d.department), d.zone_lead_id]))
    const kitById = new Map(data.kit_requirements.map((k) => [k.id, k]))

    const group = <T,>(rows: T[], key: (r: T) => string) => {
      const m = new Map<string, T[]>()
      for (const r of rows) {
        const k = key(r)
        if (!m.has(k)) m.set(k, [])
        m.get(k)!.push(r)
      }
      return m
    }
    const issuesByVol = group(data.issues, (i) => i.volunteer_id)
    const kitByVol = group(data.kit_requirements, (k) => k.volunteer_id)
    const checkinByVol = new Map(data.checkins.map((c) => [c.volunteer_id, c]))

    const isReturnable = (i: Issue) => itemById.get(i.item_id)?.returnable ?? true
    const outQty = (i: Issue) => (isReturnable(i) ? i.qty - i.returned_qty : 0)
    const outstanding = data.issues
      .filter((i) => outQty(i) > 0)
      .sort((a, b) => a.issued_at.localeCompare(b.issued_at))
    const outByItem = new Map<string, number>()
    for (const i of outstanding) outByItem.set(i.item_id, (outByItem.get(i.item_id) ?? 0) + outQty(i))

    const zoneLeadForVolunteer = (v: Volunteer | undefined): { lead: ZoneLead | null; manual: boolean } => {
      if (!v) return { lead: null, manual: false }
      if (v.zone_lead_id && zoneById.has(v.zone_lead_id)) return { lead: zoneById.get(v.zone_lead_id)!, manual: true }
      if (leadByVol.has(v.id)) return { lead: leadByVol.get(v.id)!, manual: false } // a lead answers for their own items
      const id = deptLead.get(normalise(v.department))
      return { lead: (id && zoneById.get(id)) || null, manual: false }
    }
    const zoneLeadForIssue = (i: Issue) => {
      if (i.zone_lead_id && zoneById.has(i.zone_lead_id)) return { lead: zoneById.get(i.zone_lead_id)!, manual: true }
      return zoneLeadForVolunteer(volById.get(i.volunteer_id))
    }
    /** Whether this issue was on the person's confirmed kit. */
    const isOnKit = (i: Issue) => !!((i.kit_id && kitById.get(i.kit_id)) || kitByVol.get(i.volunteer_id)?.some((k) => k.item_id === i.item_id))
    const isOverdue = (i: Issue, now: number) => outQty(i) > 0 && now > deadlineFor(i.issued_at, event.overdue_time)

    const outByLead = new Map<string, Issue[]>()
    for (const i of outstanding) {
      const id = zoneLeadForIssue(i).lead?.id
      if (!id) continue
      if (!outByLead.has(id)) outByLead.set(id, [])
      outByLead.get(id)!.push(i)
    }
    const searchLeads = (raw: string) => {
      const q = raw.trim()
      const words = normalise(q).split(' ').filter(Boolean)
      if (!words.length) return []
      return data.zone_leads.filter((z) => {
        const v = z.volunteer_id ? volById.get(z.volunteer_id) : undefined
        if (/^\d+$/.test(q)) return !!v?.satsang_id && v.satsang_id === q
        const name = normalise(`${z.name} ${v?.full_name ?? ''}`).split(' ')
        return words.every((w) => name.some((n) => n.startsWith(w)))
      })
    }
    /** A zone lead's own outstanding items, and their team's (excluding their own). */
    const leadItems = (z: ZoneLead) => {
      const own = z.volunteer_id ? outstanding.filter((i) => i.volunteer_id === z.volunteer_id) : []
      const team = (outByLead.get(z.id) ?? []).filter((i) => i.volunteer_id !== z.volunteer_id)
      return { own, team }
    }

    const departments = [...new Set(data.volunteers.map((v) => v.department?.trim()).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b))
    const searchPeople = createPeopleSearch(data.volunteers)

    return {
      event, itemById, volById, zoneById, kitById, issuesByVol, kitByVol, checkinByVol,
      outstanding, outByItem, outQty, isReturnable, zoneLeadForVolunteer, zoneLeadForIssue,
      isOnKit, isOverdue, departments, searchPeople, outByLead, searchLeads, leadByVol, leadItems,
    }
  }, [data])
}

export type Derived = ReturnType<typeof useDerived>

function useStoreValue() {
  const [data, setData] = useState<Snapshot>(EMPTY)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [desk, setDeskState] = useState<string>(() => {
    try { return localStorage.getItem(DESK_KEY) ?? '' } catch { return '' }
  })
  const d = useDerived(data)

  const setDesk = (name: string) => {
    setDeskState(name)
    try { localStorage.setItem(DESK_KEY, name) } catch { /* private mode */ }
  }

  const refresh = useCallback(async (tables: TableName[] = TABLES) => {
    try {
      const loaded = await Promise.all(tables.map((t) => backend.load(t)))
      setData((prev) => {
        const next = { ...prev }
        tables.forEach((t, i) => { (next as Record<string, unknown>)[t] = loaded[i] })
        return next
      })
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [])

  // Initial session check + load
  useEffect(() => {
    backend.hasSession().then(setSignedIn)
  }, [])
  useEffect(() => {
    if (!signedIn) return
    refresh().then(() => setReady(true))
  }, [signedIn, refresh])

  // Live updates from other devices, batched so a burst of changes refetches once
  const pending = useRef(new Set<TableName>())
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!signedIn) return
    const unsub = backend.subscribe((t) => {
      pending.current.add(t)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const tables = [...pending.current]
        pending.current.clear()
        refresh(tables)
      }, 250)
    })
    // Phones drop the live connection when asleep: refetch whenever the app comes back
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    const safety = setInterval(() => refresh(), 60000)
    return () => {
      unsub()
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(safety)
    }
  }, [signedIn, refresh])

  const who = desk || 'Desk'
  const log = (action: ActivityAction, f: Partial<Omit<Activity, 'id' | 'at' | 'action' | 'actor'>> = {}) =>
    backend.insert('activity', [{ actor: who, action, volunteer_id: null, item_id: null, qty: null, details: null, ...f }])

  const act = {
    async signIn(password: string) {
      await backend.signIn(password)
      setSignedIn(true)
    },
    async signOut() {
      await backend.signOut()
      setSignedIn(false)
      setReady(false)
    },

    async issue(args: Omit<IssueArgs, 'p_issued_by'>) {
      const id = await backend.issueItem({ ...args, p_issued_by: who })
      await refresh(['items', 'issues', 'activity'])
      return id
    },
    async returnIssue(issue: Issue, qty: number) {
      await backend.returnIssue(issue.id, qty, who)
      await refresh(['items', 'issues', 'activity'])
    },
    async voidIssue(issueId: string) {
      await backend.voidIssue(issueId, who)
      await refresh(['items', 'issues', 'activity'])
    },
    async setIssueZoneLead(issue: Issue, zoneLeadId: string | null) {
      await backend.update('issues', { id: issue.id }, { zone_lead_id: zoneLeadId })
      await refresh(['issues'])
    },

    async setStock(item: Item, count: number, reason?: string) {
      await backend.setStockCount(item.id, count, who, reason)
      await refresh(['items', 'activity'])
    },
    async saveItem(item: Partial<Item> & Pick<Item, 'category' | 'name'>) {
      if (item.id) {
        const { id, ...patch } = item
        await backend.update('items', { id }, patch)
      } else {
        const sort = Math.max(0, ...data.items.map((i) => i.sort)) + 10
        await backend.insert('items', [{ returnable: true, track_stock: false, in_store: 0, low_threshold: 0, unit_tracking: false, active: true, sort, ...item }])
      }
      await refresh(['items'])
    },
    async addStarterCatalogue() {
      const existing = new Set(data.items.map((i) => `${i.category}|${i.name}`.toLowerCase()))
      const rows = starterCatalogue().filter((i) => !existing.has(`${i.category}|${i.name}`.toLowerCase()))
      if (rows.length) await backend.insert('items', rows)
      await refresh(['items'])
      return rows.length
    },

    async addKit(k: Pick<KitRequirement, 'volunteer_id' | 'item_id' | 'qty' | 'note'>) {
      const lead = d.zoneLeadForVolunteer(d.volById.get(k.volunteer_id)).lead
      await backend.insert('kit_requirements', [{ ...k, confirmed_by: lead?.name ?? '', created_by: who }])
      await log('kit_add', { volunteer_id: k.volunteer_id, item_id: k.item_id, qty: k.qty, details: k.note })
      await refresh(['kit_requirements', 'activity'])
    },
    async removeKit(k: KitRequirement) {
      await backend.remove('kit_requirements', { id: k.id })
      await log('kit_remove', { volunteer_id: k.volunteer_id, item_id: k.item_id, qty: k.qty })
      await refresh(['kit_requirements', 'issues', 'activity'])
    },

    async checkIn(v: Volunteer) {
      await backend.insert('checkins', [{ volunteer_id: v.id, checked_in_by: who }])
      await log('checkin', { volunteer_id: v.id, details: 'Karyakar checked in' })
      await refresh(['checkins', 'activity'])
    },
    async checkOut(c: Checkin) {
      await backend.update('checkins', { id: c.id }, { checked_out_at: new Date().toISOString(), checked_out_by: who })
      await log('checkout', { volunteer_id: c.volunteer_id, details: 'Karyakar checked out' })
      await refresh(['checkins', 'activity'])
    },
    async undoCheckout(c: Checkin) {
      await backend.update('checkins', { id: c.id }, { checked_out_at: null, checked_out_by: null })
      await log('checkin_undo', { volunteer_id: c.volunteer_id, details: 'Check-out undone' })
      await refresh(['checkins', 'activity'])
    },
    async undoCheckin(c: Checkin) {
      await backend.remove('checkins', { id: c.id })
      await log('checkin_undo', { volunteer_id: c.volunteer_id, details: 'Check-in removed' })
      await refresh(['checkins', 'activity'])
    },

    /** Bulk check-in for everyone listed who isn't checked in yet. */
    async checkInMany(vols: Volunteer[]) {
      const fresh = vols.filter((v) => !d.checkinByVol.has(v.id))
      if (!fresh.length) return 0
      const nowIso = new Date().toISOString()
      for (let i = 0; i < fresh.length; i += 500) {
        await backend.insert('checkins', fresh.slice(i, i + 500).map((v) => ({ volunteer_id: v.id, checked_in_at: nowIso, checked_in_by: who })))
      }
      await backend.insert('activity', fresh.map((v) => ({ at: nowIso, actor: who, action: 'checkin', volunteer_id: v.id, item_id: null, qty: null, details: 'Karyakar checked in (bulk)' })))
      await refresh(['checkins', 'activity'])
      return fresh.length
    },
    /** Bulk check-out for everyone listed who is still checked in. */
    async checkOutMany(vols: Volunteer[]) {
      const open = vols.map((v) => d.checkinByVol.get(v.id)).filter((c): c is Checkin => !!c && !c.checked_out_at)
      if (!open.length) return 0
      const nowIso = new Date().toISOString()
      await backend.updateMany('checkins', open.map((c) => c.id), { checked_out_at: nowIso, checked_out_by: who })
      await backend.insert('activity', open.map((c) => ({ at: nowIso, actor: who, action: 'checkout', volunteer_id: c.volunteer_id, item_id: null, qty: null, details: 'Karyakar checked out (bulk)' })))
      await refresh(['checkins', 'activity'])
      return open.length
    },

    async addVolunteer(v: VolunteerInput): Promise<string> {
      const id = uid()
      await backend.insert('volunteers', [{ ...v, id, added_at_desk: true }])
      await log('person_add', { volunteer_id: id, details: 'Added at desk (not in mastersheet)' })
      await refresh(['volunteers', 'activity'])
      return id
    },
    async updateVolunteer(v: Volunteer, patch: Partial<Volunteer>, note?: string) {
      await backend.update('volunteers', { id: v.id }, patch)
      if (note) await log('person_edit', { volunteer_id: v.id, details: note })
      await refresh(['volunteers', 'activity'])
    },
    /** Upserts mastersheet rows: matched on Satsang ID, or on exact name for rows with no ID. */
    async importVolunteers(rows: VolunteerInput[]) {
      const byName = new Map(data.volunteers.filter((v) => !v.satsang_id).map((v) => [normalise(v.full_name), v]))
      const withId = rows.filter((r) => r.satsang_id)
      const noId = rows.filter((r) => !r.satsang_id)
      const rowsOut = (rs: VolunteerInput[]) => rs.map((r) => ({ ...r, added_at_desk: false }))
      for (let i = 0; i < withId.length; i += 500) await backend.upsert('volunteers', rowsOut(withId.slice(i, i + 500)), 'satsang_id')
      const fresh = noId.filter((r) => !byName.has(normalise(r.full_name)))
      for (const r of noId.filter((r) => byName.has(normalise(r.full_name)))) {
        await backend.update('volunteers', { id: byName.get(normalise(r.full_name))!.id }, { ...r, added_at_desk: false })
      }
      if (fresh.length) await backend.insert('volunteers', rowsOut(fresh))
      await log('import', { details: `Imported ${rows.length} volunteers from mastersheet` })
      await refresh(['volunteers', 'activity'])
    },

    async saveZoneLead(z: { id?: string; name: string; phone: string | null; volunteer_id: string | null }) {
      const row = { name: z.name, phone: z.phone, volunteer_id: z.volunteer_id }
      if (z.id) await backend.update('zone_leads', { id: z.id }, row)
      else await backend.insert('zone_leads', [row])
      await refresh(['zone_leads'])
    },
    async removeZoneLead(z: ZoneLead) {
      await backend.remove('zone_leads', { id: z.id })
      await refresh(['zone_leads', 'department_leads', 'volunteers', 'issues'])
    },
    async setDeptLead(department: string, zoneLeadId: string | null) {
      if (zoneLeadId) await backend.upsert('department_leads', [{ department, zone_lead_id: zoneLeadId }], 'department')
      else await backend.remove('department_leads', { department })
      await refresh(['department_leads'])
    },
    /** Start fresh: removes people, issues, kit, check-ins, zone leads and history. */
    async wipe(opts: { keepCatalogue: boolean; keepCounts: boolean }) {
      for (const t of ['issues', 'kit_requirements', 'checkins', 'activity', 'department_leads', 'zone_leads', 'volunteers'] as TableName[]) {
        await backend.clear(t)
      }
      if (!opts.keepCatalogue) await backend.clear('items')
      else if (!opts.keepCounts) {
        for (const i of data.items) await backend.update('items', { id: i.id }, { in_store: 0, track_stock: false })
      }
      await log('setting', { details: `Data wiped — fresh start (${opts.keepCatalogue ? `catalogue kept${opts.keepCounts ? ' with counts' : ', counts cleared'}` : 'catalogue removed'})` })
      await refresh()
    },
    async saveEvent(patch: Partial<EventSettings>) {
      await backend.update('events', { id: d.event.id }, patch)
      await log('setting', { details: Object.entries(patch).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(', ') })
      await refresh(['events', 'activity'])
    },
  }

  return { data, d, ready, loadError, signedIn, desk, setDesk, refresh, act, mode: backend.mode }
}

type Store = ReturnType<typeof useStoreValue>
const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue()
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const s = useContext(StoreContext)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
