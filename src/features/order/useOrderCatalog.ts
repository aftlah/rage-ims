import { useCallback, useEffect, useState } from 'react'
import {
  fetchCatalog,
  type CatalogByCategory,
  EMPTY_CATALOG,
} from '../../lib/catalog'
import {
  describeOrderWindow,
  fetchActiveOrderWindow,
  type OrderWindow,
} from '../../lib/orderWindow'
import { fetchItemTotals, type ItemTotals } from '../../lib/orders'

type OrderCatalogState = {
  catalog: CatalogByCategory
  orderWindow: OrderWindow | null
  itemTotals: ItemTotals
  isOpen: boolean
  statusText: string
  detailText: string
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  refreshTotals: () => Promise<void>
}

export function useOrderCatalog(): OrderCatalogState {
  const [catalog, setCatalog] = useState<CatalogByCategory>(EMPTY_CATALOG)
  const [orderWindow, setOrderWindow] = useState<OrderWindow | null>(null)
  const [itemTotals, setItemTotals] = useState<ItemTotals>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshTotals = useCallback(async (orderanke?: number | null) => {
    const periode = orderanke ?? null
    if (!periode) {
      setItemTotals({})
      return
    }
    const totals = await fetchItemTotals(periode)
    setItemTotals(totals)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [catalogRes, windowRes] = await Promise.all([
        fetchCatalog(),
        fetchActiveOrderWindow(),
      ])

      if (catalogRes.error) {
        setError(catalogRes.error)
      } else if (windowRes.error) {
        setError(windowRes.error)
      }

      setCatalog(catalogRes.catalog)
      setOrderWindow(windowRes.window)

      if (windowRes.window?.orderanke) {
        const totals = await fetchItemTotals(windowRes.window.orderanke)
        setItemTotals(totals)
      } else {
        setItemTotals({})
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data order')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const described = describeOrderWindow(orderWindow)

  return {
    catalog,
    orderWindow,
    itemTotals,
    isOpen: described.isOpen,
    statusText: described.statusText,
    detailText: described.detailText,
    loading,
    error,
    refresh,
    refreshTotals: () => refreshTotals(orderWindow?.orderanke ?? null),
  }
}
