// Local fixture only. No Supabase client, OAuth or external account operations.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CtraderControl from '../src/features/ctrader/CtraderControl';
import { translate } from '../src/shared/i18n';

function Preview() {
  const [connected, setConnected] = useState(true);
  const [accountId, setAccountId] = useState('demo');
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('Local fixture: history = 3 trades, PnL = 25 EUR');
  const accounts = [{ id: 'demo', broker_name: 'Example broker', account_id: '1234567890', is_live: false }, { id: 'live', broker_name: 'Example broker with a long name', account_id: '9876543210987654321', is_live: true }];
  return <main className="min-h-screen bg-zinc-200 p-0 sm:p-6">
    <h1 className="p-3 font-semibold">cTrader — local fixture, no real requests</h1><p role="status" className="p-3">{message}</p>
    <div className="flex flex-wrap gap-6">{[true, false].map(isLight => <div key={String(isLight)} data-testid={isLight ? 'light-card' : 'dark-card'} className={`w-[390px] max-w-full rounded-3xl border p-5 ${isLight ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
      <CtraderControl isLight={isLight} t={key => translate('ru', key)} connected={connected} loading={false} syncing={syncing} accounts={connected ? accounts : []} accountId={connected ? accountId : ''}
        onConnect={() => { setConnected(true); setMessage('Connected (fixture)'); }}
        onSelect={async id => { setAccountId(id); setMessage(`Selected ${id}; history unchanged`); return true; }}
        onSync={async () => { setSyncing(true); setMessage('Syncing (fixture)'); await new Promise(resolve => setTimeout(resolve, 500)); setSyncing(false); setMessage('0 new trades; history = 3 trades, PnL = 25 EUR'); }}
        onDisconnect={async () => { setConnected(false); setMessage('Disconnected; history = 3 trades, PnL = 25 EUR'); return true; }} />
    </div>)}</div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
