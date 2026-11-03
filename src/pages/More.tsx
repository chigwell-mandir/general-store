import { Link } from 'react-router'
import { Boxes, ChevronRight, ClipboardList, History, Settings, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import { useTheme, type Theme } from '../components/Layout'

export function MorePage() {
  const { data } = useStore()
  const [theme, setTheme] = useTheme()
  const rows = [
    { to: '/stock', icon: Boxes, title: 'Stock', sub: 'Counts, low stock, add items' },
    { to: '/kit', icon: ClipboardList, title: 'Kit list', sub: `${data.kit_requirements.length} confirmed items` },
    { to: '/people', icon: Users, title: 'People', sub: `${data.volunteers.length} in the directory` },
    { to: '/history', icon: History, title: 'History & export', sub: 'Every action · download Excel' },
    { to: '/setup', icon: Settings, title: 'Setup', sub: 'Event, zone leads, imports, start fresh' },
  ]
  return (
    <main className="page page-narrow">
      <h1>More</h1>
      <ul className="list plain">
        {rows.map((r) => (
          <li key={r.to}>
            <Link to={r.to} className="menu-row">
              <r.icon aria-hidden />
              <span className="grow"><strong>{r.title}</strong><span className="subtle" style={{ display: 'block' }}>{r.sub}</span></span>
              <ChevronRight aria-hidden className="muted" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="between">
        <span className="muted">Appearance</span>
        <div className="seg" role="group" aria-label="Appearance">
          {(['auto', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t === 'auto' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}</button>
          ))}
        </div>
      </div>
    </main>
  )
}
