import { useCallback, useEffect, useMemo, useState } from 'react'
import { Megaphone, RefreshCw } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { PageHeader } from '@/components/layout/PageHeader'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { fmtLocalDateTime } from '@/lib/dates'
import { fmtIdMoney } from '@/lib/format'
import { fetchMembersLite, type MemberLite } from '@/lib/membersLite'
import {
  calcUangPutih,
  canDeleteNitipCuciRow,
  deleteNitipCuciRow,
  fetchNitipCuciLogs,
  fetchNitipPeriodeOptions,
  filterNitipByPaid,
  resolveNitipPeriodeFilter,
  submitNitipCuci,
  toggleNitipPaid,
  type NitipCuciRow,
  type NitipPaidFilter,
  type NitipPeriodeOption,
} from '@/lib/nitipCuci'
import {
  canDeleteStoranRow,
  deleteStoranRow,
  fetchStoranPeriodeOptions,
  fetchStoranRekap,
  getStoranCalendarWeekPeriod,
  upsertStoran,
  type StoranRekapRow,
  type StoranStatus,
} from '@/lib/storan'
import { shareStoranRekapToDiscord } from '@/lib/discordShares'

type Tab = 'mingguan' | 'nitip'

export function StoranPage() {
  const [tab, setTab] = useState<Tab>('mingguan')

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as Tab)}
      className="page-stack flex flex-col"
    >
      <PageHeader
        title="Storan"
        subtitle="Mingguan & nitip cuci (mirror query lama)"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="mingguan">Mingguan</TabsTrigger>
          <TabsTrigger value="nitip">Nitip Cuci</TabsTrigger>
        </TabsList>
      </PageHeader>

      <TabsContent value="mingguan" className="mt-0 flex flex-col gap-5">
        <StoranMingguanPanel />
      </TabsContent>
      <TabsContent value="nitip" className="mt-0 flex flex-col gap-5">
        <NitipCuciPanel />
      </TabsContent>
    </Tabs>
  )
}

function StoranMingguanPanel() {
  const { member, isAdmin } = useAuth()
  const toast = useToast()
  const current = useMemo(() => getStoranCalendarWeekPeriod(), [])
  const [periodeValue, setPeriodeValue] = useState<number | 'current'>(
    'current',
  )
  const [periodeOptions, setPeriodeOptions] = useState<
    Array<{ value: number; label: string }>
  >([])
  const [rows, setRows] = useState<StoranRekapRow[]>([])
  const [members, setMembers] = useState<MemberLite[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StoranRekapRow | null>(null)

  const [status, setStatus] = useState<StoranStatus>('SUDAH')
  const [penerima, setPenerima] = useState('')
  const [adminMemberId, setAdminMemberId] = useState<number | ''>('')

  const resolvedPeriode =
    periodeValue === 'current' ? current.periodeValue : periodeValue
  const isCurrent = periodeValue === 'current'

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const opts = await fetchStoranPeriodeOptions()
    setPeriodeOptions(opts.options)
    const res = await fetchStoranRekap(resolvedPeriode)
    setRows(res.rows)
    setMembers(res.members)
    if (res.error) setError(res.error)
    setLoading(false)
  }, [resolvedPeriode])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const doneCount = rows.filter((r) => r.statusRaw === 'SUDAH').length
  const pendingCount = rows.length - doneCount

  const submit = async () => {
    if (!member) return
    setBusy(true)

    const targetId = isAdmin
      ? Number(adminMemberId)
      : Number(member.id)
    const targetNama = isAdmin
      ? members.find((m) => m.id === targetId)?.nama || ''
      : member.nama

    const res = await upsertStoran({
      memberId: targetId,
      nama: targetNama,
      status,
      penerima,
      periodeValue: isCurrent ? undefined : resolvedPeriode,
    })
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Storan tersimpan')
    setPenerima('')
    await refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (!canDeleteStoranRow(deleteTarget, member)) return
    setBusy(true)
    const res = await deleteStoranRow(deleteTarget, member)
    setBusy(false)
    setDeleteTarget(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Storan dihapus')
    await refresh()
  }

  return (
    <>
      <Card className="border-border/60 bg-card/80">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:min-w-[200px]">
              <Label>Periode</Label>
              <Select
                value={
                  periodeValue === 'current' ? 'current' : String(periodeValue)
                }
                onValueChange={(v) => {
                  setPeriodeValue(v === 'current' ? 'current' : Number(v))
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">
                    Minggu ini — {current.label}
                  </SelectItem>
                  {periodeOptions
                    .filter((o) => o.value !== current.periodeValue)
                    .map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy || loading}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    const res = await shareStoranRekapToDiscord(resolvedPeriode)
                    setBusy(false)
                    if (!res.ok) {
                      toast.error(res.error)
                      return
                    }
                    toast.success('Rekap storan dikirim ke Discord')
                  })()
                }}
              >
                <Megaphone className="size-4" />
                Announce rekap
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total" value={String(rows.length)} />
            <StatCard label="Sudah" value={String(doneCount)} tone="ok" />
            <StatCard label="Belum" value={String(pendingCount)} tone="warn" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>
            {isCurrent ? 'Input Storan Minggu Ini' : 'Input Storan (periode dipilih)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {isAdmin ? (
              <div className="flex flex-col gap-2">
                <Label>Member</Label>
                <Select
                  value={adminMemberId === '' ? 'none' : String(adminMemberId)}
                  onValueChange={(v) =>
                    setAdminMemberId(v === 'none' ? '' : Number(v))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih member</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Nama</Label>
                <Input readOnly value={member?.nama || '—'} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Status</Label>
              <div className="flex gap-1 rounded-lg border border-border/60 bg-muted p-1">
                {(['SUDAH', 'BELUM'] as StoranStatus[]).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={status === s ? 'default' : 'ghost'}
                    size="sm"
                    className={`flex-1 ${
                      status === s
                        ? s === 'SUDAH'
                          ? 'bg-emerald-600 hover:bg-emerald-600'
                          : 'bg-amber-600 hover:bg-amber-600'
                        : ''
                    }`}
                    onClick={() => setStatus(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Penerima</Label>
              <Input
                value={penerima}
                onChange={(e) => setPenerima(e.target.value)}
                disabled={status !== 'SUDAH'}
                placeholder={status === 'SUDAH' ? 'Nama penerima' : '—'}
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                disabled={busy}
                className="w-full"
                onClick={() => void submit()}
              >
                {busy ? 'Menyimpan…' : 'Kirim Storan'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>
            {isCurrent ? 'Rekap Storan Minggu Ini' : 'Rekap Storan (History)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <LoadingState />
          ) : !rows.length ? (
            <EmptyState title="Belum ada member" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Penerima</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.memberId}>
                    <TableCell className="font-medium">{r.nama}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.statusRaw === 'SUDAH' ? 'default' : 'secondary'
                        }
                        className={
                          r.statusRaw === 'SUDAH'
                            ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15'
                            : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/15'
                        }
                      >
                        {r.statusRaw}
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.statusLabel}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.penerima || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.waktu || '—'}
                    </TableCell>
                    <TableCell>
                      {canDeleteStoranRow(r, member) && r.id ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => setDeleteTarget(r)}
                        >
                          Hapus
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus storan?"
        description={`Hapus storan ${deleteTarget?.nama}? Status kembali ke Belum.`}
        confirmLabel="Ya, hapus"
        onConfirm={() => confirmDelete()}
      />
    </>
  )
}

function NitipCuciPanel() {
  const { member, isAdmin } = useAuth()
  const toast = useToast()
  const [members, setMembers] = useState<MemberLite[]>([])
  const [periodeOptions, setPeriodeOptions] = useState<NitipPeriodeOption[]>(
    [],
  )
  const [periodeFilter, setPeriodeFilter] = useState('current')
  const [paidFilter, setPaidFilter] = useState<NitipPaidFilter>('all')
  const [rows, setRows] = useState<NitipCuciRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NitipCuciRow | null>(null)

  const [adminMemberId, setAdminMemberId] = useState<number | ''>('')
  const [uangMerah, setUangMerah] = useState('')
  const [keterangan, setKeterangan] = useState('Nitip cuci')
  const [buktiFile, setBuktiFile] = useState<File | null>(null)

  const putihPreview = useMemo(() => {
    const raw = uangMerah.replace(/\./g, '').replace(/,/g, '')
    const n = parseFloat(raw)
    if (!Number.isFinite(n) || n <= 0) return 0
    return calcUangPutih(n)
  }, [uangMerah])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [mem, opts] = await Promise.all([
      fetchMembersLite(),
      fetchNitipPeriodeOptions(),
    ])
    setMembers(mem.data)
    setPeriodeOptions(opts.options)
    const periodeValue = resolveNitipPeriodeFilter(
      periodeFilter,
      opts.options,
    )
    const res = await fetchNitipCuciLogs(periodeValue)
    setRows(res.data)
    if (res.error) setError(res.error)
    setLoading(false)
  }, [periodeFilter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = filterNitipByPaid(rows, paidFilter)
  const stats = useMemo(() => {
    let totalMerah = 0
    let totalPutih = 0
    let countPaid = 0
    let countUnpaid = 0
    let putihBelum = 0
    let putihSudah = 0
    for (const r of rows) {
      totalMerah += r.uang_merah
      totalPutih += r.uang_putih
      if (r.is_paid) {
        countPaid += 1
        putihSudah += r.uang_putih
      } else {
        countUnpaid += 1
        putihBelum += r.uang_putih
      }
    }
    return {
      totalMerah,
      totalPutih,
      countPaid,
      countUnpaid,
      putihBelum,
      putihSudah,
    }
  }, [rows])

  const submit = async () => {
    if (!member) return
    setBusy(true)
    const targetId = isAdmin ? Number(adminMemberId) : Number(member.id)
    const targetNama = isAdmin
      ? members.find((m) => m.id === targetId)?.nama || ''
      : member.nama

    const res = await submitNitipCuci({
      memberId: targetId,
      nama: targetNama,
      uangMerahRaw: uangMerah,
      keterangan,
      buktiFile,
    })
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Nitip cuci tersimpan')
    setUangMerah('')
    setKeterangan('Nitip cuci')
    setBuktiFile(null)
    await refresh()
  }

  const onTogglePaid = async (row: NitipCuciRow) => {
    if (!isAdmin) return
    setBusy(true)
    const res = await toggleNitipPaid(row.id, !row.is_paid, isAdmin)
    setBusy(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    await refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (!canDeleteNitipCuciRow(deleteTarget, member)) return
    setBusy(true)
    const res = await deleteNitipCuciRow(deleteTarget, member)
    setBusy(false)
    setDeleteTarget(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Nitip cuci dihapus')
    await refresh()
  }

  return (
    <>
      <Card className="border-border/60 bg-card/80">
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label>Periode</Label>
              <Select value={periodeFilter} onValueChange={setPeriodeFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Status bayar</Label>
              <Select
                value={paidFilter}
                onValueChange={(v) => setPaidFilter(v as NitipPaidFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="unpaid">Belum dikasih</SelectItem>
                  <SelectItem value="paid">Sudah dikasih</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
              >
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Merah"
              value={fmtIdMoney(stats.totalMerah)}
              tone="warn"
            />
            <StatCard
              label="Total Putih"
              value={fmtIdMoney(stats.totalPutih)}
              tone="ok"
            />
            <StatCard
              label="Belum dikasih"
              value={`${stats.countUnpaid} · ${fmtIdMoney(stats.putihBelum)}`}
            />
            <StatCard
              label="Sudah dikasih"
              value={`${stats.countPaid} · ${fmtIdMoney(stats.putihSudah)}`}
              tone="ok"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Input Nitip Cuci</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isAdmin ? (
              <div className="flex flex-col gap-2">
                <Label>Member</Label>
                <Select
                  value={adminMemberId === '' ? 'none' : String(adminMemberId)}
                  onValueChange={(v) =>
                    setAdminMemberId(v === 'none' ? '' : Number(v))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih member</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Nama</Label>
                <Input readOnly value={member?.nama || '—'} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Uang merah</Label>
              <Input
                value={uangMerah}
                onChange={(e) => setUangMerah(e.target.value)}
                placeholder="Contoh: 1000000"
              />
              <span className="text-xs text-muted-foreground">
                Putih (65%): {fmtIdMoney(putihPreview)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Keterangan</Label>
              <Input
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Bukti screenshot</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setBuktiFile(e.target.files?.[0] ?? null)
                }
              />
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                disabled={busy}
                className="w-full"
                onClick={() => void submit()}
              >
                {busy ? 'Menyimpan…' : 'Kirim Nitip'}
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Daftar Nitip Cuci</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <LoadingState />
          ) : !visible.length ? (
            <EmptyState
              title="Belum ada nitip cuci"
              message="Belum ada nitip cuci di filter ini"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Merah</TableHead>
                  <TableHead>Putih</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bukti</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow
                    key={r.id}
                    className={r.is_paid ? '' : 'bg-amber-500/5'}
                  >
                    <TableCell className="font-medium">{r.nama}</TableCell>
                    <TableCell className="font-mono text-red-400">
                      {fmtIdMoney(r.uang_merah)}
                    </TableCell>
                    <TableCell className="font-mono text-emerald-400">
                      {fmtIdMoney(r.uang_putih)}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          className={
                            r.is_paid
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                              : 'border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                          }
                          onClick={() => void onTogglePaid(r)}
                        >
                          {r.is_paid ? 'SUDAH' : 'BELUM'}
                        </Button>
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            r.is_paid
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                              : 'border-red-500/30 bg-red-500/15 text-red-300'
                          }
                        >
                          {r.is_paid ? 'SUDAH' : 'BELUM'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.image_url ? (
                        <a
                          href={r.image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Lihat
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtLocalDateTime(r.waktu)}
                    </TableCell>
                    <TableCell>
                      {canDeleteNitipCuciRow(r, member) ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => setDeleteTarget(r)}
                        >
                          Hapus
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus nitip cuci?"
        description={`Hapus nitip cuci ${deleteTarget?.nama}?`}
        confirmLabel="Ya, hapus"
        onConfirm={() => confirmDelete()}
      />
    </>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'ok' | 'warn'
}) {
  const color =
    tone === 'ok'
      ? 'text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : 'text-foreground'
  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="pt-6 text-center">
        <CardDescription className="text-[10px] tracking-widest uppercase">
          {label}
        </CardDescription>
        <p className={`mt-1 font-mono text-sm font-semibold ${color}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
