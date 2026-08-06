import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
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
import { fmtLocalDateTime } from '@/lib/dates'
import {
  calcDrugsSplits,
  deleteDrugsSales,
  DRUGS_JENIS,
  drugsPeriodeShort,
  fetchDrugsBatchOptions,
  fetchDrugsSales,
  filterDrugsRows,
  resolveCurrentDrugsBatch,
  submitDrugsSale,
  toggleDrugsPaid,
  type DrugsBatchOption,
  type DrugsPaidFilter,
  type DrugsSaleRow,
} from '@/lib/drugs'
import { fmtUsd } from '@/lib/format'
import { fetchMembersLite, type MemberLite } from '@/lib/membersLite'

export function DrugsPage() {
  const { member, isAdmin } = useAuth()
  const [members, setMembers] = useState<MemberLite[]>([])
  const [currentBatch, setCurrentBatch] = useState<number | null>(null)
  const [batchOptions, setBatchOptions] = useState<DrugsBatchOption[]>([])
  const [batchFilter, setBatchFilter] = useState('current')
  const [paidFilter, setPaidFilter] = useState<DrugsPaidFilter>('all')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<DrugsSaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DrugsSaleRow | null>(null)

  const [adminMemberId, setAdminMemberId] = useState<number | ''>('')
  const [duitMerah, setDuitMerah] = useState('')
  const [jenis, setJenis] = useState('Weed')
  const [jumlah, setJumlah] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editBatch, setEditBatch] = useState<number | null>(null)

  const splits = useMemo(() => {
    const n = parseFloat(duitMerah) || 0
    return calcDrugsSplits(n)
  }, [duitMerah])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const batch = await resolveCurrentDrugsBatch()
    setCurrentBatch(batch)
    const opts = await fetchDrugsBatchOptions(batch)
    setBatchOptions(opts.options)
    if (isAdmin) {
      const mem = await fetchMembersLite()
      setMembers(mem.data)
    }
    const res = await fetchDrugsSales({
      filterValue: batchFilter,
      options: opts.options,
    })
    setRows(res.data)
    if (res.error) setError(res.error)
    setLoading(false)
  }, [batchFilter, isAdmin])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visible = filterDrugsRows(rows, search, paidFilter)

  const resetForm = () => {
    setDuitMerah('')
    setJenis('Weed')
    setJumlah('')
    setEditId(null)
    setEditBatch(null)
  }

  const submit = async () => {
    if (!member) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const targetId = isAdmin ? Number(adminMemberId) : Number(member.id)
    const targetNama = isAdmin
      ? members.find((m) => m.id === targetId)?.nama || ''
      : member.nama
    const batch = editBatch || currentBatch || 0

    const res = await submitDrugsSale({
      memberId: targetId,
      nama: targetNama,
      duitMerah: parseFloat(duitMerah) || 0,
      jenis,
      jumlah: parseInt(jumlah, 10) || 0,
      batch,
      editId,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage(editId ? 'Data drugs diupdate' : 'Data drugs tersimpan')
    resetForm()
    await refresh()
  }

  const startEdit = (row: DrugsSaleRow) => {
    setEditId(row.id)
    setEditBatch(row.periode_orderanke)
    setDuitMerah(String(row.uang_merah || ''))
    setJenis(row.jenis || 'Weed')
    setJumlah(String(row.jumlah || ''))
    if (isAdmin) setAdminMemberId(row.member_id || '')
  }

  const onTogglePaid = async (row: DrugsSaleRow) => {
    setBusy(true)
    const res = await toggleDrugsPaid([row.id], !row.is_paid)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    await refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    const res = await deleteDrugsSales([deleteTarget.id])
    setBusy(false)
    setDeleteTarget(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage('Data drugs diarsipkan')
    await refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Drugs Sales</h2>
          <p className="page-subtitle">
            Setoran Weed / Meth / Opium — gaji putih & uang RAGE otomatis
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Batch aktif:{' '}
            {currentBatch
              ? drugsPeriodeShort(currentBatch)
              : 'tidak ada (buka window drugs)'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>
            {editId ? 'Edit Data Drugs' : 'Input Penjualan'}
          </CardTitle>
          <CardDescription>
            Gaji putih & uang RAGE dihitung otomatis dari duit merah
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isAdmin ? (
              <div className="flex flex-col gap-2">
                <Label>Member</Label>
                <Select
                  value={
                    adminMemberId === '' ? undefined : String(adminMemberId)
                  }
                  onValueChange={(v) => setAdminMemberId(Number(v))}
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
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Nama</Label>
                <Input readOnly value={member?.nama || '—'} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Jenis</Label>
              <Select value={jenis} onValueChange={setJenis}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DRUGS_JENIS.map((j) => (
                    <SelectItem key={j} value={j}>
                      {j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Jumlah</Label>
              <Input
                type="number"
                min={1}
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Duit merah</Label>
              <Input
                type="number"
                min={0}
                value={duitMerah}
                onChange={(e) => setDuitMerah(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Preview
              </p>
              <p className="mt-1 text-xs text-emerald-400">
                Gaji putih: {fmtUsd(splits.upahPutih)}
              </p>
              <p className="text-xs text-sky-400">
                Uang RAGE: {fmtUsd(splits.uangRage)}
              </p>
            </div>

            <div className="flex items-end gap-2">
              <Button
                disabled={busy}
                onClick={() => void submit()}
                className="flex-1"
              >
                {busy ? 'Menyimpan…' : editId ? 'Update' : 'Simpan'}
              </Button>
              {editId ? (
                <Button variant="outline" onClick={resetForm}>
                  Batal
                </Button>
              ) : null}
            </div>
          </div>

          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
          {message ? (
            <InlineMessage tone="success">{message}</InlineMessage>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label>Periode</Label>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {batchOptions.map((o) => (
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
                onValueChange={(v) => setPaidFilter(v as DrugsPaidFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="unpaid">Belum lunas</SelectItem>
                  <SelectItem value="paid">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Cari</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nama / jenis…"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Riwayat Drugs</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <LoadingState />
          ) : error && !rows.length ? (
            <div className="px-6">
              <ErrorState message={error} />
            </div>
          ) : !visible.length ? (
            <EmptyState title="Belum ada data penjualan" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Merah</TableHead>
                  <TableHead>Putih</TableHead>
                  <TableHead>RAGE</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.nama}</div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {drugsPeriodeShort(r.periode_orderanke)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {fmtLocalDateTime(r.waktu)}
                      </div>
                    </TableCell>
                    <TableCell>{r.jenis || '—'}</TableCell>
                    <TableCell className="font-mono">{r.jumlah || '—'}</TableCell>
                    <TableCell className="font-mono">
                      {fmtUsd(r.uang_merah)}
                    </TableCell>
                    <TableCell className="font-mono text-emerald-400">
                      {fmtUsd(r.upah_putih)}
                    </TableCell>
                    <TableCell className="font-mono text-sky-400">
                      {fmtUsd(r.uang_rage)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        className="h-auto p-0"
                        onClick={() => void onTogglePaid(r)}
                      >
                        <Badge variant={r.is_paid ? 'default' : 'destructive'}>
                          {r.is_paid ? 'LUNAS' : 'BELUM'}
                        </Badge>
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => startEdit(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy}
                          onClick={() => setDeleteTarget(r)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
            <AlertDialogTitle>Hapus data drugs?</AlertDialogTitle>
            <AlertDialogDescription>
              Data penjualan {deleteTarget?.nama ?? ''} akan diarsipkan
              (soft-delete).
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
    </div>
  )
}
