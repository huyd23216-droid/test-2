import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { ACCENTS, accentFor, canSpeak, getDefaultAccent, prepareSpeech, speak, stopSpeaking } from '../lib/tts.js'

// Nút đọc câu tiếng Anh. variant: "icon" (tròn nhỏ) | "big" (nút to cho bài nghe)
// prefetch: chuẩn bị trước giọng Google cho câu này để bấm là phát ngay
export default function SpeakButton({
  text,
  rate = 1,
  label = 'Nghe',
  variant = 'default',
  onPlay,
  prefetch = false,
  className = '',
}) {
  const [speaking, setSpeaking] = useState(false)
  const speakingRef = useRef(false)

  useEffect(() => {
    if (prefetch) prepareSpeech(text)
  }, [prefetch, text])

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
    speak(text, { rate, onEnd: () => setBoth(false) })
  }

  const classes = ['speak', `speak-${variant}`, speaking ? 'is-speaking' : '', className].join(' ')
  return (
    <button type="button" className={classes} onClick={handleClick} aria-label={`${label}: ${text}`}>
      <Icon name="speaker" size={variant === 'big' ? 30 : 20} />
      {variant !== 'icon' && <span>{speaking ? 'Đang đọc…' : label}</span>}
      {variant === 'big' && getDefaultAccent() === 'mixed' && (
        <small className="speak-accent">{ACCENTS[accentFor(text)].label}</small>
      )}
    </button>
  )
}
