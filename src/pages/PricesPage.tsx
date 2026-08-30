import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, X } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
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
import {
  CATALOG_CATEGORIES,
  EMPTY_CATALOG,
  fetchCatalog,
  getDisplayPrice,
  type CatalogByCategory,
  type CatalogCategory,
  type CatalogItem,
} from '@/lib/catalog'
import { fmtUsd } from '@/lib/format'

const PRICE_CATEGORY_ORDER = ['Senjata', 'Ammo', 'Attachment', 'Others'] as const

type PriceCategoryFilter = 'ALL' | (typeof PRICE_CATEGORY_ORDER)[number]

function getCategoryDisplay(kategori: CatalogCategory): string {
  return kategori === 'Gun' ? 'Senjata' : kategori
}

function flattenCatalog(catalog: CatalogByCategory): CatalogItem[] {
  return CATALOG_CATEGORIES.flatMap((cat) => catalog[cat] || [])
}

export function PricesPage() {
  const { member } = useAuth()
  const role = member?.role ?? null

  const [catalog, setCatalog] = useState<CatalogByCategory>(EMPTY_CATALOG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<PriceCategoryFilter>('ALL')

  const items = useMemo(() => flattenCatalog(catalog), [catalog])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchCatalog()
    if (res.error) {
      setError(res.error)
      setCatalog(EMPTY_CATALOG)
    } else {
      setCatalog(res.catalog)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const categoryDisplay = getCategoryDisplay(item.kategori)
      if (activeCategory !== 'ALL' && categoryDisplay !== activeCategory) {
        return false
      }
      if (query && !item.name.toLowerCase().includes(query)) {
        return false
      }
      return true
    })
  }, [items, activeCategory, query])

  const showScrap = filtered.some((item) => item.scrap)

  const tabs = useMemo(() => {
    const countFor = (cat: PriceCategoryFilter) =>
      items.filter((item) => {
        const categoryDisplay = getCategoryDisplay(item.kategori)
        if (cat !== 'ALL' && categoryDisplay !== cat) return false
        if (query && !item.name.toLowerCase().includes(query)) return false
        return true
      }).length

    return [
      { id: 'ALL' as const, label: 'Semua', count: countFor('ALL') },
      ...PRICE_CATEGORY_ORDER.filter((cat) =>
        items.some((item) => getCategoryDisplay(item.kategori) === cat),
      ).map((cat) => ({
        id: cat,
        label: cat,
        count: countFor(cat),
      })),
    ]
  }, [items, query])

  const groupedRows = useMemo(() => {
    if (activeCategory !== 'ALL') {
      return [{ label: activeCategory, items: filtered }]
    }

    return PRICE_CATEGORY_ORDER.map((cat) => ({
      label: cat,
      items: filtered.filter(
        (item) => getCategoryDisplay(item.kategori) === cat,
      ),
    })).filter((group) => group.items.length > 0)
  }, [activeCategory, filtered])

  const resultLabel = !filtered.length
    ? query
      ? `Tidak ada hasil untuk "${search.trim()}"`
      : 'Tidak ada item di kategori ini'
    : `${filtered.length} item · ${
        activeCategory === 'ALL' ? 'semua kategori' : activeCategory
      }`

  return (
    <PageStack>
      <PageHeader
        title="Daftar Harga"
        subtitle="Harga jual catalog (read-only, mirror prices.html lama)"
      >
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      <Card className="border-border/60 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cari item</CardTitle>
          <CardDescription>
            Gun & Attachment non-admin +10% markup (sama seperti halaman Order).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama item..."
              className="pl-9 pr-9"
            />
            {search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                aria-label="Hapus pencarian"
                onClick={() => setSearch('')}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                variant={activeCategory === tab.id ? 'default' : 'outline'}
                size="sm"
                className="h-8 gap-2"
                onClick={() => setActiveCategory(tab.id)}
              >
                {tab.label}
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 px-1.5 text-[10px] tabular-nums"
                >
                  {tab.count}
                </Badge>
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">{resultLabel}</p>
        </CardContent>
      </Card>

      {error ? <ErrorState message={error} /> : null}
      {loading ? <LoadingState message="Memuat daftar harga…" /> : null}

      {!loading && !error ? (
        filtered.length === 0 ? (
          <EmptyState
            title="Item tidak ditemukan"
            message={
              query
                ? 'Coba kata kunci lain atau pilih tab kategori berbeda.'
                : 'Belum ada item aktif di catalog.'
            }
          />
        ) : (
          <Card className="border-border/60 bg-card/80">
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Harga</TableHead>
                    {showScrap ? (
                      <TableHead className="text-center">Scrap</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRows.map((group) => (
                    <Fragment key={group.label}>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell
                          colSpan={showScrap ? 3 : 2}
                          className="py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
                              {group.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {group.items.length} item
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.items.map((item) => {
                        const sellPrice = getDisplayPrice(item, catalog, role)
                        return (
                          <TableRow key={`${item.kategori}-${item.name}`}>
                            <TableCell className="font-medium">
                              {item.name}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {fmtUsd(sellPrice)}
                            </TableCell>
                            {showScrap ? (
                              <TableCell className="text-center">
                                {item.scrap ? (
                                  <Badge variant="outline">{item.scrap}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            ) : null}
                          </TableRow>
                        )
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : null}
    </PageStack>
  )
}
