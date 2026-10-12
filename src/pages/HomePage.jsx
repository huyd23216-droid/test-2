import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import StatCard from '../components/StatCard.jsx'
import { useData } from '../context/DataContext.jsx'
import { formatLongDate } from '../lib/dates.js'
import { dueReviewItems, unfinishedCount } from '../lib/homeworkSets.js'
import {
  DAILY_SESSION_CONNECTED_SPEECH,
  DAILY_SESSION_DICTATION,
  DAILY_SESSION_MAX_REVIEWS,
  STREAK_REST_DAYS_PER_WEEK,
} from '../config.js'

function greeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Chào buổi sáng'
  if (h < 14) return 'Chào buổi trưa'
  if (h < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

function HomeworkCard({ unfinished, due }) {
  const parts = []
  if (unfinished > 0) parts.push(`${unfinished} bài chưa làm`)
  if (due > 0) parts.push(`${due} câu cần ôn lại`)
  return (
    <Link to="/homework" className="card hw-home">
      <span className="hw-home-icon" aria-hidden="true">
        <Icon name="task" size={24} />
      </span>
      <span>
        <strong>Bài tập</strong>
        <small className="muted">
          {parts.length ? parts.join(' · ') : 'Không có bài nào đang chờ. Luyện tập tự động nếu bạn muốn nhé.'}
        </small>
      </span>
    </Link>
  )
}

function StreakCard({ streak, todayMinutes }) {
  const { streak: days, studiedToday, restDaysLeft } = streak
  let message
  if (studiedToday) {
    message = todayMinutes >= 10 ? `Hôm nay bạn đã học ${todayMinutes} phút. Tuyệt vời!` : 'Hôm nay bạn đã học rồi. Giỏi lắm!'
  } else if (days > 0) {
    message = 'Học một chút hôm nay để nối dài chuỗi nhé.'
  } else {
    message = 'Hôm nay là một ngày đẹp để bắt đầu 🌱'
  }

  return (
    <section className="card streak">
      <div className="streak-main">
        <span className="streak-icon" aria-hidden="true">
          <Icon name="leaf" size={26} />
        </span>
        <div>
          <p className="streak-count">
            {days > 0 ? (
              <>
                Chuỗi <strong>{days}</strong> ngày học
              </>
            ) : (
              'Bắt đầu chuỗi ngày học'
            )}
          </p>
          <p className="muted">{message}</p>
        </div>
      </div>
      <p className="streak-rest">
        {restDaysLeft > 0
          ? `Tuần này bạn còn ${restDaysLeft} ngày nghỉ thoải mái mà chuỗi vẫn giữ nguyên.`
          : `Tuần mới sẽ có lại ${STREAK_REST_DAYS_PER_WEEK} ngày nghỉ thoải mái.`}
      </p>
    </section>
  )
}

export default function HomePage() {
  const { stats, hwSets, hwAnswersGrouped, today } = useData()
  const homeworkDue = dueReviewItems(hwSets, hwAnswersGrouped, today).length
  const reviewCount = Math.min(stats.dueCards.length, DAILY_SESSION_MAX_REVIEWS)

  const parts = []
  if (reviewCount > 0) parts.push(`ôn ${reviewCount} thẻ`)
  if (stats.newQuotaLeft > 0) parts.push(`${stats.newQuotaLeft} từ mới`)
  parts.push(`${DAILY_SESSION_CONNECTED_SPEECH} câu nối âm`)
  parts.push(`${DAILY_SESSION_DICTATION} câu chính tả`)

  return (
    <div className="page home">
      <header className="home-head">
        <p className="muted">{formatLongDate()}</p>
        <h1>{greeting()} 👋</h1>
      </header>

      <Link to="/session" className="cta">
        <span className="cta-title">
          <Icon name="play" size={22} /> Học tối thiểu 10 phút
        </span>
        <span className="cta-sub">Hôm nay: {parts.join(' · ')}</span>
      </Link>

      <StreakCard streak={stats.streak} todayMinutes={stats.todayMinutes} />

      <HomeworkCard unfinished={unfinishedCount(hwSets)} due={homeworkDue} />

      <section>
        <h2 className="section-title">Tiến độ của bạn</h2>
        <div className="stats">
          <StatCard value={stats.mastered} label="từ đã thuộc" hint={`${stats.learning} từ đang học`} />
          <StatCard value={stats.dueCards.length} label="thẻ đến hạn hôm nay" />
          <StatCard value={stats.weekMinutes} label="phút học tuần này" />
          <StatCard value={`${stats.csDone}/${stats.csTotal}`} label="câu nối âm đã làm" />
        </div>
      </section>

      <section>
        <h2 className="section-title">Học thêm theo ý bạn</h2>
        <div className="module-list">
          <Link to="/vocab" className="module">
            <Icon name="cards" />
            <span>
              <strong>Từ vựng</strong>
              <small>Ôn thẻ, học từ mới, thêm từ của bạn</small>
            </span>
          </Link>
          <Link to="/connected" className="module">
            <Icon name="wave" />
            <span>
              <strong>Nối âm, nuốt âm</strong>
              <small>Nghe hiểu người bản xứ nói nhanh</small>
            </span>
          </Link>
          <Link to="/dictation" className="module">
            <Icon name="pen" />
            <span>
              <strong>Chép chính tả</strong>
              <small>3 mức độ và clip YouTube của bạn</small>
            </span>
          </Link>
          <Link to="/listen" className="module">
            <Icon name="headphones" />
            <span>
              <strong>Luyện nghe thêm</strong>
              <small>Điền từ còn thiếu, phân biệt âm dễ nhầm</small>
            </span>
          </Link>
          <Link to="/homework" className="module">
            <Icon name="task" />
            <span>
              <strong>Bài tập</strong>
              <small>Bài được giao, ôn câu sai và luyện tập tự động</small>
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
