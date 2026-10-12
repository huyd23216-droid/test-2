import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { ACCENTS, accentFor, canSpeak, getDefaultAccent, prepareSpeech, speak, stopSpeaking } from '../lib/tts.js'

// Nút đọc câu tiếng Anh. variant: "icon" (tròn nhỏ) | "big" (nút to cho bài nghe)
// prefetch: chuẩn bị trước giọng Google cho câu này để bấm là phát ngay
// accent: 'us' | 'uk' để cố định giọng cho câu này (mặc định theo Cài đặt)
// autoPlay: tự đọc một lần khi nút hiện ra (bài nghe)
export default function SpeakButton({
  text,
  rate = 1,
  label = 'Nghe',
  variant = 'default',
  onPlay,
  prefetch = false,
  accent,
  autoPlay = false,
  className = '',
}) {
  const [speaking, setSpeaking] = useState(false)
  const speakingRef = useRef(false)

  useEffect(() => {
    if (prefetch) prepareSpeech(text, accent)
  }, [prefetch, text, accent])

  useEffect(() => {
    if (!autoPlay || !text) return
    const t = setTimeout(() => {
      speakingRef.current = true
      setSpeaking(true)
      speak(text, {
        rate,
        accent,
        onEnd: () => {
          speakingRef.current = false
          setSpeaking(false)
        },
      })
    }, 300)
    return () => clearTimeout(t)
  }, [autoPlay, text, rate, accent])

  // Rời màn hình thì dừng câu mà chính nút này đang đọc
  useEffect(
    () => () => {
      if (speakingRef.current) stopSpeaking()
    },
    [],
  )

  const setBoth = (v) => {
    speakingRef.current = v
    setSpeaking(v)
  }

  if (!canSpeak()) {
    return variant === 'big' ? (
      <p className="hint">Trình duyệt này chưa hỗ trợ đọc tiếng Anh. Bạn thử Safari hoặc Chrome nhé.</p>
    ) : null
  }

  const handleClick = (e) => {
    e.stopPropagation()
    if (speaking) {
      stopSpeaking()
      setBoth(false)
      return
    }
    onPlay?.()
    setBoth(true)
    speak(text, { rate, accent, onEnd: () => setBoth(false) })
  }

  const classes = ['speak', `speak-${variant}`, speaking ? 'is-speaking' : '', className].join(' ')
  return (
    <button type="button" className={classes} onClick={handleClick} aria-label={`${label}: ${text}`}>
      <Icon name="speaker" size={variant === 'big' ? 30 : 20} />
      {variant !== 'icon' && <span>{speaking ? 'Đang đọc…' : label}</span>}
      {variant === 'big' && (accent || getDefaultAccent() === 'mixed') && (
        <small className="speak-accent">{ACCENTS[accentFor(text, accent)].label}</small>
      )}
    </button>
  )
}
