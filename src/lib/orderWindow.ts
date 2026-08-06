import { formatWindowDateTime } from './format'
import { supabase } from './supabase'

export type OrderWindow = {
  id: number
  orderanke: number | null
  start_time: string
  end_time: string
  is_active: boolean
}

export type OrderWindowKind = 'order' | 'drugs'

export type DecodedOrderanke = {
  isDrugs: boolean
  m: number
  w: number
  raw: number
}

export type WindowLiveStatus =
  | 'nonaktif'
  | 'upcoming'
  | 'open'
  | 'expired'

export function getNowIso(): string {
  return new Date().toISOString()
}

export function toLocalInputValue(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}

export function encodeOrderanke(
  month: number,
  week: number,
  kind: OrderWindowKind = 'order',
): number {
  const raw = month * 10 + week
  return kind === 'drugs' ? 1000 + raw : raw
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
  const { m, w, raw, isDrugs } = decodeOrderanke(orderanke)
  if (!orderanke) return '—'
  const prefix = isDrugs ? 'Drugs ' : ''
  return `${prefix}M${m}-W${w} (#${raw})`
}

export function getWindowLiveStatus(
  win: OrderWindow,
  now = Date.now(),
): WindowLiveStatus {
  if (!win.is_active) return 'nonaktif'
  const start = new Date(win.start_time).getTime()
  const end = new Date(win.end_time).getTime()
  if (start > now) return 'upcoming'
  if (end < now) return 'expired'
  return 'open'
}

export function windowStatusLabel(status: WindowLiveStatus): string {
  switch (status) {
    case 'open':
      return 'Aktif sekarang'
    case 'upcoming':
      return 'Belum dimulai'
    case 'expired':
      return 'Berakhir'
    default:
      return 'Nonaktif'
  }
}

function mapRow(row: Record<string, unknown>): OrderWindow {
  return {
    id: Number(row.id),
    orderanke: row.orderanke == null ? null : Number(row.orderanke),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
    is_active: Boolean(row.is_active),
  }
}

/** Active order window — type `drugs` uses orderanke >= 1000. */
export async function fetchActiveOrderWindow(
  type: OrderWindowKind = 'order',
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

  return { window: mapRow(row as Record<string, unknown>), error: null }
}

/** Latest order window by end_time (orderanke < 1000 unless drugs). */
export async function fetchLatestOrderWindow(
  type: OrderWindowKind = 'order',
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

  return { window: mapRow(row as Record<string, unknown>), error: null }
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

/** Auto-close windows whose end_time has passed (mirror expireOrderWindows). */
export async function expirePastOrderWindows(): Promise<number> {
  const now = getNowIso()
  const { data, error } = await supabase
    .from('order_windows')
    .select('id')
    .eq('is_active', true)
    .lt('end_time', now)

  if (error || !data?.length) return 0

  const ids = data.map((r) => r.id).filter(Boolean)
  if (!ids.length) return 0

  const { error: upErr } = await supabase
    .from('order_windows')
    .update({ is_active: false })
    .in('id', ids)

  if (upErr) return 0
  return ids.length
}

export async function fetchAdminOrderWindows(
  kind: OrderWindowKind = 'order',
): Promise<{ data: OrderWindow[]; error: string | null }> {
  await expirePastOrderWindows()

  let q = supabase
    .from('order_windows')
    .select('id,orderanke,start_time,end_time,is_active')
    .order('start_time', { ascending: false })

  q =
    kind === 'drugs'
      ? q.gte('orderanke', 1000)
      : q.or('orderanke.is.null,orderanke.lt.1000')

  const { data, error } = await q

  if (error) {
    return { data: [], error: error.message || 'Gagal memuat jadwal' }
  }

  return {
    data: (data || []).map((r) => mapRow(r as Record<string, unknown>)),
    error: null,
  }
}

export async function hasDuplicateOrderanke(
  orderanke: number,
  excludeId?: number | null,
): Promise<boolean> {
  let q = supabase
    .from('order_windows')
    .select('id')
    .eq('orderanke', orderanke)
    .limit(1)

  if (excludeId) q = q.neq('id', excludeId)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return Array.isArray(data) && data.length > 0
}

export type UpsertOrderWindowInput = {
  month: number
  week: number
  kind: OrderWindowKind
  startLocal: string
  endLocal: string
  isActive?: boolean
  editId?: number | null
}

export async function upsertOrderWindow(
  input: UpsertOrderWindowInput,
): Promise<{ ok: true; id?: number } | { ok: false; error: string }> {
  const { month, week, kind, startLocal, endLocal, editId } = input
  if (!month || !week || month < 1 || month > 12 || week < 1 || week > 5) {
    return { ok: false, error: 'Bulan (1–12) dan minggu (1–5) wajib diisi' }
  }
  if (!startLocal || !endLocal) {
    return { ok: false, error: 'Waktu mulai & selesai wajib diisi' }
  }

  const startIso = localInputToIso(startLocal)
  const endIso = localInputToIso(endLocal)
  if (Number.isNaN(Date.parse(startIso)) || Number.isNaN(Date.parse(endIso))) {
    return { ok: false, error: 'Format waktu tidak valid' }
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return { ok: false, error: 'Waktu selesai harus setelah waktu mulai' }
  }

  const orderanke = encodeOrderanke(month, week, kind)

  try {
    const duplicated = await hasDuplicateOrderanke(orderanke, editId ?? null)
    if (duplicated) {
      const label = formatOrderankeLabel(orderanke)
      return {
        ok: false,
        error: `Periode ${label} sudah pernah dibuat. Pilih periode lain.`,
      }
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Gagal validasi periode',
    }
  }

  const row = {
    start_time: startIso,
    end_time: endIso,
    orderanke,
    is_active: input.isActive ?? true,
  }

  if (editId) {
    const { error } = await supabase
      .from('order_windows')
      .update(row)
      .eq('id', editId)
    if (error) {
      return { ok: false, error: error.message || 'Gagal update jadwal' }
    }
    return { ok: true, id: editId }
  }

  // Drugs: close other active drugs windows first (mirror lama)
  if (kind === 'drugs' && row.is_active) {
    await supabase
      .from('order_windows')
      .update({ is_active: false })
      .eq('is_active', true)
      .gte('orderanke', 1000)
  }

  const { data, error } = await supabase
    .from('order_windows')
    .insert([row])
    .select('id')
    .limit(1)

  if (error) {
    return { ok: false, error: error.message || 'Gagal membuat jadwal' }
  }
  return { ok: true, id: data?.[0]?.id ? Number(data[0].id) : undefined }
}

export async function closeOrderWindow(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = getNowIso()
  const { error } = await supabase
    .from('order_windows')
    .update({ is_active: false, end_time: now })
    .eq('id', id)

  if (error) {
    return { ok: false, error: error.message || 'Gagal menutup jadwal' }
  }
  return { ok: true }
}

export async function setOrderWindowActive(
  id: number,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('order_windows')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) {
    return {
      ok: false,
      error: error.message || 'Gagal mengubah status jadwal',
    }
  }
  return { ok: true }
}

export async function deleteOrderWindow(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('order_windows').delete().eq('id', id)
  if (error) {
    return { ok: false, error: error.message || 'Gagal menghapus jadwal' }
  }
  return { ok: true }
}
