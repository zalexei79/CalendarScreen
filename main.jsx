import React from 'react'
import ReactDOM from 'react-dom/client'
import CalendarScreen from '../CalendarScreen.jsx'
import { translate } from './src/shared/i18n'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[DAYRIS] Render error:', error, info)
  }

  render() {
    const t = key => translate(window.localStorage.getItem('atj_language') || navigator.language, key)
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-zinc-900 p-6 text-center shadow-2xl">
            <div className="text-amber-400 text-xs font-semibold tracking-widest uppercase mb-2">DAYRIS</div>
            <h1 className="text-xl font-semibold mb-2">{t('appErrorTitle')}</h1>
            <p className="text-sm text-zinc-400 mb-5">{t('appErrorBody')}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950"
            >
              {t('reload')}
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
