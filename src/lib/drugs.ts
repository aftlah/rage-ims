import { isMissingColumnError } from './orderUtils'
import {
  decodeOrderanke,
  fetchActiveOrderWindow,
  formatOrderankeLabel,
} from './orderWindow'
import { softDeleteByIds } from './softDelete'
import { supabase } from './supabase'

export const DRUGS_JENIS = ['Weed', 'Meth', 'Opium'] as const
export type DrugsJenis = (typeof DRUGS_JENIS)[number]

export type DrugsSaleRow = {
  id: string
  member_id: number
  nama: string
  uang_merah: number
  upah_putih: number
  uang_rage: number
  periode_orderanke: number | null
  waktu: string
  jenis: string
  jumlah: number
  is_paid: boolean
}

export type DrugsBatchOption = {
  value: string
  label: string
  orderanke: number | null
}

export type DrugsPaidFilter = 'all' | 'paid' | 'unpaid'

/** Gaji Putih = merah * 25% * 65%; Uang RAGE = merah * 65% * 65% */
export function calcDrugsSplits(duitMerah: number): {
  upahPutih: number
  uangRage: number
} {
  const m = duitMerah > 0 ? duitMerah : 0
  return {
    upahPutih: m * 0.25 * 0.65,
    uangRage: m * 0.65 * 0.65,
  }
}

export async function resolveCurrentDrugsBatch(): Promise<number | null> {
  const { window } = await fetchActiveOrderWindow('drugs')
  if (window?.orderanke) return Number(window.orderanke)
  return null
}

export async function fetchDrugsBatchOptions(
  currentBatch: number | null,
): Promise<{ options: DrugsBatchOption[]; error: string | null }> {
  let list: Array<{ orderanke: number; is_active: boolean }> = []
  const { data, error } = await supabase
    .from('order_windows')
    .select('orderanke,start_time,end_time,is_active')
    .gte('orderanke', 1000)
    .order('start_time', { ascending: false })
    .limit(50)

  if (!error) {
    list = (data || [])
      .filter((r) => r && r.orderanke != null)
      .map((r) => ({
        orderanke: Number(r.orderanke),
        is_active: Boolean(r.is_active),
      }))
  }

  if (!list.length) {
    let q = await supabase
      .from('drugs_sales')
      .select('periode_orderanke')
      .gte('periode_orderanke', 1000)
      .is('deleted_at', null)
      .order('periode_orderanke', { ascending: false })
      .limit(200)
    if (q.error && isMissingColumnError(q.error, 'deleted_at')) {
      q = await supabase
        .from('drugs_sales')
        .select('periode_orderanke')
        .gte('periode_orderanke', 1000)
        .order('periode_orderanke', { ascending: false })
        .limit(200)
    }
    if (!q.error) {
      const seen = new Set<number>()
      list = (q.data || [])
        .map((r) => Number(r.periode_orderanke))
        .filter((v) => !Number.isNaN(v) && v)
        .filter((v) => (seen.has(v) ? false : (seen.add(v), true)))
        .map((v) => ({
          orderanke: v,
          is_active: currentBatch ? v === currentBatch : false,
        }))
    }
  }

  let prev: number | null = null
  if (currentBatch) {
    const idx = list.findIndex((b) => b.orderanke === currentBatch)
    if (idx >= 0 && idx + 1 < list.length) prev = list[idx + 1].orderanke
  }
  if (!prev && list.length) {
    prev = list.length > 1 ? list[1].orderanke : list[0].orderanke
  }

  const options: DrugsBatchOption[] = [
    {
      value: 'current',
      label: currentBatch
        ? `Periode Aktif — ${formatOrderankeLabel(currentBatch)}`
        : 'Periode Aktif',
      orderanke: currentBatch,
    },
    {
      value: 'previous',
      label: 'Periode Sebelumnya',
      orderanke: prev,
    },
    { value: 'all', label: 'Semua Periode', orderanke: null },
  ]

  for (const b of list) {
    if (!b.orderanke) continue
    if (b.orderanke === currentBatch || b.orderanke === prev) continue
    options.push({
      value: `orderanke:${b.orderanke}`,
      label: formatOrderankeLabel(b.orderanke),
      orderanke: b.orderanke,
    })
  }

  return { options, error: error?.message ?? null }
}

function resolveBatchFilter(
  filterValue: string,
  options: DrugsBatchOption[],
): number | null | undefined {
  // undefined = all (no eq filter); null = current missing
  if (filterValue === 'all') return undefined
  const opt = options.find((o) => o.value === filterValue)
  if (!opt) return undefined
  return opt.orderanke
}

function mapDrugsRow(row: Record<string, unknown>): DrugsSaleRow {
  return {
    id: String(row.id),
    member_id: Number(row.member_id) || 0,
    nama: String(row.nama || ''),
    uang_merah: Number(row.uang_merah) || 0,
    upah_putih: Number(row.upah_putih) || 0,
    uang_rage: Number(row.uang_rage) || 0,
    periode_orderanke:
      row.periode_orderanke == null ? null : Number(row.periode_orderanke),
    waktu: String(row.waktu || ''),
    jenis: String(row.jenis || ''),
    jumlah: Number(row.jumlah) || 0,
    is_paid: Boolean(row.is_paid),
  }
}

export async function fetchDrugsSales(args: {
  filterValue: string
  options: DrugsBatchOption[]
}): Promise<{ data: DrugsSaleRow[]; error: string | null }> {
  const periode = resolveBatchFilter(args.filterValue, args.options)

  const build = (withSoftDelete: boolean) => {
    let q = supabase
      .from('drugs_sales')
      .select('*')
      .gte('periode_orderanke', 1000)
      .order('waktu', { ascending: false })
      .limit(200)
    if (withSoftDelete) q = q.is('deleted_at', null)
    if (periode != null) q = q.eq('periode_orderanke', periode)
    return q
  }

  let { data, error } = await build(true)
  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await build(false))
  }
  if (error) return { data: [], error: error.message }

  return {
    data: ((data || []) as unknown as Record<string, unknown>[]).map(
      mapDrugsRow,
    ),
    error: null,
  }
}

export function filterDrugsRows(
  rows: DrugsSaleRow[],
  term: string,
  paid: DrugsPaidFilter,
): DrugsSaleRow[] {
  const t = String(term || '')
    .trim()
    .toLowerCase()
  return rows.filter((r) => {
    if (paid === 'paid' && !r.is_paid) return false
    if (paid === 'unpaid' && r.is_paid) return false
    if (!t) return true
    const hay = `${r.nama} ${r.jenis}`.toLowerCase()
    return hay.includes(t)
  })
}

export async function submitDrugsSale(args: {
  memberId: number
  nama: string
  duitMerah: number
  jenis: string
  jumlah: number
  batch: number
  editId?: string | null
}): Promise<{ ok: boolean; error: string | null }> {
  const memberId = Number(args.memberId)
  const nama = String(args.nama || '').trim()
  const jenis = String(args.jenis || '').trim()
  const jumlah = Number(args.jumlah) || 0
  const duitMerah = Number(args.duitMerah) || 0
  const targetBatch = Number(args.batch) || 0

  if (!nama) return { ok: false, error: 'Pilih nama anggota terlebih dahulu' }
  if (!memberId) return { ok: false, error: 'Akun belum terhubung ke member' }
  if (!jenis) return { ok: false, error: 'Pilih jenis jualan (Weed/Meth/Opium)' }
  if (jumlah <= 0) {
    return { ok: false, error: 'Masukkan jumlah terjual yang valid' }
  }
  if (!targetBatch) {
    return { ok: false, error: 'Tidak ada batch drugs aktif' }
  }

  const { upahPutih, uangRage } = calcDrugsSplits(duitMerah)
  const nowIso = new Date().toISOString()

  if (args.editId) {
    let updatePayload: Record<string, unknown> = {
      member_id: memberId,
      nama,
      uang_merah: duitMerah,
      upah_putih: upahPutih,
      uang_rage: uangRage,
      periode_orderanke: targetBatch,
      waktu: nowIso,
      jenis,
      jumlah,
    }
    let { error } = await supabase
      .from('drugs_sales')
      .update(updatePayload)
      .eq('id', args.editId)

    if (error && String(error.message || '').toLowerCase().includes('column')) {
      updatePayload = {
        member_id: memberId,
        nama,
        uang_merah: duitMerah,
        upah_putih: upahPutih,
        uang_rage: uangRage,
        periode_orderanke: targetBatch,
        waktu: nowIso,
      }
      const res2 = await supabase
        .from('drugs_sales')
        .update(updatePayload)
        .eq('id', args.editId)
      error = res2.error
    }
    if (error) return { ok: false, error: error.message }

    try {
      const prevId = await (
        await import('./discord')
      ).fetchDiscordMessageId('drugs_sales', args.editId)
      if (prevId) {
        await (
          await import('./discord')
        ).deleteDiscordMessage('drugs', prevId)
      }
      const { postDiscord, persistDiscordMessageId } = await import('./discord')
      const { buildDrugsEntryEmbed } = await import('./discordMessages')
      const embed = buildDrugsEntryEmbed({
        mode: 'edit',
        nama,
        jenis,
        jumlahTotal: jumlah,
        duitMerahTotal: duitMerah,
        upahPutihTotal: upahPutih,
        periode_orderanke: targetBatch,
        waktu: nowIso,
      })
      const mid = await postDiscord({ channel: 'drugs', embeds: [embed] })
      if (mid) {
        await persistDiscordMessageId('drugs_sales', args.editId, mid)
      }
    } catch (e) {
      console.warn('[discord] drugs edit', e)
    }

    return { ok: true, error: null }
  }

  let insertPayload: Record<string, unknown> = {
    member_id: memberId,
    nama,
    uang_merah: duitMerah,
    upah_putih: upahPutih,
    uang_rage: uangRage,
    periode_orderanke: targetBatch,
    waktu: nowIso,
    jenis,
    jumlah,
  }

  let { data: inserted, error } = await supabase
    .from('drugs_sales')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error && isMissingColumnError(error, 'discord_message_id')) {
    delete insertPayload.discord_message_id
    ;({ data: inserted, error } = await supabase
      .from('drugs_sales')
      .insert(insertPayload)
      .select('id')
      .single())
  } else if (
    error &&
    String(error.message || '').toLowerCase().includes('column')
  ) {
    insertPayload = {
      member_id: memberId,
      nama,
      uang_merah: duitMerah,
      upah_putih: upahPutih,
      uang_rage: uangRage,
      periode_orderanke: targetBatch,
      waktu: nowIso,
    }
    ;({ data: inserted, error } = await supabase
      .from('drugs_sales')
      .insert(insertPayload)
      .select('id')
      .single())
  }

  if (error) return { ok: false, error: error.message }

  try {
    const { postDiscord, persistDiscordMessageId } = await import('./discord')
    const { buildDrugsEntryEmbed } = await import('./discordMessages')
    const embed = buildDrugsEntryEmbed({
      mode: 'insert',
      nama,
      jenis,
      jumlahTotal: jumlah,
      duitMerahTotal: duitMerah,
      upahPutihTotal: upahPutih,
      periode_orderanke: targetBatch,
      waktu: nowIso,
    })
    const mid = await postDiscord({ channel: 'drugs', embeds: [embed] })
    const rowId = inserted?.id
    if (mid && rowId) {
      await persistDiscordMessageId('drugs_sales', rowId, mid)
    }
  } catch (e) {
    console.warn('[discord] drugs insert', e)
  }

  return { ok: true, error: null }
}

export async function toggleDrugsPaid(
  ids: string[],
  nextStatus: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  const clean = ids.map((x) => String(x).trim()).filter(Boolean)
  if (!clean.length) return { ok: false, error: 'ID kosong' }

  let q = supabase.from('drugs_sales').update({ is_paid: nextStatus })
  q = clean.length > 1 ? q.in('id', clean) : q.eq('id', clean[0])
  const { error } = await q

  if (error) {
    if (String(error.message || '').includes('is_paid')) {
      return { ok: false, error: "Kolom 'is_paid' belum ada di drugs_sales" }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}

export async function deleteDrugsSales(
  ids: string[],
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { deleteDiscordForTableRow } = await import('./discord')
    for (const id of ids) {
      await deleteDiscordForTableRow('drugs', 'drugs_sales', id)
    }
  } catch (e) {
    console.warn('[discord] drugs delete', e)
  }

  const soft = await softDeleteByIds('drugs_sales', ids)
  if (!soft.ok) {
    if (soft.error && isMissingColumnError(soft.error, 'deleted_at')) {
      return { ok: false, error: 'Soft delete belum aktif (kolom deleted_at)' }
    }
    return { ok: false, error: soft.error?.message || 'Gagal menghapus' }
  }
  return { ok: true, error: null }
}

export function drugsPeriodeShort(orderanke: number | null): string {
  if (!orderanke) return ''
  const { m, w } = decodeOrderanke(orderanke)
  return `M${m}-W${w}`
}
