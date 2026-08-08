import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { PageHeader, PageStack } from '@/components/layout/PageHeader'
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog'
import {
  EmptyState,
  ErrorState,
  InlineMessage,
  LoadingState,
} from '@/components/ui/StatusBlock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import {
  ADMIN_CATALOG_CATEGORIES,
  fetchAdminCatalog,
  toggleCatalogActive,
  upsertCatalogItem,
  type CatalogAdminItem,
  type CatalogUpsertInput,
} from '@/lib/adminCatalog'
import { getEffectivePrice } from '@/lib/catalog'
import { fmtUsd } from '@/lib/format'

const emptyForm: CatalogUpsertInput = {
  name: '',
  kategori: 'Gun',
  price: 0,
  scrap: null,
  max_limit: 1,
  is_active: true,
  metadata: { note: '' },
}

export function CatalogPage() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState<CatalogAdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
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
      scrap: item.scrap,
      max_limit: item.max_limit ?? 1,
      is_active: item.is_active,
      metadata: { note: item.metadata?.note || '' },
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const res = await upsertCatalogItem(form, editing?.id)
    setSaving(false)
    if (!res.ok) {
      setMessage(res.error)
      return
    }
    setDialogOpen(false)
    setMessage('Berhasil disimpan')
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
      setMessage(res.error)
      return
    }
    setMessage(
      `Item ${!toggleTarget.is_active ? 'diaktifkan' : 'dinonaktifkan'}`,
    )
    await refresh()
  }

  if (!isAdmin) return null

  return (
    <PageStack>
      <PageHeader
        title="Admin Catalog"
        subtitle="CRUD catalog_items (tanpa service role)"
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

      {message ? <InlineMessage tone="success">{message}</InlineMessage> : null}
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
              <Label>Harga dasar</Label>
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

      {!loading
        ? Object.entries(grouped).map(([cat, rows]) =>
            rows.length ? (
              <Card key={cat} className="border-border/60 bg-card/80">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-primary">{cat}</CardTitle>
                    <CardDescription>{rows.length} item</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead>Base</TableHead>
                        <TableHead>Jual*</TableHead>
                        <TableHead>Scrap</TableHead>
                        <TableHead>Max</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>
                            <div className="font-medium">{it.name}</div>
                            {it.metadata?.note ? (
                              <div className="text-xs text-muted-foreground">
                                {it.metadata.note}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-muted-foreground">
                            {fmtUsd(it.price)}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums">
                            {fmtUsd(
                              getEffectivePrice(String(it.kategori), it.price),
                            )}
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
                            >
                              {it.is_active ? 'Aktif' : 'Off'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(it)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setToggleTarget(it)}
                              >
                                {it.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="px-6 pt-2 text-xs text-muted-foreground">
                    *Harga jual non-admin (Gun/Attachment × 1.1)
                  </p>
                </CardContent>
              </Card>
            ) : null,
          )
        : null}

      {!loading && !items.length ? (
        <EmptyState title="Katalog kosong" message="Tambah item pertama." />
      ) : null}
    </PageStack>
  )
}
