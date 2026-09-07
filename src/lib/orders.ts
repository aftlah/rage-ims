import type { CatalogByCategory, CatalogCategory, CatalogItem } from './catalog'
import {
  getEffectivePrice,
  getItemMax,
  MICRO_FULL_ATTACHMENT_BUNDLE_NAME,
  MICRO_FULL_ATTACHMENT_COMPONENTS,
} from './catalog'
import { isMissingColumnError, makeOrderId, normItemName } from './orderUtils'
import { canBuyItem, getRolePermissions } from './rolePermissions'
import { supabase } from './supabase'

export type CartLine = {
  item: string
  kategori: CatalogCategory
  price: number
  qty: number
  scrap: number
}

export type ItemTotals = Record<string, number>

export type OrderInsertRow = {
  order_id: string
  member_id: number
  nama: string
  orderanke: number
  waktu: string
  kategori: string
  item: string
  harga: number
  qty: number
  subtotal: number
  delivered: boolean
}

export async function fetchItemTotals(orderanke: number): Promise<ItemTotals> {
  let { data, error } = await supabase
    .from('orders')
    .select('item,qty,orderanke')
    .eq('orderanke', orderanke)
    .is('deleted_at', null)

  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await supabase
      .from('orders')
      .select('item,qty,orderanke')
      .eq('orderanke', orderanke))
  }

  if (error) {
    console.warn('fetchItemTotals:', error.message)
    return {}
  }

  const map: ItemTotals = {}
  for (const r of data || []) {
    const k = normItemName(r.item)
    map[k] = (map[k] || 0) + (Number(r.qty) || 0)
  }
  return map
}

export async function fetchMemberVestUsed(args: {
  nama: string
  orderanke: number
}): Promise<number> {
  let { data, error } = await supabase
    .from('orders')
    .select('qty,item,order_id')
    .eq('nama', args.nama)
    .eq('orderanke', args.orderanke)
    .ilike('item', 'VEST')
    .is('deleted_at', null)

  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await supabase
      .from('orders')
      .select('qty,item,order_id')
      .eq('nama', args.nama)
      .eq('orderanke', args.orderanke)
      .ilike('item', 'VEST'))
  }

  if (error) {
    console.warn('fetchMemberVestUsed:', error.message)
    return 0
  }

  return (data || []).reduce((a, r) => a + (Number(r.qty) || 0), 0)
}

function cartQtyForItem(cart: CartLine[], itemName: string): number {
  const norm = normItemName(itemName)
  return cart
    .filter((c) => normItemName(c.item) === norm)
    .reduce((a, c) => a + (c.qty || 0), 0)
}

function checkGlobalMax(args: {
  itemName: string
  qtyToAdd: number
  cart: CartLine[]
  itemTotals: ItemTotals
  catalog: CatalogByCategory
}): { ok: true } | { ok: false; message: string } {
  const max = getItemMax(args.itemName, args.catalog)
  if (typeof max !== 'number') return { ok: true }

  const norm = normItemName(args.itemName)
  const usedDb = args.itemTotals[norm] || 0
  const usedCart = cartQtyForItem(args.cart, args.itemName)
  const willBe = usedDb + usedCart + args.qtyToAdd
  if (willBe > max) {
    const remain = Math.max(0, max - usedDb - usedCart)
    return {
      ok: false,
      message: `Maks ${args.itemName} ${max}. Tersisa ${remain}.`,
    }
  }
  return { ok: true }
}

function pushOrIncrement(
  cart: CartLine[],
  line: Omit<CartLine, 'qty'> & { qty: number },
): CartLine[] {
  const next = cart.map((c) => ({ ...c }))
  const existing = next.find(
    (c) => c.item === line.item && c.kategori === line.kategori,
  )
  if (existing) {
    existing.qty += line.qty
    return next
  }
  next.push({ ...line })
  return next
}

export function addItemToCart(args: {
  cart: CartLine[]
  catalog: CatalogByCategory
  itemTotals: ItemTotals
  item: CatalogItem
  qty: number
  role: string | null
  nama: string | null
  isOpen: boolean
}): { cart: CartLine[] } | { error: string } {
  if (!args.isOpen) {
    return { error: 'Order belum dibuka atau sudah ditutup' }
  }
  const qty = Math.max(1, Math.floor(args.qty) || 1)
  const perms = getRolePermissions(args.role, args.catalog)
  const isLeo = String(args.nama || '').toLowerCase() === 'leo'
  const itemName = args.item.name
  const kategori = args.item.kategori

  if (itemName === MICRO_FULL_ATTACHMENT_BUNDLE_NAME) {
    for (const entry of MICRO_FULL_ATTACHMENT_COMPONENTS) {
      const allowed = canBuyItem(entry.name, args.role, args.nama, perms)
      if (!allowed.ok) return { error: allowed.message }
    }

    let nextCart = args.cart.map((c) => ({ ...c }))
    for (const entry of MICRO_FULL_ATTACHMENT_COMPONENTS) {
      const maxCheck = checkGlobalMax({
        itemName: entry.name,
        qtyToAdd: qty,
        cart: nextCart,
        itemTotals: args.itemTotals,
        catalog: args.catalog,
      })
      if (!maxCheck.ok) return { error: maxCheck.message }
    }

    for (const entry of MICRO_FULL_ATTACHMENT_COMPONENTS) {
      const itemInCatalog = (args.catalog[entry.kategori] || []).find(
        (i) => i.name === entry.name,
      )
      if (!itemInCatalog) continue
      nextCart = pushOrIncrement(nextCart, {
        item: entry.name,
        kategori: entry.kategori,
        price: getEffectivePrice(
          entry.kategori,
          itemInCatalog.price,
          args.role,
        ),
        qty,
        scrap: itemInCatalog.scrap || 0,
      })
    }
    return { cart: nextCart }
  }

  const allowed = canBuyItem(itemName, args.role, args.nama, perms)
  if (!allowed.ok) return { error: allowed.message }

  const maxCheck = checkGlobalMax({
    itemName,
    qtyToAdd: qty,
    cart: args.cart,
    itemTotals: args.itemTotals,
    catalog: args.catalog,
  })
  if (!maxCheck.ok) return { error: maxCheck.message }

  if (!isLeo && itemName.toUpperCase() === 'VEST') {
    const currentCartVest = args.cart
      .filter((c) => c.item.toUpperCase() === 'VEST')
      .reduce((a, c) => a + c.qty, 0)
    if (currentCartVest + qty > perms.vestLimit) {
      return {
        error: `Maksimal VEST per orang adalah ${perms.vestLimit}`,
      }
    }
  }

  return {
    cart: pushOrIncrement(args.cart, {
      item: itemName,
      kategori,
      price: getEffectivePrice(kategori, args.item.price, args.role),
      qty,
      scrap: args.item.scrap || 0,
    }),
  }
}

export function setCartQty(cart: CartLine[], index: number, qty: number): CartLine[] {
  const next = cart.map((c) => ({ ...c }))
  if (!next[index]) return cart
  next[index].qty = Math.max(1, Math.floor(qty) || 1)
  return next
}

export function removeCartLine(cart: CartLine[], index: number): CartLine[] {
  return cart.filter((_, i) => i !== index)
}

export function buildOrderRows(
  orderId: string,
  memberId: number,
  nama: string,
  orderanke: number,
  cart: CartLine[],
): OrderInsertRow[] {
  const waktu = new Date().toISOString()
  return cart.map((c) => ({
    order_id: orderId,
    member_id: memberId,
    nama,
    orderanke,
    waktu,
    kategori: c.kategori,
    item: c.item,
    harga: c.price,
    qty: c.qty,
    subtotal: c.price * c.qty,
    delivered: false,
  }))
}

export async function submitOrder(args: {
  cart: CartLine[]
  catalog: CatalogByCategory
  itemTotals: ItemTotals
  memberId: number
  nama: string
  role: string | null
  orderanke: number
  isOpen: boolean
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  if (!args.isOpen) {
    return { ok: false, error: 'Order belum dibuka atau sudah ditutup' }
  }
  if (!args.nama) {
    return { ok: false, error: 'Nama pemesan wajib diisi' }
  }
  if (!args.memberId) {
    return { ok: false, error: 'Akun belum terhubung ke member' }
  }
  if (args.cart.length === 0) {
    return { ok: false, error: 'Keranjang kosong' }
  }

  const totalQty = args.cart.reduce((a, c) => a + (c.qty || 0), 0)
  if (totalQty < 2) {
    return { ok: false, error: 'Jumlah total item minimal 2' }
  }
  if (!args.orderanke) {
    return { ok: false, error: 'Periode order aktif tidak ditemukan' }
  }

  const perms = getRolePermissions(args.role, args.catalog)
  const isLeo = String(args.nama).toLowerCase() === 'leo'

  if (!isLeo && perms.allowed !== 'ALL') {
    for (const c of args.cart) {
      const allowed = canBuyItem(c.item, args.role, args.nama, perms)
      if (!allowed.ok) return { ok: false, error: allowed.message }
    }
  }

  if (!isLeo) {
    const cartVestCount = args.cart
      .filter((c) => String(c.item || '').toUpperCase() === 'VEST')
      .reduce((a, c) => a + (c.qty || 0), 0)
    const existingVest = await fetchMemberVestUsed({
      nama: args.nama,
      orderanke: args.orderanke,
    })
    const totalVest = existingVest + cartVestCount
    if (totalVest > perms.vestLimit) {
      const remaining = Math.max(0, perms.vestLimit - existingVest)
      return {
        ok: false,
        error: `Maksimal VEST per orang ${perms.vestLimit}. Tersisa ${remaining}.`,
      }
    }
  }

  for (const c of args.cart) {
    const max = getItemMax(c.item, args.catalog)
    if (typeof max !== 'number') continue
    const norm = normItemName(c.item)
    const usedDb = args.itemTotals[norm] || 0
    const usedCart = cartQtyForItem(args.cart, c.item)
    if (usedDb + usedCart > max) {
      const remain = Math.max(0, max - usedDb)
      return {
        ok: false,
        error: `Maks ${c.item} ${max}. Tersisa ${remain}.`,
      }
    }
  }

  const orderId = makeOrderId()
  const rows = buildOrderRows(
    orderId,
    args.memberId,
    args.nama,
    args.orderanke,
    args.cart,
  )

  const { error } = await supabase.from('orders').insert(rows).select('id')
  if (error) {
    return { ok: false, error: `Gagal menyimpan: ${error.message}` }
  }

  // Discord: soft-fail — order already saved
  try {
    const scrapByItem: Record<string, number> = {}
    for (const cat of Object.keys(args.catalog) as (keyof typeof args.catalog)[]) {
      for (const it of args.catalog[cat] || []) {
        scrapByItem[it.name] = Number(it.scrap) || 0
      }
    }
    const { sendMemberOrdersDiscord } = await import('./discord')
    await sendMemberOrdersDiscord(
      args.memberId,
      args.nama,
      args.orderanke,
      scrapByItem,
    )
  } catch (e) {
    console.warn('[discord] order submit', e)
  }

  return { ok: true, orderId }
}
