import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { InlineMessage } from '@/components/ui/StatusBlock'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await signIn(username, password)
      if (result.error) {
        setError(result.error)
        return
      }
      navigate('/rekap', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-shell relative flex min-h-dvh items-center justify-center px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="login-orbs" aria-hidden />

      <Card className="relative w-full max-w-[26rem] border-border/60 bg-card/90 backdrop-blur-xl">
        <CardHeader className="justify-items-center gap-3 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center justify-self-center sm:h-32 sm:w-32">
            <img
              src="/logo_rage.png"
              alt="R.A.G.E"
              className="mx-auto block h-full w-full object-contain object-center"
            />
          </div>
          <div className="w-full justify-self-center space-y-1 text-center">
            <CardTitle className="text-gradient-gold text-2xl font-extrabold tracking-tight sm:text-3xl">
              Masuk ke R.A.G.E
            </CardTitle>
            <CardDescription>Order System — Para anggota bersatu</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="group flex flex-col gap-2.5">
              <label
                htmlFor="username"
                className="flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase group-focus-within:text-primary"
              >
                <User className="size-3.5 text-primary/70" />
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="contoh: leo / evan"
                className="login-input-lite"
              />
            </div>

            <div className="group flex flex-col gap-2.5">
              <label
                htmlFor="password"
                className="flex items-center gap-1.5 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase group-focus-within:text-primary"
              >
                <Lock className="size-3.5 text-primary/70" />
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-input-lite pr-12"
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? 'Sembunyikan password' : 'Tampilkan password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
            </div>

            {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

            <Button
              type="submit"
              disabled={submitting}
              className={cn(
                'mt-1 h-12 w-full rounded-xl text-sm font-black tracking-[0.16em] uppercase',
              )}
            >
              {submitting ? 'Masuk…' : 'Masuk'}
            </Button>
          </form>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            Internal use only · R.A.G.E
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
