import { Clock, Wrench } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/StatusBlock'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'

const DEFAULT_DETAIL = 'Sebentar yaa kawan — kami lagi perbaiki sistem supaya lebih enak dipakai.'

function parseMaintenanceMessage(raw: string) {
  const message = raw.trim()
  if (!message) {
    return { label: 'Sedang maintenance', detail: DEFAULT_DETAIL }
  }

  const colonIdx = message.indexOf(':')
  if (colonIdx > 0 && colonIdx < 48) {
    const label = message.slice(0, colonIdx).trim()
    const detail = message.slice(colonIdx + 1).trim()
    return {
      label: label || 'Sedang maintenance',
      detail: detail || DEFAULT_DETAIL,
    }
  }

  return { label: 'Sedang maintenance', detail: message }
}

function MaintenanceScreen({ message }: { message: string }) {
  const { label, detail } = parseMaintenanceMessage(message)

  return (
    <div className="app-shell relative flex min-h-dvh items-center justify-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="login-orbs" aria-hidden />

      <Card className="maintenance-card relative w-full max-w-lg border-border/60 bg-card/90 text-center backdrop-blur-xl">
        <CardHeader className="items-center gap-5 pb-2">
          <div className="mx-auto flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
            <img
              src="/logo_rage.png"
              alt="R.A.G.E"
              className="h-full w-full object-contain object-center opacity-90"
            />
          </div>

          <div className="maintenance-badge">
            <span className="maintenance-badge-dot" aria-hidden />
            Maintenance aktif
          </div>

          <div className="space-y-3">
            <h1 className="text-gradient-gold text-2xl font-extrabold tracking-tight sm:text-3xl">
              {label}
            </h1>

            <div className="maintenance-icon-wrap mx-auto">
              <Wrench className="size-7 text-amber-300" strokeWidth={2.2} />
            </div>

            <p className="mx-auto max-w-md text-base leading-relaxed text-foreground/90 sm:text-lg">
              {detail}
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-2">
          <div className="maintenance-info-row">
            <Clock className="size-4 shrink-0 text-amber-300/90" />
            <span>Sistem sementara tidak bisa diakses untuk member.</span>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Butuh akses darurat? Hubungi admin R.A.G.E lewat Discord atau
            kontak langsung.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

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
      <div className="app-shell flex min-h-dvh items-center justify-center">
        <LoadingState message="Memuat…" />
      </div>
    )
  }

  const onSettings = location.pathname.startsWith('/admin/settings')
  const blocked = maintenanceMode && !isAdmin && !onSettings

  if (blocked) {
    return (
      <MaintenanceScreen
        message={
          maintenanceMessage || 'Sedang maintenance: Sebentar yaa kawan'
        }
      />
    )
  }

  return <Outlet />
}
