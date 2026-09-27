// Visual fixture. No Supabase, purchases or changes to stored accounts.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ProWorkspaceActions from '../src/features/pro/ProWorkspaceActions';
import { translate } from '../src/shared/i18n';

function Preview() {
  const [visible, setVisible] = useState(true);
  const [trader, setTrader] = useState(false);
  const [language, setLanguage] = useState('ru');
  const [light, setLight] = useState(false);
  const [action, setAction] = useState('');
  return <main style={{ minHeight: '100vh', padding: 16, boxSizing: 'border-box', background: light ? '#faf9f6' : '#101112', color: light ? '#222' : '#ddd', fontFamily: 'sans-serif' }}>
    <style>{'body { margin: 0; } button { cursor: pointer; }'}</style>
    <p>Local preview · no account or payment actions</p>
    <label>Language <select value={language} onChange={e => setLanguage(e.target.value)}>{['ru', 'en', 'md'].map(code => <option key={code}>{code}</option>)}</select></label>
    <label style={{ marginLeft: 12 }}><input type="checkbox" checked={light} onChange={e => setLight(e.target.checked)} />Light</label>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', marginTop: 24 }}>
      <button type="button" role="switch" aria-checked={visible} onClick={() => setVisible(v => !v)} style={{ flexShrink: 0, borderRadius: 999, padding: '10px 14px' }}>PRO</button>
      <ProWorkspaceActions visible={visible} isLight={light} language={language} t={key => translate(language, key)} traderMode={trader} onTraderChange={() => setTrader(v => !v)} onWallet={() => setAction('Wallet')} onConnect={() => setAction('cTrader')} connected={true} onOffer={() => setAction('PRO offer')} />
    </div>
    <p role="status">{action}</p>
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
