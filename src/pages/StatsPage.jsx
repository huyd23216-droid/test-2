import { useMemo } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import { PercentBars, StackedBar, StudyCalendar, WeeklyColumns } from '../components/Charts.jsx'
import { useData } from '../context/DataContext.jsx'
import { calendarGrid, listeningAccuracy, weeklyMinutes } from '../lib/progress.js'
import { studyDatesFromSessions } from '../lib/streak.js'

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} phút`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} giờ ${m} phút` : `${h} giờ`
}

export default function StatsPage() {
  const { sessions, today, stats, history, csProgress, listeningProgress } = useData()

  const weeks = useMemo(() => weeklyMinutes(sessions, today, 12), [sessions, today])
  const grid = useMemo(() => calendarGrid(sessions, today, 18), [sessions, today])
  const accuracy = useMemo(
    () =>
      listeningAccuracy({
        history,
        csRows: [...csProgress.values()],
        listening: [...listeningProgress.values()],
      }),
    [history, csProgress, listeningProgress],
  )
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0)
  const studyDays = studyDatesFromSessions(sessions).size
  const notStarted = stats.totalCards - stats.mastered - stats.learning

  return (
    <div className="page">
      <PageHeader title="Tiến độ" />

      <div className="stats">
        <StatCard value={stats.streak.streak} label="ngày trong chuỗi học" />
        <StatCard value={stats.weekMinutes} label="phút học tuần này" />
        <StatCard value={studyDays} label="ngày đã học" hint={`tổng ${formatDuration(totalSeconds)}`} />
        <StatCard value={stats.mastered} label="từ đã thuộc" hint={`${stats.learning} từ đang học`} />
      </div>

      <section className="card chart-card">
        <h2>Số phút học mỗi tuần</h2>
        <p className="hint">12 tuần gần nhất. Mỗi tuần chỉ cần vài buổi 10 phút là đủ tiến bộ đều.</p>
        <WeeklyColumns weeks={weeks} />
      </section>

      <section className="card chart-card">
        <h2>Lịch học</h2>
        <p className="hint">18 tuần gần nhất, ô càng đậm là học càng lâu. Nghỉ vài hôm cũng không sao cả.</p>
        <StudyCalendar grid={grid} />
      </section>

      <section className="card chart-card">
        <h2>Từ vựng</h2>
        <p className="hint">“Đã thuộc” là từ mà lần ôn tới cách từ 7 ngày trở lên.</p>
        <StackedBar
          total={stats.totalCards}
          segments={[
            { label: 'Đã thuộc', value: stats.mastered, className: 'heat-4' },
            { label: 'Đang học', value: stats.learning, className: 'heat-2' },
            { label: 'Chưa học', value: notStarted, className: 'heat-1' },
          ]}
        />
      </section>

      <section className="card chart-card">
        <h2>Độ chính xác khi luyện nghe</h2>
        {accuracy.length ? (
          <>
            <p className="hint">Tỷ lệ từ / câu đúng ở các bài gần đây của từng kiểu luyện.</p>
            <PercentBars rows={accuracy} />
          </>
        ) : (
          <p className="hint">Làm vài bài nối âm, chính tả hoặc luyện nghe là số liệu sẽ hiện ở đây.</p>
        )}
      </section>
    </div>
  )
}
