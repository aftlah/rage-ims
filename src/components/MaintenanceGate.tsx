import { Outlet, useLocation } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'

/**
 * Blocks non-admin pages while maintenance is on.
 * Admins keep full access (including Settings to turn it off).
 */
export function MaintenanceGate() {
  const { isAdmin, loading: authLoading } = useAuth()
  const { maintenanceMode, maintenanceMessage, loading: settingsLoading } =
    useSettings()
  const location = useLocation()

  if (authLoading || settingsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Memuat…
      </div>
    )
  }

  const onSettings = location.pathname.startsWith('/admin/settings')
  const blocked = maintenanceMode && !isAdmin && !onSettings

  if (blocked) {
    return (
      <div className="app-shell flex min-h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md border-border/60 bg-card/90 text-center">
          <CardHeader>
            <CardTitle className="text-primary">Maintenance</CardTitle>
            <CardDescription className="text-base text-foreground/80">
              {maintenanceMessage ||
                'Sedang maintenance: Sebentar yaa kawan'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Hubungi admin jika butuh akses darurat.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <Outlet />
}
