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
import { useTranslation } from 'react-i18next'
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

const shortcutKeys = [
  { to: '/order', labelKey: 'nav.order', descKey: 'home.shortcutDesc.order', icon: ShoppingCart },
  { to: '/prices', labelKey: 'nav.prices', descKey: 'home.shortcutDesc.prices', icon: Tag },
  { to: '/absen', labelKey: 'nav.absen', descKey: 'home.shortcutDesc.absen', icon: MapPin },
  { to: '/rekap', labelKey: 'nav.rekap', descKey: 'home.shortcutDesc.rekap', icon: ClipboardList },
  { to: '/storan-saya', labelKey: 'nav.myStoran', descKey: 'home.shortcutDesc.storan', icon: Package },
  { to: '/profile', labelKey: 'nav.profile', descKey: 'home.shortcutDesc.profile', icon: User },
] as const

export function HomePage() {
  const { t, i18n } = useTranslation()
  const { member, isAdmin } = useAuth()
  const { siteNotice } = useSettings()

  const [orderWin, setOrderWin] = useState<OrderWindow | null>(null)
  const [orderSummary, setOrderSummary] = useState<MemberOrderSummary | null>(
    null,
  )
  const [storanView, setStoranView] = useState<MemberStoranView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dateLocale = i18n.language.startsWith('en') ? 'en-US' : 'id-ID'

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
    if (hour < 12) return t('home.greetingMorning')
    if (hour < 18) return t('home.greetingAfternoon')
    return t('home.greetingEvening')
  }, [t])

  return (
    <PageStack>
      <PageHeader title={t('home.title')} subtitle={t('home.subtitle')}>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">{t('common.refresh')}</span>
        </Button>
      </PageHeader>

      <Card className="border-border/60 bg-gradient-to-br from-card/90 to-primary/5">
        <CardContent className="">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h3 className="mt-1 text-2xl font-bold tracking-tight">
            {member?.nama || t('common.member')}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{member?.role || '—'}</Badge>
            {isAdmin ? (
              <Badge variant="secondary">{t('common.admin')}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {siteNotice.trim() ? (
        <Card className="border-primary/25 bg-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary">
              {t('common.announcement')}
            </CardTitle>
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
            <CardTitle className="text-base">{t('home.orderStatus')}</CardTitle>
            <CardDescription>{t('home.orderStatusDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingState message={t('common.loadingStatus')} />
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
                    {t('home.goToOrder')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">{t('home.orderSummary')}</CardTitle>
            <CardDescription>{t('home.orderSummaryDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingState message={t('common.loading')} />
            ) : !member?.nama ? (
              <EmptyState title={t('home.notLinkedMember')} />
            ) : orderSummary?.error ? (
              <ErrorState message={orderSummary.error} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/50 bg-muted/15 p-3 text-center">
                    <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      {t('nav.order')}
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
                    {t('home.viewFullRekap')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">{t('home.storanThisWeek')}</CardTitle>
            <CardDescription>{t('home.storanThisWeekDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <LoadingState message={t('common.loading')} />
            ) : !member?.id ? (
              <EmptyState title={t('home.notLinked')} />
            ) : (
              <>
                <Badge
                  variant={
                    storanView?.week.statusRaw === 'SUDAH'
                      ? 'default'
                      : 'destructive'
                  }
                >
                  {storanView?.week.statusRaw === 'SUDAH'
                    ? t('common.done')
                    : t('common.notYet')}
                </Badge>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {storanView?.week.statusLabel}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('home.periodLabel', {
                    label: storanView?.week.period.label ?? '—',
                  })}
                </p>
                <Button asChild size="sm" variant="ghost" className="px-0">
                  <Link to="/storan-saya">
                    {t('home.myStoranDetail')}
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
          <CardTitle className="text-base">{t('home.shortcuts')}</CardTitle>
          <CardDescription>{t('home.shortcutsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {shortcutKeys.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <Icon className="size-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{t(item.labelKey)}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      {t(item.descKey)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <ErrorState title={t('common.loadFailed')} message={error} />
      ) : null}

      <Card className="border-border/60 bg-card/80">
        <CardHeader>
          <CardTitle className="text-base">{t('home.orderHistory')}</CardTitle>
          <CardDescription>
            {member?.nama
              ? t('home.orderHistoryDescNamed', { name: member.nama })
              : t('home.orderHistoryDescGuest')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="px-6 pb-6">
              <LoadingState message={t('common.loadingHistory')} />
            </div>
          ) : !orderSummary?.recent.length ? (
            <div className="px-6 pb-6">
              <EmptyState
                title={t('home.noOrders')}
                message={t('home.noOrdersMessage')}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('home.table.time')}</TableHead>
                  <TableHead>{t('home.table.batch')}</TableHead>
                  <TableHead>{t('home.table.item')}</TableHead>
                  <TableHead className="text-center">
                    {t('home.table.qty')}
                  </TableHead>
                  <TableHead className="text-right">
                    {t('home.table.subtotal')}
                  </TableHead>
                  <TableHead className="text-center">
                    {t('home.table.paid')}
                  </TableHead>
                  <TableHead className="text-center">
                    {t('home.table.delivered')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderSummary.recent.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {row.waktu
                        ? new Date(row.waktu).toLocaleString(dateLocale, {
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
                        {row.paid ? t('common.yes') : t('common.no')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.delivered ? 'default' : 'outline'}>
                        {row.delivered ? t('common.yes') : t('common.no')}
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
