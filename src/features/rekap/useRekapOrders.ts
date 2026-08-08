import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchCatalog,
  type CatalogByCategory,
  EMPTY_CATALOG,
} from '../../lib/catalog'
import { fetchActiveOrderWindow } from '../../lib/orderWindow'
import {
  applyClientFilters,
  archiveOrderById,
  fetchOrdersForDashboard,
  groupOrdersByBatch,
  summarizeByUser,
  summarizeFiltered,
  updateOrderDelivered,
  updatePersonOrderPaid,
  type DeliveredFilter,
  type OrderRow,
} from '../../lib/rekapOrders'

type UseRekapOrdersArgs = {
  isAdmin: boolean
  memberNama: string | null
}

export function useRekapOrders({ isAdmin, memberNama }: UseRekapOrdersArgs) {
  const [month, setMonth] = useState<number | null>(null)
  const [week, setWeek] = useState<number | null>(null)
  const [periodReady, setPeriodReady] = useState(false)
  const [name, setName] = useState('')
  const [item, setItem] = useState('')
  const [delivered, setDelivered] = useState<DeliveredFilter>('all')

  const [catalog, setCatalog] = useState<CatalogByCategory>(EMPTY_CATALOG)
  const [rows, setRows] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const now = new Date()
      let nextMonth = now.getMonth() + 1
      let nextWeek: number | null = null
      try {
        const { window: win } = await fetchActiveOrderWindow()
        if (win?.orderanke) {
          nextMonth = Math.floor(win.orderanke / 10)
          nextWeek = win.orderanke % 10
        }
      } catch {
        // keep calendar defaults
      }
      if (cancelled) return
      setMonth(nextMonth)
      setWeek(nextWeek)
      setPeriodReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!periodReady || month == null) return
    setLoading(true)
    setError(null)
    try {
      const [catRes, orderRes] = await Promise.all([
        fetchCatalog(),
        fetchOrdersForDashboard({
          month,
          week,
          name: isAdmin ? name : memberNama || '',
        }),
      ])
      if (catRes.error) console.warn(catRes.error)
      setCatalog(catRes.catalog)
      if (orderRes.error) {
        setError(orderRes.error)
        setRows([])
      } else {
        setRows(orderRes.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat rekap')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, memberNama, month, name, periodReady, week])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(
    () =>
      applyClientFilters(rows, {
        item,
        delivered,
        memberNama,
        restrictToMember: !isAdmin,
      }),
    [delivered, isAdmin, item, memberNama, rows],
  )

  const stats = useMemo(
    () => summarizeFiltered(filtered, catalog),
    [catalog, filtered],
  )
  const byUser = useMemo(
    () => summarizeByUser(filtered, catalog),
    [catalog, filtered],
  )
  const batches = useMemo(() => groupOrdersByBatch(filtered), [filtered])

  const toggleDelivered = useCallback(
    async (row: OrderRow) => {
      if (!isAdmin) return
      setBusyId(row.id)
      setMessage(null)
      const next = !row.delivered
      const result = await updateOrderDelivered(row.id, next)
      setBusyId(null)
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, delivered: next } : r)),
      )
      setMessage(next ? 'Status: Sudah' : 'Status: Belum')
    },
    [isAdmin],
  )

  const togglePaid = useCallback(
    async (row: OrderRow, actor?: string) => {
      if (!isAdmin) return
      setBusyId(row.id)
      setMessage(null)
      const next = !row.paid
      const result = await updatePersonOrderPaid({
        nama: row.nama,
        orderanke: row.orderanke,
        paid: next,
        actor,
      })
      setBusyId(null)
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      setRows((prev) =>
        prev.map((r) =>
          r.nama === row.nama && r.orderanke === row.orderanke
            ? { ...r, paid: next }
            : r,
        ),
      )
      setMessage(next ? 'Pembayaran: Lunas' : 'Pembayaran: Belum lunas')
    },
    [isAdmin],
  )

  const archiveRow = useCallback(
    async (row: OrderRow) => {
      if (!isAdmin) return
      const ok = window.confirm(
        `Arsipkan item "${row.item}" milik ${row.nama}? (soft delete)`,
      )
      if (!ok) return
      setBusyId(row.id)
      setMessage(null)
      const result = await archiveOrderById(row.id)
      setBusyId(null)
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      setMessage('Item dipindahkan ke arsip')
    },
    [isAdmin],
  )

  return {
    month: month ?? new Date().getMonth() + 1,
    setMonth,
    week,
    setWeek,
    name,
    setName,
    item,
    setItem,
    delivered,
    setDelivered,
    catalog,
    loading: loading || !periodReady,
    error,
    message,
    busyId,
    filtered,
    stats,
    byUser,
    batches,
    refresh,
    toggleDelivered,
    togglePaid,
    archiveRow,
  }
}
