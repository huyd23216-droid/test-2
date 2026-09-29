// Kho key-value nhỏ trên IndexedDB (lưu hàng đợi đồng bộ và bản sao dữ liệu
// để dùng khi offline). Nếu trình duyệt không cho dùng IndexedDB thì lưu tạm
// trong bộ nhớ (mất khi tải lại trang).
const DB_NAME = 'tieng-anh-moi-ngay'
const STORE = 'kv'
const memory = new Map()
let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function run(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export async function idbGet(key) {
  const db = await openDb()
  if (!db) return memory.get(key)
  try {
    return await run('readonly', (store) => store.get(key))
  } catch {
    return memory.get(key)
  }
}

export async function idbSet(key, value) {
  const db = await openDb()
  if (!db) return void memory.set(key, value)
  try {
    await run('readwrite', (store) => store.put(value, key))
  } catch {
    memory.set(key, value)
  }
}

export async function idbDel(key) {
  memory.delete(key)
  const db = await openDb()
  if (!db) return
  try {
    await run('readwrite', (store) => store.delete(key))
  } catch {
    // bỏ qua
  }
}
