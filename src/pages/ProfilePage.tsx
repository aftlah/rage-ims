import { useState, type FormEvent } from 'react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
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
import { InlineMessage } from '@/components/ui/StatusBlock'
import { useAuth } from '@/contexts/AuthContext'
import {
  changeCurrentUserPassword,
  getUsernameFromEmail,
  validatePasswordStrength,
} from '@/lib/auth'

export function ProfilePage() {
  const { member, user } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const email = user?.email ?? ''
  const username = getUsernameFromEmail(email)

  const handleSavePassword = async (e: FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setFormError(null)

    const check = validatePasswordStrength(newPassword)
    if (!check.ok) {
      setFormError(check.message)
      return
    }
    if (newPassword !== confirmPassword) {
      setFormError('Konfirmasi password tidak sama')
      return
    }

    setBusy(true)
    const res = await changeCurrentUserPassword(newPassword)
    setBusy(false)

    if (!res.ok) {
      setFormError(`Gagal mengubah password: ${res.error}`)
      return
    }

    setNewPassword('')
    setConfirmPassword('')
    setMessage('Password berhasil diubah')
  }

  return (
    <PageStack>
      <PageHeader
        title="Profile"
        subtitle="Kelola informasi akun dan ubah password login"
      />

      {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}
      {formError ? <InlineMessage tone="error">{formError}</InlineMessage> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardDescription className="text-[10px] tracking-[0.18em] uppercase">
              Identitas
            </CardDescription>
            <CardTitle className="text-lg">Akun Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Nama Member</p>
              <p className="text-lg font-bold">{member?.nama || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <Badge variant="outline" className="mt-1">
                {member?.role || '—'}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-username">Username Sekarang</Label>
              <Input
                id="profile-username"
                value={username}
                readOnly
                className="bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email Login</Label>
              <Input
                id="profile-email"
                value={email}
                readOnly
                className="bg-muted/30"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 lg:col-span-2">
          <CardHeader>
            <CardDescription className="text-[10px] tracking-[0.18em] uppercase">
              Keamanan
            </CardDescription>
            <CardTitle className="text-lg">Ganti Password</CardTitle>
            <CardDescription>
              Username login hanya ditampilkan sebagai informasi. Yang bisa
              diubah dari halaman ini hanya password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              onSubmit={(e) => void handleSavePassword(e)}
            >
              <div className="space-y-2">
                <Label htmlFor="profile-new-password">Password Baru</Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirm-password">
                  Konfirmasi Password
                </Label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex justify-end md:col-span-2">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Menyimpan…' : 'Simpan Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageStack>
  )
}
