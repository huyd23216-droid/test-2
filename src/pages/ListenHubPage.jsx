import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useData } from '../context/DataContext.jsx'
import { DICTATION_LEVELS, DICTATION_SENTENCES, DRILLS } from '../lib/content.js'

export default function ListenHubPage() {
  const { stats, dictationStats, listeningProgress, clips } = useData()
  const dictDone = DICTATION_SENTENCES.filter((s) => dictationStats.has(s.id)).length
  const gapDone = DICTATION_SENTENCES.filter((s) => listeningProgress.get(`gap:${s.id}`)).length
  const drillItems = DRILLS.flatMap((d) => d.items)
  const drillDone = drillItems.filter((it) => listeningProgress.get(`drill:${it.id}`)).length

  return (
    <div className="page">
      <PageHeader title="Luyện nghe" />
      <p className="intro">Chọn một kiểu luyện. Mỗi ngày một ít, tai sẽ quen dần với tiếng Anh nói tự nhiên.</p>

      <div className="module-list">
        <Link to="/connected" className="module">
          <Icon name="wave" />
          <span>
            <strong>Nối âm, nuốt âm</strong>
            <small>
              6 hiện tượng người bản xứ hay dùng · đã làm {stats.csDone}/{stats.csTotal} câu
            </small>
          </span>
        </Link>
        <Link to="/dictation" className="module">
          <Icon name="pen" />
          <span>
            <strong>Chép chính tả</strong>
            <small>
              Nghe cả câu rồi gõ lại · đã làm {dictDone}/{DICTATION_SENTENCES.length} câu
            </small>
          </span>
        </Link>
        <Link to="/listen/drills" className="module">
          <Icon name="ear" />
          <span>
            <strong>Phân biệt âm dễ nhầm</strong>
            <small>
              can/can't, thirteen/thirty, -ed, -s, nguyên âm… · đã làm {drillDone}/{drillItems.length}
            </small>
          </span>
        </Link>
        <Link to="/dictation#clips" className="module">
          <Icon name="video" />
          <span>
            <strong>Clip thật từ YouTube</strong>
            <small>{clips.length ? `${clips.length} clip đã lưu` : 'Lưu câu thoại hay trong phim, podcast để luyện'}</small>
          </span>
        </Link>
      </div>

      <section className="card group">
        <div className="group-head">
          <h2>Nghe điền từ</h2>
          <span className="pill">
            {gapDone}/{DICTATION_SENTENCES.length}
          </span>
        </div>
        <p>Nghe câu và điền các từ bị che. Ưu tiên những từ nhỏ hay bị đọc lướt như to, of, can, have.</p>
        <div className="button-row level-buttons">
          {DICTATION_LEVELS.map((lv) => (
            <Link key={lv.level} to={`/listen/gapfill?level=${lv.level}`} className="btn btn-secondary">
              Mức {lv.level}: {lv.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
