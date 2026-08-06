/** YYYY-MM-DD in Asia/Jakarta — mirror todayDateKeyJakarta */
export function todayDateKeyJakarta(d: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d)
    const y = parts.find((p) => p.type === 'year')?.value || '1970'
    const m = parts.find((p) => p.type === 'month')?.value || '01'
    const day = parts.find((p) => p.type === 'day')?.value || '01'
    return `${y}-${m}-${day}`
  } catch {
    const x = new Date(d)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
  }
}

export function addDaysToDateKey(dateKey: string, delta: number): string {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return todayDateKeyJakarta(d)
}

export function fmtTimeOnly(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return '—'
  }
}

export function fmtAbsenDateTime(
  iso: string | null | undefined,
  opts: { hideToday?: boolean } = {},
): string {
  if (!iso) return '—'
  const dateKey = todayDateKeyJakarta(new Date(iso))
  const time = fmtTimeOnly(iso)
  const hideToday = opts.hideToday !== false
  if (hideToday && dateKey === todayDateKeyJakarta()) return time
  const [, m, day] = dateKey.split('-')
  return `${day}/${m} ${time}`
}

export function fmtAbsenTableTime(
  iso: string | null | undefined,
  rowTanggal: string | null | undefined,
): string {
  if (!iso) return '—'
  const ref = rowTanggal ? String(rowTanggal).slice(0, 10) : ''
  const dateKey = todayDateKeyJakarta(new Date(iso))
  const time = fmtTimeOnly(iso)
  if (ref && dateKey !== ref) {
    const [, m, day] = dateKey.split('-')
    return `${day}/${m} ${time}`
  }
  return time
}

export function fmtAbsenDuration(
  masuk: string | null | undefined,
  keluar: string | null | undefined,
): string {
  if (!masuk || !keluar) return '—'
  const ms = new Date(keluar).getTime() - new Date(masuk).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}j ${m}m`
  return `${m} menit`
}

export function fmtLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('id-ID')
  } catch {
    return '—'
  }
}
