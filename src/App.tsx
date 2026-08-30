import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { ToastProvider } from './contexts/ToastContext'
import { AdminRoute } from './components/AdminRoute'
import { WeeklyProfitRoute } from './components/WeeklyProfitRoute'
import { MaintenanceGate } from './components/MaintenanceGate'
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './layouts/DashboardLayout'
import { LoginPage } from './pages/LoginPage'
import { OrderPage } from './pages/OrderPage'
import { RekapPage } from './pages/RekapPage'
import { StoranPage } from './pages/StoranPage'
import { AbsenPage } from './pages/AbsenPage'
import { KasPage } from './pages/KasPage'
import { DrugsPage } from './pages/DrugsPage'
import { CatalogPage } from './pages/admin/CatalogPage'
import { OrderWindowsPage } from './pages/admin/OrderWindowsPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { UsersPage } from './pages/admin/UsersPage'
import { PricesPage } from './pages/PricesPage'
import { ProfilePage } from './pages/ProfilePage'
import { HomePage } from './pages/HomePage'
import { MemberStoranPage } from './pages/MemberStoranPage'
import { WeeklyProfitPage } from './pages/WeeklyProfitPage'

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <ToastProvider>
            <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<MaintenanceGate />}>
                <Route path="/" element={<DashboardLayout />}>
                  <Route index element={<Navigate to="/home" replace />} />
                  <Route path="home" element={<HomePage />} />
                  <Route path="order" element={<OrderPage />} />
                  <Route path="prices" element={<PricesPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="storan-saya" element={<MemberStoranPage />} />
                  <Route path="rekap" element={<RekapPage />} />
                  <Route path="absen" element={<AbsenPage />} />
                  <Route element={<WeeklyProfitRoute />}>
                    <Route path="profit-mingguan" element={<WeeklyProfitPage />} />
                  </Route>
                  <Route element={<AdminRoute />}>
                    <Route path="storan" element={<StoranPage />} />
                    <Route path="kas" element={<KasPage />} />
                    <Route path="drugs" element={<DrugsPage />} />
                    <Route path="admin/catalog" element={<CatalogPage />} />
                    <Route path="admin/users" element={<UsersPage />} />
                    <Route path="admin/windows" element={<OrderWindowsPage />} />
                    <Route path="admin/settings" element={<SettingsPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </ToastProvider>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  )
}
