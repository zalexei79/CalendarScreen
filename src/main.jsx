import React from 'react'
import ReactDOM from 'react-dom/client'
import CalendarScreen from '../CalendarScreen.jsx'
// если в твоём старом main.jsx была строка import './index.css' — верни её сюда

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CalendarScreen />
  </React.StrictMode>
)
