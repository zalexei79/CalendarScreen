import React from 'react'
import ReactDOM from 'react-dom/client'
import CalendarScreen from '../CalendarScreen.jsx'
// если в твоём старом main.jsx была строка import './index.css' — верни её сюда

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[app] render error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-zinc-950 px-5 py-10 text-zinc-100 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 text-center shadow-2xl">
          <div className="text-lg font-semibold">Не удалось открыть экран</div>
          <p className="mt-2 text-sm text-zinc-400">
            В одной из записей истории обнаружены некорректные данные. Перезагрузи приложение — данные не удаляются.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-2xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950"
          >
            Перезагрузить
          </button>
        </div>
      </div>
    )
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch((err) => console.error('[sw] регистрация не удалась:', err))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <CalendarScreen />
    </AppErrorBoundary>
  </React.StrictMode>
)
