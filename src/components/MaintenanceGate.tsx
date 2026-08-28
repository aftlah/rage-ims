import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus, Volume2, VolumeX } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/StatusBlock'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'

const DEFAULT_DETAIL = 'Sebentar yaa kawan — kami lagi perbaiki sistem supaya lebih enak dipakai.'
const DEFAULT_VOLUME = 0.25
const VOLUME_STEP = 0.1
const VOLUME_MIN = 0.1
const VOLUME_MAX = 1

function parseMaintenanceMessage(raw: string) {
  const message = raw.trim()
  if (!message) {
    return { label: 'Sedang maintenance', detail: DEFAULT_DETAIL }
  }

  const colonIdx = message.indexOf(':')
  if (colonIdx > 0 && colonIdx < 48) {
    const label = message.slice(0, colonIdx).trim()
    const detail = message.slice(colonIdx + 1).trim()
    return {
      label: label || 'Sedang maintenance',
      detail: detail || DEFAULT_DETAIL,
    }
  }

  return { label: 'Sedang maintenance', detail: message }
}

function MaintenanceScreen({ message }: { message: string }) {
  const { label, detail } = parseMaintenanceMessage(message)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [soundOn, setSoundOn] = useState(false)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [soundError, setSoundError] = useState<string | null>(null)

  const applyVolume = useCallback((next: number) => {
    const clamped = Math.min(VOLUME_MAX, Math.max(VOLUME_MIN, next))
    setVolume(clamped)
    const video = videoRef.current
    if (video) video.volume = clamped
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.defaultMuted = true
    video.volume = DEFAULT_VOLUME
    void video.play().catch(() => {})
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !soundOn) return
    video.volume = volume
  }, [soundOn, volume])

  const unlockSound = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      setSoundError('Video tidak tersedia.')
      return
    }

    setSoundError(null)
    video.muted = false
    video.volume = volume
    video.defaultMuted = false

    const videoPlay = video.play()
    if (videoPlay) {
      videoPlay
        .then(() => setSoundOn(true))
        .catch(() => {
          setSoundOn(false)
          setSoundError(
            'Gagal nyalain suara — coba klik lagi atau cek volume device.',
          )
        })
    } else {
      setSoundOn(true)
    }
  }, [volume])

  const muteSound = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.defaultMuted = true
    setSoundOn(false)
    setSoundError(null)
  }, [])

  const toggleSound = useCallback(() => {
    if (soundOn) {
      muteSound()
      return
    }
    unlockSound()
  }, [muteSound, soundOn, unlockSound])

  const volumePercent = Math.round(volume * 100)

  return (
    <div className="maintenance-screen">
      <video
        ref={videoRef}
        className="maintenance-video-bg"
        src="/video-joget.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label="Video joget maintenance R.A.G.E"
      />

      <div className="maintenance-scrim" aria-hidden />

      <div className="maintenance-content">
        <header className="maintenance-header">
          <img
            src="/logo_rage.png"
            alt="R.A.G.E"
            className="maintenance-logo"
          />

          <div className="maintenance-badge">
            <span className="maintenance-badge-dot" aria-hidden />
            Maintenance aktif
          </div>

          <h1 className="maintenance-title">{label}</h1>
        </header>

        <footer className="maintenance-footer">
          <div className="maintenance-sound-panel">
            <Button
              type="button"
              size="icon-sm"
              variant={soundOn ? 'secondary' : 'default'}
              className="maintenance-sound-panel-toggle"
              aria-label={soundOn ? 'Matikan suara' : 'Nyalakan suara'}
              onPointerDown={(e) => {
                e.preventDefault()
                toggleSound()
              }}
            >
              {soundOn ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </Button>

            <div className="maintenance-sound-volume">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="maintenance-sound-panel-btn"
                disabled={volume <= VOLUME_MIN}
                aria-label="Kecilkan suara"
                onPointerDown={(e) => {
                  e.preventDefault()
                  applyVolume(volume - VOLUME_STEP)
                }}
              >
                <Minus className="size-4" />
              </Button>

              <span className="maintenance-sound-level" aria-live="polite">
                {volumePercent}%
              </span>

              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="maintenance-sound-panel-btn"
                disabled={volume >= VOLUME_MAX}
                aria-label="Besarkan suara"
                onPointerDown={(e) => {
                  e.preventDefault()
                  applyVolume(volume + VOLUME_STEP)
                }}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          {!soundOn ? (
            <p className="maintenance-sound-hint">Tap speaker untuk nyalain suara</p>
          ) : null}

          {soundError ? (
            <p className="maintenance-error">{soundError}</p>
          ) : null}

          <p className="maintenance-detail">{detail}</p>

          <p className="maintenance-note">
            Sistem sementara tidak bisa diakses untuk member.
          </p>
          <p className="maintenance-note">
            Butuh akses darurat? Hubungi admin R.A.G.E lewat Discord.
          </p>
        </footer>
      </div>
    </div>
  )
}

/**
 * Blocks non-admin pages while maintenance is on.
 * Admins keep full access (including Settings to turn it off).
 */
export function MaintenanceGate() {
  const { isAdmin, loading: authLoading } = useAuth()
  const { maintenanceMode, maintenanceMessage, loading: settingsLoading } =
    useSettings()
  const location = useLocation()

  if (authLoading || settingsLoading) {
    return (
      <div className="app-shell flex min-h-dvh items-center justify-center">
        <LoadingState message="Memuat…" />
      </div>
    )
  }

  const onSettings = location.pathname.startsWith('/admin/settings')
  const blocked = maintenanceMode && !isAdmin && !onSettings

  if (blocked) {
    return (
      <MaintenanceScreen
        message={
          maintenanceMessage || 'Sedang maintenance: Sebentar yaa kawan'
        }
      />
    )
  }

  return <Outlet />
}
