import { useCallback, useEffect, useMemo, useState } from 'react'
import { List, RefreshCw } from 'lucide-react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
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
import { fmtUsd } from '@/lib/format'
import { formatOrderankeLabel } from '@/lib/orderWindow'
import {
  fetchOrderankeWeekOptions,
  fetchWeeklyProfitReport,
  type WeeklyProfitLine,
  type WeeklyProfitReport,
} from '@/lib/weeklyProfit'

function MemberOrderDetailDialog({
  member,
  lines,
  onClose,
}: {
  member: string
  lines: WeeklyProfitLine[]
  onClose: () => void
}) {
  const totals = useMemo(
    () =>
      lines.reduce(
        (acc, line) => {
          acc.qty += line.qty
          acc.subtotalJual += line.subtotalJual
          acc.subtotalAsli += line.subtotalAsli
          acc.untung += line.untung
          return acc
        },
        { qty: 0, subtotalJual: 0, subtotalAsli: 0, untung: 0 },
      ),
    [lines],
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail Order — {member}</DialogTitle>
          <DialogDescription>
            {lines.length} baris · qty {totals.qty}
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Harga jual</TableHead>
              <TableHead className="text-right">Harga asli</TableHead>
              <TableHead className="text-right">Untung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium">{line.item}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {line.qty}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtUsd(line.hargaJual)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtUsd(line.hargaAsli)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtUsd(line.untung)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-center font-semibold">
                {totals.qty}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {fmtUsd(totals.subtotalJual)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums">
                {fmtUsd(totals.subtotalAsli)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold text-primary tabular-nums">
                {fmtUsd(totals.untung)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}

export function WeeklyProfitPage() {
  const [options, setOptions] = useState<number[]>([])
  const [orderanke, setOrderanke] = useState<number | null>(null)
  const [report, setReport] = useState<WeeklyProfitReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailMember, setDetailMember] = useState<string | null>(null)

  const loadOptions = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchOrderankeWeekOptions()
    setOptions(res.options)
    if (res.error) setError(res.error)
    setOrderanke((prev) => {
      if (prev != null && res.options.includes(prev)) return prev
      return res.options[0] ?? null
    })
    setLoading(false)
  }, [])

  const loadReport = useCallback(async (value: number | null) => {
    if (value == null) {
      setReport(null)
      return
    }
    setLoadingReport(true)
    setError(null)
    const res = await fetchWeeklyProfitReport(value)
    setReport(res.report)
    if (res.error) setError(res.error)
    setLoadingReport(false)
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    void loadReport(orderanke)
  }, [orderanke, loadReport])

  const marginPct = useMemo(() => {
    if (!report || report.totals.subtotalAsli <= 0) return null
    return (report.totals.untung / report.totals.subtotalAsli) * 100
  }, [report])

  const linesByMember = useMemo(() => {
    if (!report) return new Map<string, WeeklyProfitLine[]>()
    const map = new Map<string, WeeklyProfitLine[]>()
    for (const line of report.lines) {
      const prev = map.get(line.nama) || []
      prev.push(line)
      map.set(line.nama, prev)
    }
    return map
  }, [report])

  const detailLines = detailMember
    ? linesByMember.get(detailMember) || []
    : []

  return (
    <PageStack>
      <PageHeader
        title="Profit Mingguan"
        subtitle="Rekap per orderanke — harga asli vs harga jual & total untung"
      >
        <Button variant="outline" size="sm" onClick={() => void loadOptions()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Pilih Minggu Order</CardTitle>
          <CardDescription>
            Periode mengikuti <code>orderanke</code> dari jadwal order (M×10+W)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Memuat daftar minggu…" />
          ) : !options.length ? (
            <EmptyState title="Belum ada periode order" />
          ) : (
            <Select
              value={orderanke == null ? undefined : String(orderanke)}
              onValueChange={(v) => setOrderanke(Number(v))}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Pilih minggu" />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {formatOrderankeLabel(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {loadingReport ? <LoadingState message="Menghitung rekap…" /> : null}

      {!loadingReport && report ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total Jual', value: fmtUsd(report.totals.subtotalJual) },
              { label: 'Total Asli', value: fmtUsd(report.totals.subtotalAsli) },
              { label: 'Total Untung', value: fmtUsd(report.totals.untung) },
              {
                label: 'Margin',
                value: marginPct == null ? '—' : `${marginPct.toFixed(1)}%`,
              },
            ].map((card) => (
              <Card key={card.label} className="border-border/60 bg-card/80">
                <CardContent className="text-center">
                  <p className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                    {card.label}
                  </p>
                  <p className="mt-2 font-mono text-xl font-bold text-primary tabular-nums">
                    {card.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Per Member</CardTitle>
              <CardDescription>
                {report.label} · {report.byMember.length} member
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {!report.byMember.length ? (
                <div className="px-6 pb-6">
                  <EmptyState title="Tidak ada data" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-center">Baris</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Jual</TableHead>
                      <TableHead className="text-right">Asli</TableHead>
                      <TableHead className="text-right">Untung</TableHead>
                      <TableHead className="w-24 text-center">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byMember.map((row) => (
                      <TableRow key={row.nama}>
                        <TableCell className="font-medium">{row.nama}</TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {row.lineCount}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {row.qty}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {fmtUsd(row.subtotalJual)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {fmtUsd(row.subtotalAsli)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary tabular-nums">
                          {fmtUsd(row.untung)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailMember(row.nama)}
                          >
                            <List className="size-3.5" />
                            <span className="hidden sm:inline">Detail</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Per Item</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {!report.byItem.length ? (
                <div className="px-6 pb-6">
                  <EmptyState title="Tidak ada item" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Jual</TableHead>
                      <TableHead className="text-right">Asli</TableHead>
                      <TableHead className="text-right">Untung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byItem.map((row) => (
                      <TableRow key={row.item}>
                        <TableCell className="font-medium">{row.item}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.kategori || '—'}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {row.qty}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {fmtUsd(row.subtotalJual)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {fmtUsd(row.subtotalAsli)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary tabular-nums">
                          {fmtUsd(row.untung)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {detailMember ? (
            <MemberOrderDetailDialog
              member={detailMember}
              lines={detailLines}
              onClose={() => setDetailMember(null)}
            />
          ) : null}
        </>
      ) : null}

      {!loading && !loadingReport && orderanke != null && !report && !error ? (
        <EmptyState title="Tidak ada order" message="Tidak ada order di minggu ini." />
      ) : null}
    </PageStack>
  )
}
