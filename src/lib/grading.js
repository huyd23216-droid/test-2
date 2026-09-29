// Chấm câu trả lời theo từng từ.
// - Bỏ qua khác biệt hoa/thường và dấu câu.
// - Chấp nhận dạng viết tắt tương đương: "don't" = "do not" = "dont".
// - Căn chỉnh 2 câu bằng thuật toán khoảng cách chỉnh sửa (Levenshtein) theo từ,
//   để biết từ nào đúng, sai, thiếu, thừa.

const CONTRACTIONS = {
  "i'm": ['i', 'am'],
  "you're": ['you', 'are'],
  "we're": ['we', 'are'],
  "they're": ['they', 'are'],
  "he's": ['he', 'is'],
  "she's": ['she', 'is'],
  "it's": ['it', 'is'],
  "that's": ['that', 'is'],
  "what's": ['what', 'is'],
  "there's": ['there', 'is'],
  "here's": ['here', 'is'],
  "who's": ['who', 'is'],
  "where's": ['where', 'is'],
  "how's": ['how', 'is'],
  "let's": ['let', 'us'],
  "i've": ['i', 'have'],
  "you've": ['you', 'have'],
  "we've": ['we', 'have'],
  "they've": ['they', 'have'],
  "could've": ['could', 'have'],
  "should've": ['should', 'have'],
  "would've": ['would', 'have'],
  "might've": ['might', 'have'],
  "must've": ['must', 'have'],
  "i'll": ['i', 'will'],
  "you'll": ['you', 'will'],
  "he'll": ['he', 'will'],
  "she'll": ['she', 'will'],
  "it'll": ['it', 'will'],
  "we'll": ['we', 'will'],
  "they'll": ['they', 'will'],
  "that'll": ['that', 'will'],
  "there'll": ['there', 'will'],
  "i'd": ['i', 'would'],
  "you'd": ['you', 'would'],
  "he'd": ['he', 'would'],
  "she'd": ['she', 'would'],
  "we'd": ['we', 'would'],
  "they'd": ['they', 'would'],
  "it'd": ['it', 'would'],
  "isn't": ['is', 'not'],
  "aren't": ['are', 'not'],
  "wasn't": ['was', 'not'],
  "weren't": ['were', 'not'],
  "don't": ['do', 'not'],
  "doesn't": ['does', 'not'],
  "didn't": ['did', 'not'],
  "haven't": ['have', 'not'],
  "hasn't": ['has', 'not'],
  "hadn't": ['had', 'not'],
  "won't": ['will', 'not'],
  "wouldn't": ['would', 'not'],
  "can't": ['can', 'not'],
  cannot: ['can', 'not'],
  "couldn't": ['could', 'not'],
  "shouldn't": ['should', 'not'],
  "mustn't": ['must', 'not'],
  "needn't": ['need', 'not'],
}

// Dạng gõ thiếu dấu nháy (hay gặp trên điện thoại). Bỏ những dạng trùng với
// một từ thật, ví dụ "were" (we're), "well" (we'll), "its" (it's), "ill" (I'll).
const AMBIGUOUS_WITHOUT_APOSTROPHE = new Set([
  'were', 'well', 'hell', 'shell', 'wed', 'id', 'ill', 'its', 'lets', 'shed',
])
for (const [key, parts] of Object.entries(CONTRACTIONS)) {
  const bare = key.replace(/'/g, '')
  if (bare !== key && !AMBIGUOUS_WITHOUT_APOSTROPHE.has(bare) && !(bare in CONTRACTIONS)) {
    CONTRACTIONS[bare] = parts
  }
}

function cleanWord(raw) {
  return raw
    .replace(/[‘’ʼ`´]/g, "'")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

// Tách câu thành các "token" để so sánh.
// Mỗi token: { key: dạng chuẩn hóa để so sánh, display: chữ để hiển thị, src, srcText, parts }
export function tokenize(text) {
  const tokens = []
  const words = String(text ?? '')
    .split(/[\s–—/]+|(?<=\p{L})-(?=\p{L})/u)
    .filter(Boolean)

  words.forEach((raw, src) => {
    const word = cleanWord(raw)
    if (!word) return
    const srcText = raw.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '').replace(/[‘’]/g, "'")
    const expanded = CONTRACTIONS[word]
    if (expanded) {
      expanded.forEach((key) => tokens.push({ key, display: key, src, srcText, parts: expanded.length }))
    } else {
      const key = word.replace(/'/g, '')
      if (key) tokens.push({ key, display: srcText, src, srcText, parts: 1 })
    }
  })
  return tokens
}

// So sánh câu đúng (expected) với câu trả lời (actual).
// ops: danh sách thao tác theo thứ tự câu:
//   { type: 'match', expected, actual } – đúng
//   { type: 'wrong', expected, actual } – gõ sai từ
//   { type: 'missing', expected }       – thiếu từ
//   { type: 'extra', actual }           – thừa từ
export function gradeAnswer(expectedText, actualText) {
  const exp = tokenize(expectedText)
  const act = tokenize(actualText)
  const n = exp.length
  const m = act.length

  // dp[i][j] = chi phí nhỏ nhất để khớp exp[i..] với act[j..].
  // Sai 1 từ (3) rẻ hơn thiếu + thừa (2 + 2), nhưng khi hai cách căn ngang nhau
  // thì trọng số này ưu tiên cách khớp được nhiều từ đúng hơn.
  const SUB = 3
  const GAP = 2
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      if (i === n) dp[i][j] = (m - j) * GAP
      else if (j === m) dp[i][j] = (n - i) * GAP
      else {
        const same = exp[i].key === act[j].key
        dp[i][j] = Math.min(
          dp[i + 1][j + 1] + (same ? 0 : SUB),
          dp[i + 1][j] + GAP,
          dp[i][j + 1] + GAP,
        )
      }
    }
  }

  const ops = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m) {
      const same = exp[i].key === act[j].key
      if (same && dp[i][j] === dp[i + 1][j + 1]) {
        ops.push({ type: 'match', expected: exp[i], actual: act[j] })
        i++
        j++
        continue
      }
      if (!same && dp[i][j] === dp[i + 1][j + 1] + SUB) {
        ops.push({ type: 'wrong', expected: exp[i], actual: act[j] })
        i++
        j++
        continue
      }
    }
    if (i < n && dp[i][j] === dp[i + 1][j] + GAP) {
      ops.push({ type: 'missing', expected: exp[i] })
      i++
    } else {
      ops.push({ type: 'extra', actual: act[j] })
      j++
    }
  }

  const count = (type) => ops.filter((op) => op.type === type).length
  const correct = count('match')
  const wrong = count('wrong')
  const missing = count('missing')
  const extra = count('extra')
  const total = n
  const score = total === 0 ? 0 : correct / total

  return {
    ops,
    total,
    correct,
    wrong,
    missing,
    extra,
    score,
    perfect: total > 0 && correct === total && extra === 0,
  }
}

// Gộp các token của cùng một từ viết tắt (vd "don't" → do + not) để hiển thị lại
// đúng chữ gốc khi cả hai phần đều đúng.
export function groupOpsForDisplay(ops) {
  const out = []
  for (let k = 0; k < ops.length; k++) {
    const op = ops[k]
    const tok = op.expected
    if (op.type === 'match' && tok.parts > 1) {
      const group = ops.slice(k, k + tok.parts)
      const allMatch =
        group.length === tok.parts &&
        group.every((g) => g.type === 'match' && g.expected.src === tok.src)
      if (allMatch) {
        out.push({ type: 'match', text: tok.srcText })
        k += tok.parts - 1
        continue
      }
    }
    if (op.type === 'match') out.push({ type: 'match', text: op.expected.display })
    else if (op.type === 'wrong') out.push({ type: 'wrong', text: op.actual.display, correction: op.expected.display })
    else if (op.type === 'missing') out.push({ type: 'missing', text: op.expected.display })
    else out.push({ type: 'extra', text: op.actual.display })
  }
  return out
}

export function scoreMessage(result) {
  if (result.perfect) return 'Hoàn hảo! 🎉'
  if (result.score >= 0.8) return 'Rất tốt, chỉ còn một chút nữa thôi!'
  if (result.score >= 0.5) return 'Khá lắm! Nghe lại thêm một lần để bắt nốt các từ còn lại nhé.'
  return 'Câu này khó đấy. Không sao, nghe chậm lại và thử tiếp nhé 💪'
}
