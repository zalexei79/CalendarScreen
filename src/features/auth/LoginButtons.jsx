import { LogIn, Send } from 'lucide-react';

export default function LoginButtons({ t, handleGoogleLogin, handleTelegramLogin, loginPending, loginError }) {
  return (
    <div className="flex w-full flex-col gap-2">
      <button type="button" onClick={handleGoogleLogin} disabled={Boolean(loginPending)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-400/20 transition-colors disabled:opacity-50 disabled:cursor-wait">
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
        {t(loginPending === 'google' ? 'authConnecting' : 'signIn')}
      </button>
      <button type="button" onClick={handleTelegramLogin} disabled={Boolean(loginPending)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-500 hover:bg-sky-400/20 transition-colors disabled:opacity-50 disabled:cursor-wait">
        <Send className="h-3.5 w-3.5" aria-hidden="true" />
        {t(loginPending === 'custom:telegram' ? 'authConnecting' : 'signInTelegram')}
      </button>
      {loginError && <p role="alert" className="text-xs text-red-500">{loginError}</p>}
    </div>
  );
}
