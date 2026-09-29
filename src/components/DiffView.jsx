import { groupOpsForDisplay, scoreMessage } from '../lib/grading.js'

// Hiển thị kết quả chấm: xanh = đúng, đỏ = sai/thừa, vàng = thiếu
export default function DiffView({ result, answerText }) {
  const items = groupOpsForDisplay(result.ops)
  return (
    <div className="diff">
      <p className="diff-score">
        <strong>
          Đúng {result.correct}/{result.total} từ
        </strong>{' '}
        · {scoreMessage(result)}
      </p>
      <p className="diff-words" aria-label="Kết quả từng từ">
        {items.length === 0 && <span className="hint">(Bạn chưa gõ gì)</span>}
        {items.map((it, i) => {
          if (it.type === 'match') return <span key={i} className="w w-ok">{it.text}</span>
          if (it.type === 'missing')
            return (
              <span key={i} className="w w-missing" title="Thiếu từ này">
                {it.text}
              </span>
            )
          if (it.type === 'extra')
            return (
              <del key={i} className="w w-bad" title="Từ thừa">
                {it.text}
              </del>
            )
          return (
            <span key={i} className="w-pair">
              <del className="w w-bad" title="Từ bạn gõ">{it.text}</del>
              <span className="w w-fix" title="Từ đúng">{it.correction}</span>
            </span>
          )
        })}
      </p>
      <p className="diff-legend">
        <span className="dot dot-ok" /> đúng <span className="dot dot-bad" /> sai <span className="dot dot-missing" /> thiếu
      </p>
      {answerText && (
        <p className="diff-answer">
          <span className="label">Đáp án</span>
          <span lang="en">{answerText}</span>
        </p>
      )}
    </div>
  )
}
