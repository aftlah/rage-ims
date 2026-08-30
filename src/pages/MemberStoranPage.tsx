import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
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
import { fmtIdMoney } from '@/lib/format'
import {
  fetchMemberStoranView,
  type MemberStoranView,
} from '@/lib/memberStoranView'

export function MemberStoranPage() {
  const { member } = useAuth()
  const [view, setView] = useState<MemberStoranView | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!member?.id) {
      setView(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await fetchMemberStoranView(member.id)
    setView(res)
    setLoading(false)
  }, [member?.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PageStack>
      <PageHeader
        title="Storan Saya"
        subtitle="Lihat status storan mingguan & riwayat nitip cuci milik kamu (read-only)"
      >
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      {!member?.id ? (
        <ErrorState message="Akun belum terhubung ke member — hubungi admin." />
      ) : null}

      {loading ? <LoadingState message="Memuat storan…" /> : null}

      {!loading && member?.id ? (
        <>
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Storan Mingguan</CardTitle>
              <CardDescription>
                Periode {view?.week.period.label} · read-only
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    view?.week.statusRaw === 'SUDAH' ? 'default' : 'destructive'
                  }
                >
                  {view?.week.statusRaw === 'SUDAH'
                    ? 'Sudah storan'
                    : 'Belum storan'}
                </Badge>
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                  <dt className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                    Status
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {view?.week.statusLabel}
                  </dd>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                  <dt className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                    Penerima
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {view?.week.penerima || '—'}
                  </dd>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                  <dt className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                    Waktu
                  </dt>
                  <dd className="mt-1 text-sm font-medium">
                    {view?.week.waktu || '—'}
                  </dd>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 sm:col-span-2">
                  <dt className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                    Catatan
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {view?.week.catatan || '—'}
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-muted-foreground">
                Untuk update storan mingguan, hubungi admin. Halaman ini hanya
                menampilkan status milik kamu.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Nitip Cuci Terakhir</CardTitle>
              <CardDescription>Riwayat nitip milik kamu</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {view?.error ? (
                <div className="px-6 pb-6">
                  <ErrorState message={view.error} />
                </div>
              ) : !view?.nitipRecent.length ? (
                <div className="px-6 pb-6">
                  <EmptyState title="Belum ada nitip cuci" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead className="text-right">Uang Merah</TableHead>
                      <TableHead className="text-right">Uang Putih</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-center">Bayar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.nitipRecent.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {row.waktu
                            ? new Date(row.waktu).toLocaleString('id-ID')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {fmtIdMoney(row.uang_merah)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {fmtIdMoney(row.uang_putih)}
                        </TableCell>
                        <TableCell>{row.keterangan || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={row.is_paid ? 'default' : 'outline'}>
                            {row.is_paid ? 'Lunas' : 'Belum'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </PageStack>
  )
}
