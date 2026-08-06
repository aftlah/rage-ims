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
}

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
      <div className="border-b border-border px-4 py-5">
        <p className="text-gradient-gold text-lg font-extrabold tracking-[0.14em]">
          R.A.G.E
        </p>
        <p className="mt-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
          Order System
        </p>
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
    <div className="app-shell flex h-screen overflow-hidden">
      <aside className="m-3 mr-0 hidden h-[calc(100vh-1.5rem)] w-60 shrink-0 flex-col rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl md:flex">
        <SidebarNav visibleGroups={visibleGroups} />
        {sidebarFooter}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(18rem,85vw)] p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="text-gradient-gold">Menu</SheetTitle>
          </SheetHeader>
          <div className="flex h-[calc(100%-4rem)] flex-col">
            <SidebarNav
              visibleGroups={visibleGroups}
              onNavigate={() => setMobileOpen(false)}
            />
            {sidebarFooter}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pl-0 sm:pl-3">
        <header className="mb-3 flex min-h-[3.75rem] shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 py-2.5 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-label="Buka menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight">
                {pageTitle}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant={winInfo.isOpen ? 'default' : 'destructive'}
                  title={winInfo.detailText}
                >
                  {winInfo.isOpen
                    ? `Open · ${formatOrderankeLabel(orderWin?.orderanke)}`
                    : 'Order ditutup'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex max-w-[240px] items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0 truncate text-right">
              <p className="truncate text-xs font-semibold">
                {member?.nama || 'Belum terhubung'}
              </p>
              <p className="truncate text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {member?.role || '—'}
              </p>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
