import React from 'react'
import { useAuth } from './features/auth/hooks/useAuth'
import LoginButtons from './features/auth/LoginButtons'
import { translate } from './shared/i18n'

export default function Login() {
  const language = window.localStorage.getItem('atj_language') || navigator.language;
  const auth = useAuth();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#09090b',
        color: '#f4f4f5',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#fbbf24', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
          DAYRIS
        </p>
        <LoginButtons t={(key) => translate(language, key)} {...auth} />
      </div>
    </div>
  )
}
