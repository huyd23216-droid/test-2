import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { IMPORT_LIMIT, parseImportText } from '../lib/importText.js'
import { lookupWord } from '../lib/lookup.js'
import { posLabel } from '../lib/labels.js'

const EXAMPLE = `sustainable | bền vững
commute | đi lại hằng ngày (đi làm, đi học)
pollution
urbanization`

// Chạy tra từ song song tối đa 3 từ một lúc
async function runLookups(rows, onResult, signal) {
  let next = 0
  const worker = async () => {
    while (next < rows.length && !signal.aborted) {
      const i = next++
      const found = await lookupWord(rows[i].word, { signal, translateExample: !rows[i].example_vi })
      onResult(i, found)
    }
  }
  await Promise.all([worker(), worker(), worker()])
}

export default function ImportPage() {
  const { cards, addCards } = useData()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [autoLookup, setAutoLookup] = useState(true)
  const [rows, setRows] = useState(null)
  const [progress, setProgress] = useState(null)
  const abortRef = useRef(null)

  const existing = useMemo(() => new Set(cards.map((c) => c.word.trim().toLowerCase())), [cards])

  const preview = async () => {
    const parsed = parseImportText(text).map((r) => ({
      ...r,
      ipa: '',
      pos: '',
      include: !existing.has(r.word.toLowerCase()),
      duplicate: existing.has(r.word.toLowerCase()),
      auto: false,
    }))
    setRows(parsed)
    const needLookup = parsed.filter((r) => r.include && (!r.meaning_vi || !r.example_en))
    if (!autoLookup || needLookup.length === 0) return
    if (!navigator.onLine) {
      showToast('Đang offline nên chưa tra từ được. Bạn vẫn có thể thêm thẻ và sửa sau.', { tone: 'warn' })
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let done = 0
    setProgress({ done, total: needLookup.length })
    await runLookups(
      needLookup,
      (i, found) => {
        const word = needLookup[i].word
        setRows((list) =>
          list.map((r) =>
            r.word !== word
              ? r
              : {
                  ...r,
                  ipa: r.ipa || found.ipa || '',
                  pos: r.pos || found.pos || '',
                  meaning_vi: r.meaning_vi || found.meaning_vi || '',
                  example_en: r.example_en || found.example_en || '',
                  example_vi: r.example_vi || found.example_vi || '',
                  auto: r.auto || Boolean(found.meaning_vi || found.ipa),
                },
          ),
        )
        done += 1
        setProgress({ done, total: needLookup.length })
      },
      ctrl.signal,
    )
    setProgress(null)
  }

  const update = (index, patch) => setRows((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  const selected = rows?.filter((r) => r.include) ?? []

  const save = () => {
    abortRef.current?.abort()
    addCards(
      selected.map((r) => ({
        word: r.word,
        ipa: r.ipa,
        pos: r.pos,
        meaning_vi: r.meaning_vi,
        example_en: r.example_en,
        example_vi: r.example_vi,
      })),
    )
    const missing = selected.filter((r) => !r.meaning_vi).length
    showToast(
      `Đã thêm ${selected.length} thẻ vào đầu hàng từ mới.${missing ? ` ${missing} thẻ chưa có nghĩa, bạn sửa sau nhé.` : ''}`,
    )
    navigate('/vocab')
  }

  return (
    <div className="page">
      <PageHeader title="Nhập danh sách từ" back="/vocab" />

      {!rows ? (
        <div className="form">
          <label className="field">
            <span>Dán danh sách (mỗi dòng một từ, tối đa {IMPORT_LIMIT} từ)</span>
            <textarea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              lang="en"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <p className="hint">
            Có thể ghi thêm nghĩa và câu ví dụ, cách nhau bằng dấu <code>|</code>:{' '}
            <code>từ | nghĩa | câu ví dụ | nghĩa câu ví dụ</code>. Dán thẳng từ Excel/Google Sheets cũng được.
          </p>
          <label className="check">
            <input type="checkbox" checked={autoLookup} onChange={(e) => setAutoLookup(e.target.checked)} />
            <span>Tự tra phiên âm, loại từ, nghĩa và câu ví dụ còn thiếu (cần mạng)</span>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-block btn-lg"
            disabled={!text.trim()}
            onClick={preview}
          >
            Xem trước
          </button>
        </div>
      ) : (
        <>
          {progress && (
            <div className="stack">
              <ProgressBar value={progress.done} max={progress.total} label={`${progress.done}/${progress.total}`} />
              <p className="hint">Đang tra từ… Bạn có thể sửa nghĩa ngay trong lúc chờ.</p>
            </div>
          )}
          {rows.some((r) => r.auto) && (
            <p className="notice">Nghĩa tiếng Việt được dịch tự động, bạn xem lại và sửa cho đúng ngữ cảnh nhé.</p>
          )}
          <ul className="import-list">
            {rows.map((r, i) => (
              <li key={r.word} className={r.include ? '' : 'is-off'}>
                <label className="check">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(i, { include: e.target.checked })} />
                  <span>
                    <strong lang="en">{r.word}</strong> {r.ipa && <span className="muted">{r.ipa}</span>}{' '}
                    {r.pos && <em className="muted">{posLabel(r.pos)}</em>}
                    {r.duplicate && <span className="pill">đã có</span>}
                  </span>
                </label>
                {r.include && (
                  <>
                    <input
                      value={r.meaning_vi}
                      onChange={(e) => update(i, { meaning_vi: e.target.value })}
                      placeholder="Nghĩa tiếng Việt"
                      aria-label={`Nghĩa của ${r.word}`}
                    />
                    {r.example_en && (
                      <p className="hint" lang="en">
                        {r.example_en}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="stack">
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              disabled={selected.length === 0}
              onClick={save}
            >
              Thêm {selected.length} thẻ
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => {
                abortRef.current?.abort()
                setRows(null)
                setProgress(null)
              }}
            >
              Sửa lại danh sách
            </button>
            <Link to="/vocab" className="btn btn-ghost btn-block">
              Hủy
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
