import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardList,
  MapPin,
  Package,
  RefreshCw,
  ShoppingCart,
  Tag,
  User,
} from 'lucide-react'
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
import { useSettings } from '@/contexts/SettingsContext'
import {
  fetchMemberOrderSummary,
  formatMemberOrderStatsLine,
  type MemberOrderSummary,
} from '@/lib/homeSummary'
import { fmtUsd } from '@/lib/format'
import {
  fetchMemberStoranView,
  type MemberStoranView,
} from '@/lib/memberStoranView'
import {
  describeOrderWindow,
  fetchActiveOrderWindow,
  formatOrderankeLabel,
  type OrderWindow,
} from '@/lib/orderWindow'

const shortcuts = [
  { to: '/order', label: 'Order', icon: ShoppingCart, desc: 'Buat order baru' },
  { to: '/prices', label: 'Harga', icon: Tag, desc: 'Lihat daftar harga' },
  { to: '/absen', label: 'Absen', icon: MapPin, desc: 'Masuk / keluar kota' },
  { to: '/rekap', label: 'Rekap', icon: ClipboardList, desc: 'Rekap order kamu' },
  { to: '/storan-saya', label: 'Storan Saya', icon: Package, desc: 'Status storan & nitip' },
  { to: '/profile', label: 'Profile', icon: User, desc: 'Akun & password' },
] as const

export function HomePage() {
  const { member, isAdmin } = useAuth()
  const { siteNotice } = useSettings()

  const [orderWin, setOrderWin] = useState<OrderWindow | null>(null)
  const [orderSummary, setOrderSummary] = useState<MemberOrderSummary | null>(
    null,
  )
  const [storanView, setStoranView] = useState<MemberStoranView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [winRes, summaryRes, storanRes] = await Promise.all([
      fetchActiveOrderWindow('order'),
      member?.nama
        ? fetchMemberOrderSummary(member.nama, 8)
        : Promise.resolve(null),
      member?.id
        ? fetchMemberStoranView(member.id)
        : Promise.resolve(null),
    ])

    setOrderWin(winRes.window)
    if (winRes.error) setError(winRes.error)
    if (summaryRes) setOrderSummary(summaryRes)
    if (storanRes) setStoranView(storanRes)

    setLoading(false)
  }, [member?.id, member?.nama])

  useEffect(() => {
    void load()
  }, [load])

  const winInfo = describeOrderWindow(orderWin)
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Selamat pagi'
    if (hour < 18) return 'Selamat siang'
    return 'Selamat malam'
  }, [])

  const visibleShortcuts = shortcuts

  return (
    <PageStack>
      <PageHeader
        title="Beranda"
        subtitle="Ringkasan aktivitas, shortcut menu, dan status order kamu"
      >
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      <Card className="border-border/60 bg-gradient-to-br from-card/90 to-primary/5">
        <CardContent className="">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">
            {member?.nama || 'Member'}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{member?.role || '—'}</Badge>
            {isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
          </div>
        </CardContent>
      </Card>

      {siteNotice.trim() ? (
        <Card className="border-primary/25 bg-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary">Pengumuman</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-primary/90">
              {siteNotice.trim()}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/80 sm:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Status Order</CardTitle>
            <CardDescription>Periode order aktif saat ini</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingState message="Memuat status…" />
            ) : (
              <>
                <Badge variant={winInfo.isOpen ? 'default' : 'destructive'}>
                  {winInfo.statusText}
                </Badge>
                {orderWin?.orderanke != null ? (
                  <p className="text-sm font-medium text-foreground">
                    {formatOrderankeLabel(orderWin.orderanke)}
                  </p>
                ) : null}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {winInfo.detailText}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to="/order">
                    Ke halaman Order
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Ringkasan Order</CardTitle>
            <CardDescription>Semua periode — data milik kamu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingState />
            ) : !member?.nama ? (
              <EmptyState title="Akun belum terhubung ke member" />
            ) : orderSummary?.error ? (
              <ErrorState message={orderSummary.error} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/50 bg-muted/15 p-3 text-center">
                    <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      Order
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums">
                      {orderSummary?.stats.orderCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-muted/15 p-3 text-center">
                    <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      Total
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {fmtUsd(orderSummary?.stats.totalUsd ?? 0)}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {orderSummary
                    ? formatMemberOrderStatsLine(orderSummary.stats)
                    : '—'}
                </p>
                <Button asChild size="sm" variant="ghost" className="px-0">
                  <Link to="/rekap">
                    Lihat rekap lengkap
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Storan Minggu Ini</CardTitle>
            <CardDescription>Read-only — minggu kalender ISO</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingState />
            ) : !member?.id ? (
              <EmptyState title="Akun belum terhubung" />
            ) : (
              <>
                <Badge
                  variant={
                    storanView?.week.statusRaw === 'SUDAH'
                      ? 'default'
                      : 'destructive'
                  }
                >
                  {storanView?.week.statusRaw === 'SUDAH' ? 'Sudah' : 'Belum'}
                </Badge>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {storanView?.week.statusLabel}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Periode {storanView?.week.period.label}
                </p>
                <Button asChild size="sm" variant="ghost" className="px-0">
                  <Link to="/storan-saya">
                    Detail storan saya
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Shortcut</CardTitle>
          <CardDescription>Akses cepat ke menu utama</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {visibleShortcuts.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <Icon className="size-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">Riwayat Order Terakhir</CardTitle>
          <CardDescription>
            {member?.nama
              ? `8 baris terbaru milik ${member.nama}`
              : 'Login sebagai member terhubung'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-6 pb-6">
              <LoadingState message="Memuat riwayat…" />
            </div>
          ) : !orderSummary?.recent.length ? (
            <div className="px-6 pb-6">
              <EmptyState title="Belum ada order" message="Order kamu akan muncul di sini" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-center">Bayar</TableHead>
                  <TableHead className="text-center">Delivered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderSummary.recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.waktu
                        ? new Date(row.waktu).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatOrderankeLabel(row.orderanke)}
                    </TableCell>
                    <TableCell className="font-medium">{row.item}</TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {row.qty}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {fmtUsd(row.subtotal)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.paid ? 'default' : 'outline'}>
                        {row.paid ? 'Ya' : 'Belum'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.delivered ? 'default' : 'outline'}>
                        {row.delivered ? 'Ya' : 'Belum'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageStack>
  )
}
