import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Eye,
  EyeOff,
  Lock,
  Package,
  ShieldCheck,
  TrendingUp,
  User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

const features = [
  { label: 'Order', desc: 'Period management', icon: ClipboardList },
  { label: 'Rekap', desc: 'Operations summary', icon: BarChart3 },
  { label: 'Storan', desc: 'Balance tracking', icon: Package },
  { label: 'Profit', desc: 'Financial reports', icon: TrendingUp },
] as const

export function LoginPage() {
  const { signIn } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const result = await signIn(username, password)
      if (result.error) {
        toast.error(result.error)
        return
      }
      navigate('/home', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-modern app-shell relative min-h-dvh overflow-hidden">
      <div className="login-mesh" aria-hidden />
      <div className="login-mesh login-mesh--secondary" aria-hidden />
      <div className="login-grid-overlay" aria-hidden />
      <div className="login-noise" aria-hidden />
      <div className="login-vignette login-vignette--page" aria-hidden />

      <div className="login-orbs" aria-hidden>
        <span className="login-orb login-orb--gold" />
        <span className="login-orb login-orb--ember" />
        <span className="login-orb login-orb--copper" />
      </div>

      <div className="login-modern-layout">
        <section className="login-modern-brand">
          <div className="login-brand-inner">
            <div className="login-logo-wrap">
              <span className="login-logo-ring login-logo-ring--outer" aria-hidden />
              <span className="login-logo-ring" aria-hidden />
              <span className="login-logo-glow" aria-hidden />
              <img
                src="/logo_rage.png"
                alt=""
                className="login-brand-logo"
              />
            </div>

            <p className="login-brand-kicker">
              <ShieldCheck className="size-3.5" strokeWidth={2} />
              Internal platform
            </p>

            <h1 className="login-brand-headline">
              <span className="text-gradient-gold">R.A.G.E</span>
              <span>Management System</span>
            </h1>

            <p className="login-brand-copy">
              A centralized platform for operations, summaries, deposits,
              catalog, and member financial reporting.
            </p>

            <div className="login-bento">
              {features.map((item, i) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.label}
                    className="login-bento-item"
                    style={{ animationDelay: `${0.15 + i * 0.08}s` }}
                  >
                    <span className="login-bento-icon">
                      <Icon className="size-4" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="login-bento-label">{item.label}</p>
                      <p className="login-bento-desc">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="login-brand-stats">
              <span>Integrated modules</span>
              <span className="login-brand-stats__dot" aria-hidden />
              <span>Data sync</span>
              <span className="login-brand-stats__dot" aria-hidden />
              <span>Member access</span>
            </div>
          </div>
        </section>

        <section className="login-modern-panel">
          <div className="login-mobile-hero lg:hidden">
            <div className="login-logo-wrap login-logo-wrap--sm">
              <span className="login-logo-ring login-logo-ring--outer" aria-hidden />
              <span className="login-logo-ring" aria-hidden />
              <span className="login-logo-glow" aria-hidden />
              <img src="/logo_rage.png" alt="" />
            </div>
            <h1 className="login-mobile-title">
              <span className="text-gradient-gold">R.A.G.E</span>
              <span className="login-mobile-title__sub">Management System</span>
            </h1>
          </div>

          <div className="login-glass-card">
            <div className="login-glass-card__border" aria-hidden />
            <div className="login-glass-card__glow" aria-hidden />
            <div className="login-glass-card__shine" aria-hidden />

            <div className="login-panel-header">
              <span className="login-secure-badge">
                <ShieldCheck className="size-3.5" strokeWidth={2} />
                Encrypted access
              </span>
              <h2 className="login-panel-title">Welcome</h2>
              <p className="login-panel-subtitle">
                Sign in with your member username and password
              </p>
            </div>

            <div className="login-panel-divider" aria-hidden>
              <span />
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field-modern login-stagger-1">
                <label htmlFor="username" className="login-label-modern">
                  Username
                </label>
                <div className="login-input-group">
                  <User className="login-input-group__icon" strokeWidth={1.75} />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="login-input-modern"
                  />
                </div>
              </div>

              <div className="login-field-modern login-stagger-2">
                <label htmlFor="password" className="login-label-modern">
                  Password
                </label>
                <div className="login-input-group">
                  <Lock className="login-input-group__icon" strokeWidth={1.75} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="login-input-modern login-input-modern--password"
                  />
                  <button
                    type="button"
                    className="login-input-group__action"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" strokeWidth={1.75} />
                    ) : (
                      <Eye className="size-4" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="login-btn-modern login-stagger-3"
              >
                <span className="login-btn-modern__shine" aria-hidden />
                <span>{submitting ? 'Signing in…' : 'Sign in'}</span>
                {!submitting ? (
                  <ArrowRight className="size-4 shrink-0" strokeWidth={2} />
                ) : null}
              </button>
            </form>

            <p className="login-panel-footer">
              Registered members only · R.A.G.E
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
