import { supabase } from './supabase'

export const CATALOG_CATEGORIES = ['Gun', 'Ammo', 'Attachment', 'Others'] as const
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number]

export type CatalogItem = {
  name: string
  /** Harga base / modal (untuk hitung profit). */
  price: number
  /** Harga jual member. Null/0 → pakai price. */
  sell_price: number | null
  scrap: number | null
  metadata: unknown
  max_limit: number | null
  kategori: CatalogCategory
}

export type CatalogByCategory = Record<CatalogCategory, CatalogItem[]>

export const EMPTY_CATALOG: CatalogByCategory = {
  Gun: [],
  Ammo: [],
  Attachment: [],
  Others: [],
}

/** Fallback max limits — mirror Web-orderan-rage/script.js ITEM_MAX_LIMITS */
export const ITEM_MAX_LIMITS: Record<string, number> = {
  'PISTOL .50': 25,
  'CERAMIC PISTOL': 25,
  'TECH 9': 25,
  'MINI SMG': 25,
  'MICRO SMG': 25,
  'AMMO 9MM': 300,
  'AMMO .50': 300,
  'VEST MEDIUM': 75,
  'PISTOL X17': 25,
  'X17 + Attachment': 25,
  SHOTGUN: 15,
  'NAVY REVOLVER': 25,
  KVR: 25,
  'BLACK REVOLVER': 15,
  'AMMO .45': 300,
  'AMMO 12 GAUGE': 150,
  VEST: 250,
  LOCKPICK: 60,
  'AMMO 44 MAGNUM': 300,
  'Assault Rifle': 20,
  'Carbine Rifle': 20,
  'Virtus#3': 20,
  'Ammo 762': 500,
  'Ammo 556': 500,
  'Tactical Flashlight': 20,
  Suppressor: 20,
  'Tactical Suppressor': 20,
  Grip: 20,
  'Extended Pistol Clip': 20,
  'Extended SMG Clip': 20,
  'Extended Rifle Clip': 20,
  'Rifle Drum': 20,
  'Macro Scope': 20,
  'Medium Scope': 20,
  'Modern Extended Drum': 20,
  'Modern Suppressor Short': 20,
  'Holo Scope': 20,
}

export const MICRO_FULL_ATTACHMENT_BUNDLE_NAME = 'Micro SMG Full Attachment'
export const MICRO_FULL_ATTACHMENT_COMPONENTS = [
  { name: 'MICRO SMG', kategori: 'Gun' as const },
  { name: 'Tactical Suppressor', kategori: 'Attachment' as const },
  { name: 'Extended SMG Clip', kategori: 'Attachment' as const },
]

function isCatalogCategory(value: string): value is CatalogCategory {
  return (CATALOG_CATEGORIES as readonly string[]).includes(value)
}

/** Harga base (modal) dari item katalog. */
export function getItemBasePrice(
  item: Pick<CatalogItem, 'price'>,
): number {
  return Number(item.price) || 0
}

/** Harga jual member — sell_price jika ada, else base. */
export function getItemSellPrice(
  item: Pick<CatalogItem, 'price' | 'sell_price'>,
): number {
  const sell = Number(item.sell_price)
  if (Number.isFinite(sell) && sell > 0) return sell
  return getItemBasePrice(item)
}

/** @deprecated Prefer getItemSellPrice — kept for call sites that pass kategori/role. */
export function getEffectivePrice(
  _kategori: string,
  baseOrSellPrice: number,
  _role: string | null = null,
): number {
  return baseOrSellPrice
}

export function getItemMax(
  name: string,
  catalog: CatalogByCategory = EMPTY_CATALOG,
): number | null {
  const n = name || ''

  for (const kategori of CATALOG_CATEGORIES) {
    const items = catalog[kategori]
    const item = items.find(
      (i) => (i.name || '').toLowerCase() === n.toLowerCase(),
    )
    if (item && item.max_limit != null && item.max_limit !== 0) {
      return item.max_limit
    }
  }

  if (Object.prototype.hasOwnProperty.call(ITEM_MAX_LIMITS, n)) {
    return ITEM_MAX_LIMITS[n]
  }
  const upper = n.toUpperCase()
  const found = Object.keys(ITEM_MAX_LIMITS).find((k) => k.toUpperCase() === upper)
  return typeof found === 'string' ? ITEM_MAX_LIMITS[found] : null
}

export function getMicroFullAttachmentBundlePrice(
  catalog: CatalogByCategory,
  _role: string | null = null,
): number {
  return MICRO_FULL_ATTACHMENT_COMPONENTS.reduce((sum, entry) => {
    const found = (catalog[entry.kategori] || []).find((i) => i.name === entry.name)
    if (!found) return sum
    return sum + getItemSellPrice(found)
  }, 0)
}

export function getDisplayPrice(
  item: CatalogItem,
  catalog: CatalogByCategory,
  role: string | null = null,
): number {
  if (item.name === MICRO_FULL_ATTACHMENT_BUNDLE_NAME) {
    return getMicroFullAttachmentBundlePrice(catalog, role)
  }
  return getItemSellPrice(item)
}

export function getCatalogScrap(
  itemName: string,
  catalog: CatalogByCategory,
): number {
  for (const cat of CATALOG_CATEGORIES) {
    const found = (catalog[cat] || []).find((i) => i && i.name === itemName)
    if (found) return found.scrap || 0
  }
  return 0
}

export async function fetchCatalog(): Promise<{
  catalog: CatalogByCategory
  error: string | null
}> {
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .eq('is_active', true)

  if (error) {
    return { catalog: { ...EMPTY_CATALOG }, error: error.message }
  }

  const catalog: CatalogByCategory = {
    Gun: [],
    Ammo: [],
    Attachment: [],
    Others: [],
  }

  for (const row of data || []) {
    const cat = String(row.kategori || '')
    if (!isCatalogCategory(cat)) continue
    catalog[cat].push({
      name: String(row.name || ''),
      price: Number(row.price) || 0,
      sell_price:
        row.sell_price == null || row.sell_price === ''
          ? null
          : Number(row.sell_price),
      scrap: row.scrap == null ? null : Number(row.scrap),
      metadata: row.metadata ?? null,
      max_limit: row.max_limit == null ? null : Number(row.max_limit),
      kategori: cat,
    })
  }

  return { catalog, error: null }
}
