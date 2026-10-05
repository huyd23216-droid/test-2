import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Icon from './Icon.jsx'
import SyncBanner from './SyncBanner.jsx'

const NAV = [
  { to: '/', label: 'Trang chủ', icon: 'home', match: (p) => p === '/' },
  { to: '/vocab', label: 'Từ vựng', icon: 'cards', match: (p) => p.startsWith('/vocab') },
  {
    to: '/listen',
    label: 'Luyện nghe',
    icon: 'headphones',
    match: (p) => ['/listen', '/connected', '/dictation'].some((x) => p.startsWith(x)),
  },
  { to: '/homework', label: 'Bài tập', icon: 'task', match: (p) => p.startsWith('/homework') },
  { to: '/stats', label: 'Tiến độ', icon: 'chart', match: (p) => p.startsWith('/stats') },
  { to: '/settings', label: 'Cài đặt', icon: 'settings', match: (p) => p.startsWith('/settings') },
]

// focus = màn hình luyện tập: ẩn thanh điều hướng để tập trung và có thêm chỗ
export default function Layout({ focus = false }) {
  const { pathname } = useLocation()
  return (
    <div className={`app ${focus ? 'app-focus' : ''}`}>
      <main className="main">
        <SyncBanner />
        <Outlet />
      </main>
      {!focus && (
        <nav className="bottom-nav" aria-label="Điều hướng chính">
          {NAV.map((item) => {
            const active = item.match(pathname)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={() => `nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon name={item.icon} size={22} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      )}
    </div>
  )
}
