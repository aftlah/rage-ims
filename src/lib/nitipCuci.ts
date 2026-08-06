import type { Member } from './auth'
import { isAdminMember } from './auth'
import { parseMoneyInput } from './format'
import { isMissingColumnError } from './orderUtils'
import {
  fetchActiveOrderWindow,
  fetchLatestOrderWindow,
  formatOrderankeLabel,
} from './orderWindow'
import { softDeleteById } from './softDelete'
import { supabase } from './supabase'

export const NITIP_CUCI_WHITE_RATE = 0.65
export const NITIP_CUCI_BUCKET = 'nitip-cuci'
export const NITIP_CUCI_MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type NitipCuciRow = {
  id: number
  member_id: number
  nama: string
  uang_merah: number
  uang_putih: number
  keterangan: string
  image_url: string | null
  periode_orderanke: number | null
  waktu: string
  is_paid: boolean
}

export type NitipPaidFilter = 'all' | 'paid' | 'unpaid'

export type NitipPeriodeOption = {
  value: string
  label: string
  orderanke: number | null
}

export function calcUangPutih(uangMerah: number): number {
  return Math.round(uangMerah * NITIP_CUCI_WHITE_RATE)
}

export function canDeleteNitipCuciRow(
  row: { member_id?: number },
  member: Member | null,
): boolean {
  if (!row || !member) return false
  if (isAdminMember(member)) return true
  return Number(member.id) === Number(row.member_id)
}

export function validateNitipImage(file: File | null): {
  ok: boolean
  message: string
} {
  if (!file) return { ok: false, message: 'Upload bukti screenshot wajib' }
  if (!file.type.startsWith('image/')) {
    return { ok: false, message: 'File harus berupa gambar' }
  }
  if (file.size > NITIP_CUCI_MAX_IMAGE_BYTES) {
    return { ok: false, message: 'Ukuran gambar maksimal 5MB' }
  }
  return { ok: true, message: '' }
}

async function uploadNitipCuciImage(
  file: File,
  memberId: number,
): Promise<string> {
  const ext = (file.name || 'png').split('.').pop() || 'png'
  const path = `${memberId || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from(NITIP_CUCI_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from(NITIP_CUCI_BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

function mapNitipRow(row: Record<string, unknown>): NitipCuciRow {
  return {
    id: Number(row.id),
    member_id: Number(row.member_id),
    nama: String(row.nama || ''),
    uang_merah: Number(row.uang_merah) || 0,
    uang_putih: Number(row.uang_putih) || 0,
    keterangan: String(row.keterangan || ''),
    image_url: row.image_url == null ? null : String(row.image_url),
    periode_orderanke:
      row.periode_orderanke == null ? null : Number(row.periode_orderanke),
    waktu: String(row.waktu || ''),
    is_paid: Boolean(row.is_paid),
  }
}

export async function resolveNitipSubmitPeriode(): Promise<{
  periodeValue: number | null
  periodeLabel: string
}> {
  const active = await fetchActiveOrderWindow()
  const win =
    active.window ||
    (await fetchLatestOrderWindow('order')).window
  if (win?.orderanke) {
    const v = Number(win.orderanke)
    if (v > 0) {
      return { periodeValue: v, periodeLabel: formatOrderankeLabel(v) }
    }
  }
  return { periodeValue: null, periodeLabel: '' }
}

export async function fetchNitipPeriodeOptions(): Promise<{
  current: number | null
  options: NitipPeriodeOption[]
  error: string | null
}> {
  const active = await fetchActiveOrderWindow()
  const fallback = active.window
    ? null
    : (await fetchLatestOrderWindow('order')).window
  const currentWin = active.window || fallback
  const current =
    currentWin?.orderanke != null ? Number(currentWin.orderanke) : null

  let list: Array<{ orderanke: number; is_active: boolean }> = []
  const { data, error } = await supabase
    .from('order_windows')
    .select('orderanke,start_time,end_time,is_active')
    .lt('orderanke', 1000)
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
      .from('nitip_cuci_logs')
      .select('periode_orderanke')
      .not('periode_orderanke', 'is', null)
      .lt('periode_orderanke', 1000)
      .is('deleted_at', null)
      .order('periode_orderanke', { ascending: false })
      .limit(200)
    if (q.error && isMissingColumnError(q.error, 'deleted_at')) {
      q = await supabase
        .from('nitip_cuci_logs')
        .select('periode_orderanke')
        .not('periode_orderanke', 'is', null)
        .lt('periode_orderanke', 1000)
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
          is_active: current ? v === current : false,
        }))
    }
  }

  let prev: number | null = null
  if (current) {
    const idx = list.findIndex((b) => b.orderanke === current)
    if (idx >= 0 && idx + 1 < list.length) prev = list[idx + 1].orderanke
  }
  if (!prev && list.length) {
    prev = list.length > 1 ? list[1].orderanke : list[0].orderanke
  }

  const options: NitipPeriodeOption[] = [
    { value: 'current', label: 'Periode Aktif', orderanke: current },
    { value: 'previous', label: 'Periode Sebelumnya', orderanke: prev },
    { value: 'all', label: 'Semua Periode', orderanke: null },
  ]

  for (const b of list) {
    if (!b.orderanke) continue
    if (
      options.some(
        (o) =>
          o.value !== 'current' &&
          o.value !== 'previous' &&
          o.value !== 'all' &&
          o.orderanke === b.orderanke,
      )
    ) {
      continue
    }
    if (b.orderanke === current || b.orderanke === prev) continue
    options.push({
      value: String(b.orderanke),
      label: formatOrderankeLabel(b.orderanke),
      orderanke: b.orderanke,
    })
  }

  return { current, options, error: error?.message ?? null }
}

export function resolveNitipPeriodeFilter(
  filterValue: string,
  options: NitipPeriodeOption[],
): number | null {
  const opt = options.find((o) => o.value === filterValue)
  if (!opt) return null
  if (filterValue === 'all') return null
  return opt.orderanke
}

export async function fetchNitipCuciLogs(
  periodeValue: number | null,
): Promise<{ data: NitipCuciRow[]; error: string | null }> {
  let q = supabase
    .from('nitip_cuci_logs')
    .select('*')
    .order('waktu', { ascending: false })
    .limit(200)
  q = q.is('deleted_at', null)
  if (periodeValue) q = q.eq('periode_orderanke', periodeValue)

  let { data, error } = await q
  if (error && isMissingColumnError(error, 'deleted_at')) {
    let q2 = supabase
      .from('nitip_cuci_logs')
      .select('*')
      .order('waktu', { ascending: false })
      .limit(200)
    if (periodeValue) q2 = q2.eq('periode_orderanke', periodeValue)
    ;({ data, error } = await q2)
  }

  if (error) return { data: [], error: error.message }
  return {
    data: ((data || []) as unknown as Record<string, unknown>[]).map(
      mapNitipRow,
    ),
    error: null,
  }
}

export function filterNitipByPaid(
  rows: NitipCuciRow[],
  paidFilter: NitipPaidFilter,
): NitipCuciRow[] {
  return rows.filter((r) => {
    if (paidFilter === 'paid' && !r.is_paid) return false
    if (paidFilter === 'unpaid' && r.is_paid) return false
    return true
  })
}

export async function submitNitipCuci(args: {
  memberId: number
  nama: string
  uangMerahRaw: string
  keterangan: string
  buktiFile: File | null
}): Promise<{ ok: boolean; error: string | null }> {
  const memberId = Number(args.memberId)
  const nama = String(args.nama || '').trim()
  const uangMerah = parseMoneyInput(args.uangMerahRaw)
  const keterangan = String(args.keterangan || '').trim() || 'Nitip cuci'
  const buktiFile = args.buktiFile

  if (!nama || !memberId) {
    return { ok: false, error: 'Pilih nama dari database' }
  }
  if (!Number.isFinite(uangMerah) || uangMerah <= 0) {
    return { ok: false, error: 'Jumlah uang merah wajib diisi' }
  }
  const photoCheck = validateNitipImage(buktiFile)
  if (!photoCheck.ok) return { ok: false, error: photoCheck.message }

  const uangPutih = calcUangPutih(uangMerah)
  const { periodeValue } = await resolveNitipSubmitPeriode()
  const now = new Date()

  let imageUrl = ''
  try {
    imageUrl = await uploadNitipCuciImage(buktiFile!, memberId)
  } catch {
    return {
      ok: false,
      error:
        'Gagal upload gambar. Pastikan bucket nitip-cuci sudah dibuat di Supabase.',
    }
  }

  const payload: Record<string, unknown> = {
    member_id: memberId,
    nama,
    uang_merah: uangMerah,
    uang_putih: uangPutih,
    keterangan,
    image_url: imageUrl || null,
    periode_orderanke: periodeValue,
    waktu: now.toISOString(),
  }

  let { error: logErr } = await supabase
    .from('nitip_cuci_logs')
    .insert(payload)
    .select('id')
    .single()

  if (logErr && isMissingColumnError(logErr, 'discord_message_id')) {
    delete payload.discord_message_id
    ;({ error: logErr } = await supabase
      .from('nitip_cuci_logs')
      .insert(payload)
      .select('id')
      .single())
  }

  if (logErr) {
    return {
      ok: false,
      error:
        logErr.message ||
        'Gagal simpan ke database. Jalankan migration nitip_cuci_logs di Supabase.',
    }
  }

  return { ok: true, error: null }
}

export async function toggleNitipPaid(
  id: number,
  nextStatus: boolean,
  isAdmin: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  if (!isAdmin) return { ok: false, error: 'Hanya admin yang bisa ubah status' }
  const { error } = await supabase
    .from('nitip_cuci_logs')
    .update({ is_paid: !!nextStatus })
    .eq('id', id)
  if (error) {
    if (isMissingColumnError(error, 'is_paid')) {
      return {
        ok: false,
        error: 'Kolom is_paid belum ada di nitip_cuci_logs',
      }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true, error: null }
}

export async function deleteNitipCuciRow(
  row: NitipCuciRow,
  member: Member | null,
): Promise<{ ok: boolean; error: string | null }> {
  if (!canDeleteNitipCuciRow(row, member)) {
    return { ok: false, error: 'Tidak bisa menghapus data ini' }
  }

  const { data: rpcOk, error: rpcErr } = await supabase.rpc(
    'soft_delete_nitip_cuci',
    { p_id: row.id },
  )

  if (!rpcErr) {
    if (rpcOk === true) return { ok: true, error: null }
    return { ok: false, error: 'Data tidak ditemukan atau sudah dihapus' }
  }

  const rpcMissing =
    String(rpcErr.message || '').includes('soft_delete_nitip_cuci') ||
    String(rpcErr.code || '') === 'PGRST202'

  if (rpcMissing) {
    const soft = await softDeleteById('nitip_cuci_logs', row.id)
    if (!soft.ok) {
      if (soft.error && isMissingColumnError(soft.error, 'deleted_at')) {
        return {
          ok: false,
          error: 'Soft delete belum aktif (kolom deleted_at)',
        }
      }
      return { ok: false, error: soft.error?.message || 'Gagal menghapus' }
    }
    return { ok: true, error: null }
  }

  return { ok: false, error: rpcErr.message || 'Gagal menghapus' }
}
