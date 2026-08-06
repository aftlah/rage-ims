import { postDiscord } from './discord'
import {
  buildDashboardShareMessage,
  buildDrugsTotalsEmbed,
  buildPaymentStatusShareMessage,
  buildStoranPeriodStatusMessage,
  fmtDiscordMoney,
} from './discordMessages'
import { formatOrderankeLabel } from './orderWindow'
import { supabase } from './supabase'
import {
  fetchStoranRekap,
  getStoranCalendarWeekPeriod,
  type StoranRekapRow,
} from './storan'
import { isMissingColumnError } from './orderUtils'

/** Share storan period rekap (SUDAH/BELUM) to Discord. */
export async function shareStoranRekapToDiscord(
  periodeValue?: number,
): Promise<{ ok: boolean; error: string | null }> {
  const period = getStoranCalendarWeekPeriod()
  const value = periodeValue || period.periodeValue
  const { rows, error } = await fetchStoranRekap(value)
  if (error) return { ok: false, error }

  const done: string[] = []
  const pending: string[] = []
  for (const r of rows as StoranRekapRow[]) {
    if (String(r.statusRaw).toUpperCase() === 'SUDAH') {
      done.push(r.nama)
    } else {
      pending.push(r.nama)
    }
  }

  const m = Math.floor(value / 10)
  const w = value % 10
  const msg = buildStoranPeriodStatusMessage({
    label: `M${m}-W${w}`,
    done,
    pending,
  })
  const mid = await postDiscord({ channel: 'storan', content: msg })
  if (!mid) {
    return {
      ok: false,
      error: 'Gagal kirim Discord (cek Edge Function / webhook)',
    }
  }
  return { ok: true, error: null }
}

/** Share drugs payroll totals for a batch. */
export async function shareDrugsTotalsToDiscord(
  batch: number,
): Promise<{ ok: boolean; error: string | null }> {
  if (!batch) return { ok: false, error: 'Tidak ada batch drugs aktif' }

  let q = supabase
    .from('drugs_sales')
    .select('member_id,nama,uang_merah,upah_putih,uang_rage,waktu')
    .eq('periode_orderanke', batch)
    .order('nama', { ascending: true })

  let { data, error } = await q.is('deleted_at', null)
  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await supabase
      .from('drugs_sales')
      .select('member_id,nama,uang_merah,upah_putih,uang_rage,waktu')
      .eq('periode_orderanke', batch)
      .order('nama', { ascending: true }))
  }
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: 'Tidak ada data untuk dikirim' }

  const map = new Map<
    string,
    { nama: string; upah_putih: number; uang_merah: number }
  >()
  for (const r of data) {
    const key = String(r.member_id || r.nama || '-')
    const prev = map.get(key) || {
      nama: String(r.nama || '-'),
      upah_putih: 0,
      uang_merah: 0,
    }
    prev.upah_putih += parseFloat(String(r.upah_putih)) || 0
    prev.uang_merah += parseFloat(String(r.uang_merah)) || 0
    map.set(key, prev)
  }

  const embed = buildDrugsTotalsEmbed({
    orderanke: batch,
    rows: Array.from(map.values()),
  })
  const mid = await postDiscord({ channel: 'drugs', embeds: [embed] })
  if (!mid) {
    return {
      ok: false,
      error: 'Gagal kirim Discord (cek Edge Function / webhook)',
    }
  }
  return { ok: true, error: null }
}

export type RekapShareOrder = {
  nama: string
  orderanke: number
  item: string
  qty: number
  harga: number
  subtotal: number
  kategori?: string | null
  paid?: boolean
}

const GROUP_ORDER = [
  'ORDER KE HIGH TABEL',
  'ORDER KE ALLSTAR',
  'ORDER KE BOA',
  'ORDER KE BURGENK',
  'ORDER KE PP',
  'LAINNYA',
] as const

function assignGroupForItem(item: string, kategori?: string): string {
  const k = String(kategori || '').toUpperCase()
  const n = String(item || '').toUpperCase()
  if (k.includes('HIGH') || n.includes('HIGH TABEL')) return 'ORDER KE HIGH TABEL'
  if (k.includes('ALLSTAR') || n.includes('ALLSTAR')) return 'ORDER KE ALLSTAR'
  if (k.includes('BOA') || n.includes('BOA')) return 'ORDER KE BOA'
  if (k.includes('BURGENK') || n.includes('BURGENK')) return 'ORDER KE BURGENK'
  if (k.includes('PP') || n === 'PP') return 'ORDER KE PP'
  return 'LAINNYA'
}

/** Share dashboard qty totals from already-loaded rekap rows. */
export async function shareDashboardFromRows(
  rows: RekapShareOrder[],
  opts: { month?: number; week?: string; name?: string } = {},
): Promise<{ ok: boolean; error: string | null }> {
  if (!rows.length) return { ok: false, error: 'Tidak ada data untuk dikirim' }

  const byBatch: Record<number, RekapShareOrder[]> = {}
  for (const r of rows) {
    const b = r.orderanke || 0
    ;(byBatch[b] ||= []).push(r)
  }
  const keys = Object.keys(byBatch)
    .map(Number)
    .sort((a, b) => a - b)

  const lines: string[] = ['Total Qty per Item']
  if (opts.month) {
    if (opts.week) lines.push(`Periode: M${opts.month}-W${opts.week}`)
    else lines.push(`Periode: M${opts.month}`)
  }
  if (opts.name) lines.push(`Nama: ${opts.name}`)

  const groupTotals: Record<string, number> = {
    'ORDER KE HIGH TABEL': 0,
    'ORDER KE ALLSTAR': 0,
    'ORDER KE BOA': 0,
    'ORDER KE BURGENK': 0,
    'ORDER KE PP': 0,
    LAINNYA: 0,
  }

  for (const k of keys) {
    const items = byBatch[k]
    const m = Math.floor(k / 10)
    const w = k % 10
    lines.push('')
    lines.push(`Batch M${m}-W${w}`)

    const summaryMap: Record<string, { item: string; qty: number; unit: number }> =
      {}
    for (const r of items) {
      const key = r.item
      if (!summaryMap[key]) {
        summaryMap[key] = { item: r.item, qty: 0, unit: r.harga || 0 }
      }
      summaryMap[key].qty += r.qty || 0
    }

    const groupedMap: Record<string, typeof summaryMap[string][]> = {}
    for (const s of Object.values(summaryMap)) {
      const grp = assignGroupForItem(s.item)
      ;(groupedMap[grp] ||= []).push(s)
    }

    for (const grp of GROUP_ORDER) {
      const list = (groupedMap[grp] || []).sort((a, b) =>
        a.item.localeCompare(b.item),
      )
      if (!list.length) continue
      lines.push('')
      lines.push(grp)
      let totalGrp = 0
      for (const x of list) {
        const sub = x.unit * x.qty
        totalGrp += sub
        lines.push(
          `${x.item} | ${x.qty} | ${fmtDiscordMoney(x.unit)} | ${fmtDiscordMoney(sub)}`,
        )
      }
      lines.push(`Total : ${fmtDiscordMoney(totalGrp)}`)
      groupTotals[grp] = (groupTotals[grp] || 0) + totalGrp
    }
  }

  lines.push('')
  lines.push('Ringkasan Total Orderan')
  for (const gname of GROUP_ORDER) {
    lines.push(`${gname}: ${fmtDiscordMoney(groupTotals[gname] || 0)}`)
  }

  const msg = buildDashboardShareMessage(lines)
  const mid = await postDiscord({ channel: 'dashboard', content: msg })
  if (!mid) {
    return {
      ok: false,
      error: 'Gagal kirim Discord (cek Edge Function / webhook)',
    }
  }
  return { ok: true, error: null }
}

/** Share payment status from rekap rows. */
export async function sharePaymentStatusFromRows(
  rows: RekapShareOrder[],
  opts: { month?: number; week?: string; name?: string } = {},
): Promise<{ ok: boolean; error: string | null }> {
  if (!rows.length) {
    return { ok: false, error: 'Tidak ada data pembayaran untuk dikirim' }
  }

  const grouped: Record<
    string,
    {
      batch: number
      name: string
      qty: number
      total: number
      paid: boolean
      rows: RekapShareOrder[]
    }
  > = {}

  for (const r of rows) {
    const batch = r.orderanke || 0
    const name = String(r.nama || 'Unknown')
    const key = `${batch}::${name.toLowerCase()}`
    if (!grouped[key]) {
      grouped[key] = {
        batch,
        name,
        qty: 0,
        total: 0,
        paid: true,
        rows: [],
      }
    }
    grouped[key].qty += r.qty || 0
    grouped[key].total += r.subtotal || 0
    grouped[key].rows.push(r)
  }

  const entries = Object.values(grouped).map((g) => ({
    ...g,
    paid: g.rows.length ? g.rows.every((x) => !!x.paid) : false,
  }))

  const paid = entries
    .filter((x) => x.paid)
    .map((x) => ({
      name: x.name,
      batch: x.batch,
      qty: x.qty,
      total: x.total,
    }))
  const unpaid = entries
    .filter((x) => !x.paid)
    .map((x) => ({
      name: x.name,
      batch: x.batch,
      qty: x.qty,
      total: x.total,
    }))

  let periodText = '-'
  if (opts.month && opts.week) periodText = `M${opts.month}-W${opts.week}`
  else if (opts.month) periodText = `M${opts.month}`
  else if (entries.length) {
    const batches = Array.from(new Set(entries.map((e) => e.batch)))
    periodText = batches.map((b) => formatOrderankeLabel(b)).join(', ')
  }

  const msg = buildPaymentStatusShareMessage({
    periodText,
    nameFilter: opts.name,
    paid,
    unpaid,
  })
  const mid = await postDiscord({ channel: 'order_payment', content: msg })
  if (!mid) {
    return {
      ok: false,
      error: 'Gagal kirim Discord (cek Edge Function / webhook)',
    }
  }
  return { ok: true, error: null }
}
