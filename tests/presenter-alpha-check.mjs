import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const root = path.resolve('artifacts/presenter-alpha');
await build({ stdin: { resolveDir: process.cwd(), loader: 'js', contents: `
import {createPresenterMesh} from './src/features/onboarding/presenterMorphMesh.js';
import {createPresenterRenderer} from './src/features/onboarding/presenterFaceRenderer.js';
import sheet from './src/assets/onboarding/presenter-emotions.webp';
import angry from './src/assets/onboarding/presenter-angry.webp';
window.checkAlpha=async()=>{
 const images=await Promise.all([sheet,angry].map(async src=>{const i=new Image();i.src=src;await i.decode();return i}));
 const canvas=document.createElement('canvas');canvas.width=480;canvas.height=400;document.body.append(canvas);
 const renderer=createPresenterRenderer(canvas,images,createPresenterMesh());if(renderer.mode!=='webgl')throw Error('WebGL required for alpha regression');
 const gl=canvas.getContext('webgl'),pixels=new Uint8Array(canvas.width*canvas.height*4);let invalid=0,feathered=0;
 for(const weights of [[1,0,0],[.5,.5,0],[0,1,0],[0,.5,.5],[0,0,1],[.5,0,.5]]){
  renderer.draw(weights);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3];if(a>0&&a<255)feathered++;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>a+1)invalid++;}
 }
 const premultiplied=gl.getContextAttributes().premultipliedAlpha;renderer.destroy();return {invalid,feathered,premultiplied};
};` }, bundle: true, format: 'esm', outfile: path.join(root,'main.js'), loader:{'.webp':'file'} });
for(const type of ['chromium','webkit']){
 const browser=await require('playwright')[type].launch(type==='chromium'?{channel:'msedge',headless:true}:{headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3});
  await page.route('http://alpha.test/**',async route=>{
   const p=new URL(route.request().url()).pathname;
   if(p==='/')return route.fulfill({contentType:'text/html',body:'<body style="background:#071216"><script type="module" src="/main.js"></script>'});
   return route.fulfill({contentType:p.endsWith('.js')?'text/javascript':'image/webp',body:await fs.readFile(path.join(root,p.slice(1)))});
  });
  await page.goto('http://alpha.test/');await page.waitForFunction(()=>window.checkAlpha);
  const result=await page.evaluate(()=>window.checkAlpha());
  assert.equal(result.premultiplied,true);assert.ok(result.feathered>100);assert.equal(result.invalid,0,'Feather RGB must never exceed coverage: prevents a white forehead band during page compositing');
  console.log(type,result);
 }finally{await browser.close();}
}
