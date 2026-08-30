import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ToastNotice, type ToastTone } from '@/components/ui/toast'

type ToastState = {
  message: string
  tone: ToastTone
} | null

type ToastApi = {
  show: (message: string, tone?: ToastTone) => void
  success: (message: string) => void
  error: (message: string | null | undefined) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null)

  const api = useMemo<ToastApi>(
    () => ({
      show: (message, tone = 'success') => setToast({ message, tone }),
      success: (message) => setToast({ message, tone: 'success' }),
      error: (message) => {
        if (!message) return
        setToast({ message, tone: 'error' })
      },
      info: (message) => setToast({ message, tone: 'info' }),
    }),
    [],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastNotice
        message={toast?.message ?? null}
        tone={toast?.tone}
        onDismiss={() => setToast(null)}
      />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}
