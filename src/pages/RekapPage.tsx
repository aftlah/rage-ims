import { useState } from 'react'
import { Megaphone, RefreshCw, Send } from 'lucide-react'
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
import type { DeliveredFilter, OrderRow } from '@/lib/rekapOrders'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const WEEKS = Array.from({ length: 5 }, (_, i) => i + 1)

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
    byUser,
    batches,
    refresh,
    toggleDelivered,
    togglePaid,
    archiveRow,
  } = useRekapOrders({
    isAdmin,
    memberNama: member?.nama ?? null,
  })

  const [archiveTarget, setArchiveTarget] = useState<OrderRow | null>(null)
  const [shareBusy, setShareBusy] = useState(false)

  const confirmArchive = async () => {
    if (!archiveTarget) return
    await archiveRow(archiveTarget)
    setArchiveTarget(null)
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
        subtitle="List & angka per periode (mirror dashboard/rekap lama)"
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
              ? 'Mode admin: delivered & arsip (soft delete) memakai kolom existing.'
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
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-primary">Total per User</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {byUser.length === 0 ? (
              <EmptyState title="Tidak ada data" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-center">Baris</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Scrap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byUser.map((u) => (
                    <TableRow key={u.nama}>
                      <TableCell className="font-medium">{u.nama}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {u.count}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {u.qty}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtUsd(u.total)}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {u.scrap > 0 ? Number(u.scrap.toFixed(2)) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!loading
        ? batches.map((batch) => (
            <Card
              key={batch.orderanke}
              className="border-border/60 bg-card/80"
            >
              <CardHeader>
                <CardTitle className="text-primary">
                  Batch {formatOrderankeLabel(batch.orderanke)}
                </CardTitle>
                <CardDescription>
                  {batch.count} baris • {fmtUsd(batch.total)}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-center">Delivered</TableHead>
                      <TableHead className="text-center">Bayar</TableHead>
                      {isAdmin ? (
                        <TableHead className="text-right">Aksi</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batch.items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-muted-foreground">
                          {row.order_no || row.order_id || '—'}
                        </TableCell>
                        <TableCell className="font-medium">{row.nama}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.waktu
                            ? new Date(row.waktu).toLocaleString()
                            : '—'}
                        </TableCell>
                        <TableCell>{row.item}</TableCell>
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
                              onClick={() => void toggleDelivered(row)}
                            >
                              {row.delivered ? 'Sudah' : 'Belum'}
                            </Button>
                          ) : (
                            <Badge
                              variant={row.delivered ? 'default' : 'secondary'}
                            >
                              {row.delivered ? 'Sudah' : 'Belum'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isAdmin ? (
                            <Button
                              variant={row.paid ? 'default' : 'outline'}
                              size="sm"
                              disabled={busyId === row.id}
                              onClick={() =>
                                void togglePaid(row, member?.nama || undefined)
                              }
                            >
                              {row.paid ? 'Lunas' : 'Belum'}
                            </Button>
                          ) : (
                            <Badge variant={row.paid ? 'default' : 'secondary'}>
                              {row.paid ? 'Lunas' : 'Belum'}
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin ? (
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busyId === row.id}
                              onClick={() => setArchiveTarget(row)}
                            >
                              Arsip
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        : null}

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
