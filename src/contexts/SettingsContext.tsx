import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_APP_SETTINGS,
  fetchAppSettings,
  saveAppSettingsPatch,
  type AppSettings,
} from '@/lib/appSettings'
import { useAuth } from '@/contexts/AuthContext'

type SettingsContextValue = {
  settings: AppSettings
  maintenanceMode: boolean
  maintenanceMessage: string
  adminDeletePin: string
  siteNotice: string
  weeklyProfitViewerIds: number[]
  gunAttachmentMarkupPct: number
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  save: (
    patch: Partial<{
      maintenanceMode: boolean
      maintenanceMessage: string
      adminDeletePin: string
      siteNotice: string
      weeklyProfitViewerIds: number[]
      gunAttachmentMarkupPct: number
    }>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session, user } = useAuth()
  const [settings, setSettings] = useState<AppSettings>({
    ...DEFAULT_APP_SETTINGS,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!session) {
      setSettings({ ...DEFAULT_APP_SETTINGS })
      setError(null)
      return
    }
    setLoading(true)
    const res = await fetchAppSettings()
    setSettings(res.data)
    setError(res.error)
    setLoading(false)
  }, [session])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(
    async (
      patch: Partial<{
        maintenanceMode: boolean
        maintenanceMessage: string
        adminDeletePin: string
        siteNotice: string
        weeklyProfitViewerIds: number[]
        gunAttachmentMarkupPct: number
      }>,
    ) => {
      const res = await saveAppSettingsPatch(patch, user?.id ?? null)
      if (!res.ok) return res
      await refresh()
      return { ok: true as const }
    },
    [refresh, user?.id],
  )

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      adminDeletePin: settings.adminDeletePin,
      siteNotice: settings.siteNotice,
      weeklyProfitViewerIds: settings.weeklyProfitViewerIds,
      gunAttachmentMarkupPct: settings.gunAttachmentMarkupPct,
      loading,
      error,
      refresh,
      save,
    }),
    [settings, loading, error, refresh, save],
  )

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return ctx
}
