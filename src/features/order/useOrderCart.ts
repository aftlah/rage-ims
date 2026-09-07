import { useCallback, useMemo, useState } from 'react'
import { useToast } from '../../contexts/ToastContext'
import type { CatalogByCategory, CatalogItem } from '../../lib/catalog'
import {
  addItemToCart,
  removeCartLine,
  setCartQty,
  submitOrder,
  type CartLine,
  type ItemTotals,
} from '../../lib/orders'

type UseOrderCartArgs = {
  catalog: CatalogByCategory
  itemTotals: ItemTotals
  isOpen: boolean
  orderanke: number | null
  memberId: number | null
  nama: string | null
  role: string | null
  maintenanceBlocked?: boolean
  onSubmitted: () => Promise<void>
}

export function useOrderCart(args: UseOrderCartArgs) {
  const toast = useToast()
  const [cart, setCart] = useState<CartLine[]>([])
  const [submitting, setSubmitting] = useState(false)

  const totals = useMemo(() => {
    const amount = cart.reduce((a, c) => a + c.price * c.qty, 0)
    const qty = cart.reduce((a, c) => a + c.qty, 0)
    const scrap = cart.reduce((a, c) => a + (c.scrap || 0) * c.qty, 0)
    return { amount, qty, scrap }
  }, [cart])

  const addItem = useCallback(
    (item: CatalogItem, qty: number) => {
      const result = addItemToCart({
        cart,
        catalog: args.catalog,
        itemTotals: args.itemTotals,
        item,
        qty,
        role: args.role,
        nama: args.nama,
        isOpen: args.isOpen,
      })
      if ('error' in result) {
        toast.error(result.error)
        return false
      }
      setCart(result.cart)
      toast.success(`${item.name} ditambahkan`)
      return true
    },
    [args.catalog, args.itemTotals, args.isOpen, args.nama, args.role, cart, toast],
  )

  const updateQty = useCallback((index: number, qty: number) => {
    setCart((prev) => setCartQty(prev, index, qty))
  }, [])

  const removeLine = useCallback((index: number) => {
    setCart((prev) => removeCartLine(prev, index))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const submit = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (args.maintenanceBlocked) {
        toast.error('Sedang maintenance: Sebentar yaa kawan')
        return
      }
      if (!args.memberId || !args.nama) {
        toast.error('Akun belum terhubung ke member')
        return
      }
      if (!args.orderanke) {
        toast.error('Periode order aktif tidak ditemukan')
        return
      }

      const result = await submitOrder({
        cart,
        catalog: args.catalog,
        itemTotals: args.itemTotals,
        memberId: args.memberId,
        nama: args.nama,
        role: args.role,
        orderanke: args.orderanke,
        isOpen: args.isOpen,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      setCart([])
      await args.onSubmitted()
      toast.success('Berhasil disimpan')
    } catch {
      toast.error('Gagal menyimpan (network error)')
    } finally {
      setSubmitting(false)
    }
  }, [args, cart, submitting, toast])

  return {
    cart,
    totals,
    submitting,
    addItem,
    updateQty,
    removeLine,
    clearCart,
    submit,
  }
}
