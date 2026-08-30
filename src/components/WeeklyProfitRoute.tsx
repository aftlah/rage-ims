import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { canAccessWeeklyProfit } from '@/lib/weeklyProfitAccess'

/** Route guard: admin atau member yang ada di allowlist Settings. */
export function WeeklyProfitRoute() {
  const { loading, session, member } = useAuth()
  const { loading: settingsLoading, weeklyProfitViewerIds } = useSettings()

  if (loading || settingsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="neo-inset rounded-2xl px-6 py-4 text-sm text-muted-foreground">
          Memuat…
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (!canAccessWeeklyProfit(member, weeklyProfitViewerIds)) {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}
