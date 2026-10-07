import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { getDefaultAccent, prepareSpeech, speak, stopSpeaking } from '../lib/tts.js'

// Chỉ một đoạn được đọc tại một thời điểm
let activeRun = 0

// Đọc lần lượt từng dòng của một đoạn văn. Hội thoại có tên người nói thì mỗi người
// một giọng (Mỹ / Anh xen kẽ) cho dễ phân biệt; tên người nói không được đọc.
export default function PassageSpeaker({ lines, rate = 1, label = 'Nghe cả đoạn' }) {
  const [playing, setPlaying] = useState(false)
  const runRef = useRef(0)

  const base = getDefaultAccent() === 'uk' ? 'uk' : 'us'
  const other = base === 'uk' ? 'us' : 'uk'
  const speakers = [...new Set(lines.map((l) => l.speaker).filter(Boolean))]
  const accentOf = (line) => (line.speaker ? (speakers.indexOf(line.speaker) % 2 === 0 ? base : other) : undefined)

  // Chuẩn bị sẵn giọng Google cho cả đoạn
  const key = lines.map((l) => `${l.speaker}|${l.text}`).join('\n')
  useEffect(() => {
    for (const line of lines) prepareSpeech(line.text, accentOf(line))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Rời màn hình thì dừng đọc
  useEffect(
    () => () => {
      if (runRef.current && activeRun === runRef.current) {
        activeRun++
        stopSpeaking()
      }
    },
    [],
  )

  const toggle = () => {
    if (playing) {
      activeRun++
      stopSpeaking()
      setPlaying(false)
      return
    }
    const run = ++activeRun
    runRef.current = run
    setPlaying(true)
    const step = (i) => {
      if (activeRun !== run) {
        setPlaying(false)
        return
      }
      if (i >= lines.length) {
        setPlaying(false)
        return
      }
      speak(lines[i].text, { rate, accent: accentOf(lines[i]), onEnd: () => setTimeout(() => step(i + 1), 250) })
    }
    step(0)
  }

  if (!lines.length) return null
  return (
    <button type="button" className={`speak speak-default ${playing ? 'is-speaking' : ''}`} onClick={toggle}>
      <Icon name="speaker" size={20} />
      <span>{playing ? 'Dừng đọc' : label}</span>
    </button>
  )
}
