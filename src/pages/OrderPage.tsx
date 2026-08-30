import { useMemo, useState } from 'react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import { RefreshCw, ShoppingCart } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { ToastNotice } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useOrderCart } from '@/features/order/useOrderCart'
import { useOrderCatalog } from '@/features/order/useOrderCatalog'
import {
  formatCountdown,
  useCountdown,
} from '@/features/order/useCountdown'
import {
  CATALOG_CATEGORIES,
  getDisplayPrice,
  getItemMax,
  type CatalogCategory,
} from '@/lib/catalog'
import { fmtUsd, formatWindowDateTimeCompact } from '@/lib/format'
import type { CartLine } from '@/lib/orders'
import { formatOrderankeLabel } from '@/lib/orderWindow'
import { normItemName } from '@/lib/orderUtils'

type OrderCartPanelProps = {
  cart: CartLine[]
  totals: { amount: number; qty: number; scrap: number }
  isOpen: boolean
  submitting: boolean
  memberId?: number | null
  onClear: () => void
  onUpdateQty: (index: number, qty: number) => void
  onRemove: (index: number) => void
  onSubmit: () => void
  className?: string
}

function OrderCartPanel({
  cart,
  totals,
  isOpen,
  submitting,
  memberId,
  onClear,
  onUpdateQty,
  onRemove,
  onSubmit,
  className,
}: OrderCartPanelProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-primary">Keranjang</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={cart.length === 0}
        >
          Reset
        </Button>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <EmptyState title="Keranjang kosong" />
        ) : (
          <div className="space-y-3">
            {cart.map((line, idx) => (
              <div
                key={`${line.kategori}-${line.item}-${idx}`}
                className="rounded-xl border border-border/60 bg-muted/15 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm leading-snug font-medium">{line.item}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {line.kategori}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => onRemove(idx)}
                  >
                    Hapus
                  </Button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <Input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) =>
                      onUpdateQty(idx, Number(e.target.value) || 1)
                    }
                    className="h-8 w-16 text-center"
                    aria-label={`Qty ${line.item}`}
                  />
                  <div className="text-right">
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {fmtUsd(line.price)} × {line.qty}
                    </p>
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {fmtUsd(line.price * line.qty)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto shrink-0 space-y-3 border-t border-border/60 pt-4">
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span>Total item</span>
            <span>{totals.qty}</span>
          </div>
          <div className="mt-1 flex justify-between gap-3 text-muted-foreground">
            <span>Total scrap</span>
            <span>{totals.scrap}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3 border-t border-border pt-2 font-semibold">
            <span className="text-muted-foreground">Total</span>
            <span className="text-primary">{fmtUsd(totals.amount)}</span>
          </div>
        </div>

        <Button
          className="w-full"
          onClick={onSubmit}
          disabled={submitting || !isOpen || cart.length === 0 || !memberId}
        >
          {submitting ? 'Menyimpan…' : 'Submit Order'}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Minimal total qty 2.
        </p>
      </div>
    </div>
  )
}

export function OrderPage() {
  const { member, isAdmin } = useAuth()
  const { maintenanceMode } = useSettings()
  const {
    catalog,
    orderWindow,
    itemTotals,
    isOpen,
    statusText,
    detailText,
    loading,
    error,
    refresh,
    refreshTotals,
  } = useOrderCatalog()

  const role = member?.role ?? null
  const {
    cart,
    totals,
    message,
    submitting,
    addItem,
    updateQty,
    removeLine,
    clearCart,
    submit,
    clearMessage,
  } = useOrderCart({
    catalog,
    itemTotals,
    isOpen,
    orderanke: orderWindow?.orderanke ?? null,
    memberId: member?.id ?? null,
    nama: member?.nama ?? null,
    role,
    maintenanceBlocked: maintenanceMode && !isAdmin,
    onSubmitted: refreshTotals,
  })

  const [category, setCategory] = useState<CatalogCategory>('Gun')
  const [selectedItem, setSelectedItem] = useState('')
  const [qty, setQty] = useState(1)
  const [cartOpen, setCartOpen] = useState(false)

  const items = catalog[category] || []
  const activeItem = useMemo(
    () => items.find((i) => i.name === selectedItem) || items[0] || null,
    [items, selectedItem],
  )

  const remainingForActive = useMemo(() => {
    if (!activeItem) return null
    const max = getItemMax(activeItem.name, catalog)
    if (typeof max !== 'number') return null
    const usedDb = itemTotals[normItemName(activeItem.name)] || 0
    const usedCart = cart
      .filter((c) => normItemName(c.item) === normItemName(activeItem.name))
      .reduce((a, c) => a + c.qty, 0)
    return Math.max(0, max - usedDb - usedCart)
  }, [activeItem, cart, catalog, itemTotals])

  const cartPanelProps = {
    cart,
    totals,
    isOpen,
    submitting,
    memberId: member?.id,
    onClear: clearCart,
    onUpdateQty: updateQty,
    onRemove: removeLine,
    onSubmit: () => void submit(),
  }

  function handleAdd() {
    if (!activeItem) return
    addItem(activeItem, qty)
  }

  const remainingMs = useCountdown(
    isOpen && orderWindow ? orderWindow.end_time : null,
  )
  const countdownLabel = formatCountdown(remainingMs)

  const orderSubtitle = useMemo(() => {
    if (loading) {
      return (
        <span className="block text-muted-foreground">
          Memuat katalog dan status periode order…
        </span>
      )
    }

    const statusLine =
      isOpen && orderWindow?.orderanke != null
        ? `${formatOrderankeLabel(orderWindow.orderanke)} buka — isi keranjang lalu submit (min. total qty 2).`
        : null
    // Order ditutup — ${detailText || 'tunggu admin buka periode berikutnya.'}

    return (
      <span className="block space-y-1">
        {isAdmin ? (
          <span className="block">
            Beli senjata, ammo, vest & attachment. Harga & limit item mengikuti
            role admin (tanpa markup 10%).
          </span>
        ) : (
          <span className="block">
            Pilih item, isi keranjang, lalu submit order saat periode buka.
          </span>
        )}
        {statusLine ? (
          <span className="block font-medium text-primary">{statusLine}</span>
        ) : null}
      </span>
    )
  }, [
    loading,
    isOpen,
    orderWindow?.orderanke,
    isAdmin,
  ])

  return (
    <PageStack>
      <PageHeader title="Order" subtitle={orderSubtitle}>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="space-y-4 ">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isOpen ? 'default' : 'destructive'}>
              {statusText}
            </Badge>
            {orderWindow?.orderanke != null ? (
              <Badge variant="outline">
                {formatOrderankeLabel(orderWindow.orderanke)}
              </Badge>
            ) : null}
          </div>

          {orderWindow && isOpen ? (
            <>
              {countdownLabel ? (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
                  <p className="text-[10px] font-bold tracking-[0.12em] text-amber-200/80 uppercase">
                    Order tutup dalam
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-amber-100 tabular-nums">
                    {remainingMs === 0 ? 'Waktu habis' : countdownLabel}
                  </p>
                </div>
              ) : null}
              <dl className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                <dt className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  Buka
                </dt>
                <dd className="mt-1 text-sm leading-snug font-medium text-foreground">
                  {formatWindowDateTimeCompact(orderWindow.start_time)}
                </dd>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
                <dt className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  Tutup
                </dt>
                <dd className="mt-1 text-sm leading-snug font-medium text-foreground">
                  {formatWindowDateTimeCompact(orderWindow.end_time)}
                </dd>
              </div>
            </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{detailText}</p>
          )}

          <div className="space-y-2 border-t border-border/50 pt-3">
            {isAdmin ? (
              <p className="text-xs text-muted-foreground">
                Harga admin (tanpa markup 10%)
              </p>
            ) : null}

            {!member?.id ? (
              <p className="text-xs text-destructive">
                Akun belum terhubung ke member — submit tidak bisa.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pemesan:{' '}
                <span className="font-semibold text-foreground">
                  {member.nama}
                </span>
                <span className="text-muted-foreground/80"> · {member.role}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <ToastNotice
        message={message?.text ?? null}
        tone={
          message?.type === 'error'
            ? 'error'
            : message?.type === 'info'
              ? 'info'
              : 'success'
        }
        onDismiss={clearMessage}
      />

      {loading ? <LoadingState message="Memuat katalog…" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/60 bg-card/80">
              <CardHeader>
                <CardTitle className="text-primary">Tambah Item</CardTitle>
                <CardAction className="lg:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCartOpen(true)}
                  >
                    <ShoppingCart className="size-4" />
                    Keranjang
                    {totals.qty > 0 ? (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {totals.qty}
                      </span>
                    ) : null}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>Kategori</Label>
                    <Select
                      value={category}
                      onValueChange={(v) => {
                        setCategory(v as CatalogCategory)
                        setSelectedItem('')
                      }}
                      disabled={!isOpen}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATALOG_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Item</Label>
                    <Select
                      value={activeItem?.name || ''}
                      onValueChange={setSelectedItem}
                      disabled={!isOpen || items.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.name} value={item.name}>
                            {item.name} (
                            {fmtUsd(getDisplayPrice(item, catalog, role))})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) =>
                        setQty(Math.max(1, Number(e.target.value) || 1))
                      }
                      disabled={!isOpen}
                    />
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    {remainingForActive != null ? (
                      <p className="text-[11px] text-muted-foreground">
                        Sisa kuota global: {remainingForActive}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Tanpa max global
                      </p>
                    )}
                    <Button
                      onClick={handleAdd}
                      disabled={!isOpen || !activeItem}
                    >
                      Tambah ke Cart
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Harga</TableHead>
                      <TableHead>Max</TableHead>
                      <TableHead>Terpakai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const max = getItemMax(item.name, catalog)
                      const used = itemTotals[normItemName(item.name)] || 0
                      return (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-foreground/90">
                            {fmtUsd(getDisplayPrice(item, catalog, role))}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {max == null ? '—' : max}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {used}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="hidden border-border/60 bg-card/80 lg:block">
              <CardContent className="pt-6">
                <OrderCartPanel {...cartPanelProps} className="flex min-h-[28rem] flex-col" />
              </CardContent>
            </Card>
          </div>

          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetContent
              side="right"
              className="flex w-[min(100vw,22rem)] flex-col gap-0 p-0 sm:max-w-sm"
            >
              <SheetHeader className="border-b border-border px-4 py-3 text-left">
                <SheetTitle>Keranjang</SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
                <OrderCartPanel
                  {...cartPanelProps}
                  className="flex h-full min-h-0 flex-col"
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}
    </PageStack>
  )
}
