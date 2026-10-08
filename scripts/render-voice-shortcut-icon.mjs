import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:192,height:192},deviceScaleFactor:1});
 await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${await fs.readFile('public/voice-mic.svg','utf8')}`);
 await page.locator('svg').screenshot({path:'public/voice-mic-192.png',omitBackground:true});
 const preview='android/app/src/main/res/drawable-nodpi/voice_widget_preview.png';
 await fs.mkdir(path.dirname(preview),{recursive:true});await fs.copyFile('public/voice-mic-192.png',preview);
}finally{await browser.close();}
