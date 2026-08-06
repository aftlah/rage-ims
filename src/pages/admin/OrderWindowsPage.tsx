import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatWindowDateTime } from '@/lib/format'
import {
  closeOrderWindow,
  decodeOrderanke,
  deleteOrderWindow,
  fetchAdminOrderWindows,
  formatOrderankeLabel,
  getWindowLiveStatus,
  setOrderWindowActive,
  toLocalInputValue,
  upsertOrderWindow,
  windowStatusLabel,
  type OrderWindow,
  type OrderWindowKind,
} from '@/lib/orderWindow'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const WEEKS = Array.from({ length: 5 }, (_, i) => i + 1)

function defaultEndLocal(hoursAhead = 24): string {
  return toLocalInputValue(new Date(Date.now() + hoursAhead * 60 * 60 * 1000))
}

function statusBadgeVariant(
  status: ReturnType<typeof getWindowLiveStatus>,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'open') return 'default'
  if (status === 'upcoming') return 'secondary'
  if (status === 'expired') return 'outline'
  return 'destructive'
}

export function OrderWindowsPage() {
  const [kind, setKind] = useState<OrderWindowKind>('order')
  const [rows, setRows] = useState<OrderWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [week, setWeek] = useState(1)
  const [startLocal, setStartLocal] = useState(toLocalInputValue())
  const [endLocal, setEndLocal] = useState(defaultEndLocal(kind === 'drugs' ? 168 : 24))
  const [isActive, setIsActive] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrderWindow | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchAdminOrderWindows(kind)
    setRows(res.data)
    if (res.error) setError(res.error)
    setLoading(false)
  }, [kind])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (editId) return
    setEndLocal(defaultEndLocal(kind === 'drugs' ? 168 : 24))
  }, [kind, editId])

  const openNow = useMemo(
    () => rows.find((r) => getWindowLiveStatus(r) === 'open') ?? null,
    [rows],
  )

  const resetForm = () => {
    setEditId(null)
    setMonth(new Date().getMonth() + 1)
    setWeek(1)
    setStartLocal(toLocalInputValue())
    setEndLocal(defaultEndLocal(kind === 'drugs' ? 168 : 24))
    setIsActive(true)
  }

  const startEdit = (row: OrderWindow) => {
    const decoded = decodeOrderanke(row.orderanke)
    setEditId(row.id)
    setMonth(decoded.m || new Date().getMonth() + 1)
    setWeek(decoded.w || 1)
    setStartLocal(toLocalInputValue(new Date(row.start_time)))
    setEndLocal(toLocalInputValue(new Date(row.end_time)))
    setIsActive(row.is_active)
    setMessage(null)
    setError(null)
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await upsertOrderWindow({
      month,
      week,
      kind,
      startLocal,
      endLocal,
      isActive,
      editId,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage(editId ? 'Jadwal diupdate' : 'Jadwal dibuat — periode dibuka')
    resetForm()
    await refresh()
  }

  const handleClose = async (row: OrderWindow) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await closeOrderWindow(row.id)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage(`Periode ${formatOrderankeLabel(row.orderanke)} ditutup`)
    if (editId === row.id) resetForm()
    await refresh()
  }

  const handleReactivate = async (row: OrderWindow) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await setOrderWindowActive(row.id, true)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage(`Periode ${formatOrderankeLabel(row.orderanke)} diaktifkan lagi`)
    await refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    setError(null)
    const res = await deleteOrderWindow(deleteTarget.id)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage('Jadwal dihapus')
    if (editId === deleteTarget.id) resetForm()
    setDeleteTarget(null)
    await refresh()
  }

  return (
    <PageStack>
      <PageHeader
        title="Order Window"
        subtitle="Buka / tutup periode order & drugs (tanpa Discord)"
      >
        <Button
          variant="outline"
          size="sm"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      {openNow ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">Sedang buka:</span>{' '}
          {formatOrderankeLabel(openNow.orderanke)} · sampai{' '}
          {formatWindowDateTime(openNow.end_time)}
          <Button
            size="sm"
            variant="destructive"
            className="ml-3"
            disabled={busy}
            onClick={() => void handleClose(openNow)}
          >
            Tutup sekarang
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Tidak ada periode aktif di tab ini.
        </div>
      )}

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}

      <Tabs
        value={kind}
        onValueChange={(v) => {
          setKind(v as OrderWindowKind)
          resetForm()
          setMessage(null)
          setError(null)
        }}
      >
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="order">Order</TabsTrigger>
          <TabsTrigger value="drugs">Drugs</TabsTrigger>
        </TabsList>

        <TabsContent value={kind} className="mt-4 space-y-5">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>
                {editId ? 'Edit jadwal' : 'Buka periode baru'}
              </CardTitle>
              <CardDescription>
                {kind === 'drugs'
                  ? 'Batch drugs (orderanke ≥ 1000). Membuat batch aktif akan menonaktifkan drugs window lain.'
                  : 'Periode order biasa (orderanke di bawah 1000). Member bisa submit saat status Aktif sekarang.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <Label>Bulan</Label>
                  <Select
                    value={String(month)}
                    onValueChange={(v) => setMonth(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Minggu</Label>
                  <Select
                    value={String(week)}
                    onValueChange={(v) => setWeek(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKS.map((w) => (
                        <SelectItem key={w} value={String(w)}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Mulai</Label>
                  <Input
                    type="datetime-local"
                    value={startLocal}
                    onChange={(e) => setStartLocal(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Selesai</Label>
                  <Input
                    type="datetime-local"
                    value={endLocal}
                    onChange={(e) => setEndLocal(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Aktifkan segera</p>
                  <p className="text-xs text-muted-foreground">
                    is_active = {isActive ? 'true' : 'false'}
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void handleSave()}>
                  {busy
                    ? 'Menyimpan…'
                    : editId
                      ? 'Update jadwal'
                      : 'Buka periode'}
                </Button>
                {editId ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={resetForm}
                  >
                    Batal edit
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle>Daftar jadwal</CardTitle>
              <CardDescription>
                {kind === 'drugs' ? 'Windows drugs' : 'Windows order'} · terbaru
                di atas
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <LoadingState message="Memuat jadwal…" />
              ) : error && !rows.length ? (
                <div className="px-6 pb-6">
                  <ErrorState message={error} />
                </div>
              ) : !rows.length ? (
                <EmptyState title="Belum ada jadwal" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Periode</TableHead>
                      <TableHead className="hidden sm:table-cell">Mulai</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Selesai
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const status = getWindowLiveStatus(row)
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {formatOrderankeLabel(row.orderanke)}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {formatWindowDateTime(row.start_time)}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            {formatWindowDateTime(row.end_time)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(status)}>
                              {windowStatusLabel(status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => startEdit(row)}
                              >
                                Edit
                              </Button>
                              {status === 'open' ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => void handleClose(row)}
                                >
                                  Tutup
                                </Button>
                              ) : null}
                              {status === 'nonaktif' || status === 'expired' ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void handleReactivate(row)}
                                >
                                  Aktifkan
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busy}
                                onClick={() => setDeleteTarget(row)}
                              >
                                Hapus
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus jadwal?"
        description={`Hapus periode ${formatOrderankeLabel(deleteTarget?.orderanke)}? Tindakan tidak dapat dibatalkan.`}
        confirmLabel="Ya, hapus"
        onConfirm={() => confirmDelete()}
      />
    </PageStack>
  )
}
