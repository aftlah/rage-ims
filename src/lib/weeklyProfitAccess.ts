import type { Member } from './auth'
import { isAdminMember } from './auth'

export function parseWeeklyProfitViewerIds(value: unknown): number[] {
  const raw = value
  let list: unknown[] = []
  if (Array.isArray(raw)) {
    list = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) list = parsed
    } catch {
      list = []
    }
  }
  return list
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
}

export function canAccessWeeklyProfit(
  member: Member | null | undefined,
  viewerIds: number[],
): boolean {
  if (isAdminMember(member)) return true
  if (!member?.id) return false
  return viewerIds.includes(Number(member.id))
}
