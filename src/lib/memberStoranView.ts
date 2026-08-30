import { fmtLocalDateTime } from './dates'
import {
  fetchNitipCuciLogs,
  type NitipCuciRow,
} from './nitipCuci'
import { isMissingColumnError } from './orderUtils'
import {
  getStoranCalendarWeekPeriod,
  getStoranDoneLabel,
  type StoranPeriod,
} from './storan'
import { supabase } from './supabase'

export type MemberStoranWeek = {
  period: StoranPeriod
  statusLabel: string
  statusRaw: 'SUDAH' | 'BELUM'
  penerima: string
  catatan: string
  waktu: string
}

export type MemberStoranView = {
  week: MemberStoranWeek
  nitipRecent: NitipCuciRow[]
  error: string | null
}

async function fetchMemberStoranLog(
  memberId: number,
  periodeValue: number,
): Promise<{
  penerima: string
  status_label: string
  status: string
  catatan: string
  waktu: string
} | null> {
  const firstTry = await supabase
    .from('storan_logs')
    .select('penerima,status,status_label,catatan,waktu,deleted_at')
    .eq('member_id', memberId)
    .eq('periode_orderanke', periodeValue)
    .order('waktu', { ascending: false })
    .limit(5)

  let rows: Array<Record<string, unknown>> = []

  if (firstTry.error && isMissingColumnError(firstTry.error, 'deleted_at')) {
    const retry = await supabase
      .from('storan_logs')
      .select('penerima,status,status_label,catatan,waktu')
      .eq('member_id', memberId)
      .eq('periode_orderanke', periodeValue)
      .order('waktu', { ascending: false })
      .limit(5)
    if (retry.error) return null
    rows = (retry.data || []) as Array<Record<string, unknown>>
  } else if (firstTry.error) {
    return null
  } else {
    rows = ((firstTry.data || []) as Array<Record<string, unknown>>).filter(
      (r) => !r.deleted_at,
    )
  }

  const row = rows[0]
  if (!row) return null

  return {
    penerima: String(row.penerima || ''),
    status: String(row.status || ''),
    status_label: String(row.status_label || ''),
    catatan: String(row.catatan || ''),
    waktu: String(row.waktu || ''),
  }
}

/** Read-only storan minggu ini + nitip terakhir milik member. */
export async function fetchMemberStoranView(
  memberId: number,
): Promise<MemberStoranView> {
  const period = getStoranCalendarWeekPeriod()
  const log = await fetchMemberStoranLog(memberId, period.periodeValue)
  const isSudah = log && String(log.status || '').toUpperCase() === 'SUDAH'

  const week: MemberStoranWeek = {
    period,
    statusRaw: isSudah ? 'SUDAH' : 'BELUM',
    statusLabel: isSudah
      ? log?.status_label || getStoranDoneLabel()
      : 'Belum storan minggu ini',
    penerima: log?.penerima || '—',
    catatan: log?.catatan || '',
    waktu: log?.waktu ? fmtLocalDateTime(log.waktu) : '—',
  }

  const nitipRes = await fetchNitipCuciLogs(null)
  if (nitipRes.error) {
    return { week, nitipRecent: [], error: nitipRes.error }
  }

  const nitipRecent = nitipRes.data
    .filter((row) => Number(row.member_id) === Number(memberId))
    .slice(0, 5)

  return { week, nitipRecent, error: null }
}
