import React from 'react'
import ReactDOM from 'react-dom/client'
import CalendarScreen from '../CalendarScreen.jsx'
// если в твоём старом main.jsx была строка import './index.css' — верни её сюда

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch((err) => console.error('[sw] регистрация не удалась:', err))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CalendarScreen />
  </React.StrictMode>
)
