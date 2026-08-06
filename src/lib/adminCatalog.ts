import { CATALOG_CATEGORIES, type CatalogCategory } from './catalog'
import { isMissingColumnError } from './orderUtils'
import { supabase } from './supabase'

export type CatalogAdminItem = {
  id: number
  name: string
  kategori: CatalogCategory | string
  price: number
  scrap: number | null
  max_limit: number | null
  is_active: boolean
  metadata: { note?: string } | null
}

export type CatalogUpsertInput = {
  name: string
  kategori: string
  price: number
  scrap: number | null
  max_limit: number
  is_active: boolean
  metadata: { note?: string } | null
}

function mapRow(row: Record<string, unknown>): CatalogAdminItem {
  const meta = row.metadata
  let metadata: { note?: string } | null = null
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const note = (meta as { note?: unknown }).note
    metadata = { note: note == null ? undefined : String(note) }
  }
  return {
    id: Number(row.id),
    name: String(row.name || ''),
    kategori: String(row.kategori || ''),
    price: Number(row.price) || 0,
    scrap: row.scrap == null ? null : Number(row.scrap),
    max_limit: row.max_limit == null ? null : Number(row.max_limit),
    is_active: row.is_active !== false,
    metadata,
  }
}

export async function fetchAdminCatalog(): Promise<{
  data: CatalogAdminItem[]
  error: string | null
}> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .order('kategori', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { data: [], error: error.message }
  return {
    data: (data || []).map((r) => mapRow(r as unknown as Record<string, unknown>)),
    error: null,
  }
}

export async function upsertCatalogItem(
  input: CatalogUpsertInput,
  id?: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const payload: Record<string, unknown> = {
    kategori: input.kategori,
    name: input.name.trim(),
    price: input.price,
    scrap: input.scrap,
    max_limit: input.max_limit,
    is_active: input.is_active,
    metadata: input.metadata || { note: '' },
  }

  if (!payload.name) return { ok: false, error: 'Nama wajib diisi' }
  if (!payload.kategori) return { ok: false, error: 'Kategori wajib diisi' }
  if (!input.max_limit || input.max_limit < 1) {
    return { ok: false, error: 'Limit Order wajib diisi dan minimal 1' }
  }

  let res = id
    ? await supabase.from('catalog_items').update(payload).eq('id', id)
    : await supabase.from('catalog_items').insert([payload])

  if (
    res.error &&
    isMissingColumnError(res.error, 'max_limit')
  ) {
    const { max_limit: _m, ...rest } = payload
    res = id
      ? await supabase.from('catalog_items').update(rest).eq('id', id)
      : await supabase.from('catalog_items').insert([rest])
  }

  if (res.error) return { ok: false, error: res.error.message }
  return { ok: true }
}

export async function toggleCatalogActive(
  id: number,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from('catalog_items')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export const ADMIN_CATALOG_CATEGORIES = CATALOG_CATEGORIES
