// Reads the mastersheet / stock sheets (xlsx or csv) and cleans them up.
// The original files are only ever read, never written.
import type { Item } from '../types'
import type { VolunteerInput } from './store'
import { itemLabel, normalise } from './search'

type Cell = string | number | boolean | Date | null | undefined
type Grid = Cell[][]

async function xlsx() {
  return import('xlsx') // loaded only when importing/exporting, keeps the app fast
}

export async function readSheets(file: File): Promise<{ name: string; rows: Grid }[]> {
  const XLSX = await xlsx()
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }),
  }))
}

const text = (c: Cell) => (c === null || c === undefined ? '' : String(c).replace(/\s+/g, ' ').trim())

function findHeader(rows: Grid, required: RegExp[]) {
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const cells = rows[r].map((c) => text(c).toLowerCase())
    if (required.every((re) => cells.some((c) => re.test(c)))) return r
  }
  return -1
}
const col = (header: string[], re: RegExp) => header.findIndex((h) => re.test(h))

// ── Volunteers ────────────────────────────────────────────────────────────

const MANDALS: Record<string, string> = {
  'sanyukta purush': 'Sanyukta Purush', 'sanyuta purush': 'Sanyukta Purush', 'sanyukt purush': 'Sanyukta Purush',
  'sanyukta mahila': 'Sanyukta Mahila', 'sanyuta mahila': 'Sanyukta Mahila', 'sanyukt mahila': 'Sanyukta Mahila',
  yuvak: 'Yuvak', yuvati: 'Yuvati', kishore: 'Kishore', kishori: 'Kishori', bal: 'Bal', balika: 'Balika',
}

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (m) => m.toUpperCase())

export function cleanName(s: string) {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t === t.toUpperCase()) return titleCase(t.toLowerCase())
  return t.replace(/(^|[\s-])(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase())
}

export function cleanSid(c: Cell): string | null {
  if (typeof c === 'number') return String(Math.round(c))
  const t = text(c).replace(/\.0+$/, '').replace(/\s/g, '')
  return t || null
}

/** Excel stores phone numbers as numbers and drops the leading 0 — put it back and format UK-style. */
export function cleanPhone(c: Cell): string | null {
  let digits = typeof c === 'number' ? String(Math.round(c)) : text(c).replace(/^[oO]/, '0').replace(/[^\d+]/g, '')
  if (!digits) return null
  if (digits.startsWith('0044')) digits = '+44' + digits.slice(4)
  if (digits.startsWith('+44')) digits = '0' + digits.slice(3)
  else if (digits.startsWith('44') && digits.length === 12) digits = '0' + digits.slice(2)
  if (/^7\d{9}$/.test(digits)) digits = '0' + digits
  if (/^0\d{10}$/.test(digits)) return `${digits.slice(0, 5)} ${digits.slice(5)}`
  return text(c) || null
}

export function cleanDepartment(s: string) {
  // "Kitchen -Catering" → "Kitchen - Catering", but leave "Zone-lead" alone
  let t = s.replace(/\s+/g, ' ').trim().replace(/\s+-\s*|\s*-\s+/g, ' - ').replace(/\s*\/\s*/g, '/')
  if (t === t.toLowerCase()) t = titleCase(t)
  return t || null
}

function cleanMandal(s: string) {
  const k = normalise(s)
  return k ? MANDALS[k] ?? titleCase(s.trim().toLowerCase()) : null
}

function cleanYesNo(s: string) {
  const k = s.trim().toLowerCase()
  if (!k) return null
  if (['y', 'yes'].includes(k)) return 'Yes'
  if (['n', 'no'].includes(k)) return 'No'
  return s.trim()
}

export type VolunteerImport = {
  sheet: string
  people: VolunteerInput[]
  warnings: string[]
  columns: string[]
  skipped: number
}

/** Finds the registrations sheet (any tab with a Name + Satsang ID header) and maps its columns. */
export function parseVolunteers(sheets: { name: string; rows: Grid }[]): VolunteerImport {
  const FULL_NAME = /full\s*name|volunteer name/
  const NAME = /full\s*name|^name$|volunteer name/
  const SID = /satsang|^sid$|satsang id/
  const sheet = sheets.find((s) => findHeader(s.rows, [NAME, SID]) >= 0)
  if (!sheet) throw new Error('Couldn’t find a sheet with “Full Name” and “Satsang ID” columns.')
  const h = findHeader(sheet.rows, [NAME, SID])
  const header = sheet.rows[h].map((c) => text(c).toLowerCase())
  const idx = {
    // Forms exports can have an empty "Name" column beside "Full Name", so prefer the latter
    name: col(header, FULL_NAME) >= 0 ? col(header, FULL_NAME) : col(header, NAME),
    sid: col(header, SID), mandal: col(header, /mandal/), vcd: col(header, /vcd/),
    phone: col(header, /contact|phone|mobile|number\?/), department: col(header, /department|dept/), comments: col(header, /comment|notes?$/),
  }
  // The real address can be in any email column ("Email" may just say "anonymous"); the preferred one wins
  const emailCols = header.map((h, i) => (/e-?mail/.test(h) ? i : -1)).filter((i) => i >= 0)
    .sort((a, b) => Number(/preferred/.test(header[b])) - Number(/preferred/.test(header[a])))
  const columns = [...Object.entries(idx).filter(([, i]) => i >= 0).map(([k]) => k), ...(emailCols.length ? ['email'] : [])]
  const warnings: string[] = []
  const seen = new Map<string, number>()
  const people: VolunteerInput[] = []
  let skipped = 0

  for (let r = h + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r]
    const get = (i: number) => (i >= 0 ? row[i] : null)
    const name = text(get(idx.name))
    const sid = cleanSid(get(idx.sid))
    if (!name && !sid) continue
    if (!name) { skipped++; warnings.push(`Row ${r + 1}: Satsang ID ${sid} has no name — skipped`); continue }
    const p: VolunteerInput = {
      full_name: cleanName(name),
      satsang_id: sid,
      mandal: cleanMandal(text(get(idx.mandal))),
      phone: cleanPhone(get(idx.phone)),
      department: cleanDepartment(text(get(idx.department))),
      email: emailCols.map((i) => text(row[i]).toLowerCase()).find((e) => e.includes('@')) ?? null,
      vcd: idx.vcd >= 0 ? cleanYesNo(text(get(idx.vcd))) : null,
      comments: idx.comments >= 0 ? text(get(idx.comments)) || null : null,
    }
    if (sid && seen.has(sid)) {
      const earlier = people[seen.get(sid)!]
      if (normalise(earlier.full_name) === normalise(p.full_name)) {
        warnings.push(`${p.full_name} is listed twice with Satsang ID ${sid} — kept the later row`)
        people[seen.get(sid)!] = p
        continue
      }
      // Two different people can't share an ID: keep both, the later one without it
      warnings.push(`Satsang ID ${sid} is used by both ${earlier.full_name} and ${p.full_name} — ${p.full_name} imported without an ID, please check`)
      people.push({ ...p, satsang_id: null })
      continue
    }
    if (!sid) warnings.push(`${p.full_name} has no Satsang ID — they can still be found by name`)
    if (sid) seen.set(sid, people.length)
    people.push(p)
  }
  return { sheet: sheet.name, people, warnings, columns, skipped }
}

// ── Stock counts ──────────────────────────────────────────────────────────

export type StockRow = { category: string; name: string; returnable: boolean | null; count: number | null; low: number | null; existing?: Item }

export function parseStock(sheets: { name: string; rows: Grid }[], items: Item[]): { sheet: string; rows: StockRow[]; warnings: string[] } {
  const ITEM = /^item|^name$/
  const QTY = /quantity|qty|count|in store/
  const sheet = sheets.find((s) => findHeader(s.rows, [ITEM, QTY]) >= 0)
  if (!sheet) throw new Error('Couldn’t find a sheet with “Item” and “Quantity” columns. Download the template below.')
  const h = findHeader(sheet.rows, [ITEM, QTY])
  const header = sheet.rows[h].map((c) => text(c).toLowerCase())
  const iCat = col(header, /categor/), iItem = col(header, ITEM), iQty = col(header, QTY)
  const iType = col(header, /type|returnable/), iLow = col(header, /low/)
  const warnings: string[] = []
  const rows: StockRow[] = []
  const key = (c: string, n: string) => `${normalise(c)}|${normalise(n)}`
  const byKey = new Map(items.map((i) => [key(i.category, i.name), i]))
  const byLabel = new Map(items.map((i) => [normalise(itemLabel(i)), i]))

  for (let r = h + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r]
    const name = text(row[iItem])
    if (!name) continue
    const category = iCat >= 0 ? text(row[iCat]) : ''
    const q = text(row[iQty])
    const count = q === '' ? null : Number(q.replace(/[^\d.]/g, ''))
    if (count !== null && Number.isNaN(count)) { warnings.push(`Row ${r + 1}: “${q}” isn’t a number — skipped`); continue }
    const type = iType >= 0 ? text(row[iType]).toLowerCase() : ''
    const lowRaw = iLow >= 0 ? text(row[iLow]) : ''
    const existing = byKey.get(key(category, name)) ?? byLabel.get(normalise(name)) ?? byLabel.get(normalise(`${name} ${category}`))
    if (!existing && !category) { warnings.push(`Row ${r + 1}: “${name}” is a new item but has no category — skipped`); continue }
    rows.push({
      category: existing?.category ?? category, name: existing?.name ?? name,
      returnable: type ? !/consum|no|false/.test(type) : null,
      count: count === null ? null : Math.round(count),
      low: lowRaw ? parseInt(lowRaw, 10) || 0 : null,
      existing,
    })
  }
  return { sheet: sheet.name, rows, warnings }
}

// ── Exports ───────────────────────────────────────────────────────────────

export async function downloadStockTemplate(items: Item[]) {
  const XLSX = await xlsx()
  const rows = [['Category', 'Item', 'Type', 'Quantity', 'Low stock at'],
    ...items.filter((i) => i.active).map((i) => [i.category, i.name, i.returnable ? 'Returnable' : 'Consumable', i.track_stock ? i.in_store : '', i.low_threshold || ''])]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Stock')
  XLSX.writeFile(wb, 'General Store - stock count template.xlsx')
}
