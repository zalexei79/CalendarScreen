import React from 'react'
import ReactDOM from 'react-dom/client'
import CalendarScreen from '../CalendarScreen.jsx'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      await registration.update()
    } catch (err) {
      console.error('[sw] регистрация не удалась:', err)
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <CalendarScreen />
    </AppErrorBoundary>
  </React.StrictMode>
)
