import Icon from './Icon.jsx'
import { youglishUrl } from '../lib/youglish.js'

export default function YouGlishButton({ query, compact = false }) {
  if (!query) return null
  return (
    <a
      className={`btn btn-ghost btn-youglish ${compact ? 'btn-sm' : ''}`}
      href={youglishUrl(query)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      <Icon name="video" size={18} />
      <span>Nghe người thật nói</span>
    </a>
  )
}
