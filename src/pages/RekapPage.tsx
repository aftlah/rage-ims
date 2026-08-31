import { useMemo, useState } from 'react'
import { Eye, Megaphone, RefreshCw, Send } from 'lucide-react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
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
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StatusBlock'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRekapOrders } from '@/features/rekap/useRekapOrders'
import {
  shareDashboardFromRows,
  sharePaymentStatusFromRows,
} from '@/lib/discordShares'
import { fmtUsd } from '@/lib/format'
import { formatOrderankeLabel } from '@/lib/orderWindow'
import {
  type DeliveredFilter,
  type OrderGroup,
  type OrderRow,
} from '@/lib/rekapOrders'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const WEEKS = Array.from({ length: 5 }, (_, i) => i + 1)

function deliveredLabel(group: OrderGroup): string {
  if (group.allDelivered) return 'Sudah'
  if (group.deliveredCount === 0) return 'Belum'
  return `${group.deliveredCount}/${group.lineCount}`
}

function RekapOrderTable({
  groups,
  isAdmin,
  busyId,
  memberNama,
  onDetail,
  onTogglePaid,
  onToggleScrapGiven,
}: {
  groups: OrderGroup[]
  isAdmin: boolean
  busyId: number | null
  memberNama?: string
  onDetail: (group: OrderGroup) => void
  onTogglePaid: (row: OrderRow, actor?: string) => void | Promise<void>
  onToggleScrapGiven: (row: OrderRow) => void | Promise<void>
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead className="hidden md:table-cell">Waktu</TableHead>
          <TableHead className="text-center">Item</TableHead>
          <TableHead className="text-center">Qty</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-center">Delivered</TableHead>
          <TableHead className="text-center">Metal Scrap</TableHead>
          <TableHead className="text-center">Bayar</TableHead>
          <TableHead className="text-right">Detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.key}>
            <TableCell className="font-medium">{group.nama}</TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {group.waktu ? new Date(group.waktu).toLocaleString() : '—'}
            </TableCell>
            <TableCell className="text-center text-muted-foreground">
              {group.lineCount}
            </TableCell>
            <TableCell className="text-center text-muted-foreground">
              {group.qty}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {fmtUsd(group.total)}
            </TableCell>
            <TableCell className="text-center">
              <Badge
                variant={
                  group.allDelivered
                    ? 'default'
                    : group.deliveredCount > 0
                      ? 'outline'
                      : 'secondary'
                }
              >
                {deliveredLabel(group)}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {group.periodScrapTotal === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : isAdmin ? (
                <Button
                  variant={group.periodScrapGiven ? 'default' : 'outline'}
                  size="sm"
                  disabled={group.lines.some((l) => busyId === l.id)}
                  title={`${group.periodScrapTotal} scrap periode`}
                  onClick={() => void onToggleScrapGiven(group.lines[0])}
                >
                  {group.periodScrapGiven ? 'Sudah' : 'Belum'}
                </Button>
              ) : (
                <Badge
                  variant={group.periodScrapGiven ? 'default' : 'secondary'}
                  title={`${group.periodScrapTotal} scrap periode`}
                >
                  {group.periodScrapGiven ? 'Sudah' : 'Belum'}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-center">
              {isAdmin ? (
                <Button
                  variant={group.paid ? 'default' : 'outline'}
                  size="sm"
                  disabled={group.lines.some((l) => busyId === l.id)}
                  onClick={() =>
                    void onTogglePaid(group.lines[0], memberNama)
                  }
                >
                  {group.paid ? 'Lunas' : 'Belum'}
                </Button>
              ) : (
                <Badge variant={group.paid ? 'default' : 'secondary'}>
                  {group.paid ? 'Lunas' : 'Belum'}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDetail(group)}
              >
                <Eye className="size-4" />
                <span className="hidden sm:inline">Detail</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function RekapOrderDetailDialog({
  group,
  isAdmin,
  busyId,
  onClose,
  onToggleDelivered,
  onArchive,
}: {
  group: OrderGroup
  isAdmin: boolean
  busyId: number | null
  onClose: () => void
  onToggleDelivered: (row: OrderRow) => void | Promise<void>
  onArchive: (row: OrderRow) => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail Order — {group.nama}</DialogTitle>
          <DialogDescription>
            {formatOrderankeLabel(group.orderanke)} ·{' '}
            {group.order_no || group.order_id || '—'} · {group.lineCount} item ·{' '}
            {fmtUsd(group.total)}
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-center">Delivered</TableHead>
              {isAdmin ? (
                <TableHead className="text-right">Aksi</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.lines.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.item}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {row.qty}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtUsd(row.subtotal)}
                </TableCell>
                <TableCell className="text-center">
                  {isAdmin ? (
                    <Button
                      variant={row.delivered ? 'default' : 'secondary'}
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void onToggleDelivered(row)}
                    >
                      {row.delivered ? 'Sudah' : 'Belum'}
                    </Button>
                  ) : (
                    <Badge variant={row.delivered ? 'default' : 'secondary'}>
                      {row.delivered ? 'Sudah' : 'Belum'}
                    </Badge>
                  )}
                </TableCell>
                {isAdmin ? (
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => onArchive(row)}
                    >
                      Arsip
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-center font-semibold">
                {group.qty}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {fmtUsd(group.total)}
              </TableCell>
              <TableCell colSpan={isAdmin ? 2 : 1} />
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}

export function RekapPage() {
  const { member, isAdmin } = useAuth()
  const toast = useToast()
  const {
    month,
    setMonth,
    week,
    setWeek,
    name,
    setName,
    item,
    setItem,
    delivered,
    setDelivered,
    loading,
    error,
    busyId,
    filtered,
    stats,
    orderGroups,
    orderPeriodSections,
    refresh,
    toggleDelivered,
    togglePaid,
    toggleScrapGiven,
    archiveRow,
  } = useRekapOrders({
    isAdmin,
    memberNama: member?.nama ?? null,
  })

  const [detailGroup, setDetailGroup] = useState<OrderGroup | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<OrderRow | null>(null)
  const [shareBusy, setShareBusy] = useState(false)

  const liveDetailGroup = useMemo(() => {
    if (!detailGroup) return null
    return orderGroups.find((g) => g.key === detailGroup.key) ?? null
  }, [detailGroup, orderGroups])

  const confirmArchive = async () => {
    if (!archiveTarget) return
    await archiveRow(archiveTarget)
    setArchiveTarget(null)
    if (liveDetailGroup && liveDetailGroup.lines.length <= 1) {
      setDetailGroup(null)
    }
  }

  const handleShareDashboard = async () => {
    setShareBusy(true)
    const res = await shareDashboardFromRows(filtered, {
      month,
      week: week != null ? String(week) : undefined,
      name: isAdmin ? name || undefined : member?.nama || undefined,
    })
    setShareBusy(false)
    if (res.ok) toast.success('Ringkasan dikirim ke Discord')
    else toast.error(res.error)
  }

  const handleSharePayment = async () => {
    setShareBusy(true)
    const res = await sharePaymentStatusFromRows(filtered, {
      month,
      week: week != null ? String(week) : undefined,
      name: isAdmin ? name || undefined : member?.nama || undefined,
    })
    setShareBusy(false)
    if (res.ok) toast.success('Status bayar dikirim ke Discord')
    else toast.error(res.error)
  }

  return (
    <PageStack>
      <PageHeader
        title="Rekap Order"
        subtitle="Ringkasan order per periode — klik detail untuk lihat item"
      >
        <div className="flex flex-wrap gap-2">
          {isAdmin ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={shareBusy || loading || !filtered.length}
                onClick={() => void handleShareDashboard()}
              >
                <Send className="size-4" />
                <span className="hidden sm:inline">Share qty</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={shareBusy || loading || !filtered.length}
                onClick={() => void handleSharePayment()}
              >
                <Megaphone className="size-4" />
                <span className="hidden sm:inline">Share bayar</span>
              </Button>
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="size-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </PageHeader>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
                value={week == null ? 'all' : String(week)}
                onValueChange={(v) =>
                  setWeek(v === 'all' ? null : Number(v))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {WEEKS.map((w) => (
                    <SelectItem key={w} value={String(w)}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex flex-col gap-2">
              <Label>Nama</Label>
              <Input
                value={isAdmin ? name : member?.nama || ''}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
                placeholder="Semua anggota"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Item</Label>
              <Input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="Filter item"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Delivered</Label>
              <Select
                value={delivered}
                onValueChange={(v) => setDelivered(v as DeliveredFilter)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="delivered">Sudah</SelectItem>
                  <SelectItem value="pending">Belum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {isAdmin
              ? 'Mode admin: delivered per item di detail · bayar & metal scrap per periode member.'
              : 'Mode member: menampilkan order milikmu saja.'}
          </p>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Order', value: String(stats.orderCount) },
          { label: 'Baris', value: String(stats.lineCount) },
          { label: 'Qty', value: String(stats.qty) },
          { label: 'Total', value: fmtUsd(stats.total) },
          {
            label: 'Scrap',
            value:
              stats.scrap > 0 ? String(Number(stats.scrap.toFixed(2))) : '0',
          },
        ].map((card) => (
          <Card key={card.label} className="border-border/60 bg-card/80">
            <CardContent className="py-3 text-center">
              <CardDescription className="text-[10px] tracking-[0.18em] uppercase">
                {card.label}
              </CardDescription>
              <p className="mt-1 font-mono text-xl font-bold text-primary">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? <LoadingState message="Memuat rekap…" /> : null}

      {!loading ? (
        orderPeriodSections.length === 0 ? (
          <Card className="border-border/60 bg-card/80">
            <CardContent className="py-8">
              <EmptyState title="Tidak ada data" />
            </CardContent>
          </Card>
        ) : (
          orderPeriodSections.map((section) => (
            <Card
              key={section.orderanke}
              className="border-border/60 bg-card/80"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-primary">
                  {formatOrderankeLabel(section.orderanke)}
                </CardTitle>
                <CardDescription>
                  {section.orderCount} order · {section.lineCount} baris · qty{' '}
                  {section.qty} · {fmtUsd(section.total)}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <RekapOrderTable
                  groups={section.groups}
                  isAdmin={isAdmin}
                  busyId={busyId}
                  memberNama={member?.nama || undefined}
                  onDetail={setDetailGroup}
                  onTogglePaid={togglePaid}
                  onToggleScrapGiven={toggleScrapGiven}
                />
              </CardContent>
            </Card>
          ))
        )
      ) : null}

      {liveDetailGroup ? (
        <RekapOrderDetailDialog
          group={liveDetailGroup}
          isAdmin={isAdmin}
          busyId={busyId}
          onClose={() => setDetailGroup(null)}
          onToggleDelivered={toggleDelivered}
          onArchive={setArchiveTarget}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title="Arsipkan baris order?"
        description={`Order ${archiveTarget?.item} milik ${archiveTarget?.nama} akan diarsipkan (soft-delete).`}
        confirmLabel="Ya, arsipkan"
        onConfirm={() => confirmArchive()}
      />
    </PageStack>
  )
}
