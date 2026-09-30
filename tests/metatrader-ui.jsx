// Isolated UI fixture. No real credentials, broker or Supabase calls.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MetaTraderControl from '../src/features/metatrader/MetaTraderControl.jsx';
function Fixture() {
  const [owner, setOwner] = useState('user-a');
  const [enabled, setEnabled] = useState(true);
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState({});
  const [light, setLight] = useState(false);
  const [connection, setConnection] = useState({});
  const trades = all[owner] || {};
  return <>
    <button id="open" onClick={() => setOpen(true)}>Open</button>
    <button id="owner" onClick={() => setOwner(value => value === 'user-a' ? 'user-b' : 'user-a')}>Switch owner</button>
    <button id="pro" onClick={() => setEnabled(value => !value)}>Toggle PRO</button>
    <button id="light" onClick={() => setLight(value => !value)}>Theme</button>
    <p id="saved">{Object.values(trades).flat().length}</p>
    <output id="connection">{JSON.stringify(connection)}</output>
    <MetaTraderControl onConnectionChange={setConnection} userId={owner} enabled={enabled} trades={trades} visible={open} language="ru" isLight={light} onClose={() => setOpen(false)} saveTrade={async row => {
      setAll(current => ({ ...current, [owner]: { ...(current[owner] || {}), [row.dateKey]: [...(current[owner]?.[row.dateKey] || []), { ...row, pnl: row.signedPnl }] } }));
    }} />
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
