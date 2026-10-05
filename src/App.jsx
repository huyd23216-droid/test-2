import { useEffect } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Loading from './components/Loading.jsx'
import PageHeader from './components/PageHeader.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { DataProvider, MigrationMissingError, useData } from './context/DataContext.jsx'
import { StudyTrackerProvider } from './context/StudyTracker.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { isSupabaseConfigured } from './lib/supabase.js'
import { setDefaultAccent } from './lib/tts.js'
import LoginPage from './pages/LoginPage.jsx'
import HomePage from './pages/HomePage.jsx'
import SessionPage from './pages/SessionPage.jsx'
import VocabPage from './pages/VocabPage.jsx'
import VocabReviewPage from './pages/VocabReviewPage.jsx'
import CardEditPage from './pages/CardEditPage.jsx'
import ImportPage from './pages/ImportPage.jsx'
import SetsPage from './pages/SetsPage.jsx'
import ConnectedSpeechPage from './pages/ConnectedSpeechPage.jsx'
import ConnectedPracticePage from './pages/ConnectedPracticePage.jsx'
import DictationPage from './pages/DictationPage.jsx'
import DictationPracticePage from './pages/DictationPracticePage.jsx'
import ClipEditPage from './pages/ClipEditPage.jsx'
import ClipPracticePage from './pages/ClipPracticePage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import ListenHubPage from './pages/ListenHubPage.jsx'
import GapFillPage from './pages/GapFillPage.jsx'
import DrillsPage from './pages/DrillsPage.jsx'
import DrillPracticePage from './pages/DrillPracticePage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import HomeworkPage from './pages/HomeworkPage.jsx'
import HomeworkRunPage from './pages/HomeworkRunPage.jsx'

function ConfigMissing() {
  return (
    <div className="login">
      <div className="login-card">
        <h1>Chưa cấu hình Supabase</h1>
        <p>
          Tạo file <code>.env.local</code> (xem <code>.env.example</code>) với <code>VITE_SUPABASE_URL</code> và{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, rồi chạy lại <code>npm run dev</code>.
        </p>
        <p className="hint">Khi deploy lên Vercel, thêm 2 biến này trong Settings → Environment Variables rồi deploy lại.</p>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="page">
      <PageHeader title="Không tìm thấy trang" back="/" />
      <p className="hint">Trang này không tồn tại.</p>
      <Link to="/" className="btn btn-primary btn-block">
        Về trang chủ
      </Link>
    </div>
  )
}

function AppRoutes() {
  const { status, error, reload, settings } = useData()
  const accent = settings?.accent
  useEffect(() => setDefaultAccent(accent), [accent])

  if (status === 'loading') return <Loading full text="Đang tải dữ liệu của bạn…" />
  if (status === 'seeding') return <Loading full text="Đang chuẩn bị bộ từ vựng cho bạn…" />
  if (status === 'error' && error instanceof MigrationMissingError) {
    return (
      <div className="login">
        <div className="login-card">
          <h1>Cần cập nhật cơ sở dữ liệu</h1>
          <p>
            Phiên bản này có tính năng mới. Bạn mở Supabase → <strong>SQL Editor</strong>, dán toàn bộ file{' '}
            <code>supabase/migrations/20260929000000_extensions.sql</code> rồi bấm <strong>Run</strong>.
          </p>
          <p className="hint">Dữ liệu cũ của bạn được giữ nguyên.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => reload()}>
            Mình chạy xong rồi, thử lại
          </button>
        </div>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="login">
        <div className="login-card">
          <h1>Chưa tải được dữ liệu</h1>
          <p className="muted">Bạn kiểm tra kết nối mạng rồi thử lại nhé.</p>
          <button type="button" className="btn btn-primary btn-block" onClick={() => reload()}>
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <StudyTrackerProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="vocab" element={<VocabPage />} />
          <Route path="vocab/new" element={<CardEditPage />} />
          <Route path="vocab/import" element={<ImportPage />} />
          <Route path="vocab/sets" element={<SetsPage />} />
          <Route path="vocab/:id" element={<CardEditPage />} />
          <Route path="connected" element={<ConnectedSpeechPage />} />
          <Route path="dictation" element={<DictationPage />} />
          <Route path="dictation/clips/new" element={<ClipEditPage />} />
          <Route path="dictation/clips/:id/edit" element={<ClipEditPage />} />
          <Route path="listen" element={<ListenHubPage />} />
          <Route path="listen/drills" element={<DrillsPage />} />
          <Route path="homework" element={<HomeworkPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<Layout focus />}>
          <Route path="session" element={<SessionPage />} />
          <Route path="vocab/review" element={<VocabReviewPage />} />
          <Route path="connected/practice" element={<ConnectedPracticePage />} />
          <Route path="dictation/practice" element={<DictationPracticePage />} />
          <Route path="dictation/clips/:id" element={<ClipPracticePage />} />
          <Route path="listen/gapfill" element={<GapFillPage />} />
          <Route path="listen/drills/:id" element={<DrillPracticePage />} />
          <Route path="homework/run" element={<HomeworkRunPage />} />
        </Route>
      </Routes>
    </StudyTrackerProvider>
  )
}

function Gate() {
  const { loading, user } = useAuth()
  if (loading) return <Loading full />
  if (!user) return <LoginPage />
  return (
    <DataProvider key={user.id}>
      <AppRoutes />
    </DataProvider>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissing />
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}
