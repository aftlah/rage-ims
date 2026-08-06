export function normItemName(s: string | null | undefined): string {
  return String(s || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
}

export function isMissingColumnError(
  err: { message?: string } | null | undefined,
  columnName: string,
): boolean {
  const msg = String(err?.message || '').toLowerCase()
  const col = String(columnName || '').toLowerCase()
  if (!msg || !col) return false
  return (
    msg.includes(col) &&
    (msg.includes('column') || msg.includes('does not exist'))
  )
}

export function makeOrderId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
