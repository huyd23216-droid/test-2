// Biểu đồ đơn giản bằng HTML/CSS: cột theo tuần, lịch học dạng ô, thanh xếp chồng,
// thanh ngang. Mỗi biểu đồ có tooltip khi rê chuột / chạm / focus bàn phím, và
// một bảng số liệu tương đương (không phụ thuộc vào màu hay tooltip).
import { useRef, useState } from 'react'
import { niceTicks, shortDate } from '../lib/progress.js'
import { parseDate } from '../lib/dates.js'

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WEEKDAY_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

function TableView({ children }) {
  return (
    <details className="table-view">
      <summary>Xem dạng bảng</summary>
      <div className="table-scroll">{children}</div>
    </details>
  )
}

// ---------- Cột: số phút học mỗi tuần ----------
export function WeeklyColumns({ weeks }) {
  const [active, setActive] = useState(null)
  const max = Math.max(...weeks.map((w) => w.minutes))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const labelEvery = weeks.length > 8 ? 3 : 1
  const shown = active !== null ? weeks[active] : null
  // Căn tooltip theo vị trí cột để không tràn ra ngoài khung
  const tipStyle = (() => {
    if (active === null) return {}
    const n = weeks.length
    const frac = (active + 0.5) / n
    if (frac < 0.3) return { left: `${(active / n) * 100}%`, transform: 'none' }
    if (frac > 0.7) return { right: `${(1 - (active + 1) / n) * 100}%`, transform: 'none' }
    return { left: `${frac * 100}%` }
  })()

  return (
    <figure className="chart">
      <div className="col-chart" onPointerLeave={() => setActive(null)}>
        <div className="col-plot">
          {ticks.map((t) => (
            <div key={t} className="grid-line" style={{ bottom: `${(t / top) * 100}%` }}>
              <span className="tick-label">{t}</span>
            </div>
          ))}
          <div className="col-bars">
            {weeks.map((w, i) => (
              <button
                key={w.start}
                type="button"
                className={`col-slot ${active === i ? 'is-active' : ''}`}
                aria-label={`Tuần ${shortDate(w.start)} – ${shortDate(w.end)}: ${w.minutes} phút`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i)}
              >
                {w.current && w.minutes > 0 && (
                  <span className="col-value" style={{ bottom: `${(w.minutes / top) * 100}%` }}>
                    {w.minutes}
                  </span>
                )}
                <span className="col-bar" style={{ height: `${(w.minutes / top) * 100}%` }} />
              </button>
            ))}
          </div>
          {shown && (
            <div className="chart-tip" style={tipStyle} role="status">
              <strong>{shown.minutes} phút</strong>
              <span>
                {shown.current ? 'Tuần này' : `Tuần ${shortDate(shown.start)} – ${shortDate(shown.end)}`}
              </span>
            </div>
          )}
        </div>
        <div className="col-axis">
          {weeks.map((w, i) => (
            <span key={w.start}>
              {(weeks.length - 1 - i) % labelEvery === 0 ? (w.current ? 'Tuần này' : shortDate(w.start)) : ''}
            </span>
          ))}
        </div>
      </div>
      <TableView>
        <table>
          <thead>
            <tr>
              <th>Tuần</th>
              <th className="num">Phút</th>
            </tr>
          </thead>
          <tbody>
            {[...weeks].reverse().map((w) => (
              <tr key={w.start}>
                <td>
                  {shortDate(w.start)} – {shortDate(w.end)}
                </td>
                <td className="num">{w.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableView>
    </figure>
  )
}

// ---------- Lịch học: mỗi ô là một ngày ----------
const LEVEL_TEXT = ['Không học', 'Dưới 10 phút', '10–19 phút', '20–39 phút', 'Từ 40 phút']

export function StudyCalendar({ grid }) {
  const [tip, setTip] = useState(null)
  const wrapRef = useRef(null)

  const show = (e, day) => {
    const wrap = wrapRef.current.getBoundingClientRect()
    const cell = e.currentTarget.getBoundingClientRect()
    setTip({
      day,
      left: Math.min(Math.max(cell.left - wrap.left + cell.width / 2, 70), wrap.width - 70),
      top: cell.top - wrap.top,
    })
  }

  const describe = (day) =>
    day.level === 0
      ? 'Ngày nghỉ'
      : day.minutes > 0
        ? `${day.minutes} phút`
        : 'Có học (dưới 1 phút)'

  // Nhãn tháng ở tuần đầu tiên của mỗi tháng
  const monthLabels = grid.map((week, i) => {
    const m = parseDate(week.start).getMonth()
    const prev = i > 0 ? parseDate(grid[i - 1].start).getMonth() : null
    return i === 0 || m !== prev ? `Th${m + 1}` : ''
  })

  return (
    <figure className="chart">
      <div className="cal" ref={wrapRef} onPointerLeave={() => setTip(null)}>
        <div className="cal-months" style={{ gridTemplateColumns: `repeat(${grid.length}, var(--cell))` }}>
          {monthLabels.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
        <div className="cal-body">
          <div className="cal-weekdays">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <span key={d}>{d % 2 === 1 || d === 0 ? WEEKDAY_SHORT[d] : ''}</span>
            ))}
          </div>
          <div className="cal-grid" style={{ gridTemplateColumns: `repeat(${grid.length}, var(--cell))` }}>
            {grid.map((week) =>
              week.days.map((day) =>
                day.future ? (
                  <span key={day.date} className="cal-cell is-future" />
                ) : (
                  <button
                    key={day.date}
                    type="button"
                    className={`cal-cell heat-${day.level}`}
                    aria-label={`${WEEKDAY_LONG[parseDate(day.date).getDay()]} ${shortDate(day.date)}: ${describe(day)}`}
                    onPointerEnter={(e) => show(e, day)}
                    onFocus={(e) => show(e, day)}
                    onClick={(e) => show(e, day)}
                  />
                ),
              ),
            )}
          </div>
        </div>
        {tip && (
          <div className="chart-tip cal-tip" style={{ left: tip.left, top: tip.top }} role="status">
            <strong>{describe(tip.day)}</strong>
            <span>
              {WEEKDAY_LONG[parseDate(tip.day.date).getDay()]} {shortDate(tip.day.date)}
            </span>
          </div>
        )}
      </div>
      <div className="cal-legend" aria-hidden="true">
        <span>Ít</span>
        {LEVEL_TEXT.map((text, level) => (
          <span key={level} className={`cal-cell heat-${level}`} title={text} />
        ))}
        <span>Nhiều</span>
      </div>
      <TableView>
        <table>
          <thead>
            <tr>
              <th>Tuần</th>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <th key={d} className="num">
                  {WEEKDAY_SHORT[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...grid].reverse().map((week) => (
              <tr key={week.start}>
                <td>{shortDate(week.start)}</td>
                {week.days.map((day) => (
                  <td key={day.date} className="num">
                    {day.future ? '' : day.level === 0 ? '–' : day.minutes}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Số phút học mỗi ngày (– là ngày nghỉ).</p>
      </TableView>
    </figure>
  )
}

// ---------- Thanh xếp chồng: tình trạng từ vựng ----------
export function StackedBar({ segments, total }) {
  const [active, setActive] = useState(null)
  const visible = segments.filter((s) => s.value > 0)
  return (
    <figure className="chart">
      <div className="stack-bar" onPointerLeave={() => setActive(null)}>
        {visible.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`stack-seg ${s.className}`}
            style={{ flexGrow: s.value }}
            aria-label={`${s.label}: ${s.value} thẻ`}
            onPointerEnter={() => setActive(s.label)}
            onFocus={() => setActive(s.label)}
            onBlur={() => setActive(null)}
          />
        ))}
      </div>
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.label} className={active === s.label ? 'is-active' : ''}>
            <span className={`swatch ${s.className}`} aria-hidden="true" />
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <span className="muted">{total ? `${Math.round((s.value / total) * 100)}%` : ''}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

// ---------- Thanh ngang: độ chính xác (%) ----------
export function PercentBars({ rows }) {
  return (
    <figure className="chart">
      <ul className="hbars">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="hbar-label">
              {r.label}
              <small className="muted"> · {r.count} lần</small>
            </span>
            <span className="hbar-row">
              <span className="hbar-track" role="img" aria-label={`${r.label}: ${r.value}%`}>
                <span className="hbar-fill" style={{ width: `${Math.max(r.value, 1)}%` }} />
              </span>
              <span className="hbar-value">{r.value}%</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
