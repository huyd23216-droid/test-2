import { useState } from 'react'
import ClozeItem from './ClozeItem.jsx'
import ProgressBar from './ProgressBar.jsx'
import SetItem from './SetItem.jsx'
import { useData } from '../context/DataContext.jsx'
import { useTracker } from '../context/StudyTracker.jsx'

// Làm lần lượt các câu bài tập (mỗi màn hình một câu). Mỗi câu trả lời được lưu
// ngay (qua hàng đợi offline). entries: [{ set, item, blanks? }]
// Câu cloze lưu mỗi chỗ trống thành một dòng với item_id "<id câu>.<số>";
// blanks (nếu có) là các chỗ trống cần ôn lại, chỗ khác điền sẵn.
export default function SetItemRunner({ entries, onFinish, finishLabel = 'Xem kết quả', showSource = false }) {
  const { recordSetAnswer, settings } = useData()
  const tracker = useTracker()
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState([])
  const entry = entries[index]
  const last = index + 1 >= entries.length
  const itemKey = `${entry.set.id}:${entry.item.id}:${index}`
  const common = {
    item: entry.item,
    source: showSource ? `Từ bài: ${entry.set.title}` : undefined,
    onNext: () => {
      window.scrollTo(0, 0)
      if (last) onFinish(results)
      else setIndex((i) => i + 1)
    },
    nextLabel: last ? finishLabel : 'Câu tiếp theo',
  }

  return (
    <>
      {entries.length > 1 && (
        <ProgressBar value={index} max={entries.length} label={`Câu ${index + 1}/${entries.length}`} />
      )}
      {entry.item.type === 'cloze' ? (
        <ClozeItem
          key={itemKey}
          {...common}
          dueBlanks={entry.blanks}
          rate={settings?.tts_rate ?? 1}
          onAnswer={(list) => {
            for (const r of list) recordSetAnswer(entry.set, { id: `${entry.item.id}.${r.n}` }, r.answer, r.isCorrect)
            tracker.addActivity('homework')
            setResults((prev) => [...prev, ...list.map((r) => ({ ...entry, blank: r.n, answer: r.answer, isCorrect: r.isCorrect }))])
          }}
        />
      ) : (
        <SetItem
          key={itemKey}
          {...common}
          onAnswer={(answer, isCorrect) => {
            recordSetAnswer(entry.set, entry.item, answer, isCorrect)
            tracker.addActivity('homework')
            setResults((list) => [...list, { ...entry, answer, isCorrect }])
          }}
        />
      )}
    </>
  )
}
