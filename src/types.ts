// Row shapes — these mirror supabase/schema.sql one-to-one.

export type EventSettings = {
  id: number
  name: string
  overdue_time: string // "HH:MM"
}

/** volunteer_id links the lead to their own directory entry (for their own items). */
export type ZoneLead = { id: string; name: string; phone: string | null; volunteer_id: string | null; created_at: string }

export type DepartmentLead = { department: string; zone_lead_id: string }

export type Volunteer = {
  id: string
  satsang_id: string | null
  full_name: string
  mandal: string | null
  phone: string | null
  email?: string | null
  department: string | null
  vcd: string | null
  comments: string | null
  added_at_desk: boolean
  zone_lead_id: string | null
  created_at: string
}

export type Item = {
  id: string
  category: string
  name: string
  returnable: boolean
  track_stock: boolean
  in_store: number
  low_threshold: number
  unit_tracking: boolean
  active: boolean
  sort: number
}

export type KitRequirement = {
  id: string
  volunteer_id: string
  item_id: string
  qty: number
  /** Legacy column: filled with the zone lead's name when the kit entry is added. */
  confirmed_by: string | null
  note: string | null
  created_at: string
  created_by: string | null
}

export type Issue = {
  id: string
  item_id: string
  volunteer_id: string
  qty: number
  returned_qty: number
  issued_at: string
  issued_by: string
  returned_at: string | null
  returned_by: string | null
  note: string | null
  unit_box: string | null
  unit_wt_no: string | null
  unit_channel: string | null
  unit_earpiece: boolean | null
  zone_lead_id: string | null
  kit_id: string | null
  /** When a zone lead collects for a team member: who it's really for. */
  for_volunteer_id?: string | null
  /** Hi-vis size chosen when giving it. */
  item_size?: string | null
}

export type Checkin = {
  id: string
  volunteer_id: string
  checked_in_at: string
  checked_in_by: string
  checked_out_at: string | null
  checked_out_by: string | null
}

export type ActivityAction =
  | 'issue' | 'return' | 'void' | 'stock'
  | 'kit_add' | 'kit_remove'
  | 'checkin' | 'checkout' | 'checkin_undo'
  | 'person_add' | 'person_edit' | 'import' | 'setting'

export type Activity = {
  id: number | string
  at: string
  actor: string
  action: ActivityAction
  volunteer_id: string | null
  item_id: string | null
  qty: number | null
  details: string | null
}

export type Snapshot = {
  events: EventSettings[]
  zone_leads: ZoneLead[]
  department_leads: DepartmentLead[]
  volunteers: Volunteer[]
  items: Item[]
  kit_requirements: KitRequirement[]
  issues: Issue[]
  checkins: Checkin[]
  activity: Activity[]
}

export type TableName = keyof Snapshot

export const TABLES: TableName[] = [
  'events', 'zone_leads', 'department_leads', 'volunteers', 'items',
  'kit_requirements', 'issues', 'checkins', 'activity',
]

export type IssueArgs = {
  p_item_id: string
  p_volunteer_id: string
  p_qty: number
  p_issued_by: string
  p_note?: string | null
  p_unit_box?: string | null
  p_unit_wt_no?: string | null
  p_unit_channel?: string | null
  p_unit_earpiece?: boolean | null
  p_zone_lead_id?: string | null
  p_kit_id?: string | null
  p_force?: boolean
  p_for_volunteer_id?: string | null
  p_item_size?: string | null
}
