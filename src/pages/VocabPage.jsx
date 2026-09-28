import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import PageHeader from '../components/PageHeader.jsx'
import StatCard from '../components/StatCard.jsx'
import { useData } from '../context/DataContext.jsx'
import { isNewCard } from '../lib/srs.js'
import { describeDue } from '../lib/dates.js'
import { MASTERED_INTERVAL_DAYS } from '../config.js'

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'learning', label: 'Đang học' },
  { id: 'mastered', label: 'Đã thuộc' },
  { id: 'new', label: 'Chưa học' },
  { id: 'custom', label: 'Tự thêm' },
]

const PAGE = 50

function cardStatus(card) {
  if (isNewCard(card)) return 'new'
  return card.interval_days >= MASTERED_INTERVAL_DAYS ? 'mastered' : 'learning'
}

const STATUS_LABEL = { new: 'Chưa học', learning: 'Đang học', mastered: 'Đã thuộc' }

export default function VocabPage() {
  const { cards, stats, today } = useData()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(PAGE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cards
      .filter((c) => {
        if (filter === 'custom' && c.seed_id) return false
        if (!['all', 'custom'].includes(filter) && cardStatus(c) !== filter) return false
        if (!q) return true
        return c.word.toLowerCase().includes(q) || c.meaning_vi.toLowerCase().includes(q)
      })
      .sort((a, b) => a.position - b.position || a.word.localeCompare(b.word))
  }, [cards, query, filter])

  const extraNew = Math.min(5, stats.newCards.length)

  return (
    <div className="page">
      <PageHeader
        title="Từ vựng"
        right={
          <Link to="/vocab/new" className="btn btn-secondary btn-sm">
            <Icon name="plus" size={18} /> Thêm thẻ
          </Link>
        }
      />

      <div className="tool-links">
        <Link to="/vocab/sets" className="chip">
          Bộ từ IELTS theo chủ đề
        </Link>
        <Link to="/vocab/import" className="chip">
          Nhập danh sách từ
        </Link>
      </div>

      <div className="stats stats-3">
        <StatCard value={stats.dueCards.length} label="đến hạn" />
        <StatCard value={stats.mastered} label="đã thuộc" />
        <StatCard value={stats.totalCards} label="tổng số thẻ" />
      </div>

      <div className="stack">
        {stats.dueCards.length > 0 ? (
          <Link to="/vocab/review?mode=due" className="btn btn-primary btn-block btn-lg">
            Ôn {stats.dueCards.length} thẻ đến hạn
          </Link>
        ) : (
          <p className="notice">Hôm nay không còn thẻ nào đến hạn. Tuyệt vời! 🎉</p>
        )}
        {stats.newQuotaLeft > 0 ? (
          <Link to="/vocab/review?mode=new" className="btn btn-secondary btn-block">
            Học {stats.newQuotaLeft} từ mới hôm nay
          </Link>
        ) : (
          extraNew > 0 && (
            <Link to="/vocab/review?mode=extra" className="btn btn-secondary btn-block">
              Hôm nay đủ từ mới rồi · học thêm {extraNew} từ?
            </Link>
          )
        )}
      </div>

      <section>
        <h2 className="section-title">Danh sách thẻ</h2>
        <label className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Tìm từ hoặc nghĩa…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            aria-label="Tìm thẻ"
          />
        </label>
        <div className="chips" role="group" aria-label="Lọc thẻ">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${filter === f.id ? 'active' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id)
                setLimit(PAGE)
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="hint">Không có thẻ nào phù hợp.</p>
        ) : (
          <ul className="card-list">
            {filtered.slice(0, limit).map((c) => {
              const status = cardStatus(c)
              return (
                <li key={c.id}>
                  <Link to={`/vocab/${c.id}`} className="card-row">
                    <span className="card-row-main">
                      <strong lang="en">{c.word}</strong>
                      <small>{c.meaning_vi}</small>
                    </span>
                    <span className="card-row-meta">
                      <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>
                      {status !== 'new' && <small>{describeDue(c.due_date, today)}</small>}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {filtered.length > limit && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setLimit((l) => l + PAGE)}>
            Xem thêm ({filtered.length - limit} thẻ)
          </button>
        )}
      </section>
    </div>
  )
}
