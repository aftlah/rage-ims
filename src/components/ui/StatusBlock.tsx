type Props = {
  title?: string
  message?: string
}

export function LoadingState({ message = 'Memuat…' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full border-2 border-rage-gold/15" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-rage-gold" />
      </div>
      <p className="text-sm font-medium text-rage-muted">{message}</p>
    </div>
  )
}

export function EmptyState({ title = 'Belum ada data', message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rage-gold/5 text-xl ring-1 ring-rage-gold/10">
        ∅
      </div>
      <p className="text-sm font-semibold text-rage-muted">{title}</p>
      {message ? (
        <p className="max-w-sm text-xs leading-relaxed text-rage-dim">{message}</p>
      ) : null}
    </div>
  )
}

export function ErrorState({ title = 'Gagal memuat', message }: Props) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-900/5 px-4 py-3.5">
      <p className="text-sm font-semibold text-red-300">{title}</p>
      {message ? (
        <p className="mt-1 text-xs leading-relaxed text-red-200/75">{message}</p>
      ) : null}
    </div>
  )
}

export function InlineMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: string
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-sm ${
        tone === 'error'
          ? 'border-red-500/20 bg-red-500/10 text-red-300'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
      }`}
    >
      {children}
    </div>
  )
}
