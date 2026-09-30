// Isolated fixture: synthetic data only; no Supabase, OAuth or broker requests.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ProWorkspaceActions from '../src/features/pro/ProWorkspaceActions';
import ProOffer from '../src/features/pro/ProOffer';
import PlatformConnections, { PlatformHistoryActions } from '../src/features/platforms/PlatformConnections';
import CtraderControl from '../src/features/ctrader/CtraderControl';
import { translate } from '../src/shared/i18n';
function Fixture() {
  const [trader, setTrader] = useState(true), [platform, setPlatform] = useState('choose');
  const [connected, setConnected] = useState(true), [lastSync, setLastSync] = useState(null);
  const [light, setLight] = useState(false);
  const accounts = [{id:'fixture', account_id:'42',broker_name:'Fixture broker', is_live:false,balance:100,currency:'USD'}];
  return <main><button id="theme" onClick={() => setLight(!light)}>Theme</button>
    <ProWorkspaceActions visible isLight={light} language="ru" t={key => translate('ru',key)} traderMode={trader} onTraderChange={()=>setTrader(!trader)} onWallet={()=>{}} onConnect={setPlatform} connected={connected} metatrader={{connected:false}} onOffer={()=>{}} />
    <div data-testid="history"><PlatformHistoryActions language="ru" isLight={light} onOpen={setPlatform}/></div>
    <section data-testid="platform-menu">
    {platform === 'choose' ? <PlatformConnections language="ru" isLight={light} ctrader={{connected,count:1,lastSync}} metatrader={{connected:false,count:0}} onOpen={setPlatform}/> : platform === 'ctrader' ? <CtraderControl language="ru" t={key=>translate('ru',key)} isLight={light} connected={connected} accounts={accounts} accountId="fixture" importedCount={1} lastSync={lastSync} onSelect={async()=>true} onConnect={()=>setConnected(true)} onSync={()=>setLastSync({at:Date.now(),added:0})} onDisconnect={async()=>{setConnected(false);return true;}} /> : <h2>MetaTrader 5 — отдельное меню</h2>}
    </section>
    <section className={`pro-dialog ${light ? 'pro-light' : ''}`}><ProOffer language="ru" active signedIn copy={{buyPrice:'—',buyPeriod:'',invitesTab:'Приглашения'}} onInvite={()=>{}} onCheckout={()=>{}} onInvites={()=>{}} onWallet={()=>{}} onPlatforms={()=>setPlatform('choose')}/></section>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
