import { useEffect } from 'react'

const BACKGROUND_VOLUME = 0.1
const BG_AUDIO_SRC = '/lagu-rage.mp3'

let bgAudio: HTMLAudioElement | null = null
let bgAudioStarted = false

function getBackgroundAudio() {
  if (!bgAudio) {
    bgAudio = new Audio(BG_AUDIO_SRC)
    bgAudio.loop = true
    bgAudio.preload = 'auto'
  }
  return bgAudio
}

/**
 * Plays R.A.G.E theme on normal app pages.
 * Uses a shared Audio instance so tab switches / remounts don't restart the track.
 */
export function BackgroundMusic() {
  useEffect(() => {
    const audio = getBackgroundAudio()
    audio.volume = BACKGROUND_VOLUME

    const tryPlay = () => {
      void audio.play().then(() => {
        bgAudioStarted = true
      }).catch(() => {})
    }

    const resumeIfNeeded = () => {
      if (!bgAudioStarted || !audio.paused) return
      void audio.play().catch(() => {})
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') resumeIfNeeded()
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resumeIfNeeded()
    }

    tryPlay()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)

    const unlock = () => resumeIfNeeded()
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
      audio.pause()
    }
  }, [])

  return null
}
