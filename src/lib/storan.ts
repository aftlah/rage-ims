import type { Member } from './auth'
import { isAdminMember } from './auth'
import { fmtLocalDateTime } from './dates'
import { fetchMembersLite, type MemberLite } from './membersLite'
import { isMissingColumnError } from './orderUtils'
import { softDeleteById, softDeleteByIds } from './softDelete'
import { supabase } from './supabase'

export type StoranStatus = 'SUDAH' | 'BELUM'

export type StoranPeriod = {
  periodeValue: number
  start: Date
  end: Date
  label: string
}

export type StoranLog = {
  id: number
  member_id: number
  nama: string
  penerima: string
  status: string
  status_label: string
  catatan: string
  waktu: string
  periode_orderanke: number
}

export type StoranRekapRow = {
  id: number | null
  memberId: number
  nama: string
  penerima: string
  statusLabel: string
  statusRaw: StoranStatus
  catatan: string
  waktu: string
  isBelum: boolean
  periodeValue: number | null
}

const STORAN_COLS_FULL =
  'id,member_id,nama,penerima,status,status_label,catatan,waktu,periode_orderanke,deleted_at'
const STORAN_COLS_LITE =
  'id,member_id,nama,penerima,status,status_label,catatan,waktu,periode_orderanke'

export function getStoranDoneLabel(): string {
  return 'Lunas 100 MS, 100 Empty Bottle, 100 Empty Can'
}

function formatStoranDayMonth(d: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ]
  return `${d.getDate()} ${months[d.getMonth()]}`
}

/** ISO week period: periodeValue = isoYear * 100 + isoWeek */
export function getStoranCalendarWeekPeriod(
  date: Date = new Date(),
): StoranPeriod {
  const local = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
    0,
  )
  const day = local.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  const start = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() - daysFromMonday,
    0,
    0,
    0,
    0,
  )
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
    23,
    59,
    59,
    999,
  )

  const thursday = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 3,
    12,
    0,
    0,
    0,
  )
  const isoYear = thursday.getFullYear()
  const jan4 = new Date(isoYear, 0, 4, 12, 0, 0, 0)
  const jan4Day = jan4.getDay()
  const jan4FromMon = jan4Day === 0 ? 6 : jan4Day - 1
  const week1Monday = new Date(
    jan4.getFullYear(),
    jan4.getMonth(),
    jan4.getDate() - jan4FromMon,
    0,
    0,
    0,
    0,
  )
  const isoWeek =
    Math.floor((start.getTime() - week1Monday.getTime()) / 86400000 / 7) + 1
  const periodeValue = isoYear * 100 + isoWeek

  const sameMonth = start.getMonth() === end.getMonth()
  const sameYear = start.getFullYear() === end.getFullYear()
  let label: string
  if (sameMonth && sameYear) {
    label = `${start.getDate()}–${end.getDate()} ${formatStoranDayMonth(end).split(' ')[1]} ${end.getFullYear()}`
  } else if (sameYear) {
    label = `${formatStoranDayMonth(start)}–${formatStoranDayMonth(end)} ${end.getFullYear()}`
  } else {
    label = `${formatStoranDayMonth(start)} ${start.getFullYear()}–${formatStoranDayMonth(end)} ${end.getFullYear()}`
  }

  return { periodeValue, start, end, label }
}

export function getStoranPeriodFromValue(
  periodeValue: number,
): StoranPeriod | null {
  const v = parseInt(String(periodeValue), 10)
  if (!v || Number.isNaN(v) || v < 200001) return null
  const isoYear = Math.floor(v / 100)
  const isoWeek = v % 100
  if (isoWeek < 1 || isoWeek > 53) return null
  const jan4 = new Date(isoYear, 0, 4, 12, 0, 0, 0)
  const jan4Day = jan4.getDay()
  const jan4FromMon = jan4Day === 0 ? 6 : jan4Day - 1
  const week1Monday = new Date(
    jan4.getFullYear(),
    jan4.getMonth(),
    jan4.getDate() - jan4FromMon,
    12,
    0,
    0,
    0,
  )
  const monday = new Date(
    week1Monday.getFullYear(),
    week1Monday.getMonth(),
    week1Monday.getDate() + (isoWeek - 1) * 7,
    12,
    0,
    0,
    0,
  )
  return getStoranCalendarWeekPeriod(monday)
}

export function formatStoranPeriodeLabel(
  periodeValue: number,
  isCurrent = false,
): string {
  const v = parseInt(String(periodeValue), 10)
  if (!v || Number.isNaN(v)) return '—'
  const suffix = isCurrent ? ' (minggu ini)' : ''
  if (v >= 200001) {
    const period = getStoranPeriodFromValue(v)
    return `${(period && period.label) || String(v)}${suffix}`
  }
  const m = Math.floor(v / 10)
  const w = v % 10
  return `M${m}-W${w} (#${v}) [lama]${suffix}`
}

export function listRecentStoranCalendarWeeks(count = 16): StoranPeriod[] {
  const out: StoranPeriod[] = []
  const seen = new Set<number>()
  let cursor = new Date()
  for (let i = 0; i < count; i++) {
    const period = getStoranCalendarWeekPeriod(cursor)
    if (!seen.has(period.periodeValue)) {
      seen.add(period.periodeValue)
      out.push(period)
    }
    cursor = new Date(
      period.start.getFullYear(),
      period.start.getMonth(),
      period.start.getDate() - 7,
      12,
      0,
      0,
      0,
    )
  }
  return out
}

export function canDeleteStoranRow(
  row: { id?: number | null; memberId?: number; member_id?: number },
  member: Member | null,
): boolean {
  if (!row?.id) return false
  if (isAdminMember(member)) return true
  if (!member?.id) return false
  const mid = Number(row.memberId ?? row.member_id ?? 0)
  return mid === Number(member.id)
}

async function findActiveStoranLog(
  memberId: number,
  periodeValue: number,
): Promise<{ id: number } | null> {
  const firstTry = await supabase
    .from('storan_logs')
    .select('id,deleted_at,waktu')
    .eq('member_id', memberId)
    .eq('periode_orderanke', periodeValue)
    .order('waktu', { ascending: false })
    .limit(10)

  let rows: Array<{ id: number; deleted_at?: string | null }> = []
  if (firstTry.error && isMissingColumnError(firstTry.error, 'deleted_at')) {
    const retry = await supabase
      .from('storan_logs')
      .select('id,waktu')
      .eq('member_id', memberId)
      .eq('periode_orderanke', periodeValue)
      .order('waktu', { ascending: false })
      .limit(10)
    if (retry.error) return null
    rows = (retry.data || []) as Array<{ id: number }>
  } else if (firstTry.error) {
    return null
  } else {
    rows = (firstTry.data || []) as Array<{
      id: number
      deleted_at?: string | null
    }>
  }

  const active = rows.filter((r) => !r.deleted_at)
  const first = active[0]
  return first?.id ? { id: Number(first.id) } : null
}

async function softDeleteOtherStoranLogs(
  memberId: number,
  periodeValue: number,
  keepId: number,
): Promise<void> {
  const firstTry = await supabase
    .from('storan_logs')
    .select('id,deleted_at')
    .eq('member_id', memberId)
    .eq('periode_orderanke', periodeValue)
    .neq('id', keepId)

  let rows: Array<{ id: number; deleted_at?: string | null }> = []
  if (firstTry.error && isMissingColumnError(firstTry.error, 'deleted_at')) {
    const retry = await supabase
      .from('storan_logs')
      .select('id')
      .eq('member_id', memberId)
      .eq('periode_orderanke', periodeValue)
      .neq('id', keepId)
    if (retry.error || !retry.data?.length) return
    rows = retry.data as Array<{ id: number }>
  } else if (firstTry.error || !firstTry.data?.length) {
    return
  } else {
    rows = firstTry.data as Array<{ id: number; deleted_at?: string | null }>
  }

  const ids = rows
    .filter((r) => !r.deleted_at)
    .map((r) => r.id)
    .filter(Boolean)
  if (!ids.length) return
  const soft = await softDeleteByIds('storan_logs', ids)
  if (!soft.ok && soft.error && isMissingColumnError(soft.error, 'deleted_at')) {
    await supabase.from('storan_logs').delete().in('id', ids)
  }
}

export async function fetchStoranPeriodeOptions(): Promise<{
  current: StoranPeriod
  options: Array<{ value: number; label: string }>
  error: string | null
}> {
  const current = getStoranCalendarWeekPeriod()
  const byValue = new Map<number, { value: number; label: string }>()

  listRecentStoranCalendarWeeks(16).forEach((p) => {
    byValue.set(p.periodeValue, {
      value: p.periodeValue,
      label: formatStoranPeriodeLabel(
        p.periodeValue,
        p.periodeValue === current.periodeValue,
      ),
    })
  })

  let { data, error } = await supabase
    .from('storan_logs')
    .select('periode_orderanke')
    .not('periode_orderanke', 'is', null)
    .is('deleted_at', null)
    .order('periode_orderanke', { ascending: false })
    .limit(300)

  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await supabase
      .from('storan_logs')
      .select('periode_orderanke')
      .not('periode_orderanke', 'is', null)
      .order('periode_orderanke', { ascending: false })
      .limit(300))
  }

  if (!error) {
    ;(data || []).forEach((r) => {
      const v = parseInt(String(r.periode_orderanke), 10)
      if (!v || Number.isNaN(v) || byValue.has(v)) return
      byValue.set(v, {
        value: v,
        label: formatStoranPeriodeLabel(v, v === current.periodeValue),
      })
    })
  }

  const options = Array.from(byValue.values()).sort((a, b) => b.value - a.value)
  return { current, options, error: error?.message ?? null }
}

function mapStoranLog(row: Record<string, unknown>): StoranLog {
  return {
    id: Number(row.id),
    member_id: Number(row.member_id),
    nama: String(row.nama || ''),
    penerima: String(row.penerima || ''),
    status: String(row.status || ''),
    status_label: String(row.status_label || ''),
    catatan: String(row.catatan || ''),
    waktu: String(row.waktu || ''),
    periode_orderanke: Number(row.periode_orderanke) || 0,
  }
}

export function buildStoranRekapRows(
  logs: StoranLog[],
  members: MemberLite[],
  periodeValue: number,
): StoranRekapRow[] {
  const latestByMember: Record<number, StoranLog> = {}
  for (const r of logs) {
    const key = r.member_id
    if (!key) continue
    const prev = latestByMember[key]
    if (!prev) {
      latestByMember[key] = r
      continue
    }
    const tPrev = new Date(prev.waktu || 0).getTime()
    const tCur = new Date(r.waktu || 0).getTime()
    if (tCur >= tPrev) latestByMember[key] = r
  }

  return members.map((m) => {
    const log = latestByMember[m.id] || null
    const statusRaw =
      String((log && log.status) || 'BELUM').toUpperCase() === 'SUDAH'
        ? 'SUDAH'
        : 'BELUM'
    const isSudah = !!(log && statusRaw === 'SUDAH')
    return {
      id: log?.id ?? null,
      memberId: m.id,
      nama: m.nama || '',
      penerima: log?.penerima || '',
      statusLabel: isSudah
        ? log?.status_label || getStoranDoneLabel()
        : 'Belum storan minggu ini',
      statusRaw: isSudah ? 'SUDAH' : 'BELUM',
      catatan: log?.catatan || '',
      waktu: log?.waktu ? fmtLocalDateTime(log.waktu) : '',
      isBelum: !isSudah,
      periodeValue: log?.periode_orderanke || periodeValue || null,
    }
  })
}

export async function fetchStoranRekap(periodeValue: number): Promise<{
  rows: StoranRekapRow[]
  members: MemberLite[]
  error: string | null
}> {
  const membersRes = await fetchMembersLite()
  if (membersRes.error) {
    return { rows: [], members: [], error: membersRes.error }
  }

  const firstTry = await supabase
    .from('storan_logs')
    .select(STORAN_COLS_FULL)
    .eq('periode_orderanke', periodeValue)
    .is('deleted_at', null)
    .order('waktu', { ascending: true })

  let rawRows: Record<string, unknown>[] | null = null
  let fetchError: string | null = null

  if (!firstTry.error) {
    rawRows = (firstTry.data || []) as unknown as Record<string, unknown>[]
  } else {
    const attempts = [
      () =>
        supabase
          .from('storan_logs')
          .select(STORAN_COLS_LITE)
          .eq('periode_orderanke', periodeValue)
          .is('deleted_at', null)
          .order('waktu', { ascending: true }),
      () =>
        supabase
          .from('storan_logs')
          .select(STORAN_COLS_LITE)
          .eq('periode_orderanke', periodeValue)
          .order('waktu', { ascending: true }),
    ]
    for (const run of attempts) {
      const retry = await run()
      if (!retry.error) {
        rawRows = (retry.data || []) as unknown as Record<string, unknown>[]
        break
      }
      fetchError = retry.error.message
    }
    if (!rawRows) fetchError = firstTry.error.message
  }

  if (!rawRows) {
    return { rows: [], members: membersRes.data, error: fetchError }
  }

  const logs = rawRows.map(mapStoranLog)
  return {
    rows: buildStoranRekapRows(logs, membersRes.data, periodeValue),
    members: membersRes.data,
    error: null,
  }
}

export async function upsertStoran(args: {
  memberId: number
  nama: string
  status: StoranStatus
  penerima: string
  periodeValue?: number
  editId?: number | null
}): Promise<{ ok: boolean; error: string | null }> {
  const memberId = Number(args.memberId)
  const nama = String(args.nama || '').trim()
  const statusVal: StoranStatus =
    String(args.status).toUpperCase() === 'BELUM' ? 'BELUM' : 'SUDAH'
  const penerima = String(args.penerima || '').trim()

  if (!memberId) return { ok: false, error: 'Pilih nama member dulu' }
  if (!nama) return { ok: false, error: 'Nama wajib diisi' }
  if (statusVal === 'SUDAH' && !penerima) {
    return { ok: false, error: 'Penerima wajib diisi untuk status Sudah' }
  }

  const now = new Date()
  const weekPeriod = getStoranCalendarWeekPeriod(now)
  let periodeValue = args.periodeValue || weekPeriod.periodeValue
  if (args.editId && args.periodeValue) periodeValue = args.periodeValue

  const labelStatus =
    statusVal === 'SUDAH'
      ? getStoranDoneLabel()
      : 'Belum storan minggu ini'

  let savedRowId =
    args.editId && Number(args.editId) ? Number(args.editId) : null
  if (!savedRowId) {
    const existing = await findActiveStoranLog(memberId, periodeValue)
    if (existing?.id) savedRowId = existing.id
  }

  const payload = {
    member_id: memberId,
    nama,
    status: statusVal,
    status_label: labelStatus,
    periode_orderanke: periodeValue,
    penerima: statusVal === 'SUDAH' ? penerima : '',
    catatan: '',
    waktu: now.toISOString(),
  }

  let logErr: { message?: string } | null = null
  let savedOk = false

  if (savedRowId) {
    const res = await supabase
      .from('storan_logs')
      .update(payload)
      .eq('id', savedRowId)
      .select('id,status')
      .maybeSingle()
    logErr = res.error
    if (res.data?.id) {
      savedRowId = Number(res.data.id)
      savedOk = true
      if (
        String(res.data.status || '').toUpperCase() !==
        String(statusVal).toUpperCase()
      ) {
        savedOk = false
        logErr = {
          message:
            'Status di database tidak berubah. Cek RLS update storan_logs.',
        }
      }
    } else if (!logErr) {
      logErr = { message: 'Update tidak mengubah baris (permission/RLS?).' }
    }
  } else {
    const res = await supabase
      .from('storan_logs')
      .insert(payload)
      .select('id,status')
      .maybeSingle()
    logErr = res.error
    if (res.data?.id) {
      savedRowId = Number(res.data.id)
      savedOk = true
    }
  }

  if (logErr && !isMissingColumnError(logErr, 'discord_message_id')) {
    return { ok: false, error: logErr.message || 'Gagal menyimpan' }
  }

  if (!savedOk || !savedRowId) {
    return { ok: false, error: 'Gagal menyimpan status storan ke database' }
  }

  await softDeleteOtherStoranLogs(memberId, periodeValue, savedRowId)
  return { ok: true, error: null }
}

export async function deleteStoranRow(
  row: StoranRekapRow,
  member: Member | null,
): Promise<{ ok: boolean; error: string | null }> {
  if (!canDeleteStoranRow(row, member)) {
    return { ok: false, error: 'Tidak bisa menghapus data ini' }
  }
  if (!row.id) return { ok: false, error: 'Tidak ada baris storan' }

  let soft = await softDeleteById('storan_logs', row.id)
  if (!soft.ok) {
    const hard = await supabase
      .from('storan_logs')
      .delete()
      .eq('id', row.id)
      .select('id')
    if (!hard.error && hard.data?.length) {
      soft = { ok: true, error: null }
    } else {
      return {
        ok: false,
        error: soft.error?.message || hard.error?.message || 'Gagal menghapus',
      }
    }
  }

  if (soft.ok) {
    const { data: stillThere } = await supabase
      .from('storan_logs')
      .select('id,deleted_at')
      .eq('id', row.id)
      .maybeSingle()
    if (stillThere && !stillThere.deleted_at) {
      const hard = await supabase
        .from('storan_logs')
        .delete()
        .eq('id', row.id)
        .select('id')
      if (hard.error || !hard.data?.length) {
        return {
          ok: false,
          error: hard.error?.message || 'Gagal hard-delete storan',
        }
      }
    }
  }

  return { ok: true, error: null }
}
