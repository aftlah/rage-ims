import {
  CATALOG_CATEGORIES,
  EMPTY_CATALOG,
  fetchCatalog,
  getItemBasePrice,
  type CatalogByCategory,
} from './catalog'
import { fmtUsd } from './format'
import { formatOrderankeLabel } from './orderWindow'
import { fetchOrdersForDashboard, type OrderRow } from './rekapOrders'
import { supabase } from './supabase'

export type WeeklyProfitLine = {
  id: number
  nama: string
  item: string
  kategori: string | null
  qty: number
  hargaJual: number
  hargaAsli: number
  subtotalJual: number
  subtotalAsli: number
  untung: number
  waktu: string
}

export type WeeklyProfitItemTotal = {
  item: string
  kategori: string | null
  qty: number
  subtotalJual: number
  subtotalAsli: number
  untung: number
}

export type WeeklyProfitMemberTotal = {
  nama: string
  qty: number
  subtotalJual: number
  subtotalAsli: number
  untung: number
  lineCount: number
}

export type WeeklyProfitReport = {
  orderanke: number
  label: string
  lines: WeeklyProfitLine[]
  byItem: WeeklyProfitItemTotal[]
  byMember: WeeklyProfitMemberTotal[]
  totals: {
    qty: number
    subtotalJual: number
    subtotalAsli: number
    untung: number
    lineCount: number
  }
}

function findCatalogBasePrice(
  itemName: string,
  kategori: string | null,
  catalog: CatalogByCategory,
): number | null {
  const name = String(itemName || '').trim()
  if (!name) return null

  if (kategori && (CATALOG_CATEGORIES as readonly string[]).includes(kategori)) {
    const found = catalog[kategori as keyof CatalogByCategory]?.find(
      (i) => i.name.toLowerCase() === name.toLowerCase(),
    )
    if (found) return getItemBasePrice(found)
  }

  for (const cat of CATALOG_CATEGORIES) {
    const found = catalog[cat].find(
      (i) => i.name.toLowerCase() === name.toLowerCase(),
    )
    if (found) return getItemBasePrice(found)
  }

  return null
}

function resolveBaseUnitPrice(
  row: OrderRow,
  catalog: CatalogByCategory,
): number {
  const fromCatalog = findCatalogBasePrice(row.item, row.kategori, catalog)
  if (fromCatalog != null) return fromCatalog
  return Number(row.harga) || 0
}

function buildLine(
  row: OrderRow,
  catalog: CatalogByCategory,
): WeeklyProfitLine {
  const qty = Number(row.qty) || 0
  const hargaJual = Number(row.harga) || 0
  const hargaAsli = resolveBaseUnitPrice(row, catalog)
  const subtotalJual = Number(row.subtotal) || hargaJual * qty
  const subtotalAsli = hargaAsli * qty
  const untung = subtotalJual - subtotalAsli

  return {
    id: row.id,
    nama: row.nama,
    item: row.item,
    kategori: row.kategori,
    qty,
    hargaJual,
    hargaAsli,
    subtotalJual,
    subtotalAsli,
    untung,
    waktu: row.waktu,
  }
}

function aggregateByItem(lines: WeeklyProfitLine[]): WeeklyProfitItemTotal[] {
  const map = new Map<string, WeeklyProfitItemTotal>()
  for (const line of lines) {
    const key = line.item
    const prev = map.get(key) || {
      item: line.item,
      kategori: line.kategori,
      qty: 0,
      subtotalJual: 0,
      subtotalAsli: 0,
      untung: 0,
    }
    prev.qty += line.qty
    prev.subtotalJual += line.subtotalJual
    prev.subtotalAsli += line.subtotalAsli
    prev.untung += line.untung
    map.set(key, prev)
  }
  return [...map.values()].sort(
    (a, b) => b.untung - a.untung || a.item.localeCompare(b.item),
  )
}

function aggregateByMember(lines: WeeklyProfitLine[]): WeeklyProfitMemberTotal[] {
  const map = new Map<string, WeeklyProfitMemberTotal>()
  for (const line of lines) {
    const prev = map.get(line.nama) || {
      nama: line.nama,
      qty: 0,
      subtotalJual: 0,
      subtotalAsli: 0,
      untung: 0,
      lineCount: 0,
    }
    prev.qty += line.qty
    prev.subtotalJual += line.subtotalJual
    prev.subtotalAsli += line.subtotalAsli
    prev.untung += line.untung
    prev.lineCount += 1
    map.set(line.nama, prev)
  }
  return [...map.values()].sort(
    (a, b) => b.untung - a.untung || a.nama.localeCompare(b.nama),
  )
}

export async function fetchOrderankeWeekOptions(): Promise<{
  options: number[]
  error: string | null
}> {
  const fromWindows = await supabase
    .from('order_windows')
    .select('orderanke')
    .lt('orderanke', 1000)
    .not('orderanke', 'is', null)
    .order('orderanke', { ascending: false })

  const set = new Set<number>()

  if (!fromWindows.error) {
    for (const row of fromWindows.data || []) {
      const n = Number(row.orderanke)
      if (n > 0 && n < 1000) set.add(n)
    }
  }

  const fromOrders = await supabase
    .from('orders')
    .select('orderanke')
    .lt('orderanke', 1000)
    .not('orderanke', 'is', null)
    .order('orderanke', { ascending: false })
    .limit(500)

  if (!fromOrders.error) {
    for (const row of fromOrders.data || []) {
      const n = Number(row.orderanke)
      if (n > 0 && n < 1000) set.add(n)
    }
  }

  const options = [...set].sort((a, b) => b - a)
  return {
    options,
    error: fromWindows.error?.message || fromOrders.error?.message || null,
  }
}

export async function fetchWeeklyProfitReport(
  orderanke: number,
): Promise<{ report: WeeklyProfitReport | null; error: string | null }> {
  const month = Math.floor(orderanke / 10)
  const week = orderanke % 10

  const [catalogRes, ordersRes] = await Promise.all([
    fetchCatalog(),
    fetchOrdersForDashboard({ month, week, name: '' }),
  ])

  if (catalogRes.error) {
    return { report: null, error: catalogRes.error }
  }
  if (ordersRes.error) {
    return { report: null, error: ordersRes.error }
  }

  const catalog = catalogRes.catalog || EMPTY_CATALOG
  const lines = ordersRes.data.map((row) => buildLine(row, catalog))

  const totals = lines.reduce(
    (acc, line) => {
      acc.qty += line.qty
      acc.subtotalJual += line.subtotalJual
      acc.subtotalAsli += line.subtotalAsli
      acc.untung += line.untung
      acc.lineCount += 1
      return acc
    },
    { qty: 0, subtotalJual: 0, subtotalAsli: 0, untung: 0, lineCount: 0 },
  )

  return {
    report: {
      orderanke,
      label: formatOrderankeLabel(orderanke),
      lines,
      byItem: aggregateByItem(lines),
      byMember: aggregateByMember(lines),
      totals,
    },
    error: null,
  }
}

export function formatProfitSummary(report: WeeklyProfitReport): string {
  return `${report.label}: jual ${fmtUsd(report.totals.subtotalJual)} · asli ${fmtUsd(report.totals.subtotalAsli)} · untung ${fmtUsd(report.totals.untung)}`
}
