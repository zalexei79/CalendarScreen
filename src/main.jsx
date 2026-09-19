import React from 'react'
import ReactDOM from 'react-dom/client'
import CalendarScreen from '../CalendarScreen.jsx'
import InstallPage from './InstallPage.jsx'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[AI Trade Journal] Render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-zinc-900 p-6 text-center shadow-2xl">
            <div className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-2">AI Trade Journal</div>
            <h1 className="text-xl font-semibold mb-2">Не удалось открыть этот экран</h1>
            <p className="text-sm text-zinc-400 mb-5">Данные приложения сохранены. Попробуйте обновить страницу.</p>
            {this.state.error?.message && (
              <p className="text-xs font-data text-red-400 bg-red-950/40 p-2.5 rounded-lg mb-4 text-left overflow-auto max-h-32 whitespace-pre-wrap break-all">
                {String(this.state.error.message)}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950"
            >
              Обновить
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Capture the Android/Chromium PWA install prompt as early as possible so the
// dedicated install screen can trigger the native dialog later on a user tap.
window.__atjInstallPrompt = window.__atjInstallPrompt || null
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__atjInstallPrompt = event
  window.dispatchEvent(new Event('atj-install-ready'))
})
window.addEventListener('appinstalled', () => {
  window.__atjInstallPrompt = null
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch((err) => console.error('[sw] регистрация не удалась:', err))
  })
}

const params = new URLSearchParams(window.location.search)
const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
const showInstallPage = params.get('install') === '1' || normalizedPath === '/install'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      {showInstallPage ? <InstallPage /> : <CalendarScreen />}
    </AppErrorBoundary>
  </React.StrictMode>
)
