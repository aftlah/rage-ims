import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import {
  EmptyState,
  ErrorState,
  InlineMessage,
  LoadingState,
} from '@/components/ui/StatusBlock'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  absenStatusLabel,
  deleteAbsenKotaRow,
  fetchAbsenKotaTable,
  fetchOpenAbsenSession,
  recordAbsenKota,
  type AbsenRow,
} from '@/lib/absen'
import {
  fmtAbsenDateTime,
  fmtAbsenDuration,
  fmtAbsenTableTime,
  todayDateKeyJakarta,
} from '@/lib/dates'
import { fetchMembersLite, type MemberLite } from '@/lib/membersLite'

function AbsenStatusBadge({
  tone,
  text,
}: {
  tone: 'stone' | 'yellow' | 'done'
  text: string
}) {
  return (
    <Badge
      variant="secondary"
      className={
        tone === 'yellow'
          ? 'border-transparent bg-amber-500/15 text-amber-300'
          : 'border-transparent bg-stone-500/20 text-stone-300'
      }
    >
      {text}
    </Badge>
  )
}

export function AbsenPage() {
  const { member, isAdmin } = useAuth()
  const [tanggal, setTanggal] = useState(todayDateKeyJakarta())
  const [rows, setRows] = useState<AbsenRow[]>([])
  const [openSession, setOpenSession] = useState<AbsenRow | null>(null)
  const [members, setMembers] = useState<MemberLite[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AbsenRow | null>(null)

  const [catatan, setCatatan] = useState('')
  const [buktiMasuk, setBuktiMasuk] = useState<File | null>(null)
  const [buktiKeluar, setBuktiKeluar] = useState<File | null>(null)

  const [adminMemberId, setAdminMemberId] = useState<number | ''>('')
  const [adminAction, setAdminAction] = useState<'masuk' | 'keluar'>('masuk')
  const [adminBukti, setAdminBukti] = useState<File | null>(null)
  const [adminCatatan, setAdminCatatan] = useState('')

  const refresh = useCallback(async () => {
    if (!member) return
    setLoading(true)
    setError(null)
    const [table, open] = await Promise.all([
      fetchAbsenKotaTable({ tanggal, member, isAdmin }),
      fetchOpenAbsenSession(member.id),
    ])
    setRows(table.data)
    setOpenSession(open)
    if (table.error) setError(table.error)
    if (isAdmin) {
      const mem = await fetchMembersLite()
      setMembers(mem.data)
    }
    setLoading(false)
  }, [tanggal, member, isAdmin])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const inCity = rows.filter(
    (r) => r.jam_masuk_kota && !r.jam_keluar_kota,
  ).length
  const done = rows.filter((r) => r.jam_masuk_kota && r.jam_keluar_kota).length

  const doSelf = async (action: 'masuk' | 'keluar') => {
    if (!member) return
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await recordAbsenKota({
      action,
      memberId: member.id,
      nama: member.nama,
      catatan,
      actor: member.nama,
      photoFile: action === 'masuk' ? buktiMasuk : buktiKeluar,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage(
      action === 'masuk' ? 'Masuk kota tercatat' : 'Keluar kota tercatat',
    )
    setCatatan('')
    setBuktiMasuk(null)
    setBuktiKeluar(null)
    await refresh()
  }

  const doAdmin = async () => {
    if (!member || !isAdmin) return
    const targetId = Number(adminMemberId)
    const target = members.find((m) => m.id === targetId)
    if (!target) {
      setError('Pilih member dulu')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await recordAbsenKota({
      action: adminAction,
      memberId: target.id,
      nama: target.nama,
      catatan: adminCatatan,
      actor: member.nama,
      photoFile: adminBukti,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage(`Absen ${adminAction} untuk ${target.nama} tersimpan`)
    setAdminBukti(null)
    setAdminCatatan('')
    await refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !isAdmin || !member) return
    setBusy(true)
    const res = await deleteAbsenKotaRow(deleteTarget, member)
    setBusy(false)
    setDeleteTarget(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage('Absen dihapus')
    await refresh()
  }

  const sessionOpen = !!(openSession && !openSession.jam_keluar_kota)
  const st = absenStatusLabel(openSession)

  return (
    <PageStack>
      <PageHeader
        title="Absen Kota"
        subtitle="Masuk / keluar kota + bukti foto"
      >
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="text-sm">Sesi kamu</CardTitle>
            <CardDescription className="mt-1">
              Masuk:{' '}
              <span className="font-mono text-emerald-400">
                {openSession?.jam_masuk_kota
                  ? fmtAbsenDateTime(openSession.jam_masuk_kota)
                  : '—'}
              </span>
              {' · '}
              Keluar:{' '}
              <span className="font-mono text-orange-400">
                {openSession?.jam_keluar_kota
                  ? fmtAbsenDateTime(openSession.jam_keluar_kota)
                  : '—'}
              </span>
            </CardDescription>
            <div className="mt-2">
              <AbsenStatusBadge tone={st.tone} text={st.text} />
            </div>
          </div>
          <p className="max-w-md text-xs text-muted-foreground">
            {sessionOpen
              ? 'Sesi aktif — upload bukti lalu tekan Keluar Kota.'
              : 'Setiap sesi: masuk kota → keluar kota. Boleh lewat tengah malam.'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>Catatan (opsional)</Label>
              <Input
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
              />
            </div>

            {!sessionOpen ? (
              <div className="flex flex-col gap-2">
                <Label>Bukti masuk</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBuktiMasuk(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Bukti keluar</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBuktiKeluar(e.target.files?.[0] ?? null)}
                />
              </div>
            )}

            <div className="flex items-end gap-2">
              <Button
                className="flex-1"
                disabled={busy || sessionOpen}
                onClick={() => void doSelf('masuk')}
              >
                Masuk Kota
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-orange-400"
                disabled={busy || !sessionOpen}
                onClick={() => void doSelf('keluar')}
              >
                Keluar Kota
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>Admin — absenkan member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label>Member</Label>
                <Select
                  value={
                    adminMemberId === '' ? '' : String(adminMemberId)
                  }
                  onValueChange={(v) =>
                    setAdminMemberId(v === '' ? '' : Number(v))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Aksi</Label>
                <div className="flex gap-1 rounded-lg border border-border/60 p-1">
                  {(['masuk', 'keluar'] as const).map((a) => (
                    <Button
                      key={a}
                      type="button"
                      variant={adminAction === a ? 'default' : 'ghost'}
                      size="sm"
                      className="flex-1 capitalize"
                      onClick={() => setAdminAction(a)}
                    >
                      {a}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Bukti</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setAdminBukti(e.target.files?.[0] ?? null)
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Catatan</Label>
                <Input
                  value={adminCatatan}
                  onChange={(e) => setAdminCatatan(e.target.value)}
                />
              </div>
            </div>

            <Button disabled={busy} onClick={() => void doAdmin()}>
              {busy ? 'Menyimpan…' : 'Simpan Absen Admin'}
            </Button>
          </CardContent>
        </Card>
      )}

      {error ? <ErrorState message={error} /> : null}
      {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="flex-row items-center justify-between space-y-0 gap-3">
          <div>
            <CardTitle>Daftar Absen</CardTitle>
            {isAdmin && (
              <CardDescription>
                Di kota: {inCity} · Selesai: {done}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="absen-tanggal" className="text-xs text-muted-foreground">
              Tanggal
            </Label>
            <Input
              id="absen-tanggal"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-auto"
            />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <LoadingState message="Memuat…" />
          ) : !rows.length ? (
            <EmptyState title="Belum ada data absen" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>Nama</TableHead>}
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Masuk</TableHead>
                  <TableHead>Keluar</TableHead>
                  <TableHead>Durasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bukti</TableHead>
                  {isAdmin && <TableHead className="text-right">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const label = absenStatusLabel(r)
                  const tgl = r.tanggal
                    ? r.tanggal.split('-').reverse().join('/')
                    : '—'
                  return (
                    <TableRow key={r.id}>
                      {isAdmin && (
                        <TableCell className="font-medium">{r.nama}</TableCell>
                      )}
                      <TableCell className="text-xs">{tgl}</TableCell>
                      <TableCell className="font-mono text-emerald-400">
                        {fmtAbsenTableTime(r.jam_masuk_kota, r.tanggal)}
                      </TableCell>
                      <TableCell className="font-mono text-orange-400">
                        {fmtAbsenTableTime(r.jam_keluar_kota, r.tanggal)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtAbsenDuration(
                          r.jam_masuk_kota,
                          r.jam_keluar_kota,
                        )}
                      </TableCell>
                      <TableCell>
                        <AbsenStatusBadge tone={label.tone} text={label.text} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.bukti_masuk_url ? (
                          <a
                            href={r.bukti_masuk_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            In
                          </a>
                        ) : (
                          '—'
                        )}
                        {' / '}
                        {r.bukti_keluar_url ? (
                          <a
                            href={r.bukti_keluar_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            Out
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => setDeleteTarget(r)}
                          >
                            Hapus
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="border-border/60 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus absen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Absen ${deleteTarget.nama} (${deleteTarget.tanggal}) akan dihapus permanen.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              Ya, hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageStack>
  )
}
