import type { Member } from './auth'
import { isAdminMember } from './auth'
import {
  addDaysToDateKey,
  todayDateKeyJakarta,
} from './dates'
import { isMissingColumnError } from './orderUtils'
import { softDeleteById } from './softDelete'
import { supabase } from './supabase'

export const ABSEN_KOTA_BUCKET = 'absen-kota'
export const NITIP_CUCI_BUCKET = 'nitip-cuci'
export const ABSEN_KOTA_MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type AbsenRow = {
  id: number
  member_id: number
  nama: string
  tanggal: string
  jam_masuk_kota: string | null
  jam_keluar_kota: string | null
  bukti_masuk_url: string | null
  bukti_keluar_url: string | null
  catatan: string | null
  dicatat_oleh: string | null
}

export function absenStatusLabel(row: AbsenRow | null): {
  text: string
  tone: 'stone' | 'yellow' | 'done'
} {
  if (!row?.jam_masuk_kota) return { text: 'Belum masuk', tone: 'stone' }
  if (!row.jam_keluar_kota) return { text: 'Di kota', tone: 'yellow' }
  return { text: 'Sudah keluar', tone: 'done' }
}

export function validateAbsenPhotoFile(file: File | null): {
  ok: boolean
  message: string
} {
  if (!file) return { ok: false, message: 'Upload bukti foto dulu' }
  if (!file.type.startsWith('image/')) {
    return { ok: false, message: 'File harus berupa gambar' }
  }
  if (file.size > ABSEN_KOTA_MAX_IMAGE_BYTES) {
    return { ok: false, message: 'Ukuran gambar maksimal 5MB' }
  }
  return { ok: true, message: '' }
}

function isAbsenUniqueViolation(error: {
  code?: string
  message?: string
} | null): boolean {
  const code = String(error?.code || '')
  const msg = String(error?.message || '').toLowerCase()
  return (
    code === '23505' || msg.includes('duplicate') || msg.includes('unique')
  )
}

function absenRowMatchesFilterDate(
  row: AbsenRow,
  tanggal: string,
): boolean {
  if (!row || !tanggal) return false
  const rowTgl = row.tanggal ? String(row.tanggal).slice(0, 10) : ''
  if (rowTgl === tanggal) return true
  if (row.jam_keluar_kota) {
    const keluarDate = todayDateKeyJakarta(new Date(row.jam_keluar_kota))
    if (keluarDate === tanggal) return true
  }
  if (!row.jam_keluar_kota && row.jam_masuk_kota) {
    const masukDate = todayDateKeyJakarta(new Date(row.jam_masuk_kota))
    if (masukDate <= tanggal) return true
  }
  return false
}

function mapAbsenRow(row: Record<string, unknown>): AbsenRow {
  return {
    id: Number(row.id),
    member_id: Number(row.member_id),
    nama: String(row.nama || ''),
    tanggal: String(row.tanggal || '').slice(0, 10),
    jam_masuk_kota: row.jam_masuk_kota
      ? String(row.jam_masuk_kota)
      : null,
    jam_keluar_kota: row.jam_keluar_kota
      ? String(row.jam_keluar_kota)
      : null,
    bukti_masuk_url: row.bukti_masuk_url
      ? String(row.bukti_masuk_url)
      : null,
    bukti_keluar_url: row.bukti_keluar_url
      ? String(row.bukti_keluar_url)
      : null,
    catatan: row.catatan == null ? null : String(row.catatan),
    dicatat_oleh:
      row.dicatat_oleh == null ? null : String(row.dicatat_oleh),
  }
}

async function uploadAbsenKotaImage(
  file: File,
  memberId: number,
  action: 'masuk' | 'keluar',
): Promise<string> {
  const ext = (file.name || 'png').split('.').pop() || 'png'
  const kind = action === 'keluar' ? 'keluar' : 'masuk'
  const fileName = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const relPath = `${memberId || 'unknown'}/${fileName}`

  const attempts = [
    { bucket: ABSEN_KOTA_BUCKET, path: relPath },
    { bucket: NITIP_CUCI_BUCKET, path: `absen-kota/${relPath}` },
  ]

  let lastError: { message?: string } | null = null
  for (const { bucket, path } of attempts) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      return data?.publicUrl || ''
    }
    lastError = error
    const msg = String(error.message || '').toLowerCase()
    const bucketMissing =
      msg.includes('not found') ||
      msg.includes('does not exist') ||
      msg.includes('bucket')
    if (!bucketMissing) break
  }

  throw new Error(
    lastError?.message ||
      'Gagal upload bukti. Pastikan bucket absen-kota sudah dibuat.',
  )
}

export async function fetchOpenAbsenSession(
  memberId: number,
): Promise<AbsenRow | null> {
  const buildQuery = (withDeletedFilter: boolean) => {
    let q = supabase
      .from('absen_kota_logs')
      .select('*')
      .eq('member_id', memberId)
      .not('jam_masuk_kota', 'is', null)
      .is('jam_keluar_kota', null)
      .order('jam_masuk_kota', { ascending: false })
      .limit(1)
    if (withDeletedFilter) q = q.is('deleted_at', null)
    return q.maybeSingle()
  }

  let { data, error } = await buildQuery(true)
  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await buildQuery(false))
  }
  if (error || !data) return null
  return mapAbsenRow(data as unknown as Record<string, unknown>)
}

export async function recordAbsenKota(args: {
  action: 'masuk' | 'keluar'
  memberId: number
  nama: string
  catatan?: string
  actor?: string
  photoFile: File | null
  tanggal?: string
}): Promise<{ ok: boolean; error: string | null; row: AbsenRow | null }> {
  const mid = Number(args.memberId)
  const nama = String(args.nama || '').trim()
  if (!mid || !nama) {
    return { ok: false, error: 'Member tidak valid', row: null }
  }

  const now = new Date()
  const catatan = String(args.catatan || '').trim()
  const actor = String(args.actor || '').trim()
  const photoFile = args.photoFile
  const openSession = await fetchOpenAbsenSession(mid)

  if (args.action === 'masuk') {
    if (openSession) {
      return {
        ok: false,
        error:
          'Masih ada sesi aktif — catat keluar kota dulu sebelum masuk lagi',
        row: openSession,
      }
    }
    const v = validateAbsenPhotoFile(photoFile)
    if (!v.ok) return { ok: false, error: v.message, row: null }

    let photoUrl = ''
    try {
      photoUrl = await uploadAbsenKotaImage(photoFile!, mid, 'masuk')
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Gagal upload bukti',
        row: null,
      }
    }
    if (!photoUrl) return { ok: false, error: 'Gagal upload bukti', row: null }

    const tanggalMasuk = todayDateKeyJakarta(now)
    const payload: Record<string, unknown> = {
      member_id: mid,
      nama,
      tanggal: args.tanggal || tanggalMasuk,
      jam_masuk_kota: now.toISOString(),
      catatan: catatan || null,
      dicatat_oleh: actor || null,
      updated_at: now.toISOString(),
      bukti_masuk_url: photoUrl,
    }

    let { data: row, error } = await supabase
      .from('absen_kota_logs')
      .insert(payload)
      .select('*')
      .single()

    if (error && isMissingColumnError(error, 'bukti_masuk_url')) {
      delete payload.bukti_masuk_url
      ;({ data: row, error } = await supabase
        .from('absen_kota_logs')
        .insert(payload)
        .select('*')
        .single())
    }

    if (error) {
      if (isAbsenUniqueViolation(error)) {
        return {
          ok: false,
          error:
            'Gagal simpan: database masih batasi 1 absen per hari (unique index).',
          row: null,
        }
      }
      return {
        ok: false,
        error: error.message || 'Gagal simpan absen',
        row: null,
      }
    }

    const mapped = mapAbsenRow(row as unknown as Record<string, unknown>)
    await syncAbsenKotaDiscord(mapped)
    return { ok: true, error: null, row: mapped }
  }

  if (args.action === 'keluar') {
    if (!openSession?.jam_masuk_kota) {
      return {
        ok: false,
        error: 'Belum catat masuk kota (tidak ada sesi aktif)',
        row: null,
      }
    }
    const v = validateAbsenPhotoFile(photoFile)
    if (!v.ok) return { ok: false, error: v.message, row: null }

    let photoUrl = ''
    try {
      photoUrl = await uploadAbsenKotaImage(photoFile!, mid, 'keluar')
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Gagal upload bukti',
        row: null,
      }
    }
    if (!photoUrl) return { ok: false, error: 'Gagal upload bukti', row: null }

    const payload: Record<string, unknown> = {
      jam_keluar_kota: now.toISOString(),
      catatan: catatan || openSession.catatan || null,
      dicatat_oleh: actor || openSession.dicatat_oleh || null,
      updated_at: now.toISOString(),
      bukti_keluar_url: photoUrl,
    }

    let { data: row, error } = await supabase
      .from('absen_kota_logs')
      .update(payload)
      .eq('id', openSession.id)
      .select('*')
      .single()

    if (error && isMissingColumnError(error, 'bukti_keluar_url')) {
      delete payload.bukti_keluar_url
      ;({ data: row, error } = await supabase
        .from('absen_kota_logs')
        .update(payload)
        .eq('id', openSession.id)
        .select('*')
        .single())
    }

    if (error) {
      return { ok: false, error: error.message || 'Gagal update absen keluar', row: null }
    }

    const mapped = mapAbsenRow(row as unknown as Record<string, unknown>)
    await syncAbsenKotaDiscord(mapped)
    return { ok: true, error: null, row: mapped }
  }

  return { ok: false, error: 'Aksi tidak valid', row: null }
}

export async function fetchAbsenKotaTable(args: {
  tanggal: string
  member: Member | null
  isAdmin: boolean
}): Promise<{ data: AbsenRow[]; error: string | null }> {
  const tanggal = args.tanggal || todayDateKeyJakarta()
  const prevDay = addDaysToDateKey(tanggal, -1)
  const orFilter = `tanggal.eq.${tanggal},tanggal.eq.${prevDay},and(jam_keluar_kota.is.null,jam_masuk_kota.not.is.null)`

  const buildQuery = (withDeletedFilter: boolean) => {
    let q = supabase
      .from('absen_kota_logs')
      .select('*')
      .or(orFilter)
      .order('jam_masuk_kota', { ascending: true, nullsFirst: false })
    if (!args.isAdmin && args.member?.id) {
      q = q.eq('member_id', args.member.id)
    }
    if (withDeletedFilter) q = q.is('deleted_at', null)
    return q
  }

  let { data, error } = await buildQuery(true)
  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await buildQuery(false))
  }
  if (error) return { data: [], error: error.message }

  const rows = [
    ...new Map(
      ((data || []) as unknown as Record<string, unknown>[])
        .map(mapAbsenRow)
        .filter((r) => absenRowMatchesFilterDate(r, tanggal))
        .map((r) => [r.id, r] as const),
    ).values(),
  ].sort((a, b) => {
    const ta = a.jam_masuk_kota ? new Date(a.jam_masuk_kota).getTime() : 0
    const tb = b.jam_masuk_kota ? new Date(b.jam_masuk_kota).getTime() : 0
    return ta - tb
  })

  return { data: rows, error: null }
}

export async function deleteAbsenKotaRow(
  row: AbsenRow,
  member: Member | null,
): Promise<{ ok: boolean; error: string | null }> {
  if (!isAdminMember(member)) {
    return { ok: false, error: 'Hanya admin yang bisa hapus data absen' }
  }
  try {
    const { deleteDiscordForTableRow } = await import('./discord')
    await deleteDiscordForTableRow('absen', 'absen_kota_logs', row.id)
  } catch (e) {
    console.warn('[discord] absen delete', e)
  }
  const soft = await softDeleteById('absen_kota_logs', row.id)
  if (!soft.ok) {
    if (soft.error && isMissingColumnError(soft.error, 'deleted_at')) {
      return { ok: false, error: 'Soft delete belum aktif (kolom deleted_at)' }
    }
    return { ok: false, error: soft.error?.message || 'Gagal hapus absen' }
  }
  return { ok: true, error: null }
}

async function syncAbsenKotaDiscord(row: AbsenRow | null): Promise<void> {
  if (!row?.id) return
  try {
    const {
      fetchDiscordMessageId,
      patchDiscord,
      postDiscord,
      persistDiscordMessageId,
    } = await import('./discord')
    const { buildAbsenKotaDiscordEmbeds } = await import('./discordMessages')
    const { content, embeds } = buildAbsenKotaDiscordEmbeds(row)
    const existing = await fetchDiscordMessageId('absen_kota_logs', row.id)
    if (existing) {
      await patchDiscord({
        channel: 'absen',
        messageId: existing,
        content,
        embeds,
      })
      return
    }
    const mid = await postDiscord({
      channel: 'absen',
      content,
      embeds,
    })
    if (mid) await persistDiscordMessageId('absen_kota_logs', row.id, mid)
  } catch (e) {
    console.warn('[discord] absen sync', e)
  }
}
