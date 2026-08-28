import { useEffect } from 'react'

const BACKGROUND_VOLUME = 0.1
const BG_AUDIO_SRC = '/lagu-rage.mp3'

let bgAudio: HTMLAudioElement | null = null
let bgAudioStarted = false

function getBackgroundAudio() {
  if (!bgAudio) {
    bgAudio = new Audio(BG_AUDIO_SRC)
    bgAudio.preload = 'auto'
  }
  bgAudio.loop = true
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
    audio.loop = true

    const tryPlay = () => {
      void audio.play().then(() => {
        bgAudioStarted = true
      }).catch(() => {})
    }

    const resumeIfNeeded = () => {
      if (!bgAudioStarted || !audio.paused) return
      void audio.play().catch(() => {})
    }

    const onEnded = () => {
      if (!bgAudioStarted) return
      audio.currentTime = 0
      void audio.play().catch(() => {})
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') resumeIfNeeded()
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resumeIfNeeded()
    }

    tryPlay()

    audio.addEventListener('ended', onEnded)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)

    const unlock = () => resumeIfNeeded()
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })

    return () => {
      audio.removeEventListener('ended', onEnded)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
      audio.pause()
    }
  }, [])

  return null
}
