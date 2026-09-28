import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import SpeakButton from '../components/SpeakButton.jsx'
import { useData } from '../context/DataContext.jsx'
import { CS_GROUPS, CS_ITEMS } from '../lib/content.js'
import { CS_MODES } from '../lib/labels.js'

const MODE_KEY = 'cs-mode'

function loadMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'listen' ? 'listen' : 'read'
  } catch {
    return 'read'
  }
}

export default function ConnectedSpeechPage() {
  const { csProgress, settings, stats } = useData()
  const [mode, setMode] = useState(loadMode)

  const chooseMode = (m) => {
    setMode(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // không sao
    }
  }

  return (
    <div className="page">
      <PageHeader title="Nối âm, nuốt âm" subtitle={`Đã làm ${stats.csDone}/${stats.csTotal} câu`} />

      <p className="intro">
        Người bản xứ không đọc tách từng từ. Họ nối, nuốt và rút gọn âm, nên câu quen thuộc nghe vẫn lạ tai. Hiểu từng
        hiện tượng dưới đây, bạn sẽ bắt kịp câu nói nhanh hơn nhiều.
      </p>

      <div className="card">
        <p className="label">Chọn kiểu bài tập</p>
        <div className="segmented segmented-block" role="group" aria-label="Kiểu bài tập">
          {Object.entries(CS_MODES).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={mode === id ? 'active' : ''}
              aria-pressed={mode === id}
              onClick={() => chooseMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <Link to={`/connected/practice?mode=${mode}`} className="btn btn-primary btn-block btn-lg">
          Luyện trộn tất cả nhóm
        </Link>
      </div>

      <div className="group-list">
        {CS_GROUPS.map((group) => {
          const items = CS_ITEMS.filter((it) => it.group === group.id)
          const done = items.filter((it) => csProgress.get(it.id)?.attempts > 0).length
          return (
            <section key={group.id} className="card group">
              <div className="group-head">
                <h2>{group.name}</h2>
                <span className="pill">
                  {done}/{items.length}
                </span>
              </div>
              {group.example && (
                <p className="group-example" lang="en">
                  {group.example}
                </p>
              )}
              <p>{group.explanation}</p>
              <details className="examples">
                <summary>Xem {items.length} câu mẫu</summary>
                <ul>
                  {items.map((it) => (
                    <li key={it.id}>
                      <div>
                        <p lang="en">{it.full}</p>
                        <p lang="en" className="reduced-small">
                          → {it.reduced}
                        </p>
                      </div>
                      <SpeakButton text={it.full} rate={settings.tts_rate} variant="icon" />
                    </li>
                  ))}
                </ul>
              </details>
              <Link to={`/connected/practice?group=${group.id}&mode=${mode}`} className="btn btn-secondary btn-block">
                Luyện nhóm này
              </Link>
            </section>
          )
        })}
      </div>
    </div>
  )
}
