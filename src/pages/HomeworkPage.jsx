import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PercentBars } from '../components/Charts.jsx'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useData } from '../context/DataContext.jsx'
import {
  HOMEWORK_TYPES,
  HOMEWORK_TYPE_IDS,
  NUMBER_SUBTYPE_LABELS,
  accuracyByType,
  buildHomework,
  isWeak,
  runStorageKey,
} from '../lib/homework.js'
import { aggregateMistakes } from '../lib/mistakes.js'

function savedProgress(key) {
  try {
    const run = JSON.parse(localStorage.getItem(key) || 'null')
    return run?.items?.length ? { done: run.results.length, total: run.items.length } : null
  } catch {
    return null
  }
}

// Mô tả ngắn một câu trong sổ lỗi
function describeWeak(row, cardById) {
  const at = row.item_key.indexOf(':')
  const kind = row.item_key.slice(0, at)
  const rest = row.item_key.slice(at + 1)
  if (kind === 'spellword') return { text: rest, sub: 'Từ hay chép sai' }
  if (kind === 'spelling') return { text: rest, sub: HOMEWORK_TYPES.spelling.label }
  const card = cardById.get(rest)
  if (!card) return null
  return { text: card.word, sub: `${HOMEWORK_TYPES[kind]?.label ?? ''} · ${card.meaning_vi}` }
}

export default function HomeworkPage() {
  const { user } = useAuth()
  const { today, cards, history, homeworkProgress, homeworkSessions, homeworkReady } = useData()

  const todaySessions = homeworkSessions.filter((s) => s.study_date === today)
  const daily = todaySessions.find((s) => s.mode === 'daily')
  const dailyDone = Boolean(daily)
  const countToday = (mode, type) => todaySessions.filter((s) => s.mode === mode && (s.type ?? undefined) === type).length
  const runLink = (mode, type) => {
    const params = new URLSearchParams({ mode, round: String(mode === 'daily' ? 0 : countToday(mode, type)) })
    if (type) params.set('type', type)
    return `/homework/run?${params}`
  }
  const dailySaved = !daily ? savedProgress(runStorageKey(user.id, today, 'daily', undefined, 0)) : null

  // Xem trước bài hôm nay để biết có những gì
  const preview = useMemo(() => {
    if (dailyDone) return null
    const items = buildHomework({
      cards,
      progress: homeworkProgress,
      mistakes: aggregateMistakes(history, { minCount: 1, limit: 20 }),
      today,
      seed: `${today}:daily::0`,
    })
    const count = (fn) => items.filter(fn).length
    const isDue = (i) => homeworkProgress.get(i.key)?.due_on <= today
    return {
      total: items.length,
      parts: [
        [count(isDue), 'câu làm lại'],
        [count((i) => i.cardId && !isDue(i)), 'câu từ vựng đã học'],
        [count((i) => i.fromDictation), 'từ hay chép sai'],
        [count((i) => i.type === 'numbers' || i.type === 'spelling'), 'câu nghe IELTS'],
      ].filter(([n]) => n > 0),
    }
  }, [dailyDone, cards, homeworkProgress, history, today])

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const weak = useMemo(
    () =>
      [...homeworkProgress.values()]
        .filter(isWeak)
        .map((r) => ({ row: r, info: describeWeak(r, cardById) }))
        .filter((w) => w.info)
        .sort((a, b) => b.row.wrong_count - a.row.wrong_count),
    [homeworkProgress, cardById],
  )

  const accuracy = accuracyByType(homeworkSessions, today).map((a) => ({
    label: HOMEWORK_TYPES[a.type]?.label ?? a.type,
    value: Math.round((a.correct / a.total) * 100),
    count: a.total,
  }))
  const numberRows = Object.entries(NUMBER_SUBTYPE_LABELS)
    .map(([id, label]) => {
      const r = homeworkProgress.get(`numbers:${id}`)
      const total = (r?.correct_count ?? 0) + (r?.wrong_count ?? 0)
      return total ? { label, value: Math.round((r.correct_count / total) * 100), count: total } : null
    })
    .filter(Boolean)

  if (!homeworkReady) {
    return (
      <div className="page">
        <PageHeader title="Bài tập" />
        <div className="notice notice-warn">
          Mục Bài tập cần thêm 2 bảng mới trong Supabase. Bạn chạy file migration{' '}
          <code>supabase/migrations/20261005000000_homework.sql</code> (xem README) rồi mở lại app nhé.
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Bài tập" subtitle="Làm bài từ chính những gì bạn đã học" />

      <section className="card stack hw-today">
        <h2 className="section-title">Bài hôm nay</h2>
        {daily ? (
          <>
            <p>
              <Icon name="check" size={18} /> Bạn đã làm xong bài hôm nay: đúng {daily.correct_count}/{daily.total} câu.
              Giỏi lắm!
            </p>
            <div className="stack">
              {daily.wrong_count + daily.close_count > 0 && weak.length > 0 && (
                <Link to={runLink('mistakes')} className="btn btn-primary btn-block">
                  Ôn lại câu chưa đúng
                </Link>
              )}
              <Link to={runLink('extra')} className="btn btn-secondary btn-block">
                Làm thêm một bài
              </Link>
            </div>
          </>
        ) : (
          <>
            <p>
              <strong>{preview.total} câu</strong>, khoảng 10 phút.{' '}
              {preview.parts.map(([n, label]) => `${n} ${label}`).join(' · ')}
            </p>
            <Link to={runLink('daily')} className="btn btn-primary btn-block btn-lg">
              <Icon name="play" size={20} />{' '}
              {dailySaved ? `Làm tiếp (đã xong ${dailySaved.done}/${dailySaved.total})` : 'Làm bài hôm nay'}
            </Link>
          </>
        )}
        <p className="hint">
          Câu nào chưa đúng sẽ quay lại vào hôm sau, rồi giãn dần 2, 4, 8 ngày khi bạn trả lời đúng, cho tới khi nhớ chắc.
        </p>
      </section>

      <section className="card stack">
        <h2 className="section-title">Sổ lỗi</h2>
        {weak.length === 0 ? (
          <p className="muted">Chưa có câu nào cần ôn lại. Làm bài xong, câu chưa đúng sẽ được ghi vào đây.</p>
        ) : (
          <>
            <p className="muted">{weak.length} câu bạn còn nhầm, sẽ tự quay lại trong các bài tới.</p>
            <ul className="hw-weak">
              {weak.slice(0, 8).map(({ row, info }) => (
                <li key={row.item_key}>
                  <strong lang="en">{info.text}</strong>
                  <span className="muted">{info.sub}</span>
                </li>
              ))}
            </ul>
            {weak.length > 8 && <p className="hint">và {weak.length - 8} câu khác.</p>}
            <Link to={runLink('mistakes')} className="btn btn-secondary btn-block">
              Luyện riêng sổ lỗi ({Math.min(weak.length, 15)} câu)
            </Link>
          </>
        )}
      </section>

      <section className="stack">
        <h2 className="section-title">Luyện theo dạng</h2>
        <div className="module-list">
          {HOMEWORK_TYPE_IDS.map((t) => (
            <Link key={t} to={runLink('type', t)} className="module">
              <Icon name={t === 'numbers' || t === 'spelling' || t.startsWith('listen') ? 'headphones' : 'pen'} />
              <span>
                <strong>{HOMEWORK_TYPES[t].label}</strong>
                <small>{HOMEWORK_TYPES[t].desc}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {accuracy.length > 0 && (
        <section className="card stack">
          <h2 className="section-title">Độ chính xác 30 ngày qua</h2>
          <PercentBars rows={accuracy} />
          {numberRows.length > 0 && (
            <>
              <h3 className="hw-subtitle">Phần số, ngày, giờ (IELTS Part 1)</h3>
              <PercentBars rows={numberRows} />
              <p className="hint">Dạng nào thấp hơn sẽ được ra nhiều hơn trong các bài sau.</p>
            </>
          )}
        </section>
      )}
    </div>
  )
}
