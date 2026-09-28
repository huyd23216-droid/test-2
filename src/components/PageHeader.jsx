import { Link } from 'react-router-dom'
import Icon from './Icon.jsx'

export default function PageHeader({ title, back, backLabel = 'Quay lại', right, subtitle }) {
  return (
    <header className="page-header">
      {back && (
        <Link to={back} className="icon-btn" aria-label={backLabel}>
          <Icon name="back" />
        </Link>
      )}
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  )
}
