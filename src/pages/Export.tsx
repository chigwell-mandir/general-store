import { ArrowLeftRight, Boxes, DatabaseBackup, FileSpreadsheet, UserCheck, type LucideIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { exportEverything, exportIssueLog, exportItems, exportKaryakarLog } from '../lib/exports'
import { useAction } from '../components/ui'

type Kind = 'issues' | 'karyakar' | 'items' | 'everything'

const EXPORTS: Record<Kind, { fn: typeof exportIssueLog; icon: LucideIcon; title: string; sub: string; button: string }> = {
  issues: { fn: exportIssueLog, icon: ArrowLeftRight, title: 'Issue & return log', sub: 'Every item issued: who, what, when out, when back, zone lead, desk volunteer. Plus a “still out” sheet and a timeline of every issue/return.', button: 'Export issue log' },
  karyakar: { fn: exportKaryakarLog, icon: UserCheck, title: 'Karyakar check-in log', sub: 'Every karyakar check-in and check-out with times and who recorded it.', button: 'Export check-in log' },
  items: { fn: exportItems, icon: Boxes, title: 'Items & quantities', sub: 'Every item: in store, out now, total, issued so far, low-stock flag.', button: 'Export item list' },
  everything: { fn: exportEverything, icon: DatabaseBackup, title: 'Full backup', sub: 'All of the above plus confirmed kit, people and the full audit log, in one workbook.', button: 'Export everything' },
}

/** One-tap Excel download, usable on any page. */
export function ExportButton({ kind, label, className = 'btn' }: { kind: Kind; label?: string; className?: string }) {
  const { data, d } = useStore()
  const { busy, run } = useAction()
  return (
    <button className={className} disabled={busy} onClick={() => run(() => EXPORTS[kind].fn(data, d), 'Excel file downloaded')}>
      <FileSpreadsheet /> {label ?? EXPORTS[kind].button}
    </button>
  )
}

export function ExportPage() {
  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Export to Excel</h1><p className="muted">Downloads a fresh .xlsx with the latest data. Dates and times are real Excel dates, with filters on every column.</p></div>
      </div>
      <div className="stack">
        {(Object.keys(EXPORTS) as Kind[]).map((k) => {
          const e = EXPORTS[k]
          return (
            <section key={k} className="card card-pad between" style={{ flexWrap: 'wrap' }}>
              <div className="row grow" style={{ gap: 14, alignItems: 'flex-start', minWidth: 240 }}>
                <span className="menu-tile" style={{ padding: 0, minHeight: 0 }}><span className="tile-icon"><e.icon aria-hidden /></span></span>
                <div><h2>{e.title}</h2><p className="subtle" style={{ marginTop: 4 }}>{e.sub}</p></div>
              </div>
              <ExportButton kind={k} className={k === 'everything' ? 'btn' : 'btn btn-primary'} />
            </section>
          )
        })}
      </div>
    </main>
  )
}
