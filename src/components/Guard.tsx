import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { Lock } from 'lucide-react'
import { useStore, type Perm } from '../lib/store'
import { Empty } from './ui'

const LABEL: Record<Perm, string> = { items: 'issuing and returning items', karyakar: 'karyakar check-in', admin: 'admin (setup and stock)' }

/** Shows the page only if the current desk volunteer has the permission. */
export function Guard({ perm, children }: { perm: Perm; children: ReactNode }) {
  const { can } = useStore()
  if (can(perm)) return <>{children}</>
  return (
    <main className="page">
      <div className="card">
        <Empty icon={Lock} title="Not available for you">
          This needs permission for {LABEL[perm]}. Ask an admin to change your access in Setup.
          <div style={{ marginTop: 12 }}><Link to="/outstanding" className="btn">Go to Outstanding</Link></div>
        </Empty>
      </div>
    </main>
  )
}

/** Home screen: Issue for item desks, otherwise the first screen this person can use. */
export function Home({ issue }: { issue: ReactNode }) {
  const { can } = useStore()
  if (can('items')) return <>{issue}</>
  if (can('karyakar')) return <Navigate to="/checkin" replace />
  return <Navigate to="/outstanding" replace />
}
