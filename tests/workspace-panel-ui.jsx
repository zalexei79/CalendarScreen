// Synthetic layout fixture. No accounts, OAuth, Supabase or broker requests.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import WorkspaceModePanel from '../src/features/pro/WorkspaceModePanel';
import { translate } from '../src/shared/i18n';
function Fixture() {
  const [pro,setPro]=useState(false), [trader,setTrader]=useState(false), [light,setLight]=useState(false);
  const [language,setLanguage]=useState('ru'), [action,setAction]=useState('');
  return <main style={{padding:12,fontFamily:'system-ui',color:light?'#222325':'#f3f0e9',background:light?'#f8f7f3':'#090a0c',minHeight:'100vh',boxSizing:'border-box'}}>
    <style>{'body{margin:0}button{font-family:inherit}#stage{max-width:440px}#marker{margin-top:16px;height:120px;border-top:1px solid #7773;padding-top:12px;font-size:12px;color:#888}#qa{margin-top:24px;display:flex;gap:8px;flex-wrap:wrap}'}</style>
    <div id="stage"><WorkspaceModePanel proView={pro} onModeChange={()=>setPro(!pro)} traderMode={trader} onTraderChange={()=>setTrader(!trader)} isLight={light} language={language} t={key=>translate(language,key)} connected metatrader={{connected:false}} onWallet={()=>setAction('wallet')} onConnect={setAction} onOffer={()=>setAction('offer')}/></div>
    <div id="marker">Calendar follows here · isolated QA fixture</div>
    <div id="qa"><button id="free" onClick={()=>setPro(false)}>FREE</button><button id="idle" onClick={()=>{setPro(true);setTrader(false);}}>PRO idle</button><button id="trader" onClick={()=>{setPro(true);setTrader(true);}}>PRO Trader</button><button id="theme" onClick={()=>setLight(!light)}>Theme</button><select id="language" value={language} onChange={e=>setLanguage(e.target.value)}>{['ru','en','md'].map(code=><option key={code}>{code}</option>)}</select></div>
    <output id="action">{action}</output>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
