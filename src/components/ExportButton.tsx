import { FileSpreadsheet } from 'lucide-react'
import { useStore } from '../lib/store'
import { exportEverything, exportIssueLog, exportItems, exportKaryakarLog } from '../lib/exports'
import { useAction } from './ui'

export type ExportKind = 'issues' | 'karyakar' | 'items' | 'everything'
type Kind = ExportKind

const EXPORTS: Record<Kind, { fn: typeof exportIssueLog; button: string }> = {
  issues: { fn: exportIssueLog, button: 'Issues & returns' },
  karyakar: { fn: exportKaryakarLog, button: 'Karyakar check-ins' },
  items: { fn: exportItems, button: 'Items & quantities' },
  everything: { fn: exportEverything, button: 'Full backup' },
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
