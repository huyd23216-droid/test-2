// Nhãn tiếng Việt cho loại từ (trường "pos")
export const POS_OPTIONS = [
  { value: 'noun', label: 'danh từ' },
  { value: 'verb', label: 'động từ' },
  { value: 'adjective', label: 'tính từ' },
  { value: 'adverb', label: 'trạng từ' },
  { value: 'pronoun', label: 'đại từ' },
  { value: 'preposition', label: 'giới từ' },
  { value: 'conjunction', label: 'liên từ' },
  { value: 'determiner', label: 'từ hạn định' },
  { value: 'article', label: 'mạo từ' },
  { value: 'modal', label: 'động từ khuyết thiếu' },
  { value: 'number', label: 'số từ' },
  { value: 'interjection', label: 'thán từ' },
  { value: 'phrase', label: 'cụm từ' },
  { value: 'idiom', label: 'thành ngữ' },
]

const POS_MAP = Object.fromEntries(POS_OPTIONS.map((o) => [o.value, o.label]))

// "verb, noun" -> "động từ, danh từ"; loại lạ thì giữ nguyên
export function posLabel(pos) {
  if (!pos) return ''
  return pos
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => POS_MAP[p.toLowerCase()] ?? p)
    .join(', ')
}

// Hai kiểu bài tập nối âm
export const CS_MODES = {
  read: 'Đọc cách nói → gõ câu đầy đủ',
  listen: 'Nghe → gõ câu đầy đủ',
}

const CHEERS = [
  'Mỗi ngày một chút, tai bạn sẽ quen dần với tiếng Anh thật.',
  'Bạn vừa tiến thêm một bước tới IELTS 6.5 rồi đấy.',
  'Đều đặn quan trọng hơn nhiều so với học dồn. Làm tốt lắm!',
  'Hôm nay bạn đã dành thời gian cho chính mình. Tuyệt vời!',
  'Nghe nhiều sẽ hiểu nhiều. Cứ nhẹ nhàng mà tiến nhé.',
  'Não bạn đang âm thầm ghi nhớ đấy, mai gặp lại nhé!',
]

export function randomCheer() {
  return CHEERS[Math.floor(Math.random() * CHEERS.length)]
}
