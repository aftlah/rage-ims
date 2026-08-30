import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** Admin-only child routes. */
export function AdminRoute() {
  const { loading, session, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="neo-inset rounded-2xl px-6 py-4 text-sm text-rage-muted">
          Memuat...
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/home" replace />

  return <Outlet />
}
