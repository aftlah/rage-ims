import { useEffect, useState } from 'react'

export function useCountdown(targetIso: string | null | undefined): number | null {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    if (!targetIso) {
      setRemainingMs(null)
      return
    }

    const target = new Date(targetIso).getTime()
    if (Number.isNaN(target)) {
      setRemainingMs(null)
      return
    }

    const tick = () => {
      setRemainingMs(Math.max(0, target - Date.now()))
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [targetIso])

  return remainingMs
}

export function formatCountdown(ms: number | null): string | null {
  if (ms == null) return null
  if (ms <= 0) return '0j 0m 0d'

  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  if (h > 0) return `${h}j ${m}m ${s}d`
  if (m > 0) return `${m}m ${s}d`
  return `${s}d`
}
