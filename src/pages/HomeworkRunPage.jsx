import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import HomeworkItem from '../components/HomeworkItem.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import RateSelector from '../components/RateSelector.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useData } from '../context/DataContext.jsx'
import { useStudyTimer, useTracker } from '../context/StudyTracker.jsx'
import { HOMEWORK_TYPES, buildHomework, runStorageKey, summarize } from '../lib/homework.js'
import { aggregateMistakes } from '../lib/mistakes.js'
import { randomCheer } from '../lib/labels.js'
import { prepareSpeech } from '../lib/tts.js'

const TITLES = {
  daily: 'Bài tập hôm nay',
  extra: 'Bài tập thêm',
  mistakes: 'Ôn sổ lỗi',
}

function readRun(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    return saved?.items?.length ? saved : null
  } catch {
    return null
  }
}

function writeRun(key, run) {
  try {
    if (run) localStorage.setItem(key, JSON.stringify(run))
    else localStorage.removeItem(key)
  } catch {
    // bỏ qua nếu trình duyệt chặn localStorage
  }
}

export default function HomeworkRunPage() {
  const [params] = useSearchParams()
  const mode = params.get('mode') ?? 'daily'
  const type = params.get('type') ?? undefined
  const round = Number(params.get('round') ?? 0)
  const { user } = useAuth()
  const { today, cards, history, homeworkProgress, settings, recordHomework, saveHomeworkSession } = useData()
  const tracker = useTracker()
  useStudyTimer('free')

  const storageKey = runStorageKey(user.id, today, mode, type, round)
  const [run, setRun] = useState(() => {
    const saved = readRun(storageKey)
    // Làm tiếp từ câu chưa trả lời
    if (saved) return { ...saved, index: Math.min(saved.results.length, saved.items.length) }
    const items = buildHomework({
      cards,
      progress: homeworkProgress,
      mistakes: aggregateMistakes(history, { minCount: 1, limit: 20 }),
      today,
      seed: `${today}:${mode}:${type ?? ''}:${round}`,
      mode: mode === 'extra' ? 'daily' : mode,
      type,
    })
    return { items, index: 0, results: [], startedAt: Date.now(), practice: false }
  })
  const [finished, setFinished] = useState(null) // { summary, wrongItems }
  const [rate, setRate] = useState(settings.tts_rate ?? 1)
  const [cheer] = useState(randomCheer)

  // Lưu bài đang làm để tải lại trang vẫn làm tiếp được (không lưu lượt làm lại ngay)
  useEffect(() => {
    if (!run.practice && !finished) writeRun(storageKey, run)
  }, [run, finished, storageKey])

  // Chuẩn bị sẵn giọng đọc cho cả bài
  useEffect(() => {
    const uk = run.items.filter((i) => i.audio?.accent === 'uk').map((i) => i.audio.text)
    const rest = run.items.flatMap((i) => (i.audio?.accent === 'uk' ? [] : [i.audio?.text].filter(Boolean)))
    prepareSpeech(uk, 'uk')
    prepareSpeech(rest)
  }, [run.items])

  const title = mode === 'type' ? HOMEWORK_TYPES[type]?.label ?? 'Bài tập' : TITLES[mode] ?? 'Bài tập'
  const item = run.items[run.index]
  const answered = run.results.length > run.index

  const onAnswered = (result) => {
    if (run.results.length > run.index) return
    if (!run.practice) recordHomework(item, result)
    tracker.addActivity('homework')
    setRun((r) => ({ ...r, results: [...r.results, { key: item.key, type: item.type, result }] }))
  }

  const finish = (r) => {
    const summary = summarize(r.results)
    const wrongItems = r.items.filter((_, i) => r.results[i]?.result !== 'correct')
    if (!r.practice) {
      saveHomeworkSession({
        study_date: today,
        mode,
        type: type ?? null,
        total: summary.total,
        correct_count: summary.correct,
        close_count: summary.close,
        wrong_count: summary.wrong,
        duration_seconds: Math.min(3600, Math.round((Date.now() - r.startedAt) / 1000)),
        items: r.results,
      })
      writeRun(storageKey, null)
    }
    setFinished({ summary, wrongItems, practice: r.practice })
  }

  const onNext = () => {
    if (!answered) return
    if (run.index + 1 >= run.items.length) finish(run)
    else setRun((r) => ({ ...r, index: r.index + 1 }))
    window.scrollTo(0, 0)
  }

  const percent = useMemo(() => {
    if (!finished) return 0
    const { total, correct, close } = finished.summary
    return total ? Math.round(((correct + close * 0.5) / total) * 100) : 0
  }, [finished])

  if (run.items.length === 0) {
    return (
      <div className="page">
        <PageHeader title={title} back="/homework/practice" />
        <div className="notice">
          {mode === 'mistakes'
            ? 'Sổ lỗi đang trống, không có câu nào cần ôn lại. Tuyệt vời! 🎉'
            : 'Chưa có đủ từ đã học để làm dạng bài này. Bạn học thêm vài thẻ từ vựng rồi quay lại nhé.'}
        </div>
        <Link to="/homework/practice" className="btn btn-secondary btn-block">
          Về Luyện tập tự động
        </Link>
      </div>
    )
  }

  if (finished) {
    const { summary, wrongItems, practice } = finished
    return (
      <div className="page">
        <PageHeader title={title} back="/homework/practice" />
        <div className="summary">
          <div className="summary-hero">
            <span className="summary-icon" aria-hidden="true">
              <Icon name="star" size={34} />
            </span>
            <h2>{practice ? 'Xong lượt làm lại!' : 'Xong bài rồi! 🎉'}</h2>
            <p className="muted">
              Đúng {summary.correct}/{summary.total} câu
              {summary.close ? `, gần đúng ${summary.close} câu` : ''} ({percent}%). {cheer}
            </p>
          </div>

          {wrongItems.length > 0 && (
            <section className="card stack">
              <h2 className="section-title">Câu cần để ý</h2>
              <ul className="hw-review">
                {wrongItems.map((it) => (
                  <li key={it.key}>
                    <span className="muted">{HOMEWORK_TYPES[it.type]?.label}</span>
                    <strong lang="en">{it.answer}</strong>
                  </li>
                ))}
              </ul>
              {!practice && <p className="hint">Những câu này sẽ quay lại trong bài ngày mai để bạn nhớ chắc hơn.</p>}
            </section>
          )}

          <div className="stack">
            {wrongItems.length > 0 && (
              <button
                type="button"
                className="btn btn-primary btn-block btn-lg"
                onClick={() => {
                  setFinished(null)
                  setRun({ items: wrongItems, index: 0, results: [], startedAt: Date.now(), practice: true })
                }}
              >
                Thử lại ngay {wrongItems.length} câu này
              </button>
            )}
            <Link to="/homework/practice" className={`btn btn-block ${wrongItems.length ? 'btn-secondary' : 'btn-primary btn-lg'}`}>
              Về Luyện tập tự động
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Đã trả lời hết nhưng chưa bấm xem kết quả (vd tải lại trang ở câu cuối)
  if (!item) {
    return (
      <div className="page">
        <PageHeader title={title} back="/homework/practice" />
        <div className="notice">Bạn đã làm xong tất cả các câu rồi.</div>
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={() => finish(run)}>
          Xem kết quả
        </button>
      </div>
    )
  }

  const last = run.index + 1 >= run.items.length
  return (
    <div className="page">
      <PageHeader title={title} back="/homework/practice" subtitle={run.practice ? 'Làm lại ngay, không tính điểm' : undefined} />
      <ProgressBar value={run.index} max={run.items.length} label={`${run.index + 1}/${run.items.length}`} />
      <RateSelector value={rate} onChange={setRate} />
      <HomeworkItem
        key={`${run.practice ? 'p' : 'r'}-${run.index}-${item.key}`}
        item={item}
        rate={rate}
        onAnswered={onAnswered}
        onNext={onNext}
        nextLabel={last ? 'Xem kết quả' : 'Câu tiếp theo'}
      />
      <Link to="/homework/practice" className="btn btn-ghost btn-block finish-early">
        {run.practice ? 'Dừng ở đây' : 'Dừng ở đây, lát làm tiếp'}
      </Link>
    </div>
  )
}
