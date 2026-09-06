import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import { ConfirmMemberDeleteDialog } from '@/components/ConfirmMemberDeleteDialog'
import {
  EmptyState,
  ErrorState,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useToast } from '@/contexts/ToastContext'
import {
  createMemberViaAdmin,
  fetchAccountAuditLogs,
  fetchAdminMembers,
  deleteMemberViaAdmin,
  MEMBER_ROLES,
  patchMemberProfileViaRpc,
  updateMemberRole,
  type AdminMember,
  type AuditRow,
} from '@/lib/adminUsers'

export function UsersPage() {
  const { user, member, isAdmin } = useAuth()
  const toast = useToast()
  const [members, setMembers] = useState<AdminMember[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AdminMember | null>(null)
  const [roleDraft, setRoleDraft] = useState('Hoodlum')
  const [usernameDraft, setUsernameDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createNama, setCreateNama] = useState('')
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<string>('Hoodlum')
  const [createBusy, setCreateBusy] = useState(false)

  const isSelfSelected = useMemo(() => {
    if (!selected) return false
    if (member?.id && selected.id === member.id) return true
    if (user?.id && selected.auth_user_id && user.id === selected.auth_user_id) {
      return true
    }
    return false
  }, [member?.id, selected, user?.id])

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
    const res = await updateMemberRole({
      memberId: selected.id,
      role: roleDraft,
      actorAuthUserId: user?.id ?? null,
      targetAuthUserId: selected.auth_user_id,
    })
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Role berhasil diupdate')
    await refresh()
    setSelected((prev) =>
      prev && prev.id === selected.id ? { ...prev, role: roleDraft } : prev,
    )
  }

  async function handlePatchUsername() {
    if (!selected) return
    setBusy(true)
    const res = await patchMemberProfileViaRpc({
      memberId: selected.id,
      username: usernameDraft,
      actorAuthUserId: user?.id ?? null,
      targetAuthUserId: selected.auth_user_id,
    })
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(`Username berhasil diubah — login sekarang: ${res.email}`)
    await refresh()
    setSelected((prev) =>
      prev && prev.id === selected.id
        ? { ...prev, email: res.email }
        : prev,
    )
  }

  async function handleDeleteMember() {
    if (!selected || isSelfSelected) return
    setBusy(true)
    const res = await deleteMemberViaAdmin({
      memberId: selected.id,
      targetAuthUserId: selected.auth_user_id,
      actorAuthUserId: user?.id ?? null,
      memberName: selected.nama,
    })
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      throw new Error(res.error)
    }
    toast.success(`Member ${selected.nama} dihapus`)
    setSelected(null)
    await refresh()
  }

  const resetCreateForm = () => {
    setCreateNama('')
    setCreateUsername('')
    setCreatePassword('')
    setCreateRole('Hoodlum')
  }

  const handleCreateMember = async () => {
    setCreateBusy(true)
    try {
      const res = await createMemberViaAdmin({
        nama: createNama,
        username: createUsername,
        password: createPassword,
        role: createRole,
        actorAuthUserId: user?.id ?? null,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        `Member ${res.member.nama} ditambahkan (login: ${res.username})`,
      )
      setCreateOpen(false)
      resetCreateForm()
      setSelected(res.member)
      setRoleDraft(res.member.role || 'Hoodlum')
      setUsernameDraft(res.username)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambah member')
    } finally {
      setCreateBusy(false)
    }
  }

  if (!isAdmin) return null

  return (
    <PageStack>
      <PageHeader
        title="Admin Users"
        subtitle="Tambah member, kelola role & username (hanya admin)"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy || createBusy}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Tambah Member</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </PageHeader>

      {error ? <ErrorState message={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[0.9fr_1.1fr]">
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
                    <Label className="text-muted-foreground">ID Akun</Label>
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
                Ubah jabatan/role member yang dipilih.
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
              <CardTitle>Ubah Username Login</CardTitle>
              <CardDescription>
                Ganti username yang dipakai member untuk masuk ke sistem.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                  <Label>Username baru</Label>
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
                  Simpan Username
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Hapus Member</CardTitle>
              <CardDescription>
                Menghapus member beserta seluruh data terkait dan akses login.
                Wajib konfirmasi nama + PIN hapus.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isSelfSelected ? (
                <p className="text-sm text-muted-foreground">
                  Kamu tidak bisa menghapus akun sendiri.
                </p>
              ) : null}
              <Button
                variant="destructive"
                disabled={!selected || busy || isSelfSelected}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Hapus Member
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Riwayat aksi admin terbaru</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (createBusy) return
          setCreateOpen(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Member</DialogTitle>
            <DialogDescription>
              Isi data di bawah untuk membuat akun login member baru.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-nama">Nama</Label>
              <Input
                id="create-nama"
                value={createNama}
                disabled={createBusy}
                onChange={(e) => setCreateNama(e.target.value)}
                placeholder="Contoh: Leo"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-username">Username login</Label>
              <Input
                id="create-username"
                value={createUsername}
                disabled={createBusy}
                onChange={(e) => setCreateUsername(e.target.value)}
                placeholder="contoh: leo"
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Username ini dipakai member untuk masuk ke sistem.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="create-password">Password awal</Label>
              <Input
                id="create-password"
                type="password"
                value={createPassword}
                disabled={createBusy}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select
                value={createRole}
                disabled={createBusy}
                onValueChange={setCreateRole}
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={createBusy}
              onClick={() => {
                setCreateOpen(false)
                resetCreateForm()
              }}
            >
              Batal
            </Button>
            <Button
              disabled={createBusy}
              onClick={() => void handleCreateMember()}
            >
              {createBusy ? 'Menyimpan…' : 'Buat Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmMemberDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        memberName={selected?.nama || ''}
        onConfirm={handleDeleteMember}
      />
    </PageStack>
  )
}
