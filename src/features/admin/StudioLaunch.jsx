import React,{useEffect,useRef,useState} from 'react';
import {ExternalLink,FolderOpen,Terminal,Copy,CheckCircle2} from 'lucide-react';
import {studioLaunchURL,validStudioReply} from './studioLaunch.js';
import './StudioLaunch.css';

export default function StudioLaunch(){
  const [status,setStatus]=useState('idle'),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState(false);
  const pending=useRef(null),timer=useRef(null);
  useEffect(()=>{const message=event=>{if(validStudioReply(event,pending.current?.popup,pending.current?.nonce)){clearTimeout(timer.current);setStatus('ready');}};window.addEventListener('message',message);return()=>{clearTimeout(timer.current);window.removeEventListener('message',message);};},[]);
  function open(){
    clearTimeout(timer.current);
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
    const popup=window.open(studioLaunchURL(location.origin,nonce),'dayris-local-studio');
    if(!popup){pending.current=null;setStatus('blocked');return;}
    pending.current={popup,nonce};setStatus('waiting');
    timer.current=setTimeout(()=>setStatus('unconfirmed'),12000);
  }
  async function copy(){try{await navigator.clipboard.writeText('npm run project:desk');setCopied(true);setCopyError(false);}catch{setCopyError(true);}}
  return <main className="admin-page studio-launch" aria-label="Переход в студию"><header className="studio-launch-heading"><span><FolderOpen size={24}/></span><div><p>РЕДАКТОР ПРИЛОЖЕНИЯ · НА ЭТОМ ПК</p><h1>Студия DAYRIS</h1></div></header>
    <p className="studio-launch-intro">Песочница с календарём, закреплёнными окнами элементов, логикой, исходниками и отдельным просмотром твоей версии.</p>
    <div className="studio-launch-open"><button className="admin-primary" onClick={open}><ExternalLink size={18}/>Открыть студию на этом ПК</button><p>Откроется отдельная вкладка. Локальная мастерская должна быть запущена на этом же компьютере.</p></div>
    <section className={`studio-launch-status studio-launch-status-${status}`} role="status" aria-live="polite">{status==='idle'?'Подключение ещё не проверялось. Нажми «Открыть студию» после запуска мастерской.':status==='waiting'?'Вкладка открыта. Ждём подтверждение загрузки студии…':status==='ready'?<><CheckCircle2 size={18}/>Студия загрузилась в отдельной вкладке. Можно работать.</>:status==='blocked'?'Браузер заблокировал новую вкладку. Разреши всплывающие окна для админки и попробуй снова.':'Студия не подтвердила загрузку. Если в новой вкладке ошибка, пустой экран или обычный календарь — проверь запуск ниже. Это не подтверждение подключения.'}</section>
    <section className="studio-launch-instructions"><h2>Первый запуск или студия не открывается</h2><ol><li>На ПК открой папку проекта <code>ai-trade-journal</code>.</li><li>Открой в этой папке терминал — PowerShell или терминал редактора.</li><li>Выполни команду и оставь терминал открытым:<div className="studio-launch-command"><code>npm run project:desk</code><button onClick={copy} aria-label="Скопировать команду запуска"><Copy size={16}/>{copied?'Скопировано':'Копировать'}</button></div>{copyError&&<p role="alert">Не удалось скопировать автоматически. Выдели команду и скопируй вручную.</p>}</li><li>Вернись сюда и нажми «Открыть студию на этом ПК».</li></ol><p><Terminal size={16}/>Если порт 5173 занят, проверь другой запущенный сервер DAYRIS: нужна именно команда <code>project:desk</code>, не обычный просмотр готовой сборки.</p></section>
    <footer className="studio-launch-boundary"><strong>Админка и студия — разные задачи</strong><p>Здесь остаются данные пользователей. Файлы, сборка и push работают на твоём ПК. В студии подключи папку проекта: «Посмотреть» → проверка версии → локальное сохранение → подготовка push. Переход ничего не публикует и не меняет права аккаунта.</p><p>С телефона эта кнопка ищет мастерскую на самом телефоне, а не на домашнем ПК. Для редактирования проекта открой админку на компьютере.</p></footer>
  </main>;
}
