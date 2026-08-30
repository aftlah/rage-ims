import { fmtUsd } from './format'
import { fetchOrdersForDashboard, type OrderRow } from './rekapOrders'

export type MemberOrderStats = {
  lineCount: number
  orderCount: number
  totalUsd: number
  unpaidLines: number
  unpaidTotal: number
  undeliveredLines: number
}

export type MemberOrderSummary = {
  recent: OrderRow[]
  stats: MemberOrderStats
  error: string | null
}

function summarizeMemberOrders(rows: OrderRow[]): MemberOrderStats {
  const orderIds = new Set(rows.map((r) => r.order_id).filter(Boolean))
  let unpaidLines = 0
  let unpaidTotal = 0
  let undeliveredLines = 0

  for (const row of rows) {
    if (!row.paid) {
      unpaidLines += 1
      unpaidTotal += row.subtotal || 0
    }
    if (!row.delivered) undeliveredLines += 1
  }

  return {
    lineCount: rows.length,
    orderCount: orderIds.size,
    totalUsd: rows.reduce((sum, r) => sum + (r.subtotal || 0), 0),
    unpaidLines,
    unpaidTotal,
    undeliveredLines,
  }
}

/** Recent order lines + unpaid/undelivered stats for one member. */
export async function fetchMemberOrderSummary(
  memberNama: string,
  recentLimit = 12,
): Promise<MemberOrderSummary> {
  const nama = String(memberNama || '').trim()
  if (!nama) {
    return {
      recent: [],
      stats: summarizeMemberOrders([]),
      error: 'Nama member tidak ditemukan',
    }
  }

  const { data, error } = await fetchOrdersForDashboard({
    month: null,
    week: null,
    name: nama,
  })

  if (error) {
    return {
      recent: [],
      stats: summarizeMemberOrders([]),
      error,
    }
  }

  const sorted = [...data].sort(
    (a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime(),
  )

  return {
    recent: sorted.slice(0, recentLimit),
    stats: summarizeMemberOrders(sorted),
    error: null,
  }
}

export function formatMemberOrderStatsLine(stats: MemberOrderStats): string {
  const parts: string[] = []
  if (stats.unpaidLines > 0) {
    parts.push(`${stats.unpaidLines} baris belum bayar (${fmtUsd(stats.unpaidTotal)})`)
  }
  if (stats.undeliveredLines > 0) {
    parts.push(`${stats.undeliveredLines} baris belum delivered`)
  }
  if (!parts.length) return 'Semua order terpantau sudah bayar & delivered'
  return parts.join(' · ')
}
