import { useMemo, useState } from 'react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
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
  InlineMessage,
  LoadingState,
} from '@/components/ui/StatusBlock'
import { useAuth } from '@/contexts/AuthContext'
import { useOrderCart } from '@/features/order/useOrderCart'
import { useOrderCatalog } from '@/features/order/useOrderCatalog'
import {
  CATALOG_CATEGORIES,
  getDisplayPrice,
  getItemMax,
  type CatalogCategory,
} from '@/lib/catalog'
import { fmtUsd } from '@/lib/format'
import { formatOrderankeLabel } from '@/lib/orderWindow'
import { normItemName } from '@/lib/orderUtils'

export function OrderPage() {
  const { member, isAdmin } = useAuth()
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
  } = useOrderCart({
    catalog,
    itemTotals,
    isOpen,
    orderanke: orderWindow?.orderanke ?? null,
    memberId: member?.id ?? null,
    nama: member?.nama ?? null,
    role,
    onSubmitted: refreshTotals,
  })

  const [category, setCategory] = useState<CatalogCategory>('Gun')
  const [selectedItem, setSelectedItem] = useState('')
  const [qty, setQty] = useState(1)

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

  function handleAdd() {
    if (!activeItem) return
    addItem(activeItem, qty)
  }

  return (
    <PageStack>
      <PageHeader
        title="Order"
        subtitle="Cart + submit ke Supabase (tanpa Discord)"
      >
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </PageHeader>

      <Card className="border-border/60 bg-card/80">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={isOpen ? 'default' : 'destructive'}>
              {statusText}
            </Badge>
            {orderWindow?.orderanke != null ? (
              <Badge variant="outline">
                {formatOrderankeLabel(orderWindow.orderanke)}
              </Badge>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              {isAdmin
                ? 'Harga admin (tanpa markup 10%)'
                : 'Gun/Attachment sudah include markup 10%'}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{detailText}</p>
          {!member?.id ? (
            <p className="mt-2 text-xs text-destructive">
              Akun belum terhubung ke member — submit tidak bisa.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Pemesan: <span className="text-foreground">{member.nama}</span> ·{' '}
              {member.role}
            </p>
          )}
        </CardContent>
      </Card>

      {message ? (
        <InlineMessage
          tone={
            message.type === 'success'
              ? 'success'
              : message.type === 'error'
                ? 'error'
                : 'success'
          }
        >
          {message.text}
        </InlineMessage>
      ) : null}

      {loading ? <LoadingState message="Memuat katalog…" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/60 bg-card/80">
            <CardHeader>
              <CardTitle className="text-primary">Tambah Item</CardTitle>
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
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-primary">
                          {fmtUsd(getDisplayPrice(item, catalog, role))}
                        </TableCell>
                        <TableCell>{max == null ? '—' : max}</TableCell>
                        <TableCell>{used}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-primary">Keranjang</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                Reset
              </Button>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <EmptyState title="Keranjang kosong" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Harga</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Subtotal</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((line, idx) => (
                      <TableRow key={`${line.kategori}-${line.item}-${idx}`}>
                        <TableCell>
                          {line.item}
                          <div className="text-[10px] text-muted-foreground">
                            {line.kategori}
                          </div>
                        </TableCell>
                        <TableCell>{fmtUsd(line.price)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) =>
                              updateQty(idx, Number(e.target.value) || 1)
                            }
                            className="w-16 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-primary">
                          {fmtUsd(line.price * line.qty)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(idx)}
                          >
                            Hapus
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="mt-5 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
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
                className="mt-4 w-full"
                onClick={() => void submit()}
                disabled={
                  submitting || !isOpen || cart.length === 0 || !member?.id
                }
              >
                {submitting ? 'Menyimpan…' : 'Submit Order'}
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Minimal total qty 2 (sama seperti app lama).
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </PageStack>
  )
}
