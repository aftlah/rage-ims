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
import { Textarea } from '@/components/ui/textarea'
import { fmtUsd } from '@/lib/format'
import {
  deleteRageCashEntry,
  fetchRageCashLogs,
  formatCashTime,
  RAGE_CASH_CATEGORIES,
  submitRageCash,
  toLocalInputValue,
  type CashType,
  type RageCashRow,
} from '@/lib/kas'

export function KasPage() {
  const [rows, setRows] = useState<RageCashRow[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RageCashRow | null>(null)

  const [type, setType] = useState<CashType>('IN')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [waktu, setWaktu] = useState(toLocalInputValue())

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchRageCashLogs()
    setRows(res.data)
    setBalance(res.balance)
    if (res.error) setError(res.error)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submit = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await submitRageCash({
      type,
      amount: parseFloat(amount) || 0,
      category,
      note,
      waktuIso: waktu || null,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage('Transaksi tersimpan')
    setAmount('')
    setCategory('')
    setNote('')
    setWaktu(toLocalInputValue())
    await refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    const res = await deleteRageCashEntry(deleteTarget.id)
    setBusy(false)
    setDeleteTarget(null)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setMessage('Catatan diarsipkan')
    await refresh()
  }

  return (
    <PageStack>
      <PageHeader
        title="Kas R.A.G.E"
        subtitle="Pemasukan & pengeluaran (rage_cash_logs)"
      >
        <Card className="w-full border-border/60 bg-card/80 px-4 py-2 sm:w-auto">
          <CardDescription className="text-[10px] tracking-widest uppercase">
            Saldo
          </CardDescription>
          <p className="font-mono text-lg font-bold text-primary">
            {balance == null ? '—' : fmtUsd(balance)}
          </p>
        </Card>
      </PageHeader>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Tambah Transaksi</CardTitle>
          <CardDescription>Catat pemasukan atau pengeluaran kas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>Tipe</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CashType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Pemasukan</SelectItem>
                  <SelectItem value="OUT">Pengeluaran</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Nominal ($)</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Waktu</Label>
              <Input
                type="datetime-local"
                value={waktu}
                onChange={(e) => setWaktu(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {RAGE_CASH_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
              <Label>Catatan</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>

          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
          {message ? (
            <InlineMessage tone="success">{message}</InlineMessage>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle>Riwayat</CardTitle>
          <CardDescription>50 transaksi terakhir</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <LoadingState />
          ) : error && !rows.length ? (
            <div className="px-6">
              <ErrorState message={error} />
            </div>
          ) : !rows.length ? (
            <EmptyState title="Belum ada transaksi kas" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatCashTime(r.waktu)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.type === 'IN' ? 'default' : 'destructive'}
                      >
                        {r.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>{r.category || '—'}</div>
                      {r.note ? (
                        <div className="text-xs text-muted-foreground">
                          {r.note}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${
                        r.type === 'IN' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {r.type === 'IN' ? '+' : '-'}
                      {fmtUsd(r.amount)}
                    </TableCell>
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
            <AlertDialogTitle>Hapus catatan kas?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi{' '}
              {deleteTarget
                ? `${deleteTarget.type} ${fmtUsd(deleteTarget.amount)}`
                : ''}{' '}
              akan diarsipkan (soft-delete).
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
