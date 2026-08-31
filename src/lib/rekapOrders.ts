import type { CatalogByCategory } from './catalog'
import { getCatalogScrap } from './catalog'
import { isMissingColumnError } from './orderUtils'
import { supabase } from './supabase'

export type OrderRow = {
  id: number
  order_id: string | null
  order_no: string | null
  nama: string
  orderanke: number
  waktu: string
  kategori: string | null
  item: string
  harga: number
  qty: number
  subtotal: number
  delivered: boolean
  paid: boolean
  scrap_given: boolean
}

export type BatchGroup = {
  orderanke: number
  items: OrderRow[]
  total: number
  count: number
}

export type OrderGroup = {
  key: string
  order_id: string | null
  order_no: string | null
  nama: string
  orderanke: number
  waktu: string
  lines: OrderRow[]
  lineCount: number
  qty: number
  total: number
  deliveredCount: number
  allDelivered: boolean
  paid: boolean
}

export type DeliveredFilter = 'all' | 'delivered' | 'pending'

const FULL_COLS =
  'id,order_id,order_no,nama,orderanke,waktu,kategori,item,harga,qty,subtotal,delivered,paid,scrap_given'
const LITE_COLS =
  'id,order_id,order_no,nama,orderanke,waktu,kategori,item,harga,qty,subtotal'

function escapeIlikePattern(value: string): string {
  return String(value || '').replace(/[%_\\]/g, '\\$&')
}

export function normalizeDashNameFilter(raw: string): string {
  const v = String(raw || '').trim()
  if (!v) return ''
  const lower = v.toLowerCase()
  if (lower === 'semua' || lower === 'semua anggota') return ''
  return v
}

function mapOrderRow(row: Record<string, unknown>): OrderRow {
  return {
    id: Number(row.id),
    order_id: row.order_id == null ? null : String(row.order_id),
    order_no: row.order_no == null ? null : String(row.order_no),
    nama: String(row.nama || 'Unknown'),
    orderanke: Number(row.orderanke) || 0,
    waktu: String(row.waktu || ''),
    kategori: row.kategori == null ? null : String(row.kategori),
    item: String(row.item || ''),
    harga: Number(row.harga) || 0,
    qty: Number(row.qty) || 0,
    subtotal: Number(row.subtotal) || 0,
    delivered: Boolean(row.delivered),
    paid: Boolean(row.paid),
    scrap_given: Boolean(row.scrap_given),
  }
}

/** Mirror fetchOrdersForDashboard from script.js */
export async function fetchOrdersForDashboard(args: {
  month: number | null
  week: number | null
  name: string
}): Promise<{ data: OrderRow[]; error: string | null }> {
  const name = normalizeDashNameFilter(args.name)
  const pageSize = 1000
  const maxPages = 30
  const out: OrderRow[] = []
  let useSoftDelete = true
  let cols = FULL_COLS

  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize
    const to = from + pageSize - 1

    let q = supabase
      .from('orders')
      .select(cols)
      .lt('orderanke', 1000)
      .order('waktu', { ascending: false })

    if (useSoftDelete) q = q.is('deleted_at', null)

    if (args.month) {
      if (args.week) {
        q = q.eq('orderanke', args.month * 10 + args.week)
      } else {
        q = q
          .gte('orderanke', args.month * 10)
          .lt('orderanke', args.month * 10 + 10)
      }
    }

    if (name) q = q.ilike('nama', `%${escapeIlikePattern(name)}%`)

    const { data, error } = await q.range(from, to)
    if (error) {
      if (useSoftDelete && isMissingColumnError(error, 'deleted_at')) {
        useSoftDelete = false
        out.length = 0
        page = -1
        continue
      }
      if (
        cols === FULL_COLS &&
        (String(error.message || '').includes('delivered') ||
          String(error.message || '').includes('paid') ||
          String(error.message || '').includes('scrap_given'))
      ) {
        cols = LITE_COLS
        out.length = 0
        page = -1
        continue
      }
      return { data: out, error: error.message }
    }

    const rows = (data || []).map((r) =>
      mapOrderRow(r as unknown as Record<string, unknown>),
    )
    out.push(...rows)
    if (rows.length < pageSize) break
  }

  return { data: out, error: null }
}

export function applyClientFilters(
  rows: OrderRow[],
  args: {
    item: string
    delivered: DeliveredFilter
    memberNama?: string | null
    restrictToMember?: boolean
  },
): OrderRow[] {
  const itemQ = args.item.trim().toLowerCase()
  return rows.filter((r) => {
    if (args.restrictToMember && args.memberNama) {
      if (r.nama.toLowerCase() !== args.memberNama.toLowerCase()) return false
    }
    if (itemQ && !String(r.item || '').toLowerCase().includes(itemQ)) return false
    if (args.delivered === 'delivered' && !r.delivered) return false
    if (args.delivered === 'pending' && r.delivered) return false
    return true
  })
}

export function groupOrdersByBatch(rows: OrderRow[]): BatchGroup[] {
  const groups: Record<string, BatchGroup> = {}
  for (const r of rows) {
    const key = String(r.orderanke)
    if (!groups[key]) {
      groups[key] = {
        orderanke: r.orderanke,
        items: [],
        total: 0,
        count: 0,
      }
    }
    groups[key].items.push(r)
    groups[key].total += r.subtotal || 0
    groups[key].count += 1
  }
  return Object.values(groups).sort((a, b) => b.orderanke - a.orderanke)
}

function orderGroupKey(row: OrderRow): string {
  if (row.order_id) return `oid:${row.order_id}`
  const waktuKey = row.waktu ? row.waktu.slice(0, 16) : String(row.id)
  return `fb:${row.nama}|${row.orderanke}|${row.order_no || ''}|${waktuKey}`
}

/** Group line items into one row per order submission. */
export function groupOrdersBySubmission(rows: OrderRow[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>()

  for (const row of rows) {
    const key = orderGroupKey(row)
    let group = map.get(key)
    if (!group) {
      group = {
        key,
        order_id: row.order_id,
        order_no: row.order_no,
        nama: row.nama,
        orderanke: row.orderanke,
        waktu: row.waktu,
        lines: [],
        lineCount: 0,
        qty: 0,
        total: 0,
        deliveredCount: 0,
        allDelivered: true,
        paid: row.paid,
      }
      map.set(key, group)
    }
    group.lines.push(row)
    group.lineCount += 1
    group.qty += row.qty || 0
    group.total += row.subtotal || 0
    if (row.delivered) group.deliveredCount += 1
    if (!row.delivered) group.allDelivered = false
    if (row.waktu > group.waktu) group.waktu = row.waktu
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.orderanke - a.orderanke ||
      new Date(b.waktu).getTime() - new Date(a.waktu).getTime() ||
      a.nama.localeCompare(b.nama),
  )
}

export type UserTotal = {
  nama: string
  count: number
  total: number
  scrap: number
  qty: number
}

export function summarizeByUser(
  rows: OrderRow[],
  catalog: CatalogByCategory,
): UserTotal[] {
  const map: Record<string, UserTotal> = {}
  for (const r of rows) {
    const name = r.nama || 'Unknown'
    if (!map[name]) {
      map[name] = { nama: name, count: 0, total: 0, scrap: 0, qty: 0 }
    }
    map[name].count += 1
    map[name].total += r.subtotal || 0
    map[name].qty += r.qty || 0
    map[name].scrap += getCatalogScrap(r.item, catalog) * (r.qty || 0)
  }
  return Object.values(map).sort(
    (a, b) => b.total - a.total || a.nama.localeCompare(b.nama),
  )
}

export function summarizeFiltered(
  rows: OrderRow[],
  catalog: CatalogByCategory,
): {
  orderCount: number
  lineCount: number
  qty: number
  total: number
  scrap: number
} {
  const orderIds = new Set(rows.map((r) => r.order_id).filter(Boolean))
  return {
    orderCount: orderIds.size,
    lineCount: rows.length,
    qty: rows.reduce((a, r) => a + (r.qty || 0), 0),
    total: rows.reduce((a, r) => a + (r.subtotal || 0), 0),
    scrap: rows.reduce(
      (a, r) => a + getCatalogScrap(r.item, catalog) * (r.qty || 0),
      0,
    ),
  }
}

/** Existing column update — mirror dashboard delivered save. */
export async function updateOrderDelivered(
  id: number,
  delivered: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('orders')
    .update({ delivered })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Toggle paid for all active rows of a person in a periode (+ Discord log). */
export async function updatePersonOrderPaid(args: {
  nama: string
  orderanke: number
  paid: boolean
  actor?: string
}): Promise<{ ok: true; qty: number; total: number } | { ok: false; error: string }> {
  const nama = String(args.nama || '').trim()
  const orderanke = Number(args.orderanke) || 0
  if (!nama || !orderanke) {
    return { ok: false, error: 'Nama / periode tidak valid' }
  }

  let q = supabase
    .from('orders')
    .update({ paid: !!args.paid })
    .eq('nama', nama)
    .eq('orderanke', orderanke)
    .is('deleted_at', null)
    .select('id,qty,subtotal')

  let { data, error } = await q
  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await supabase
      .from('orders')
      .update({ paid: !!args.paid })
      .eq('nama', nama)
      .eq('orderanke', orderanke)
      .select('id,qty,subtotal'))
  }
  if (error) {
    if (String(error.message || '').includes('paid')) {
      return { ok: false, error: "Kolom 'paid' belum ada di orders" }
    }
    return { ok: false, error: error.message }
  }
  if (!data?.length) {
    return { ok: false, error: 'Tidak ada baris order yang diubah' }
  }

  const qty = data.reduce((s, r) => s + (Number(r.qty) || 0), 0)
  const total = data.reduce((s, r) => s + (Number(r.subtotal) || 0), 0)

  try {
    const { postDiscord } = await import('./discord')
    const { fmtDiscordMoney, fmtDiscordNumber } = await import(
      './discordMessages'
    )
    const m = Math.floor(orderanke / 10)
    const w = orderanke % 10
    const batchText = `M${m}-W${w} (#${orderanke})`
    const statusText = args.paid ? 'LUNAS ✅' : 'BELUM LUNAS ❌'
    const actor = String(args.actor || '').trim() || 'Unknown'
    const embed = {
      title: 'Status Pembayaran Senjata',
      color: args.paid ? 5763719 : 15548997,
      description:
        '```' +
        `\nNAMA        : ${nama}` +
        `\nPERIODE     : ${batchText}` +
        `\nSTATUS      : ${statusText}` +
        `\nTOTAL ITEM  : ${fmtDiscordNumber(qty)}` +
        `\nTOTAL UANG  : ${fmtDiscordMoney(total)}` +
        `\nDIUBAH OLEH : ${actor}` +
        '\n```',
      fields: [
        {
          name: 'Ringkasan',
          value: args.paid
            ? 'Pembayaran order senjata sudah dikonfirmasi lunas.'
            : 'Status pembayaran order senjata diubah menjadi belum lunas.',
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    }
    await postDiscord({ channel: 'order_payment', embeds: [embed] })
  } catch (e) {
    console.warn('[discord] payment toggle', e)
  }

  return { ok: true, qty, total }
}

/** Soft-delete archive — mirror softDeleteById("orders") + Discord sync. */
export async function archiveOrderById(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rowId = Number(id)
  if (!rowId) return { ok: false, error: 'ID tidak valid' }

  // Snapshot before delete — Discord mid is shared per member+periode
  let memberId = 0
  let orderanke = 0
  let nama = ''
  let prevDiscordId = ''
  {
    let { data: before, error: beforeErr } = await supabase
      .from('orders')
      .select('id,member_id,orderanke,nama,discord_message_id')
      .eq('id', rowId)
      .maybeSingle()
    if (beforeErr && isMissingColumnError(beforeErr, 'discord_message_id')) {
      ;({ data: before } = await supabase
        .from('orders')
        .select('id,member_id,orderanke,nama')
        .eq('id', rowId)
        .maybeSingle())
    }
    if (before) {
      memberId = Number(before.member_id) || 0
      orderanke = Number(before.orderanke) || 0
      nama = String(before.nama || '')
      prevDiscordId = String(
        (before as { discord_message_id?: string }).discord_message_id || '',
      ).trim()
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('orders')
    .update({ deleted_at: now })
    .eq('id', rowId)
    .select('id')

  if (error) {
    if (isMissingColumnError(error, 'deleted_at')) {
      return {
        ok: false,
        error: 'Soft delete belum aktif (kolom deleted_at).',
      }
    }
    return { ok: false, error: error.message }
  }
  if (!data || !data.length) {
    return {
      ok: false,
      error: 'Tidak ada baris terhapus (cek RLS/permission update di orders)',
    }
  }

  // Discord: if siblings remain → re-post updated summary; else delete channel msg
  try {
    if (memberId && orderanke) {
      const { data: siblings } = await supabase
        .from('orders')
        .select('id')
        .eq('member_id', memberId)
        .eq('orderanke', orderanke)
        .is('deleted_at', null)
        .limit(1)
      if (siblings?.length) {
        const { sendMemberOrdersDiscord } = await import('./discord')
        await sendMemberOrdersDiscord(memberId, nama, orderanke)
      } else if (prevDiscordId) {
        const { deleteDiscordMessage } = await import('./discord')
        await deleteDiscordMessage('orders', prevDiscordId)
      }
    } else if (prevDiscordId) {
      const { deleteDiscordMessage } = await import('./discord')
      await deleteDiscordMessage('orders', prevDiscordId)
    }
  } catch (e) {
    console.warn('[discord] order archive', e)
  }

  return { ok: true }
}
