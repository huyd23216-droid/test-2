// Các hằng số có thể chỉnh để thay đổi cách app hoạt động.

// Tốc độ đọc có thể chọn
export const SPEECH_RATES = [0.75, 1, 1.25]

// Thẻ có khoảng ôn >= số ngày này được tính là "đã thuộc"
export const MASTERED_INTERVAL_DAYS = 7

// Buổi học "10 phút": số thẻ ôn tối đa (để không bị ngợp sau vài ngày nghỉ)
export const DAILY_SESSION_MAX_REVIEWS = 50
export const DAILY_SESSION_CONNECTED_SPEECH = 1
export const DAILY_SESSION_DICTATION = 2

// Mỗi tuần (thứ Hai → Chủ nhật) được nghỉ bấy nhiêu ngày mà không mất chuỗi
export const STREAK_REST_DAYS_PER_WEEK = 2

// Mặc định khi tạo tài khoản
export const DEFAULT_SETTINGS = {
  tts_rate: 1,
  new_words_per_day: 5,
  removed_seed_ids: [],
}
