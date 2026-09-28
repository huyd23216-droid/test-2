import { NavLink, Outlet } from 'react-router-dom'
import Icon from './Icon.jsx'
import SyncBanner from './SyncBanner.jsx'

const NAV = [
  { to: '/', label: 'Trang chủ', icon: 'home', end: true },
  { to: '/vocab', label: 'Từ vựng', icon: 'cards' },
  { to: '/connected', label: 'Nối âm', icon: 'wave' },
  { to: '/dictation', label: 'Chính tả', icon: 'pen' },
  { to: '/settings', label: 'Cài đặt', icon: 'settings' },
]

// focus = màn hình luyện tập: ẩn thanh điều hướng để tập trung và có thêm chỗ
export default function Layout({ focus = false }) {
  return (
    <div className={`app ${focus ? 'app-focus' : ''}`}>
      <main className="main">
        <SyncBanner />
        <Outlet />
      </main>
      {!focus && (
        <nav className="bottom-nav" aria-label="Điều hướng chính">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-item">
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
