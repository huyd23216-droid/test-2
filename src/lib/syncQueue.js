// Hàng đợi đồng bộ: mọi thay đổi được ghi vào đây trước (lưu trên máy bằng
// IndexedDB), rồi gửi lần lượt lên Supabase. Mất mạng thì giữ lại và tự gửi
// tiếp khi có mạng. Các thay đổi cùng `key` (vd chấm nhiều lần 1 thẻ) được gộp.
//
// Một thao tác (op):
//   { table, action: 'upsert' | 'update' | 'delete', values?, match?, inFilter?,
//     onConflict?, ignoreDuplicates?, key? }
import { supabase } from './supabase.js'
import { idbGet, idbSet } from './idb.js'
import { uuid } from './ids.js'

export function isNetworkError(err) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (!err) return false
  if (err.status === 0) return true
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(err.message ?? '')
}

// Lỗi tạm thời → thử lại sau. Lỗi khác (vd dữ liệu không hợp lệ) → bỏ thao tác.
function isRetryable(status, error) {
  if (status === 0 || status === 408 || status === 429 || status >= 500) return true
  if (isNetworkError(error)) return true
  const code = error?.code ?? ''
  return (status === 401 || status === 403) && /PGRST30|JWT/i.test(`${code} ${error?.message ?? ''}`)
}

async function execute(op) {
  const q = supabase.from(op.table)
  let res
  try {
    if (op.action === 'upsert') {
      res = await q.upsert(op.values, {
        onConflict: op.onConflict,
        ignoreDuplicates: Boolean(op.ignoreDuplicates),
      })
    } else if (op.action === 'update') {
      res = await q.update(op.values).match(op.match)
    } else if (op.action === 'delete') {
      // inFilter: xóa nhiều dòng một lần, vd { column: 'id', values: [...] }
      res = op.inFilter ? await q.delete().in(op.inFilter.column, op.inFilter.values) : await q.delete().match(op.match)
    } else {
      return { ok: false, retry: false, error: new Error(`Thao tác lạ: ${op.action}`) }
    }
  } catch (err) {
    return { ok: false, retry: isNetworkError(err), error: err }
  }
  if (!res.error) return { ok: true }
  return { ok: false, retry: isRetryable(res.status, res.error), error: res.error }
}

export function createSyncQueue(userId, { onChange, onDrop } = {}) {
  const storageKey = `queue:${userId}`
  let ops = []
  let inFlight = null
  let running = null
  let retryTimer = null
  let retryDelay = 3000

  const notify = () => onChange?.(ops.length)
  const persist = () => idbSet(storageKey, ops)

  function scheduleRetry() {
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => flush(), retryDelay)
    retryDelay = Math.min(retryDelay * 2, 60_000)
  }

  // Đọc hàng đợi đã lưu ngay khi tạo; mọi thao tác khác chờ bước này xong
  let isReady = false
  const ready = idbGet(storageKey)
    .then(
      (saved) => {
        if (Array.isArray(saved)) ops = [...saved, ...ops]
        notify()
      },
      () => {},
    )
    .finally(() => {
      isReady = true
    })

  function add(op) {
    const existing =
      op.key && op.action !== 'delete'
        ? ops.find((o) => o.key === op.key && o.action === op.action && o !== inFlight)
        : null
    if (existing) existing.values = { ...existing.values, ...op.values }
    else ops.push({ ...op, qid: uuid() })
    // Gửi ngay (kịp cả khi trang sắp đóng), ghi xuống máy song song
    const saved = persist()
    notify()
    flush()
    return saved
  }

  async function run() {
    if (!isReady) await ready
    while (ops.length > 0) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
      const op = ops[0]
      inFlight = op
      const result = await execute(op)
      inFlight = null
      if (!result.ok && result.retry) {
        scheduleRetry()
        return false
      }
      if (!result.ok) {
        console.error('Bỏ thao tác không lưu được', op, result.error)
        onDrop?.(op, result.error)
      }
      ops.shift()
      retryDelay = 3000
      await persist()
      notify()
    }
    return true
  }

  // Gửi hết hàng đợi. Trả về true nếu đã gửi xong.
  function flush() {
    if (!running) {
      running = run().finally(() => {
        running = null
      })
    }
    return running
  }

  return {
    ready,
    size: () => ops.length,
    flush,
    enqueue(op) {
      return isReady ? add(op) : ready.then(() => add(op))
    },
    dispose() {
      clearTimeout(retryTimer)
    },
  }
}
