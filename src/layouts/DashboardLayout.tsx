import { useEffect, useMemo, useState } from 'react'
import { Menu, LogOut } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { BackgroundMusic } from '@/components/BackgroundMusic'
import { canAccessWeeklyProfit } from '@/lib/weeklyProfitAccess'

type NavItem = {
  to: string
  labelKey: string
  icon: string
  adminOnly?: boolean
  weeklyProfitOnly?: boolean
}

type NavGroup = {
  titleKey: string
  items: NavItem[]
  adminOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    titleKey: 'nav.groups.operational',
    items: [
      { to: '/home', labelKey: 'nav.home', icon: '🏠' },
      { to: '/order', labelKey: 'nav.order', icon: '📋' },
      { to: '/prices', labelKey: 'nav.prices', icon: '💲' },
    ],
  },
  {
    titleKey: 'nav.groups.finance',
    items: [
      { to: '/storan-saya', labelKey: 'nav.myStoran', icon: '📥' },
      { to: '/storan', labelKey: 'nav.storan', icon: '📦', adminOnly: true },
      { to: '/kas', labelKey: 'nav.kas', icon: '💰', adminOnly: true },
      { to: '/rekap', labelKey: 'nav.rekap', icon: '📊' },
      {
        to: '/profit-mingguan',
        labelKey: 'nav.weeklyProfit',
        icon: '💹',
        weeklyProfitOnly: true,
      },
    ],
  },
  {
    titleKey: 'nav.groups.inventory',
    items: [{ to: '/drugs', labelKey: 'nav.drugs', icon: '🧪', adminOnly: true }],
  },
  {
    titleKey: 'nav.groups.account',
    items: [{ to: '/profile', labelKey: 'nav.profile', icon: '👤' }],
  },
  {
    titleKey: 'nav.groups.admin',
    adminOnly: true,
    items: [
      { to: '/admin/windows', labelKey: 'nav.windows', icon: '🗓️' },
      { to: '/admin/catalog', labelKey: 'nav.catalog', icon: '🗂️' },
      { to: '/admin/users', labelKey: 'nav.users', icon: '👥' },
      { to: '/admin/settings', labelKey: 'nav.settings', icon: '⚙️' },
    ],
  },
]

const pageTitleKeys: Record<string, string> = {
  '/home': 'nav.home',
  '/order': 'nav.order',
  '/prices': 'nav.prices',
  '/absen': 'nav.absen',
  '/storan-saya': 'nav.myStoran',
  '/storan': 'nav.storan',
  '/kas': 'nav.kas',
  '/rekap': 'nav.rekap',
  '/profit-mingguan': 'nav.weeklyProfit',
  '/drugs': 'nav.drugs',
  '/profile': 'nav.profile',
  '/admin/windows': 'nav.windows',
  '/admin/catalog': 'nav.catalog',
  '/admin/users': 'nav.users',
  '/admin/settings': 'nav.settings',
}

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/15 text-primary'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  ]
    .filter(Boolean)
    .join(' ')
}

function memberInitials(nama: string | undefined): string {
  if (!nama) return '?'
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function SidebarNav({
  visibleGroups,
  onNavigate,
}: {
  visibleGroups: NavGroup[]
  onNavigate?: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="border-b border-border px-4 py-4">
        <p className="text-gradient-gold text-sm font-extrabold tracking-[0.12em]">
          R.A.G.E
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('app.subtitle')}
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        {visibleGroups.map((group) => (
          <div key={group.titleKey}>
            <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
              {t(group.titleKey)}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={navClassName}
                  onClick={onNavigate}
                >
                  <span className="text-sm opacity-70" aria-hidden>
                    {item.icon}
                  </span>
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </>
  )
}

export function DashboardLayout() {
  const { t } = useTranslation()
  const { member, isAdmin, signOut } = useAuth()
  const { siteNotice, maintenanceMode, weeklyProfitViewerIds } = useSettings()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const canWeeklyProfit = canAccessWeeklyProfit(member, weeklyProfitViewerIds)

  const visibleGroups = useMemo(
    () =>
      navGroups
        .filter((g) => !g.adminOnly || isAdmin)
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => {
            if (item.adminOnly && !isAdmin) return false
            if (item.weeklyProfitOnly && !canWeeklyProfit) return false
            return true
          }),
        }))
        .filter((g) => g.items.length > 0),
    [isAdmin, canWeeklyProfit],
  )

  const pageTitleKey =
    pageTitleKeys[location.pathname] ||
    Object.entries(pageTitleKeys).find(([path]) =>
      location.pathname.startsWith(path),
    )?.[1] ||
    'nav.dashboard'

  const pageTitle = t(pageTitleKey)
  const initials = useMemo(() => memberInitials(member?.nama), [member?.nama])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const sidebarFooter = (
    <div className="border-t border-border p-3">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => void signOut()}
      >
        <LogOut className="size-4" />
        {t('layout.logout')}
      </Button>
    </div>
  )

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      {!maintenanceMode ? <BackgroundMusic /> : null}
      <aside className="m-2 mr-0 hidden h-[calc(100dvh-1rem)] w-60 shrink-0 flex-col rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl md:m-3 md:mr-0 md:flex md:h-[calc(100dvh-1.5rem)]">
        <SidebarNav visibleGroups={visibleGroups} />
        {sidebarFooter}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(18rem,90vw)] p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-gradient-gold text-left">
              {t('layout.menu')}
            </SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100dvh-4rem)] flex-col">
            <SidebarNav
              visibleGroups={visibleGroups}
              onNavigate={() => setMobileOpen(false)}
            />
            {sidebarFooter}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
        <header className="mb-2 flex shrink-0 items-center gap-2 rounded-2xl border border-border/60 bg-card/80 px-2.5 py-2.5 backdrop-blur-xl sm:mb-3 sm:justify-between sm:gap-3 sm:px-4 sm:py-3 md:px-5">
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 md:hidden"
            aria-label={t('layout.openMenu')}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
              {pageTitle}
            </h1>
          </div>

          <LanguageSwitcher compact className="hidden shrink-0 sm:flex" />

          <NavLink
            to="/profile"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-primary/15 text-xs font-bold text-primary transition-colors hover:bg-primary/25 md:hidden"
            title={t('layout.openProfile')}
            aria-label={t('layout.profileAria', {
              name: member?.nama || '',
            })}
          >
            {initials}
          </NavLink>

          <NavLink
            to="/profile"
            className="hidden min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 transition-colors hover:bg-muted/60 md:flex md:max-w-60"
            title={t('layout.openProfile')}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1 truncate text-right">
              <p className="truncate text-xs font-semibold">
                {member?.nama || t('layout.notConnected')}
              </p>
              <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {member?.role || '—'}
              </p>
            </div>
          </NavLink>
        </header>

        {siteNotice.trim() ? (
          <div className="mb-2 shrink-0 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary sm:mb-3 sm:px-4 sm:text-sm">
            {siteNotice.trim()}
          </div>
        ) : null}

        {maintenanceMode && isAdmin ? (
          <div className="mb-2 shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:mb-3 sm:px-4 sm:text-sm">
            {t('layout.maintenanceBanner')}
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-2xl border border-border/60 bg-card/50 p-3 backdrop-blur-sm sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
