import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  EmptyState,
  ErrorState,
  InlineMessage,
  LoadingState,
} from '@/components/ui/StatusBlock'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import {
  fetchAccountAuditLogs,
  fetchAdminMembers,
  MEMBER_ROLES,
  patchMemberProfileViaRpc,
  updateMemberRole,
  type AdminMember,
  type AuditRow,
} from '@/lib/adminUsers'

export function UsersPage() {
  const { user, isAdmin } = useAuth()
  const [members, setMembers] = useState<AdminMember[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminMember | null>(null)
  const [roleDraft, setRoleDraft] = useState('Hoodlum')
  const [usernameDraft, setUsernameDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [mRes, aRes] = await Promise.all([
      fetchAdminMembers(),
      fetchAccountAuditLogs(),
    ])
    if (mRes.error) setError(mRes.error)
    setMembers(mRes.data)
    if (!aRes.error) setAudit(aRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!selected) return
    setRoleDraft(selected.role || 'Hoodlum')
    const fromEmail = selected.email?.split('@')[0] || ''
    setUsernameDraft(fromEmail)
  }, [selected])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return members
    return members.filter((m) =>
      `${m.nama} ${m.email || ''} ${m.role}`.toLowerCase().includes(term),
    )
  }, [members, search])

  async function handleSaveRole() {
    if (!selected) return
    setBusy(true)
    setMessage(null)
    const res = await updateMemberRole({
      memberId: selected.id,
      role: roleDraft,
      actorAuthUserId: user?.id ?? null,
      targetAuthUserId: selected.auth_user_id,
    })
    setBusy(false)
    if (!res.ok) {
      setMessage(res.error)
      return
    }
    setMessage('Role berhasil diupdate')
    await refresh()
    setSelected((prev) =>
      prev && prev.id === selected.id ? { ...prev, role: roleDraft } : prev,
    )
  }

  async function handlePatchUsername() {
    if (!selected) return
    setBusy(true)
    setMessage(null)
    const res = await patchMemberProfileViaRpc({
      memberId: selected.id,
      username: usernameDraft,
      actorAuthUserId: user?.id ?? null,
      targetAuthUserId: selected.auth_user_id,
    })
    setBusy(false)
    if (!res.ok) {
      setMessage(res.error)
      return
    }
    setMessage(
      `Username/email di tabel members diupdate ke ${res.email}. Auth login email belum ikut (TODO Edge Function).`,
    )
    await refresh()
    setSelected((prev) =>
      prev && prev.id === selected.id
        ? { ...prev, email: res.email }
        : prev,
    )
  }

  if (!isAdmin) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Admin Users</h2>
          <p className="page-subtitle">
            List members + patch via RPC (tanpa service role)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Pilih user untuk edit role atau username</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / email / role..."
            />
            {loading ? (
              <LoadingState />
            ) : !filtered.length ? (
              <EmptyState title="Tidak ada member" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow
                      key={m.id}
                      className={
                        selected?.id === m.id ? 'bg-primary/5' : undefined
                      }
                    >
                      <TableCell className="font-medium">{m.nama}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelected(m)}
                        >
                          Pilih
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Akun Terpilih</CardTitle>
            </CardHeader>
            <CardContent>
              {selected ? (
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Nama</Label>
                    <p className="mt-1 font-semibold">{selected.nama}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Role</Label>
                    <p className="mt-1 font-semibold">{selected.role}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {selected.email || '—'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-muted-foreground">Auth User ID</Label>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {selected.auth_user_id || '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pilih user di kiri
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Update Role</CardTitle>
              <CardDescription>
                Update langsung ke tabel members (RLS admin), + audit log RPC.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[160px] flex-1 flex-col gap-2">
                  <Label>Role</Label>
                  <Select
                    value={roleDraft}
                    disabled={!selected || busy}
                    onValueChange={setRoleDraft}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMBER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  disabled={!selected || busy}
                  onClick={() => void handleSaveRole()}
                >
                  Simpan Role
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Patch Username / Email (RPC)</CardTitle>
              <CardDescription>
                Via <code>rage_admin_patch_member</code> +{' '}
                <code>rage_admin_insert_audit_log</code>. Tidak mengubah Auth
                login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                  <Label>Username</Label>
                  <Input
                    value={usernameDraft}
                    disabled={!selected || busy}
                    onChange={(e) => setUsernameDraft(e.target.value)}
                    placeholder="contoh: leo2"
                  />
                </div>
                <Button
                  disabled={!selected || busy}
                  onClick={() => void handlePatchUsername()}
                >
                  Simpan via RPC
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 border-dashed bg-muted/20">
            <CardHeader>
              <CardTitle className="text-primary">
                TODO — Edge Function
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>
                  Reset / set password user (lama: Auth Admin API + service
                  role)
                </li>
                <li>
                  Sync email Auth saat ganti username (lama:
                  supabaseAdminUpdateUser)
                </li>
                <li>Jangan taruh SERVICE_ROLE_KEY di browser</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Riwayat aksi admin terbaru</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {audit.length === 0 ? (
                <div className="px-6 pb-6">
                  <EmptyState title="Belum ada audit / tidak terbaca" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Actor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.map((row, idx) => (
                      <TableRow key={`${row.created_at}-${idx}`}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell>{row.action}</TableCell>
                        <TableCell className="break-all font-mono text-[10px] text-muted-foreground">
                          {row.target_auth_user_id ||
                            row.target_member_id ||
                            '—'}
                        </TableCell>
                        <TableCell className="break-all font-mono text-[10px] text-muted-foreground">
                          {row.actor_auth_user_id || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
