export function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n)
}

export function fmtIdMoney(n: number | string | null | undefined): string {
  const v = typeof n === 'number' ? n : parseFloat(String(n || '0'))
  const safe = Number.isFinite(v) ? v : 0
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(
    safe,
  )
}

/** Mirror parseMoneyInput — strips thousand separators */
export function parseMoneyInput(raw: string): number {
  const s = String(raw || '')
    .trim()
    .replace(/\s/g, '')
  if (!s) return NaN
  const cleaned = s.replace(/\./g, '').replace(/,/g, '')
  const v = parseFloat(cleaned)
  return Number.isFinite(v) ? v : NaN
}

export function formatWindowDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true,
  })
}
