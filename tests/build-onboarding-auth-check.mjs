// Builds an isolated browser harness for the real useAuth hook with an in-memory SDK.
// No credentials, Supabase requests or real account changes are involved.
import { build } from 'esbuild';
import fs from 'node:fs';
const mock = `
export const previewUser={id:'11111111-1111-4111-8111-111111111111',email:'aveel2000@gmail.com',user_metadata:{nickname:'Preview'}};
export const regularUser={id:'22222222-2222-4222-8222-222222222222',email:'regular@example.test',user_metadata:{nickname:'Regular'}};
let current=new URLSearchParams(location.search).get('account')==='regular'?regularUser:previewUser;
let listener;
export function emit(event,user=current){current=user;listener?.(event,{user});}
export const supabase={auth:{onAuthStateChange(callback){listener=callback;queueMicrotask(()=>callback('INITIAL_SESSION',{user:current}));return {data:{subscription:{unsubscribe(){listener=null;}}}}},getSession:async()=>({data:{session:{user:current}}}),getUser:async()=>({data:{user:current}})}};`;
const source = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {useAuth} from './src/features/auth/hooks/useAuth.js';
import {emit,previewUser,regularUser} from './src/supabaseClient';
localStorage.setItem('dayris_onboarding_v2_completed','1');
function App(){const auth=useAuth();return <main><h1>Onboarding auth check</h1><p>Account: {auth.user?.email||'loading'}</p><output>Setup: {auth.setupStep||'closed'}</output><div><button onClick={()=>auth.setSetupStep(null)}>Complete setup</button><button onClick={()=>emit('TOKEN_REFRESHED',{...auth.user})}>Refresh session</button><button onClick={()=>emit('SIGNED_IN',regularUser)}>Regular account</button><button onClick={()=>emit('SIGNED_IN',previewUser)}>Preview account</button></div></main>}
createRoot(document.getElementById('root')).render(<App/>);`;
const bundle = await build({ stdin: { contents: source, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, write: false, format: 'iife', define: { 'import.meta.env': '{}' }, plugins: [{ name: 'memory-sdk', setup(plugin) { plugin.onResolve({filter:/supabaseClient(?:\.js)?$/},()=>({path:'memory-sdk',namespace:'mock'})); plugin.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js'})); } }] });
fs.writeFileSync('dist/onboarding-auth-check.html', `<!doctype html><meta charset="UTF-8"><title>Onboarding auth check</title><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script>', '<\\/script>')}</script>`);
console.log('Isolated auth onboarding harness built.');
