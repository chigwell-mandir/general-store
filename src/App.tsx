import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { StoreProvider, useStore } from './lib/store'
import { ToastProvider } from './components/ui'
import { Layout, BrandMark } from './components/Layout'
import { DeskNamePage, LoginPage } from './pages/Login'
import { DeskPage } from './pages/Desk'
import { OutPage } from './pages/Out'
import { CheckinPage } from './pages/Checkin'
import { MorePage } from './pages/More'
import { DashboardPage } from './pages/Dashboard'
import { KitPage } from './pages/Kit'
import { PeoplePage, ProfilePage } from './pages/People'
import { HistoryPage } from './pages/History'
import { SetupPage } from './pages/Setup'

function Gate() {
  const { signedIn, ready, desk, loadError, refresh } = useStore()
  if (signedIn === false) return <LoginPage />
  if (!ready) {
    return (
      <div className="login">
        <div className="stack" style={{ alignItems: 'center' }}>
          <BrandMark />
          {loadError
            ? <div className="banner banner-danger"><AlertTriangle /><div className="stack"><span>Couldn’t reach the database: {loadError}</span><button className="btn btn-sm" onClick={() => refresh()}>Try again</button></div></div>
            : <p className="subtle">Loading the store…</p>}
        </div>
      </div>
    )
  }
  if (!desk) return <DeskNamePage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DeskPage />} />
        <Route path="out" element={<OutPage />} />
        <Route path="checkin" element={<CheckinPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="stock" element={<DashboardPage />} />
        <Route path="kit" element={<KitPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="people/:id" element={<ProfilePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="setup" element={<SetupPage />} />
        {/* old addresses from before the simplification */}
        <Route path="return" element={<Navigate to="/" replace />} />
        <Route path="outstanding" element={<Navigate to="/out" replace />} />
        <Route path="escalation" element={<Navigate to="/out" replace />} />
        <Route path="dashboard" element={<Navigate to="/stock" replace />} />
        <Route path="export" element={<Navigate to="/history" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </StoreProvider>
    </HashRouter>
  )
}
