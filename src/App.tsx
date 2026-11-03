import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { StoreProvider, useStore } from './lib/store'
import { ToastProvider } from './components/ui'
import { Layout, BrandMark } from './components/Layout'
import { DeskNamePage, LoginPage } from './pages/Login'
import { IssuePage } from './pages/Issue'
import { ReturnPage } from './pages/Return'
import { OutstandingPage } from './pages/Outstanding'
import { CheckinPage } from './pages/Checkin'
import { MorePage } from './pages/More'
import { DashboardPage } from './pages/Dashboard'
import { KitPage } from './pages/Kit'
import { EscalationPage } from './pages/Escalation'
import { PeoplePage, ProfilePage } from './pages/People'
import { HistoryPage } from './pages/History'
import { SetupPage } from './pages/Setup'
import { ExportPage } from './pages/Export'

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
        <Route index element={<IssuePage />} />
        <Route path="return" element={<ReturnPage />} />
        <Route path="outstanding" element={<OutstandingPage />} />
        <Route path="checkin" element={<CheckinPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="kit" element={<KitPage />} />
        <Route path="escalation" element={<EscalationPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="people/:id" element={<ProfilePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="setup" element={<SetupPage />} />
        <Route path="export" element={<ExportPage />} />
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
