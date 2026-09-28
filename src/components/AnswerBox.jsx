import { useEffect, useRef } from 'react'

const prefersFinePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

// Ô gõ câu trả lời. Tắt tự sửa chính tả để app chấm đúng những gì bạn nghe được.
// Enter = kiểm tra.
export default function AnswerBox({ value, onChange, onSubmit, disabled, placeholder = 'Gõ câu bạn nghe được…', autoFocus = true }) {
  const ref = useRef(null)

  useEffect(() => {
    // Chỉ tự đặt con trỏ trên máy tính, tránh bàn phím điện thoại che nội dung
    if (autoFocus && !disabled && prefersFinePointer()) ref.current?.focus()
  }, [autoFocus, disabled])

  return (
    <textarea
      ref={ref}
      className="answer"
      rows={2}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          onSubmit()
        }
      }}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      enterKeyHint="done"
      lang="en"
      aria-label="Câu trả lời"
    />
  )
}
