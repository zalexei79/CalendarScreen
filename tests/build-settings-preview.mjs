// Isolated preview of the real settings UI, without credentials or cloud calls.
import { build } from 'esbuild';
import fs from 'node:fs';
const source = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import SettingsPanel from './src/shared/ui/SettingsPanel.jsx';
import {translate} from './src/shared/i18n/index.js';
function App() {
  const [language,setLanguage]=useState('ru'), [currency,setCurrency]=useState('USD');
  const [theme,setTheme]=useState('dark'), [open,setOpen]=useState(true), [event,setEvent]=useState('');
  const account=new URLSearchParams(location.search).has('account');
  const user=account?{id:'preview',email:'alex@example.test',user_metadata:{nickname:'Алексей'}}:null;
  const resolved=theme==='system'?(matchMedia('(prefers-color-scheme:light)').matches?'light':'dark'):theme;
  return <><button id="open-settings" onClick={()=>setOpen(true)}>Открыть настройки</button><output>{event}</output>{open&&<SettingsPanel t={key=>translate(language,key)} language={language} setLanguage={setLanguage} currency={currency} setCurrency={setCurrency} theme={resolved} themePreference={theme} setTheme={setTheme} isLight={resolved==='light'} user={user} handleGoogleLogin={()=>setEvent('google')} handleTelegramLogin={()=>setEvent('telegram')} handleGoogleLogout={()=>setEvent('logout')} onStory={()=>setEvent('story')} onRestart={()=>setEvent('restart')} onPro={()=>setEvent('pro')} proAccessActive={account} onClose={()=>setOpen(false)} visible/>}</>;
}
createRoot(document.getElementById('root')).render(<App/>);`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,outfile:'settings-preview.js',format:'iife',logLevel:'silent'});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
const baseCss = fs.readFileSync('dist/assets/' + fs.readdirSync('dist/assets').find(file=>file.endsWith('.css')), 'utf8');
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/settings-preview.html', '<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DAYRIS Settings Preview</title><style>'+baseCss+'body{margin:0;background:#101113;color:#ddd;font-family:system-ui}button{font:inherit}*{box-sizing:border-box}#open-settings{margin:24px}'+css+'</style><div id="root"></div><script>'+js.replaceAll('</script>','<\\/script>')+'</script></html>');
console.log('Settings preview built in dist/settings-preview.html');
