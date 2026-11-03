import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import {
  BadgeCheck, ClipboardList, FileSpreadsheet, History, LayoutDashboard, LogOut, Megaphone, Menu, Monitor, Moon,
  PackageMinus, PackagePlus, Settings, Sun, Users, Clock,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/time'
import { Avatar, Sheet } from './ui'
import { DeskNameForm } from '../pages/Login'

type Theme = 'auto' | 'light' | 'dark'
const THEME_KEY = 'general-store-theme'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem(THEME_KEY) as Theme) || 'auto' } catch { return 'auto' }
  })
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* ignore */ }
  }, [theme])
  return [theme, setTheme] as const
}

export function BrandMark() {
  return <img src="./icon.svg" alt="" className="brand-mark" />
}

export function Layout() {
  const { d, desk, mode, act } = useStore()
  const now = useNow()
  const [theme, setTheme] = useTheme()
  const [deskSheet, setDeskSheet] = useState(false)
  const overdue = d.outstanding.filter((i) => d.isOverdue(i, now)).length
  const outCount = d.outstanding.length
  const onSite = [...d.checkinByVol.values()].filter((c) => !c.checked_out_at).length
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  const nextTheme: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }

  const side = (to: string, icon: ReactNode, label: string, count?: ReactNode) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
      {icon}{label}{count}
    </NavLink>
  )

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <BrandMark />
          <div><div className="brand-name">General Store</div><div className="brand-sub">{d.event.name}</div></div>
        </div>
        <div className="side-group">Desk</div>
        {side('/', <PackageMinus />, 'Issue')}
        {side('/return', <PackagePlus />, 'Return')}
        {side('/outstanding', <Clock />, 'Outstanding', outCount > 0 && <span className={`count badge ${overdue ? 'badge-danger' : ''}`}>{overdue || outCount}</span>)}
        {side('/checkin', <BadgeCheck />, 'Karyakar check-in', onSite > 0 && <span className="count badge">{onSite}</span>)}
        <div className="side-group">Manage</div>
        {side('/dashboard', <LayoutDashboard />, 'Dashboard & stock')}
        {side('/kit', <ClipboardList />, 'Kit allocation')}
        {side('/escalation', <Megaphone />, 'Escalation')}
        {side('/people', <Users />, 'People')}
        {side('/history', <History />, 'History')}
        {side('/export', <FileSpreadsheet />, 'Export to Excel')}
        {side('/setup', <Settings />, 'Setup & import')}
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="brand">
            <BrandMark />
            <div className="brand-text"><div className="brand-name">General Store</div><div className="brand-sub">{d.event.name}</div></div>
          </div>
          <div className="topbar-spacer" />
          {mode === 'demo' && <span className="demo-pill" title="Data is stored on this device only">Demo</span>}
          <button className="icon-btn" onClick={() => setTheme(nextTheme[theme])} aria-label={`Theme: ${theme}. Change theme`} title={`Theme: ${theme}`}><ThemeIcon /></button>
          <button className="desk-chip" onClick={() => setDeskSheet(true)} aria-label={`On desk: ${desk}. Change`}>
            <Avatar name={desk || '?'} /><span>{desk || 'Set name'}</span>
          </button>
        </header>
        <Outlet />
      </div>

      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}><PackageMinus />Issue</NavLink>
        <NavLink to="/return" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}><PackagePlus />Return</NavLink>
        <NavLink to="/outstanding" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          <Clock />Out{overdue > 0 && <span className="dot num">{overdue}</span>}
        </NavLink>
        <NavLink to="/checkin" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}><BadgeCheck /><span className="tab-label">Karyakar Check-in</span></NavLink>
        <NavLink to="/more" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}><Menu />More</NavLink>
      </nav>

      {deskSheet && (
        <Sheet title="Who’s on the desk?" subtitle="Every issue and return is stamped with this name." onClose={() => setDeskSheet(false)}>
          <DeskNameForm onDone={() => setDeskSheet(false)} />
          {mode === 'live' && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => act.signOut()}><LogOut /> Sign this device out</button>
          )}
        </Sheet>
      )}
    </div>
  )
}
