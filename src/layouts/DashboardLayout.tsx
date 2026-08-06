import { useEffect, useMemo, useState } from 'react'
import { Menu, LogOut } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import {
  describeOrderWindow,
  fetchActiveOrderWindow,
  formatOrderankeLabel,
  type OrderWindow,
} from '@/lib/orderWindow'

type NavItem = {
  to: string
  label: string
  icon: string
}

type NavGroup = {
  title: string
  items: NavItem[]
  adminOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    title: 'Operasional',
    items: [
      { to: '/order', label: 'Order', icon: '📋' },
      { to: '/absen', label: 'Absen', icon: '📍' },
    ],
  },
  {
    title: 'Keuangan',
    items: [
      { to: '/storan', label: 'Storan', icon: '📦' },
      { to: '/kas', label: 'Kas', icon: '💰' },
      { to: '/rekap', label: 'Rekap', icon: '📊' },
    ],
  },
  {
    title: 'Inventory',
    items: [{ to: '/drugs', label: 'Drugs', icon: '🧪' }],
  },
  {
    title: 'Admin',
    adminOnly: true,
    items: [
      { to: '/admin/catalog', label: 'Catalog', icon: '🗂️' },
      { to: '/admin/users', label: 'Users', icon: '👥' },
      { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
]

const pageTitles: Record<string, string> = {
  '/order': 'Order',
  '/absen': 'Absen',
  '/storan': 'Storan',
  '/kas': 'Kas',
  '/rekap': 'Rekap',
  '/drugs': 'Drugs',
  '/admin/catalog': 'Catalog',
  '/admin/users': 'Users',
  '/admin/settings': 'Settings',
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
  return (
    <>
      <div className="border-b border-border px-4 py-4">
        <p className="text-gradient-gold text-sm font-extrabold tracking-[0.12em]">
          R.A.G.E
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">Order System</p>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-2 text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
              {group.title}
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
                  {item.label}
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
  const { member, isAdmin, signOut } = useAuth()
  const { siteNotice, maintenanceMode } = useSettings()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [orderWin, setOrderWin] = useState<OrderWindow | null>(null)

  const visibleGroups = navGroups.filter((g) => !g.adminOnly || isAdmin)
  const pageTitle =
    pageTitles[location.pathname] ||
    Object.entries(pageTitles).find(([path]) =>
      location.pathname.startsWith(path),
    )?.[1] ||
    'Dashboard'

  const initials = useMemo(() => memberInitials(member?.nama), [member?.nama])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    let alive = true
    const load = async () => {
      const { window } = await fetchActiveOrderWindow('order')
      if (alive) setOrderWin(window)
    }
    void load()
    const id = window.setInterval(() => void load(), 60_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const winInfo = describeOrderWindow(orderWin)
  const orderBadgeLabel = winInfo.isOpen
    ? `Open · ${formatOrderankeLabel(orderWin?.orderanke)}`
    : 'Order ditutup'

  const sidebarFooter = (
    <div className="border-t border-border p-3">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => void signOut()}
      >
        <LogOut className="size-4" />
        Keluar
      </Button>
    </div>
  )

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      <aside className="m-2 mr-0 hidden h-[calc(100dvh-1rem)] w-60 shrink-0 flex-col rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl md:m-3 md:mr-0 md:flex md:h-[calc(100dvh-1.5rem)]">
        <SidebarNav visibleGroups={visibleGroups} />
        {sidebarFooter}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(18rem,90vw)] p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-gradient-gold text-left">Menu</SheetTitle>
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
        <header className="mb-2 flex shrink-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 px-3 py-3 backdrop-blur-xl sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 md:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
              aria-label="Buka menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-bold tracking-tight sm:text-base">
                {pageTitle}
              </h1>
              <div className="mt-1">
                <Badge
                  variant={winInfo.isOpen ? 'default' : 'destructive'}
                  title={winInfo.detailText}
                  className="max-w-full truncate text-[10px] sm:text-xs"
                >
                  <span className="truncate">{orderBadgeLabel}</span>
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-2.5 py-2 sm:w-auto sm:max-w-[240px] sm:px-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1 truncate sm:text-right">
              <p className="truncate text-xs font-semibold">
                {member?.nama || 'Belum terhubung'}
              </p>
              <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {member?.role || '—'}
              </p>
            </div>
          </div>
        </header>

        {siteNotice.trim() ? (
          <div className="mb-2 shrink-0 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary sm:mb-3 sm:px-4 sm:text-sm">
            {siteNotice.trim()}
          </div>
        ) : null}

        {maintenanceMode && isAdmin ? (
          <div className="mb-2 shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 sm:mb-3 sm:px-4 sm:text-sm">
            Mode maintenance aktif — member diblok. Matikan di Admin →
            Settings.
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain rounded-2xl border border-border/60 bg-card/50 p-3 backdrop-blur-sm sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
