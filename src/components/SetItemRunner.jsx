import { useState } from 'react'
import ProgressBar from './ProgressBar.jsx'
import SetItem from './SetItem.jsx'
import { useData } from '../context/DataContext.jsx'
import { useTracker } from '../context/StudyTracker.jsx'

// Làm lần lượt các câu bài tập (mỗi màn hình một câu). Mỗi câu trả lời được lưu
// ngay (qua hàng đợi offline). entries: [{ set, item }]
export default function SetItemRunner({ entries, onFinish, finishLabel = 'Xem kết quả', showSource = false }) {
  const { recordSetAnswer } = useData()
  const tracker = useTracker()
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState([])
  const entry = entries[index]
  const last = index + 1 >= entries.length

  return (
    <>
      {entries.length > 1 && (
        <ProgressBar value={index} max={entries.length} label={`Câu ${index + 1}/${entries.length}`} />
      )}
      <SetItem
        key={`${entry.set.id}:${entry.item.id}:${index}`}
        item={entry.item}
        source={showSource ? `Từ bài: ${entry.set.title}` : undefined}
        onAnswer={(answer, isCorrect) => {
          recordSetAnswer(entry.set, entry.item, answer, isCorrect)
          tracker.addActivity('homework')
          setResults((list) => [...list, { ...entry, answer, isCorrect }])
        }}
        onNext={() => {
          window.scrollTo(0, 0)
          if (last) onFinish(results)
          else setIndex((i) => i + 1)
        }}
        nextLabel={last ? finishLabel : 'Câu tiếp theo'}
      />
    </>
  )
}
