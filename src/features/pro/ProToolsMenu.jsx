import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Wallet,ChartNoAxesCombined,ChartCandlestick,ChevronRight,Link2,Monitor,X} from 'lucide-react';
import {WorkspaceModeSelector} from './WorkspaceModePanel.jsx';
import LotCalculator from '../trading/LotCalculator.jsx';
import './ProToolsMenu.css';

const COPY={
 ru:{title:'Ваше пространство',tools:'Открыть инструменты',wallet:'Счета и баланс',capital:'Инвестиции',portfolio:'Портфель и доходность',trader:'Трейдер',trading:'Сделки и площадки',active:'Режим включён',platforms:'Площадки',connected:'Подключён',offline:'Не подключён',reconnect:'Нужен вход',pc:'Подключён на ПК',close:'Закрыть меню'},
 uk:{title:'Ваш простір',tools:'Відкрити інструменти',wallet:'Рахунки та баланс',capital:'Інвестиції',portfolio:'Портфель і дохідність',trader:'Трейдер',trading:'Угоди та платформи',active:'Режим увімкнено',platforms:'Платформи',connected:'Підключено',offline:'Не підключено',reconnect:'Потрібен вхід',pc:'Підключено на ПК',close:'Закрити меню'},
 en:{title:'Your space',tools:'Open tools',wallet:'Accounts and balance',capital:'Investments',portfolio:'Portfolio and returns',trader:'Trader',trading:'Trades and platforms',active:'Trading mode is on',platforms:'Platforms',connected:'Connected',offline:'Not connected',reconnect:'Sign in again',pc:'Connected on PC',close:'Close menu'},
 ro:{title:'Spațiul tău',tools:'Deschide instrumentele',wallet:'Conturi și sold',capital:'Investiții',portfolio:'Portofoliu și randament',trader:'Trader',trading:'Tranzacții și platforme',active:'Mod activ',platforms:'Platforme',connected:'Conectat',offline:'Neconectat',reconnect:'Autentificare necesară',pc:'Conectat pe PC',close:'Închide meniul'},
 zh:{title:'你的空间',tools:'打开工具',wallet:'账户与余额',capital:'投资',portfolio:'投资组合与收益',trader:'交易模式',trading:'交易与平台',active:'交易模式已开启',platforms:'交易平台',connected:'已连接',offline:'未连接',reconnect:'需要重新登录',pc:'已在电脑上连接',close:'关闭菜单'},
};

export default function ProToolsMenu({language,t,isLight,currency,traderMode,onTraderChange,onWallet,onCapital,onConnect,connected,reconnect,metatrader={},onOffer}){
 const locale=language==='md'?'ro':language?.startsWith('zh')?'zh':language;
 const copy=COPY[locale]||COPY.en;
 const id=useId(),trigger=useRef(null),panel=useRef(null),pending=useRef(null);
 const [open,setOpen]=useState(false);
 function cancelPending(){pending.current?.animation?.cancel();pending.current=null;panel.current?.removeAttribute('data-exiting');}
 function position(){
  if(!panel.current||!trigger.current)return;
  const box=trigger.current.getBoundingClientRect(),viewport=window.visualViewport;
  const width=Math.min(328,(viewport?.width||innerWidth)-24),left=Math.max(12,Math.min(box.right-width,(viewport?.width||innerWidth)-width-12));
  const top=box.bottom+8;
  Object.assign(panel.current.style,{left:left+'px',top:top+'px',width:width+'px',maxHeight:Math.max(100,(viewport?.height||innerHeight)+(viewport?.offsetTop||0)-top-12)+'px',transformOrigin:`${box.left+box.width/2-left}px -8px`});
 }
 function close(action,restoreFocus=true){
  const node=panel.current;
  if(pending.current)return;
  if(!node?.matches(':popover-open')){action?.();return;}
  const work={animation:null};pending.current=work;node.dataset.exiting='true';
  const finish=()=>{
   if(pending.current!==work)return;
   pending.current=null;node.hidePopover();work.animation?.cancel();node.removeAttribute('data-exiting');
   if(restoreFocus)trigger.current?.focus({preventScroll:true});action?.();
  };
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||!node.animate){finish();return;}
  const current=getComputedStyle(node);
  work.animation=node.animate([{opacity:current.opacity,transform:current.transform},{opacity:0,transform:'translateY(-5px) scale(.97)'}],{duration:150,easing:'cubic-bezier(.3,0,1,1)',fill:'forwards'});
  work.animation.finished.then(finish).catch(()=>{});
 }
 function toggle(){
  if(panel.current.matches(':popover-open')){close();return;}
  position();panel.current.showPopover();panel.current.querySelector('.pro-tools-destination')?.focus({preventScroll:true});
 }
 useEffect(()=>{
  const node=panel.current;
  const sync=()=>{const visible=node.matches(':popover-open');setOpen(visible);if(!visible)cancelPending();};
  const outside=event=>{
   if(node.matches(':popover-open')&&!node.contains(event.target)&&!trigger.current?.closest('.workspace-selector')?.contains(event.target))close(undefined,false);
  };
  const escape=event=>{if(event.key==='Escape'&&!event.defaultPrevented&&node.matches(':popover-open')){event.preventDefault();close();}};
  const scroll=event=>{if((!(event.target instanceof Node)||!node.contains(event.target))&&node.matches(':popover-open'))node.hidePopover();};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);
  node.addEventListener('toggle',sync);window.addEventListener('resize',position);window.visualViewport?.addEventListener('resize',position);window.addEventListener('scroll',scroll,true);
  return()=>{cancelPending();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);node.removeEventListener('toggle',sync);window.removeEventListener('resize',position);window.visualViewport?.removeEventListener('resize',position);window.removeEventListener('scroll',scroll,true);};
 },[]);
 const destinations=[{key:'wallet',Icon:Wallet,label:t('walletLabel'),hint:copy.wallet,action:onWallet},{key:'capital',Icon:ChartNoAxesCombined,label:copy.capital,hint:copy.portfolio,action:onCapital}];
 return <>
  <WorkspaceModeSelector proView language={language} t={t} onOffer={()=>close(onOffer)} onTools={toggle} toolsOpen={open} toolsId={id} toolsLabel={copy.tools} triggerRef={trigger} traderMode={traderMode}/>
  {createPortal(<div ref={panel} id={id} popover="manual" role="dialog" aria-labelledby={id+'-title'} className="pro-tools-popover" data-light={isLight} onKeyDown={event=>{if(event.key==='Escape'&&event.currentTarget.contains(event.target)&&event.currentTarget.matches(':popover-open')){event.preventDefault();event.stopPropagation();close();}}}>
   <header className="pro-tools-heading"><h2 id={id+'-title'}>{copy.title}</h2><button type="button" onClick={()=>close()} aria-label={copy.close}><X size={17}/></button></header>
   <div className="pro-tools-destinations">
    {destinations.filter(item=>item.action).map(({key,Icon,label,hint,action},index)=><button key={key} type="button" className="pro-tools-destination" data-destination={key} onClick={()=>close(action)} style={{'--tools-order':index}}><span className="pro-tools-icon"><Icon size={19}/></span><span className="pro-tools-copy"><strong>{label}</strong><small>{hint}</small></span><ChevronRight className="pro-tools-arrow" size={15}/></button>)}
    <button type="button" className="pro-tools-destination pro-tools-trader" role="switch" aria-checked={traderMode} aria-controls={id+'-platforms'} aria-label={t('traderModeLabel')} onClick={onTraderChange} style={{'--tools-order':2}}><span className="pro-tools-icon"><ChartCandlestick size={19}/></span><span className="pro-tools-copy"><strong>{copy.trader}</strong><small>{traderMode?copy.active:copy.trading}</small></span><span className="pro-tools-switch" aria-hidden="true"><i/></span></button>
   </div>
   <div id={id+'-platforms'} className="pro-tools-platforms" data-open={traderMode} inert={traderMode?undefined:''} aria-hidden={!traderMode}><div className="pro-tools-platform-clip"><div className="pro-tools-platform-content">
    <p>{copy.platforms}</p>
    {[['ctrader','cTrader',Link2,connected&&!reconnect],['mt5','MetaTrader 5',Monitor,metatrader?.connected]].map(([key,label,Icon,ready])=><button key={key} type="button" className="pro-tools-platform" disabled={!traderMode} onClick={()=>close(()=>onConnect(key))}><Icon size={18}/><span><strong>{label}</strong><small>{key==='ctrader'&&reconnect?copy.reconnect:ready?key==='mt5'?copy.pc:copy.connected:copy.offline}</small></span><i data-connected={Boolean(ready)}/></button>)}
    <LotCalculator enabled={traderMode} language={language} isLight={isLight} currency={currency} onRequestOpen={close} returnFocusRef={trigger}/>
   </div></div></div>
  </div>,document.body)}
 </>;
}
