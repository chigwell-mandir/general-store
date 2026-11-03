// Excel exports. Each returns a downloaded .xlsx; nothing is changed in the database.
import type { Snapshot } from '../types'
import type { Derived } from './store'
import { itemLabel } from './search'

type Row = Record<string, string | number | Date>
type SheetDef = [name: string, rows: Row[]]

const DATE_FORMAT = 'dd/mm/yyyy hh:mm'
const at = (iso: string | null) => (iso ? new Date(iso) : '')

async function writeWorkbook(fileBase: string, eventName: string, sheets: SheetDef[]) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '(none yet)': '' }], { cellDates: true, dateNF: DATE_FORMAT })
    const headers = Object.keys(rows[0] ?? { '(none yet)': '' })
    ws['!cols'] = headers.map((h) => ({
      wch: Math.min(40, Math.max(h.length, ...rows.slice(0, 300).map((r) => (r[h] instanceof Date ? 16 : String(r[h] ?? '').length))) + 2),
    }))
    ws['!autofilter'] = { ref: ws['!ref'] ?? 'A1' }
    XLSX.utils.book_append_sheet(wb, ws, name)
  }
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '.')
  XLSX.writeFile(wb, `${eventName} - ${fileBase} ${stamp}.xlsx`)
}

// ── Sheet builders ────────────────────────────────────────────────────────

/** One row per issue: who had what, when it went out, when it came back. */
function issueRows(data: Snapshot, d: Derived): Row[] {
  return [...data.issues].sort((a, b) => a.issued_at.localeCompare(b.issued_at)).map((i) => {
    const it = d.itemById.get(i.item_id)
    const v = d.volById.get(i.volunteer_id)
    const out = d.outQty(i)
    return {
      'Issued at': at(i.issued_at),
      Item: it ? itemLabel(it) : '',
      Category: it?.category ?? '',
      Type: it?.returnable === false ? 'Consumable' : 'Returnable',
      Qty: i.qty,
      'Qty returned': it?.returnable === false ? '' : i.returned_qty,
      'Still out': out,
      Status: it?.returnable === false ? 'Consumed' : out === 0 ? 'Returned' : i.returned_qty > 0 ? 'Part returned' : 'Out',
      'Returned at': at(i.returned_at),
      Name: v?.full_name ?? '',
      SID: v?.satsang_id ?? '',
      Department: v?.department ?? '',
      Phone: v?.phone ?? '',
      'Zone lead': d.zoneLeadForIssue(i).lead?.name ?? '',
      'On confirmed kit': d.isOnKit(i) ? 'Yes' : '',
      'Issued by (desk)': i.issued_by,
      'Returned to (desk)': i.returned_by ?? '',
      'WT No.': i.unit_wt_no ?? '',
      Box: i.unit_box ?? '',
      Channel: i.unit_channel ?? '',
      Earpiece: i.unit_earpiece ? 'Yes' : '',
      Note: i.note ?? '',
    }
  })
}

/** Every issue / return / cancellation as it happened, in time order (shows partial returns too). */
function issueTimelineRows(data: Snapshot, d: Derived): Row[] {
  const labels: Record<string, string> = { issue: 'Issued', return: 'Returned', void: 'Cancelled (mistake)' }
  return data.activity
    .filter((a) => a.action in labels)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((a) => {
      const it = a.item_id ? d.itemById.get(a.item_id) : undefined
      const v = a.volunteer_id ? d.volById.get(a.volunteer_id) : undefined
      return {
        When: at(a.at), Action: labels[a.action], Item: it ? itemLabel(it) : '', Qty: a.qty ?? '',
        Name: v?.full_name ?? '', SID: v?.satsang_id ?? '', 'Desk volunteer': a.actor, Details: a.details ?? '',
      }
    })
}

function karyakarRows(data: Snapshot, d: Derived): Row[] {
  return [...data.checkins].sort((a, b) => a.checked_in_at.localeCompare(b.checked_in_at)).map((c) => {
    const v = d.volById.get(c.volunteer_id)
    return {
      Name: v?.full_name ?? '', SID: v?.satsang_id ?? '', Mandal: v?.mandal ?? '', Department: v?.department ?? '', Phone: v?.phone ?? '',
      'Checked in': at(c.checked_in_at), 'Checked in by': c.checked_in_by,
      'Checked out': at(c.checked_out_at), 'Checked out by': c.checked_out_by ?? '',
      Status: c.checked_out_at ? 'Checked out' : 'Checked in',
    }
  })
}

function itemRows(data: Snapshot, d: Derived): Row[] {
  const issued = new Map<string, number>()
  for (const i of data.issues) issued.set(i.item_id, (issued.get(i.item_id) ?? 0) + i.qty)
  return data.items.filter((i) => i.active).map((i) => {
    const out = d.outByItem.get(i.id) ?? 0
    const low = i.track_stock && (i.in_store === 0 || i.in_store <= i.low_threshold)
    return {
      Category: i.category, Item: i.name, Type: i.returnable ? 'Returnable' : 'Consumable',
      'In store': i.track_stock ? i.in_store : 'not counted',
      'Out now': i.returnable ? out : '',
      Total: i.track_stock && i.returnable ? i.in_store + out : '',
      'Issued so far': issued.get(i.id) ?? 0,
      'Low stock at': i.low_threshold || '',
      'Low stock?': low ? 'LOW' : '',
    }
  })
}

function outstandingRows(d: Derived): Row[] {
  return d.outstanding.map((i) => {
    const it = d.itemById.get(i.item_id)
    const v = d.volById.get(i.volunteer_id)
    return {
      'Zone lead': d.zoneLeadForIssue(i).lead?.name ?? 'No zone lead', Name: v?.full_name ?? '', SID: v?.satsang_id ?? '',
      Phone: v?.phone ?? '', Department: v?.department ?? '', Item: it ? itemLabel(it) : '', 'Still out': d.outQty(i),
      'Issued at': at(i.issued_at), 'WT No.': i.unit_wt_no ?? '', 'On confirmed kit': d.isOnKit(i) ? 'Yes' : '',
    }
  }).sort((a, b) => String(a['Zone lead']).localeCompare(String(b['Zone lead'])) || String(a.Name).localeCompare(String(b.Name)))
}

// ── Public exports ────────────────────────────────────────────────────────

export const exportIssueLog = (data: Snapshot, d: Derived) =>
  writeWorkbook('Issue and return log', d.event.name, [
    ['Issues', issueRows(data, d)],
    ['Still out', outstandingRows(d)],
    ['Timeline', issueTimelineRows(data, d)],
  ])

export const exportKaryakarLog = (data: Snapshot, d: Derived) =>
  writeWorkbook('Karyakar check-in log', d.event.name, [['Karyakar check-in', karyakarRows(data, d)]])

export const exportItems = (data: Snapshot, d: Derived) =>
  writeWorkbook('Items and quantities', d.event.name, [['Items', itemRows(data, d)]])

export function exportEverything(data: Snapshot, d: Derived) {
  const zl = (id: string | null) => (id ? d.zoneById.get(id)?.name ?? '' : '')
  return writeWorkbook('General Store full backup', d.event.name, [
    ['Issues', issueRows(data, d)],
    ['Still out', outstandingRows(d)],
    ['Karyakar check-in', karyakarRows(data, d)],
    ['Items', itemRows(data, d)],
    ['Kit', data.kit_requirements.map((k) => {
      const v = d.volById.get(k.volunteer_id)
      const it = d.itemById.get(k.item_id)
      return { Name: v?.full_name ?? '', SID: v?.satsang_id ?? '', Item: it ? itemLabel(it) : '', Qty: k.qty, 'Zone lead': d.zoneLeadForVolunteer(v).lead?.name ?? '', Note: k.note ?? '' }
    })],
    ['People', data.volunteers.map((v) => ({
      Name: v.full_name, SID: v.satsang_id ?? '', Mandal: v.mandal ?? '', Phone: v.phone ?? '', Department: v.department ?? '',
      VCD: v.vcd ?? '', Comments: v.comments ?? '', 'Zone lead': d.zoneLeadForVolunteer(v).lead?.name ?? '',
      'Zone lead override': zl(v.zone_lead_id), 'Added at desk': v.added_at_desk ? 'Yes' : '',
    }))],
    ['Audit log', [...data.activity].sort((a, b) => a.at.localeCompare(b.at)).map((a) => {
      const it = a.item_id ? d.itemById.get(a.item_id) : undefined
      return { When: at(a.at), 'Desk volunteer': a.actor, Action: a.action, Name: a.volunteer_id ? d.volById.get(a.volunteer_id)?.full_name ?? '' : '', Item: it ? itemLabel(it) : '', Qty: a.qty ?? '', Details: a.details ?? '' }
    })],
  ])
}
