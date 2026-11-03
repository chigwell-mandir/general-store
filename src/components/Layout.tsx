import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { BadgeCheck, Boxes, ClipboardList, Clock, History, LogOut, Menu, PackageOpen, Settings, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/time'
import { Avatar, Sheet } from './ui'
import { DeskNameForm } from '../pages/Login'

export type Theme = 'auto' | 'light' | 'dark'
const THEME_KEY = 'general-store-theme'

export function useTheme() {
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
  useTheme() // apply the saved theme
  const [deskSheet, setDeskSheet] = useState(false)
  const overdue = d.outstanding.filter((i) => d.isOverdue(i, now)).length

  const link = (to: string, icon: ReactNode, label: string, extra?: ReactNode) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>{icon}{label}{extra}</NavLink>
  )
  const tab = (to: string, icon: ReactNode, label: ReactNode) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>{icon}{label}</NavLink>
  )

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <BrandMark />
          <div><div className="brand-name">General Store</div><div className="brand-sub">{d.event.name}</div></div>
        </div>
        {link('/', <PackageOpen />, 'Desk')}
        {link('/out', <Clock />, 'Out', overdue > 0 && <span className="count dot-inline">{overdue}</span>)}
        {link('/checkin', <BadgeCheck />, 'Karyakar check-in')}
        <div className="side-group" />
        {link('/stock', <Boxes />, 'Stock')}
        {link('/kit', <ClipboardList />, 'Kit list')}
        {link('/people', <Users />, 'People')}
        {link('/history', <History />, 'History & export')}
        {link('/setup', <Settings />, 'Setup')}
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="brand">
            <BrandMark />
            <div className="brand-text"><div className="brand-name">General Store</div><div className="brand-sub">{d.event.name}</div></div>
          </div>
          <div className="topbar-spacer" />
          {mode === 'demo' && <span className="demo-pill" title="Data is stored on this device only">Demo</span>}
          <button className="desk-chip" onClick={() => setDeskSheet(true)} aria-label={`On desk: ${desk}. Change`}>
            <Avatar name={desk || '?'} /><span>{desk || 'Set name'}</span>
          </button>
        </header>
        <Outlet />
      </div>

      <nav className="tabbar" aria-label="Main">
        {tab('/', <PackageOpen />, 'Desk')}
        {tab('/out', <Clock />, <>Out{overdue > 0 && <span className="dot num">{overdue}</span>}</>)}
        {tab('/checkin', <BadgeCheck />, 'Karyakar')}
        {tab('/more', <Menu />, 'More')}
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
