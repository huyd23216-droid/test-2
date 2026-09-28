import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DictationExercise from '../components/DictationExercise.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer } from '../context/StudyTracker.jsx'
import { formatSeconds } from '../lib/dates.js'
import { youtubeWatchUrl } from '../lib/youtube.js'

export default function ClipPracticePage() {
  const { id } = useParams()
  const { clips, history } = useData()
  useStudyTimer('free')
  const [round, setRound] = useState(0)
  const clip = clips.find((c) => c.id === id)

  if (!clip) {
    return (
      <div className="page">
        <PageHeader title="Không tìm thấy clip" back="/dictation" />
      </div>
    )
  }

  const url = youtubeWatchUrl(clip.youtube_url, clip.start_seconds)
  const range = `${formatSeconds(clip.start_seconds)}${clip.end_seconds != null ? ` – ${formatSeconds(clip.end_seconds)}` : ''}`
  const attempts = history.filter((h) => h.clip_id === clip.id)
  const best = attempts.length ? Math.round(Math.max(...attempts.map((h) => h.score)) * 100) : null

  const player = (
    <div className="clip-player">
      {url ? (
        <a className="btn btn-primary btn-lg btn-block" href={url} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={20} /> Mở video tại {formatSeconds(clip.start_seconds)}
        </a>
      ) : (
        <p className="notice notice-warn">Link YouTube của clip này không hợp lệ. Bạn sửa lại link nhé.</p>
      )}
      <p className="hint">
        Nghe đoạn {range} (xem lại bao nhiêu lần cũng được), rồi quay lại đây gõ câu thoại.
      </p>
    </div>
  )

  return (
    <div className="page">
      <PageHeader
        title={clip.title || 'Clip thật'}
        back="/dictation"
        subtitle={best !== null ? `Đã luyện ${attempts.length} lần · tốt nhất ${best}%` : 'Lần đầu luyện clip này'}
        right={
          <Link to={`/dictation/clips/${clip.id}/edit`} className="icon-btn" aria-label="Sửa clip">
            <Icon name="edit" size={20} />
          </Link>
        }
      />
      <DictationExercise
        key={round}
        text={clip.transcript}
        meaning={clip.meaning_vi}
        clipId={clip.id}
        player={player}
        onDone={() => {
          setRound((r) => r + 1)
          window.scrollTo(0, 0)
        }}
        doneLabel="Luyện lại clip này"
      />
      <Link to="/dictation" className="btn btn-ghost btn-block finish-early">
        Về danh sách clip
      </Link>
    </div>
  )
}
