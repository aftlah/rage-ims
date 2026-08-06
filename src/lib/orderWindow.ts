import { formatWindowDateTime } from './format'
import { supabase } from './supabase'

export type OrderWindow = {
  id: number
  orderanke: number | null
  start_time: string
  end_time: string
  is_active: boolean
}

export type DecodedOrderanke = {
  isDrugs: boolean
  m: number
  w: number
  raw: number
}

export function getNowIso(): string {
  return new Date().toISOString()
}

export function decodeOrderanke(val: number | null | undefined): DecodedOrderanke {
  if (!val) return { isDrugs: false, m: 0, w: 0, raw: 0 }
  const isDrugs = val >= 1000
  const v = isDrugs ? val - 1000 : val
  const m = Math.floor(v / 10)
  const w = v % 10
  return { isDrugs, m, w, raw: v }
}

export function formatOrderankeLabel(orderanke: number | null | undefined): string {
  const { m, w, raw } = decodeOrderanke(orderanke)
  if (!orderanke) return '—'
  return `M${m}-W${w} (#${raw})`
}

/** Active order window — type `drugs` uses orderanke >= 1000. */
export async function fetchActiveOrderWindow(
  type: 'order' | 'drugs' = 'order',
): Promise<{
  window: OrderWindow | null
  error: string | null
}> {
  const now = getNowIso()
  let q = supabase
    .from('order_windows')
    .select('id,orderanke,start_time,end_time,is_active')
    .eq('is_active', true)
    .lte('start_time', now)
    .gte('end_time', now)

  q =
    type === 'drugs'
      ? q.gte('orderanke', 1000)
      : q.lt('orderanke', 1000)

  const { data, error } = await q
    .order('orderanke', { ascending: false })
    .limit(1)

  if (error) {
    return { window: null, error: error.message }
  }

  const row = Array.isArray(data) && data.length ? data[0] : null
  if (!row) return { window: null, error: null }

  return {
    window: {
      id: Number(row.id),
      orderanke: row.orderanke == null ? null : Number(row.orderanke),
      start_time: String(row.start_time),
      end_time: String(row.end_time),
      is_active: Boolean(row.is_active),
    },
    error: null,
  }
}

/** Latest order window by end_time (orderanke < 1000 unless drugs). */
export async function fetchLatestOrderWindow(
  type: 'order' | 'drugs' = 'order',
): Promise<{ window: OrderWindow | null; error: string | null }> {
  let q = supabase
    .from('order_windows')
    .select('id,orderanke,start_time,end_time,is_active')
    .not('orderanke', 'is', null)

  q =
    type === 'drugs'
      ? q.gte('orderanke', 1000)
      : q.lt('orderanke', 1000)

  const { data, error } = await q
    .order('end_time', { ascending: false })
    .order('orderanke', { ascending: false })
    .limit(1)

  if (error) return { window: null, error: error.message }
  const row = Array.isArray(data) && data.length ? data[0] : null
  if (!row) return { window: null, error: null }

  return {
    window: {
      id: Number(row.id),
      orderanke: row.orderanke == null ? null : Number(row.orderanke),
      start_time: String(row.start_time),
      end_time: String(row.end_time),
      is_active: Boolean(row.is_active),
    },
    error: null,
  }
}

export function describeOrderWindow(win: OrderWindow | null): {
  isOpen: boolean
  statusText: string
  detailText: string
} {
  if (!win) {
    return {
      isOpen: false,
      statusText: 'Order ditutup',
      detailText: 'Tidak ada Periode Order Aktif',
    }
  }

  return {
    isOpen: true,
    statusText: 'Order sedang dibuka',
    detailText: `Buka: ${formatWindowDateTime(win.start_time)} • Tutup: ${formatWindowDateTime(win.end_time)} • Periode: ${formatOrderankeLabel(win.orderanke)}`,
  }
}
