import { supabase } from './supabase'

export async function softDeleteById(
  tableName: string,
  id: number | string,
): Promise<{ ok: boolean; error: { message?: string } | null }> {
  const rowId = String(id || '').trim()
  if (!rowId) return { ok: false, error: { message: 'ID kosong' } }
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from(tableName)
    .update({ deleted_at: now })
    .eq('id', rowId)
    .select('id')
  if (error) return { ok: false, error }
  if (!data || !data.length) {
    return {
      ok: false,
      error: {
        message: `Tidak ada baris terhapus (cek RLS/permission update di ${tableName})`,
      },
    }
  }
  return { ok: true, error: null }
}

export async function softDeleteByIds(
  tableName: string,
  ids: Array<number | string>,
): Promise<{ ok: boolean; error: { message?: string } | null }> {
  const clean = (Array.isArray(ids) ? ids : [ids])
    .map((x) => String(x).trim())
    .filter(Boolean)
  if (!clean.length) return { ok: false, error: { message: 'ID kosong' } }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from(tableName)
    .update({ deleted_at: now })
    .in('id', clean)
  if (error) return { ok: false, error }
  return { ok: true, error: null }
}
