import { useEffect, useMemo, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettings } from '@/contexts/SettingsContext'
import { matchAdminDeletePin } from '@/lib/appSettings'

type ConfirmMemberDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  onConfirm: () => void | Promise<void>
}

export function ConfirmMemberDeleteDialog({
  open,
  onOpenChange,
  memberName,
  onConfirm,
}: ConfirmMemberDeleteDialogProps) {
  const { adminDeletePin } = useSettings()
  const [confirmName, setConfirmName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const nameMatches = useMemo(
    () => confirmName.trim() === memberName.trim(),
    [confirmName, memberName],
  )

  useEffect(() => {
    if (!open) {
      setConfirmName('')
      setPin('')
      setError(null)
      setBusy(false)
    }
  }, [open])

  const handleConfirm = async () => {
    if (!nameMatches) {
      setError('Ketik nama member persis seperti ditampilkan untuk konfirmasi.')
      return
    }

    const check = matchAdminDeletePin(pin, adminDeletePin)
    if (!check.ok) {
      setError(check.message)
      return
    }

    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memproses')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-destructive/30 bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            Hapus member permanen?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Member <strong className="text-foreground">{memberName}</strong>{' '}
                dan <strong className="text-foreground">semua data terkait</strong>{' '}
                akan dihapus permanen, termasuk:
              </p>
              <ul className="list-inside list-disc text-xs">
                <li>Order / rekap</li>
                <li>Storan & nitip cuci</li>
                <li>Absen kota</li>
                <li>Drugs sales</li>
                <li>Akun login Supabase Auth</li>
              </ul>
              <p className="font-medium text-destructive">
                Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-member-name">
              Ketik <span className="font-semibold">{memberName}</span> untuk
              konfirmasi
            </Label>
            <Input
              id="confirm-member-name"
              value={confirmName}
              autoComplete="off"
              disabled={busy}
              onChange={(e) => {
                setConfirmName(e.target.value)
                setError(null)
              }}
              placeholder={memberName}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="delete-member-pin">PIN hapus</Label>
            <Input
              id="delete-member-pin"
              type="password"
              autoComplete="off"
              value={pin}
              disabled={busy}
              onChange={(e) => {
                setPin(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleConfirm()
              }}
              placeholder="Masukkan PIN admin"
            />
          </div>

          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              PIN diatur di Admin → Settings (minimal 6 karakter).
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy || !nameMatches || !pin.trim()}
            onClick={() => void handleConfirm()}
          >
            {busy ? 'Menghapus…' : 'Ya, hapus semua permanen'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
