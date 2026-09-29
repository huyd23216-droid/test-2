export default function Loading({ text = 'Đang tải…', full = false }) {
  return (
    <div className={`loading ${full ? 'loading-full' : ''}`} role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  )
}
