import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { isNewCard } from '../lib/srs.js'
import { lookupWord } from '../lib/lookup.js'

// Các từ nghe sai → tạo thẻ mới (kèm câu làm ví dụ) hoặc cho thẻ sẵn có ôn lại sớm.
// items: [{ key, word, count?, sentence?, meaning? }]
export default function MistakeWords({ items, sentence, sentenceMeaning = '', title }) {
  const { cards, addCard, editCard, today } = useData()
  const { showToast } = useToast()
  const [done, setDone] = useState({})
  const byWord = useMemo(() => new Map(cards.map((c) => [c.word.trim().toLowerCase(), c])), [cards])

  if (!items.length) return null

  const create = async (item) => {
    const card = addCard({
      word: item.word,
      example_en: item.sentence ?? sentence ?? '',
      example_vi: item.meaning ?? sentenceMeaning ?? '',
    })
    setDone((d) => ({ ...d, [item.key]: 'created' }))
    showToast(`Đã tạo thẻ “${item.word}”, xếp đầu hàng từ mới.`)
    if (navigator.onLine === false) return
    const found = await lookupWord(item.word, { translateExample: false })
    const patch = Object.fromEntries(['ipa', 'pos', 'meaning_vi'].filter((k) => found[k]).map((k) => [k, found[k]]))
    if (Object.keys(patch).length) editCard(card.id, patch)
  }

  const reviewSooner = (item, card) => {
    editCard(card.id, { due_date: today })
    setDone((d) => ({ ...d, [item.key]: 'sooner' }))
    showToast(`“${card.word}” sẽ được ôn lại ngay hôm nay.`)
  }

  return (
    <div className="mistakes">
      {title && <p className="label">{title}</p>}
      <div className="chip-wrap">
        {items.map((item) => {
          const card = byWord.get(item.key)
          const count = item.count > 1 ? ` · ${item.count} lần` : ''
          if (done[item.key]) {
            return (
              <span key={item.key} className="chip chip-done">
                ✓ {item.word}
              </span>
            )
          }
          if (card && isNewCard(card)) {
            return (
              <span key={item.key} className="chip chip-muted" lang="en">
                {item.word} · đã có thẻ{count}
              </span>
            )
          }
          if (card) {
            return (
              <button key={item.key} type="button" className="chip" onClick={() => reviewSooner(item, card)}>
                <span lang="en">{item.word}</span> · ôn lại sớm{count}
              </button>
            )
          }
          return (
            <button key={item.key} type="button" className="chip chip-add" onClick={() => create(item)}>
              + <span lang="en">{item.word}</span>
              {count}
            </button>
          )
        })}
      </div>
    </div>
  )
}
