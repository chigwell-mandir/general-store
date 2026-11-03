import { Link } from 'react-router'
import { ClipboardList, FileSpreadsheet, History, LayoutDashboard, Megaphone, Settings, Users } from 'lucide-react'
import { useStore } from '../lib/store'

export function MorePage() {
  const { data, d } = useStore()
  const tiles = [
    { to: '/dashboard', icon: LayoutDashboard, title: 'Dashboard & stock', sub: `${data.items.filter((i) => i.active).length} items` },
    { to: '/escalation', icon: Megaphone, title: 'Escalation', sub: 'WhatsApp summary per lead' },
    { to: '/kit', icon: ClipboardList, title: 'Kit allocation', sub: `${data.kit_requirements.length} confirmed` },
    { to: '/people', icon: Users, title: 'People', sub: `${data.volunteers.length} volunteers` },
    { to: '/history', icon: History, title: 'History', sub: 'Full audit log' },
    { to: '/export', icon: FileSpreadsheet, title: 'Export to Excel', sub: 'Logs, check-ins, items' },
    { to: '/setup', icon: Settings, title: 'Setup & import', sub: `${d.event.name}` },
  ]
  return (
    <main className="page">
      <h1>More</h1>
      <div className="menu-grid">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="card menu-tile">
            <span className="tile-icon"><t.icon aria-hidden /></span>
            <span><span style={{ fontWeight: 750, display: 'block' }}>{t.title}</span><span className="subtle">{t.sub}</span></span>
          </Link>
        ))}
      </div>
    </main>
  )
}
