import { supabase } from './supabaseClient'
import { translate } from './shared/i18n'

export default function Login() {
  const language = window.localStorage.getItem('atj_language') || navigator.language;
  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

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
        <button
          onClick={handleGoogleLogin}
          style={{
            padding: '12px 28px',
            borderRadius: 8,
            background: '#fbbf24',
            color: '#09090b',
            fontWeight: 600,
            fontSize: 14,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {translate(language, 'signIn')}
        </button>
      </div>
    </div>
  )
}
