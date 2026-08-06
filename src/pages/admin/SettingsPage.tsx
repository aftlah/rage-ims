import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { InlineMessage } from '@/components/ui/StatusBlock'
import { useSettings } from '@/contexts/SettingsContext'
import { validateAdminDeletePin } from '@/lib/appSettings'

export function SettingsPage() {
  const {
    maintenanceMode,
    maintenanceMessage,
    adminDeletePin,
    siteNotice,
    loading,
    error,
    refresh,
    save,
  } = useSettings()

  const [maintOn, setMaintOn] = useState(false)
  const [maintMsg, setMaintMsg] = useState('')
  const [pin, setPin] = useState('')
  const [notice, setNotice] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setMaintOn(maintenanceMode)
    setMaintMsg(maintenanceMessage)
    setPin(adminDeletePin)
    setNotice(siteNotice)
  }, [maintenanceMode, maintenanceMessage, adminDeletePin, siteNotice])

  const handleSave = async () => {
    setBusy(true)
    setMessage(null)
    setFormError(null)

    if (pin.trim()) {
      const check = validateAdminDeletePin(pin)
      if (!check.ok) {
        setFormError(check.message)
        setBusy(false)
        return
      }
    }

    const res = await save({
      maintenanceMode: maintOn,
      maintenanceMessage: maintMsg,
      adminDeletePin: pin,
      siteNotice: notice,
    })
    setBusy(false)
    if (!res.ok) {
      setFormError(res.error)
      return
    }
    setMessage('Settings tersimpan')
  }

  return (
    <PageStack>
      <PageHeader
        title="Settings"
        subtitle="Maintenance, PIN hapus, dan pengumuman situs"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading || busy}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button size="sm" disabled={busy || loading} onClick={() => void handleSave()}>
          {busy ? 'Menyimpan…' : 'Simpan semua'}
        </Button>
      </PageHeader>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {formError ? <InlineMessage tone="error">{formError}</InlineMessage> : null}
      {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>
            Non-admin tidak bisa memakai modul lain saat aktif. Admin tetap
            bisa masuk Settings untuk mematikannya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Mode maintenance</p>
              <p className="text-xs text-muted-foreground">
                {maintOn ? 'Aktif — member diblok' : 'Nonaktif'}
              </p>
            </div>
            <Switch
              checked={maintOn}
              onCheckedChange={setMaintOn}
              aria-label="Toggle maintenance"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="maint-msg">Pesan maintenance</Label>
            <Textarea
              id="maint-msg"
              value={maintMsg}
              onChange={(e) => setMaintMsg(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>PIN hapus</CardTitle>
          <CardDescription>
            Diminta sebelum hapus/arsip data. Minimal 6 karakter. Dicek di
            client (sama seperti app lama) — bukan secret server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-pin-setting">PIN</Label>
            <div className="relative">
              <Input
                id="delete-pin-setting"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="pr-16"
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-1/2 right-1 h-7 -translate-y-1/2 text-xs"
                onClick={() => setShowPin((v) => !v)}
              >
                {showPin ? 'Hide' : 'Show'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Site notice</CardTitle>
          <CardDescription>
            Banner singkat di bawah header dashboard (kosongkan untuk
            menyembunyikan).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Label htmlFor="site-notice">Pengumuman</Label>
            <Textarea
              id="site-notice"
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              rows={2}
              placeholder="Contoh: Order batch baru buka jam 20:00"
            />
          </div>
        </CardContent>
      </Card>
    </PageStack>
  )
}
