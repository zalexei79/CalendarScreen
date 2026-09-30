// Synthetic layout fixture. No accounts, OAuth, Supabase or broker requests.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import WorkspaceModePanel from '../src/features/pro/WorkspaceModePanel';
import { translate } from '../src/shared/i18n';
import Header from '../Header';
import CalendarGrid from '../CalendarGrid';
import MonthlyGoal from '../MonthlyGoal';
function Fixture() {
  const [pro,setPro]=useState(false), [trader,setTrader]=useState(false), [light,setLight]=useState(false);
  const [language,setLanguage]=useState('ru'), [action,setAction]=useState('');
  const [access,setAccess]=useState(false), [loading,setLoading]=useState(false);
  return <main style={{padding:12,fontFamily:'system-ui',color:light?'#222325':'#f3f0e9',background:light?'#f8f7f3':'#090a0c',minHeight:'100vh',boxSizing:'border-box'}}>
    <style>{'body{margin:0}button{font-family:inherit}#stage{width:100%}#marker{margin-top:16px;height:120px;border-top:1px solid #7773;padding-top:12px;font-size:12px;color:#888}#qa{margin-top:24px;display:flex;gap:8px;flex-wrap:wrap}'}</style>
    <div id="stage"><WorkspaceModePanel walletAccess={access} walletLoading={loading} proView={pro} onModeChange={()=>setPro(!pro)} traderMode={trader} onTraderChange={()=>setTrader(!trader)} isLight={light} language={language} t={key=>translate(language,key)} connected metatrader={{connected:false}} onWallet={()=>setAction('wallet')} onConnect={setAction} onOffer={()=>setAction('offer')}/></div>
    <div id="marker">Calendar follows here · isolated QA fixture</div>
    <div id="qa"><button id="free" onClick={()=>setPro(false)}>FREE</button><button id="idle" onClick={()=>{setPro(true);setTrader(false);}}>PRO idle</button><button id="trader" onClick={()=>{setPro(true);setTrader(true);}}>PRO Trader</button><button id="theme" onClick={()=>setLight(!light)}>Theme</button><select id="language" value={language} onChange={e=>setLanguage(e.target.value)}>{['ru','en','md'].map(code=><option key={code}>{code}</option>)}</select></div>
    <button id="access" onClick={()=>setAccess(!access)}>Toggle entitlement</button><button id="loading" onClick={()=>setLoading(!loading)}>Toggle access loading</button>
    <output id="action">{action}</output>
  </main>;
}
function HeaderFixture() {
  const params=new URLSearchParams(location.search), preview=params.has('preview');
  const language=params.get('language') || 'ru';
  const [access,setAccess]=useState(preview), [loading,setLoading]=useState(false);
  const [pro,setPro]=useState(preview && params.get('mode')!=='free'), [account,setAccount]=useState('main'), [offer,setOffer]=useState(false);
  const [trader,setTrader]=useState(preview && params.get('mode')==='trader'), [light,setLight]=useState(params.has('light'));
  const [selected,setSelected]=useState(null);
  const cells=Array.from({length:35},(_,i)=>{const date=new Date(2026,7,31+i);return {date,key:String(i),inMonth:date.getMonth()===8,isToday:i===30};});
  // Deterministic synthetic calendar for layout QA only; never user account data.
  const pnl=key=>Number(key)%7>4 ? 0 : [125,-82,43,-106,68][Number(key)%5];
  // Mirror CalendarScreen's real wallet access effect, not just the CTA callback.
  useEffect(()=>{if ((!loading && !access) || !pro) setAccount('main');},[access,loading,pro,account]);
  return <div className={preview ? `premium-shell min-h-screen flex flex-col ${pro?'pro-active-shell':''} ${light?'theme-light bg-zinc-100 text-zinc-900':'bg-zinc-950 text-zinc-100'}` : ''}>
    <Header t={key=>translate(language,key)} language={language} month={8} year={2026} today={new Date(2026,8,30)}
      isPwaInstalled proAccessActive={access} proAccessLoading={loading} proView={pro} setProView={setPro}
      accountMode={account} setAccountMode={setAccount} openProPresentation={()=>setOffer(true)}
      traderMode={trader} setTraderMode={setTrader} setPlatformFilter={()=>{}} openConnectModal={()=>{}}
      ctraderConnected isLight={light} theme={light?'light':'dark'} setTheme={value=>setLight(value==='light')}
      periodStats={{}} currency="USD" formatMoney={String}/>
    {preview && <>
      <div className="px-3 sm:px-5"><MonthlyGoal year={2026} month={8} currency="USD" currencySymbol="$" currentPnl={cells.reduce((sum,cell)=>sum+pnl(cell.key),0)} language={language} isLight={light}/></div>
      <CalendarGrid cells={cells} selectedKey={selected} onSelectDay={setSelected} isLight={light} proView={pro} traderMode={trader} language={language}
        monthMaxAbsPnl={125} tradesForDayFiltered={key=>pnl(key)?[{}]:[]} totalPnlForDay={pnl}
        formatPnlDisplay={value=>`${value>=0?'+':'−'}$${Math.abs(value)}`} onEmptyClick={()=>setSelected(null)}/>
    </>}
    <div style={preview?{display:'none'}:{}}>
    <button id="access" onClick={()=>setAccess(!access)}>Entitlement</button>
    <button id="loading" onClick={()=>setLoading(!loading)}>Loading</button>
    <output id="state">{`${account}/${pro}/${offer}`}</output>
    </div>
  </div>;
}
createRoot(document.getElementById('root')).render(location.pathname==='/header' ? <HeaderFixture/> : <Fixture/>);
