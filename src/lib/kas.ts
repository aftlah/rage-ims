import { fmtLocalDateTime } from './dates'
import { fmtUsd } from './format'
import { isMissingColumnError } from './orderUtils'
import { softDeleteById } from './softDelete'
import { supabase } from './supabase'

export type CashType = 'IN' | 'OUT'

export type RageCashRow = {
  id: number
  type: CashType
  amount: number
  category: string
  note: string
  waktu: string
}

export const RAGE_CASH_CATEGORIES = [
  'Operasional',
  'Event',
  'Senjata',
  'Drugs',
  'Storan',
  'Lainnya',
] as const

export async function ensureRageCashTable(): Promise<{
  ok: boolean
  error: string | null
}> {
  const { error } = await supabase.from('rage_cash_logs').select('id').limit(1)
  if (
    error &&
    String(error.message || '')
      .toLowerCase()
      .includes('relation')
  ) {
    return { ok: false, error: "Tabel 'rage_cash_logs' belum ada di Supabase" }
  }
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}

export async function getRageCashBalance(): Promise<number | null> {
  const ok = await ensureRageCashTable()
  if (!ok.ok) return null

  let { data, error } = await supabase
    .from('rage_cash_logs')
    .select('type,amount')
    .is('deleted_at', null)
    .order('waktu', { ascending: false })
    .limit(2000)

  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await supabase
      .from('rage_cash_logs')
      .select('type,amount')
      .order('waktu', { ascending: false })
      .limit(2000))
  }
  if (error) return null

  return (data || []).reduce((acc, r) => {
    const a = parseFloat(String(r.amount)) || 0
    if (r.type === 'IN') return acc + a
    return acc - a
  }, 0)
}

function mapCashRow(row: Record<string, unknown>): RageCashRow {
  return {
    id: Number(row.id),
    type: String(row.type).toUpperCase() === 'OUT' ? 'OUT' : 'IN',
    amount: Number(row.amount) || 0,
    category: String(row.category || ''),
    note: String(row.note || ''),
    waktu: String(row.waktu || ''),
  }
}

export async function fetchRageCashLogs(): Promise<{
  data: RageCashRow[]
  balance: number | null
  error: string | null
}> {
  const table = await ensureRageCashTable()
  if (!table.ok) return { data: [], balance: null, error: table.error }

  let { data, error } = await supabase
    .from('rage_cash_logs')
    .select('id,type,amount,category,note,waktu')
    .is('deleted_at', null)
    .order('waktu', { ascending: false })
    .limit(50)

  if (error && isMissingColumnError(error, 'deleted_at')) {
    ;({ data, error } = await supabase
      .from('rage_cash_logs')
      .select('id,type,amount,category,note,waktu')
      .order('waktu', { ascending: false })
      .limit(50))
  }

  if (error) return { data: [], balance: null, error: error.message }

  const balance = await getRageCashBalance()
  return {
    data: ((data || []) as unknown as Record<string, unknown>[]).map(mapCashRow),
    balance,
    error: null,
  }
}

export async function submitRageCash(args: {
  type: CashType
  amount: number
  category: string
  note: string
  waktuIso?: string | null
}): Promise<{ ok: boolean; error: string | null }> {
  const table = await ensureRageCashTable()
  if (!table.ok) return { ok: false, error: table.error }

  const type = args.type
  const amount = Number(args.amount) || 0
  const category = String(args.category || '').trim()
  const note = String(args.note || '').trim()

  if (type !== 'IN' && type !== 'OUT') {
    return { ok: false, error: 'Pilih tipe transaksi' }
  }
  if (amount <= 0) return { ok: false, error: 'Nominal harus lebih dari 0' }
  if (!category) return { ok: false, error: 'Kategori wajib diisi' }

  const waktu = args.waktuIso
    ? new Date(args.waktuIso).toISOString()
    : new Date().toISOString()

  const { error } = await supabase
    .from('rage_cash_logs')
    .insert({ type, amount, category, note, waktu })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}

export async function deleteRageCashEntry(
  id: number,
): Promise<{ ok: boolean; error: string | null }> {
  const soft = await softDeleteById('rage_cash_logs', id)
  if (!soft.ok) {
    if (soft.error && isMissingColumnError(soft.error, 'deleted_at')) {
      return { ok: false, error: 'Soft delete belum aktif (kolom deleted_at)' }
    }
    return { ok: false, error: soft.error?.message || 'Gagal menghapus' }
  }
  return { ok: true, error: null }
}

export function formatCashAmount(amount: number, type: CashType): string {
  const sign = type === 'IN' ? '+' : '-'
  return `${sign}${fmtUsd(amount)}`
}

export function formatCashTime(iso: string): string {
  return fmtLocalDateTime(iso)
}

/** datetime-local value from Date */
export function toLocalInputValue(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
