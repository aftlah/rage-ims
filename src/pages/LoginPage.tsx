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
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

const featureKeys = [
  { key: 'order', icon: ClipboardList },
  { key: 'rekap', icon: BarChart3 },
  { key: 'storan', icon: Package },
  { key: 'profit', icon: TrendingUp },
] as const

export function LoginPage() {
  const { t } = useTranslation()
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
              {t('login.kicker')}
            </p>

            <h1 className="login-brand-headline">
              <span className="text-gradient-gold">R.A.G.E</span>
              <span>{t('login.headlineSub')}</span>
            </h1>

            <p className="login-brand-copy">{t('login.copy')}</p>

            <div className="login-bento">
              {featureKeys.map((item, i) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.key}
                    className="login-bento-item"
                    style={{ animationDelay: `${0.15 + i * 0.08}s` }}
                  >
                    <span className="login-bento-icon">
                      <Icon className="size-4" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="login-bento-label">
                        {t(`login.features.${item.key}.label`)}
                      </p>
                      <p className="login-bento-desc">
                        {t(`login.features.${item.key}.desc`)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="login-brand-stats">
              <span>{t('login.stats.modules')}</span>
              <span className="login-brand-stats__dot" aria-hidden />
              <span>{t('login.stats.sync')}</span>
              <span className="login-brand-stats__dot" aria-hidden />
              <span>{t('login.stats.access')}</span>
            </div>
          </div>
        </section>

        <section className="login-modern-panel">
          <div className="login-mobile-shell">
            <div className="login-auth-card login-glass-card login-glass-card--clean">
              <div className="login-auth-mobile-top">
                <div className="login-auth-mobile-brand">
                  <div className="login-auth-mobile-brand__logo">
                    <span className="login-logo-ring" aria-hidden />
                    <span className="login-logo-glow" aria-hidden />
                    <img src="/logo_rage.png" alt="" />
                  </div>
                  <div className="login-auth-mobile-brand__text">
                    <p className="login-auth-mobile-brand__title text-gradient-gold">
                      R.A.G.E
                    </p>
                    <p className="login-auth-mobile-brand__sub">
                      {t('login.headlineSub')}
                    </p>
                  </div>
                </div>
                <div className="login-auth-mobile-lang">
                  <LanguageSwitcher compact className="login-lang-mobile" />
                </div>
              </div>

              <div className="login-panel-top login-auth-desktop-head">
                <div className="login-panel-header">
                  <h2 className="login-panel-title">{t('login.welcome')}</h2>
                  <p className="login-panel-subtitle">{t('login.subtitle')}</p>
                </div>
                <div className="login-panel-lang">
                  <LanguageSwitcher compact />
                </div>
              </div>

              <div className="login-auth-intro">
                <h2 className="login-auth-intro__title">{t('login.welcome')}</h2>
                <p className="login-auth-intro__sub">{t('login.subtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                <div className="login-field-modern login-stagger-1">
                  <label htmlFor="username" className="login-label-modern">
                    {t('login.username')}
                  </label>
                  <div className="login-input-group">
                    <User
                      className="login-input-group__icon"
                      strokeWidth={1.75}
                    />
                    <input
                      id="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('login.usernamePlaceholder')}
                      className="login-input-modern"
                    />
                  </div>
                </div>

                <div className="login-field-modern login-stagger-2">
                  <label htmlFor="password" className="login-label-modern">
                    {t('login.password')}
                  </label>
                  <div className="login-input-group">
                    <Lock
                      className="login-input-group__icon"
                      strokeWidth={1.75}
                    />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('login.passwordPlaceholder')}
                      className="login-input-modern login-input-modern--password"
                    />
                    <button
                      type="button"
                      className="login-input-group__action"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword
                          ? t('login.hidePassword')
                          : t('login.showPassword')
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
                  <span>
                    {submitting ? t('login.signingIn') : t('login.signIn')}
                  </span>
                  {!submitting ? (
                    <ArrowRight className="size-4 shrink-0" strokeWidth={2} />
                  ) : null}
                </button>
              </form>

              <p className="login-panel-footer">
                <ShieldCheck className="size-3.5" strokeWidth={2} aria-hidden />
                {t('login.footer')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
