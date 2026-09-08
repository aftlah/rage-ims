import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui/StatusBlock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import {
  ADMIN_CATALOG_CATEGORIES,
  fetchAdminCatalog,
  toggleCatalogActive,
  upsertCatalogItem,
  type CatalogAdminItem,
  type CatalogUpsertInput,
} from '@/lib/adminCatalog'
import { fmtUsd } from '@/lib/format'

const emptyForm: CatalogUpsertInput = {
  name: '',
  kategori: 'Gun',
  price: 0,
  sell_price: 0,
  scrap: null,
  max_limit: 1,
  is_active: true,
  metadata: { note: '' },
}

export function CatalogPage() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<CatalogAdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CatalogAdminItem | null>(null)
  const [form, setForm] = useState<CatalogUpsertInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<CatalogAdminItem | null>(
    null,
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetchAdminCatalog()
    if (res.error) setError(res.error)
    setItems(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const grouped = useMemo(() => {
    const map: Record<string, CatalogAdminItem[]> = {}
    for (const cat of ADMIN_CATALOG_CATEGORIES) map[cat] = []
    for (const it of items) {
      const key = String(it.kategori || 'Others')
      if (!map[key]) map[key] = []
      map[key].push(it)
    }
    return map
  }, [items])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(item: CatalogAdminItem) {
    setEditing(item)
    setForm({
      name: item.name,
      kategori: String(item.kategori),
      price: item.price,
      sell_price:
        item.sell_price != null && item.sell_price > 0
          ? item.sell_price
          : item.price,
      scrap: item.scrap,
      max_limit: item.max_limit ?? 1,
      is_active: item.is_active,
      metadata: { note: item.metadata?.note || '' },
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const res = await upsertCatalogItem(form, editing?.id)
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    setDialogOpen(false)
    toast.success('Berhasil disimpan')
    await refresh()
  }

  async function confirmToggle() {
    if (!toggleTarget) return
    const res = await toggleCatalogActive(
      toggleTarget.id,
      !toggleTarget.is_active,
    )
    setToggleTarget(null)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success(
      `Item ${!toggleTarget.is_active ? 'diaktifkan' : 'dinonaktifkan'}`,
    )
    await refresh()
  }

  if (!isAdmin) return null

  return (
    <PageStack>
      <PageHeader
        title="Admin Catalog"
        subtitle="Atur item dan harga jual yang dipakai di Order"
      >
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" />
          Tambah Item
        </Button>
      </PageHeader>

      {error ? <ErrorState message={error} /> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border/60 bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Item' : 'Tambah Item'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Kategori</Label>
              <Select
                value={form.kategori}
                onValueChange={(v) => setForm((f) => ({ ...f, kategori: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_CATALOG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Nama</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Harga base</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    price: Number(e.target.value) || 0,
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Modal / harga asli untuk hitung profit.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Harga jual</Label>
              <Input
                type="number"
                value={form.sell_price}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sell_price: Number(e.target.value) || 0,
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Harga yang dibayar member di Order.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Scrap</Label>
              <Input
                type="number"
                step="0.1"
                value={form.scrap ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    scrap:
                      e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Max limit</Label>
              <Input
                type="number"
                min={1}
                value={form.max_limit}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    max_limit: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Note (metadata)</Label>
              <Input
                value={form.metadata?.note || ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    metadata: { note: e.target.value },
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="catalog-active"
                checked={form.is_active}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, is_active: v === true }))
                }
              />
              <Label htmlFor="catalog-active">Aktif</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={`${toggleTarget?.is_active ? 'Nonaktifkan' : 'Aktifkan'} item?`}
        description={`${toggleTarget?.name ?? ''} akan ${
          toggleTarget?.is_active ? 'disembunyikan' : 'ditampilkan'
        } di katalog order.`}
        confirmLabel="Ya, lanjutkan"
        onConfirm={() => confirmToggle()}
      />

      {loading ? <LoadingState message="Memuat katalog…" /> : null}

      {!loading && items.length ? (
        <Card className="border-border/60 bg-card/80 [--card-spacing:--spacing(3)]">
          <CardContent className="px-0 pb-3 pt-3">
            {Object.entries(grouped).map(([cat, rows]) =>
              rows.length ? (
                <section key={cat} className="not-first:mt-3">
                  <div className="flex items-baseline gap-2 border-b border-border/40 px-3 pb-1.5 sm:px-4">
                    <h3 className="text-sm font-semibold text-primary">{cat}</h3>
                    <span className="text-xs text-muted-foreground">
                      {rows.length} item
                    </span>
                  </div>
                  <Table
                    containerClassName="rounded-none border-0 shadow-none [&_th]:h-8 [&_th]:py-1 [&_td]:py-1.5"
                  >
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Base</TableHead>
                        <TableHead>Jual</TableHead>
                        <TableHead>Scrap</TableHead>
                        <TableHead>Max</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((it) => {
                        const jual =
                          it.sell_price != null && it.sell_price > 0
                            ? it.sell_price
                            : it.price
                        return (
                        <TableRow key={it.id}>
                          <TableCell className="whitespace-normal">
                            <div className="font-medium leading-tight">{it.name}</div>
                            {it.metadata?.note ? (
                              <div className="mt-0.5 text-xs leading-tight text-muted-foreground">
                                {it.metadata.note}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-muted-foreground">
                            {fmtUsd(it.price)}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {fmtUsd(jual)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {it.scrap ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {it.max_limit ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={it.is_active ? 'default' : 'destructive'}
                              className="text-[10px]"
                            >
                              {it.is_active ? 'Aktif' : 'Off'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => openEdit(it)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => setToggleTarget(it)}
                              >
                                {it.is_active ? 'Off' : 'On'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )})}
                    </TableBody>
                  </Table>
                </section>
              ) : null,
            )}
          </CardContent>
        </Card>
      ) : null}

      {!loading && !items.length ? (
        <EmptyState title="Katalog kosong" message="Tambah item pertama." />
      ) : null}
    </PageStack>
  )
}
