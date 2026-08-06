import type { CatalogByCategory } from './catalog'

export type VestType = 'VEST' | 'VEST MEDIUM' | 'BOTH'

export type RolePermissions = {
  allowed: 'ALL' | Set<string>
  vestType: VestType
  vestLimit: number
}

/** Mirror getRolePermissions from Web-orderan-rage/script.js */
export function getRolePermissions(
  role: string | null | undefined,
  catalog: CatalogByCategory,
): RolePermissions {
  const R = role || 'Hoodlum'
  if (String(R).trim().toLowerCase() === 'admin') {
    return {
      allowed: 'ALL',
      vestType: 'BOTH',
      vestLimit: 9999,
    }
  }

  const BASE_GUNS = ['PISTOL .50', 'CERAMIC PISTOL', 'TECH 9']
  const BASE_AMMO = ['AMMO .50', 'AMMO 9MM']
  const BASE_ATTACHMENTS = (catalog.Attachment || []).map((i) => i.name)
  const HANGAROUND_ADDITIONS = ['MINI SMG', 'MICRO SMG', 'PISTOL X17']
  const HANGAROUND_AMMO = ['AMMO .45']

  const norm = (list: string[]) => list.map((x) => x.toUpperCase())

  if (R === 'Internship') {
    return {
      allowed: new Set(
        norm([
          ...BASE_GUNS,
          ...BASE_AMMO,
          ...BASE_ATTACHMENTS,
          'VEST MEDIUM',
          'LOCKPICK',
        ]),
      ),
      vestType: 'VEST MEDIUM',
      vestLimit: 5,
    }
  }

  if (R === 'Hangaround') {
    return {
      allowed: new Set(
        norm([
          ...BASE_GUNS,
          ...BASE_AMMO,
          ...BASE_ATTACHMENTS,
          ...HANGAROUND_ADDITIONS,
          ...HANGAROUND_AMMO,
          'VEST MEDIUM',
          'VEST',
          'LOCKPICK',
        ]),
      ),
      vestType: 'BOTH',
      vestLimit: 5,
    }
  }

  if (R === 'Hoodlum') {
    return {
      allowed: 'ALL',
      vestType: 'BOTH',
      vestLimit: 10,
    }
  }

  // Highrank / default
  return {
    allowed: 'ALL',
    vestType: 'BOTH',
    vestLimit: 10,
  }
}

export function canBuyItem(
  itemName: string,
  role: string | null | undefined,
  nama: string | null | undefined,
  perms: RolePermissions,
): { ok: true } | { ok: false; message: string } {
  const isLeo = String(nama || '').toLowerCase() === 'leo'
  if (isLeo || perms.allowed === 'ALL') return { ok: true }

  const nItem = itemName.toUpperCase()
  if (perms.allowed.has(nItem)) return { ok: true }

  if (nItem.includes('VEST')) {
    if (perms.vestType === 'VEST' && nItem !== 'VEST') {
      return { ok: false, message: `${role} hanya boleh beli VEST` }
    }
    if (perms.vestType === 'VEST MEDIUM' && nItem !== 'VEST MEDIUM') {
      return { ok: false, message: `${role} hanya boleh beli VEST MEDIUM` }
    }
  }
  return {
    ok: false,
    message: `${role} tidak diperbolehkan membeli ${itemName}`,
  }
}
