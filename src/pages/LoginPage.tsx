import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineMessage } from '@/components/ui/StatusBlock'
import { useAuth } from '@/contexts/AuthContext'

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

      <Card className="relative w-full max-w-[22rem] border-border/60 bg-card/90 backdrop-blur-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
            <span className="text-gradient-gold text-2xl font-black">R</span>
          </div>
          <CardTitle className="text-gradient-gold text-2xl font-extrabold tracking-[0.12em]">
            R.A.G.E
          </CardTitle>
          <CardDescription>Order System</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="contoh: leo / evan"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-14"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-1/2 right-1 h-7 -translate-y-1/2 text-xs"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>

            {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

            <Button type="submit" disabled={submitting} className="mt-1 w-full">
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
