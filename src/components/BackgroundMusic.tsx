import { useEffect, useRef } from 'react'

const BACKGROUND_VOLUME = 0.15

/**
 * Plays R.A.G.E theme on normal app pages.
 * DashboardLayout only mounts when maintenance gate allows access.
 */
export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.volume = BACKGROUND_VOLUME
    audio.loop = true

    const tryPlay = () => {
      void audio.play().catch(() => {})
    }

    tryPlay()

    const unlock = () => {
      if (audio.paused) tryPlay()
    }

    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })

    return () => {
      audio.pause()
      audio.currentTime = 0
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  return (
    <audio
      ref={audioRef}
      src="/lagu-rage.mp3"
      loop
      preload="auto"
      aria-hidden
    />
  )
}
