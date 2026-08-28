import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type ToastTone = 'success' | 'error' | 'info'

type Props = {
  message: string | null
  tone?: ToastTone
  duration?: number
  onDismiss?: () => void
}

const toneStyles: Record<ToastTone, string> = {
  success: 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200',
  error: 'border-red-500/30 bg-red-950/90 text-red-200',
  info: 'border-primary/30 bg-card/95 text-foreground',
}

export function ToastNotice({
  message,
  tone = 'success',
  duration,
  onDismiss,
}: Props) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const autoDuration =
    duration ?? (tone === 'info' ? 0 : tone === 'error' ? 5000 : 3000)

  useEffect(() => {
    if (!message) {
      setVisible(false)
      setLeaving(false)
      return
    }

    setLeaving(false)
    setVisible(true)

    if (autoDuration <= 0) return

    const hideTimer = window.setTimeout(() => setLeaving(true), autoDuration)
    const removeTimer = window.setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, autoDuration + 280)

    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(removeTimer)
    }
  }, [message, autoDuration, onDismiss])

  if (!message || !visible) return null

  return createPortal(
    <div className="toast-stack" role="status" aria-live="polite">
      <div
        className={cn(
          'toast-notice border shadow-lg backdrop-blur-md',
          toneStyles[tone],
          leaving ? 'toast-leaving' : 'toast-enter',
        )}
      >
        {message}
      </div>
    </div>,
    document.body,
  )
}
