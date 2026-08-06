import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="neo-inset rounded-2xl px-6 py-4 text-sm text-rage-muted">
          Memuat sesi...
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function GuestRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="neo-inset rounded-2xl px-6 py-4 text-sm text-rage-muted">
          Memuat sesi...
        </div>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/rekap" replace />
  }

  return <Outlet />
}
