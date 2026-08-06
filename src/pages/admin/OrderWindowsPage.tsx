import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  CircleOff,
  MoreHorizontal,
  Pencil,
  Power,
  RefreshCw,
  Trash2,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { cn } from '@/lib/utils'
import { formatWindowDateTime } from '@/lib/format'
import {
  closeOrderWindow,
  decodeOrderanke,
  deleteOrderWindow,
  encodeOrderanke,
  fetchActiveOrderWindow,
  fetchAdminOrderWindows,
  formatOrderankeLabel,
  getWindowLiveStatus,
  setOrderWindowActive,
  toLocalInputValue,
  upsertOrderWindow,
  windowStatusLabel,
  type OrderWindow,
  type OrderWindowKind,
  type WindowLiveStatus,
} from '@/lib/orderWindow'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const WEEKS = Array.from({ length: 5 }, (_, i) => i + 1)

const DURATION_PRESETS = [
  { label: '6 jam', hours: 6 },
  { label: '12 jam', hours: 12 },
  { label: '1 hari', hours: 24 },
  { label: '3 hari', hours: 72 },
  { label: '7 hari', hours: 168 },
] as const

function defaultEndLocal(hoursAhead = 24): string {
  return toLocalInputValue(new Date(Date.now() + hoursAhead * 60 * 60 * 1000))
}

function statusTone(status: WindowLiveStatus) {
  switch (status) {
    case 'open':
      return {
        badge: 'default' as const,
        card: 'border-emerald-500/30 bg-emerald-500/10',
        text: 'text-emerald-300',
        dot: 'bg-emerald-400',
      }
    case 'upcoming':
      return {
        badge: 'secondary' as const,
        card: 'border-sky-500/25 bg-sky-500/8',
        text: 'text-sky-300',
        dot: 'bg-sky-400',
      }
    case 'expired':
      return {
        badge: 'outline' as const,
        card: 'border-border/50 bg-muted/20',
        text: 'text-muted-foreground',
        dot: 'bg-muted-foreground',
      }
    default:
      return {
        badge: 'destructive' as const,
        card: 'border-border/50 bg-muted/15',
        text: 'text-muted-foreground',
        dot: 'bg-muted-foreground/60',
      }
  }
}

export function OrderWindowsPage() {
  const formRef = useRef<HTMLDivElement>(null)
  const [kind, setKind] = useState<OrderWindowKind>('order')
  const [rows, setRows] = useState<OrderWindow[]>([])
  const [openByKind, setOpenByKind] = useState<{
    order: OrderWindow | null
    drugs: OrderWindow | null
  }>({ order: null, drugs: null })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [week, setWeek] = useState(1)
  const [startLocal, setStartLocal] = useState(toLocalInputValue())
  const [endLocal, setEndLocal] = useState(
    defaultEndLocal(kind === 'drugs' ? 168 : 24),
  )
  const [openImmediately, setOpenImmediately] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrderWindow | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [listRes, orderActive, drugsActive] = await Promise.all([
      fetchAdminOrderWindows(kind),
      fetchActiveOrderWindow('order'),
      fetchActiveOrderWindow('drugs'),
    ])
    setRows(listRes.data)
    setOpenByKind({
      order: orderActive.window,
      drugs: drugsActive.window,
    })
    if (listRes.error) setError(listRes.error)
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
    () => openByKind[kind] ?? rows.find((r) => getWindowLiveStatus(r) === 'open') ?? null,
    [kind, openByKind, rows],
  )

  const upcoming = useMemo(
    () => rows.filter((r) => getWindowLiveStatus(r) === 'upcoming'),
    [rows],
  )

  const periodPreview = useMemo(
    () => formatOrderankeLabel(encodeOrderanke(month, week, kind)),
    [month, week, kind],
  )

  const kindLabel = kind === 'drugs' ? 'Drugs' : 'Order'

  const resetForm = () => {
    setEditId(null)
    setMonth(new Date().getMonth() + 1)
    setWeek(1)
    setStartLocal(toLocalInputValue())
    setEndLocal(defaultEndLocal(kind === 'drugs' ? 168 : 24))
    setOpenImmediately(true)
  }

  const switchKind = (tabKind: OrderWindowKind) => {
    if (kind === tabKind) return
    setKind(tabKind)
    resetForm()
    setMessage(null)
    setError(null)
  }

  const applyDuration = (hours: number) => {
    const start = startLocal ? new Date(startLocal) : new Date()
    if (Number.isNaN(start.getTime())) return
    setStartLocal(toLocalInputValue(start))
    setEndLocal(
      toLocalInputValue(new Date(start.getTime() + hours * 60 * 60 * 1000)),
    )
  }

  const startEdit = (row: OrderWindow) => {
    const decoded = decodeOrderanke(row.orderanke)
    setEditId(row.id)
    setMonth(decoded.m || new Date().getMonth() + 1)
    setWeek(decoded.w || 1)
    setStartLocal(toLocalInputValue(new Date(row.start_time)))
    setEndLocal(toLocalInputValue(new Date(row.end_time)))
    setOpenImmediately(row.is_active)
    setMessage(null)
    setError(null)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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
      isActive: openImmediately,
      editId,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage(
      editId
        ? `Jadwal ${periodPreview} berhasil diubah`
        : openImmediately
          ? `Periode ${periodPreview} dibuka`
          : `Jadwal ${periodPreview} disimpan (belum aktif)`,
    )
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
    setMessage(`Periode ${formatOrderankeLabel(row.orderanke)} diaktifkan`)
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
        title="Periode Order"
        subtitle="Atur kapan member boleh order. Buka periode → member submit → tutup jika selesai."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      {/* Switcher penuh — status BUKA/TUTUP terlihat jelas */}
      <div
        role="tablist"
        aria-label="Jenis periode"
        className="grid grid-cols-2 gap-2"
      >
        {(
          [
            { key: 'order' as const, label: 'Order' },
            { key: 'drugs' as const, label: 'Drugs' },
          ] as const
        ).map(({ key, label }) => {
          const selected = kind === key
          const openWin = openByKind[key]
          const isOpen = !!openWin
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => switchKind(key)}
              className={cn(
                'flex flex-col gap-2 rounded-2xl border px-3 py-3 text-left transition-all sm:px-4 sm:py-3.5',
                selected
                  ? 'border-primary/50 bg-primary/15 ring-2 ring-primary/40'
                  : 'border-border/50 bg-card/60 hover:border-border hover:bg-card/80',
                isOpen && !selected && 'border-emerald-500/40 bg-emerald-500/10',
                isOpen && selected && 'border-emerald-500/60 ring-emerald-500/35',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm font-bold sm:text-base',
                    selected ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase',
                    isOpen
                      ? 'bg-emerald-500 text-emerald-950'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isOpen ? (
                    <>
                      <span className="size-1.5 animate-pulse rounded-full bg-emerald-950" />
                      Buka
                    </>
                  ) : (
                    'Tutup'
                  )}
                </span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                {isOpen
                  ? `Aktif: ${formatOrderankeLabel(openWin.orderanke)}`
                  : 'Tidak ada periode aktif'}
              </p>
            </button>
          )
        })}
      </div>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}

      {/* 1. Status sekarang */}
      <Card
        className={cn(
          'border-border/60',
          openNow
            ? 'border-emerald-500/35 bg-gradient-to-br from-emerald-500/15 to-card/80'
            : 'bg-card/80',
        )}
      >
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                'mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl',
                openNow
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {openNow ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <CircleOff className="size-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Status {kindLabel} sekarang
              </p>
              {openNow ? (
                <>
                  <p className="mt-1 text-xl font-bold tracking-tight text-emerald-300">
                    Sedang dibuka
                  </p>
                  <p className="mt-1 text-sm text-foreground/90">
                    Periode{' '}
                    <span className="font-semibold text-primary">
                      {formatOrderankeLabel(openNow.orderanke)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Tutup otomatis{' '}
                    {formatWindowDateTime(openNow.end_time)}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-xl font-bold tracking-tight">
                    Sedang ditutup
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Member belum bisa submit {kindLabel.toLowerCase()}. Buka
                    periode di bawah.
                  </p>
                  {upcoming.length > 0 ? (
                    <p className="mt-1 text-xs text-sky-300">
                      {upcoming.length} jadwal terjadwal (belum mulai)
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {openNow ? (
            <Button
              variant="destructive"
              className="w-full shrink-0 sm:w-auto"
              disabled={busy}
              onClick={() => void handleClose(openNow)}
            >
              <Power className="size-4" />
              Tutup sekarang
            </Button>
          ) : (
            <Button
              className="w-full shrink-0 sm:w-auto"
              disabled={busy}
              onClick={() =>
                formRef.current?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }
            >
              <CalendarClock className="size-4" />
              Buat periode
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 2. Form buka / edit */}
      <div ref={formRef} className="scroll-mt-4">
      <Card
        className={cn(
          'border-border/60 bg-card/80',
          editId && 'ring-1 ring-primary/30',
        )}
      >
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {editId ? 'Edit jadwal' : `Buka periode ${kindLabel}`}
              </CardTitle>
              <CardDescription className="mt-1">
                {editId
                  ? 'Ubah waktu atau status, lalu simpan.'
                  : 'Pilih periode (bulan & minggu), atur waktu, lalu buka.'}
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-primary">
              {periodPreview}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <section className="space-y-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              1 · Periode
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
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
                        Bulan {m}
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
                        Minggu {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              2 · Waktu
            </p>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((p) => (
                <Button
                  key={p.hours}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => applyDuration(p.hours)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
          </section>

          <section className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Langsung buka untuk member</p>
              <p className="text-xs text-muted-foreground">
                Matikan jika hanya menyimpan jadwal untuk nanti
              </p>
            </div>
            <Switch
              checked={openImmediately}
              onCheckedChange={setOpenImmediately}
            />
          </section>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {editId ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={resetForm}
                className="sm:min-w-28"
              >
                Batal
              </Button>
            ) : null}
            <Button
              disabled={busy}
              onClick={() => void handleSave()}
              className="sm:min-w-40"
            >
              {busy
                ? 'Menyimpan…'
                : editId
                  ? 'Simpan perubahan'
                  : openImmediately
                    ? `Buka ${periodPreview}`
                    : 'Simpan jadwal'}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* 3. Riwayat */}
      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Riwayat jadwal</CardTitle>
          <CardDescription>
            Semua periode {kindLabel.toLowerCase()} · yang baru di atas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Memuat jadwal…" />
          ) : error && !rows.length ? (
            <ErrorState message={error} />
          ) : !rows.length ? (
            <EmptyState
              title="Belum ada jadwal"
              message={`Buka periode ${kindLabel.toLowerCase()} pertama lewat form di atas.`}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {rows.map((row) => {
                const status = getWindowLiveStatus(row)
                const tone = statusTone(status)
                const isLiveOpen = status === 'open'
                return (
                  <li
                    key={row.id}
                    className={cn(
                      'rounded-xl border px-3.5 py-3 transition-colors sm:px-4',
                      tone.card,
                      editId === row.id && 'ring-1 ring-primary/40',
                      isLiveOpen && 'ring-1 ring-emerald-400/50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'size-2 shrink-0 rounded-full',
                              tone.dot,
                              isLiveOpen && 'animate-pulse',
                            )}
                            aria-hidden
                          />
                          <p className="font-semibold tracking-tight">
                            {formatOrderankeLabel(row.orderanke)}
                          </p>
                          <Badge
                            variant={tone.badge}
                            className={cn(
                              'text-[10px]',
                              isLiveOpen && 'bg-emerald-500 text-emerald-950',
                            )}
                          >
                            {isLiveOpen ? '● Sedang buka' : windowStatusLabel(status)}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground sm:text-[13px]">
                          <span className="hidden sm:inline">Mulai </span>
                          {formatWindowDateTime(row.start_time)}
                          <span className="mx-1.5 text-border">→</span>
                          <span className="hidden sm:inline">Selesai </span>
                          {formatWindowDateTime(row.end_time)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {status === 'open' ? (
                          <Button
                            size="sm"
                            variant="destructive"
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

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={busy}
                              aria-label="Aksi lain"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => startEdit(row)}>
                              <Pencil className="size-4" />
                              Edit jadwal
                            </DropdownMenuItem>
                            {status !== 'open' && status !== 'nonaktif' ? (
                              <DropdownMenuItem
                                onClick={() => void handleReactivate(row)}
                              >
                                <Power className="size-4" />
                                Aktifkan
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(row)}
                            >
                              <Trash2 className="size-4" />
                              Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus jadwal?"
        description={`Hapus periode ${formatOrderankeLabel(deleteTarget?.orderanke)}? Tidak bisa dibatalkan.`}
        confirmLabel="Ya, hapus"
        onConfirm={() => confirmDelete()}
      />
    </PageStack>
  )
}
