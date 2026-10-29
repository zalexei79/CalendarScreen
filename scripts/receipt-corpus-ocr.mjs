import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {createWorker} from 'tesseract.js';

// Raw OCR benchmark only: this deliberately does not run DAYRIS image recovery,
// amount refinement, account checks or calendar writes. Compare parsers using
// the same frozen text/geometry cache; never confuse this with a full-app score.
const require=createRequire(import.meta.url),version=require('tesseract.js/package.json').version;
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('Raw receipt image OCR benchmark. Options: --dataset DIR --records FILE --images DIR --source NAME --out DIR --splits train,test --limit 100 --workers 2 --psm 3 --ids-file FILE --timeout-ms 30000 --image-wait-ms 600000. Existing matching engine/image SHA caches are reused.');process.exit(0);}
const option=(name,fallback)=>{const at=args.indexOf('--'+name);return at>=0?args[at+1]:fallback;};
const dataset=path.resolve(option('dataset','artifacts/receipt-corpus/cord-v2'));
const recordsPath=path.resolve(option('records',path.join(dataset,'records.jsonl'))),imageRoot=path.resolve(option('images',path.join(dataset,'images'))),datasetLabel=option('source','CORD v2');
const psm=option('psm','3');if(!/^(?:[0-9]|1[0-3])$/.test(psm))throw new Error('Invalid PSM');
const out=path.resolve(option('out',path.join('artifacts/receipt-corpus/ocr',path.basename(dataset)+(psm==='3'?'':'-psm'+psm))));
const positive=(name,fallback)=>{const value=Number(option(name,String(fallback)));if(!Number.isInteger(value)||value<=0)throw new Error('Invalid positive integer --'+name);return value;};
const splits=option('splits','train,test').split(',').filter(Boolean),limit=positive('limit',100);
const workers=Math.min(2,positive('workers',2)),timeoutMs=positive('timeout-ms',30000);
const imageWaitMs=positive('image-wait-ms',600000);
const languages=['eng','ron','rus'],langPath=path.resolve('public/receipt-ocr/v1/lang');
const engine={name:'tesseract.js',version,languages,oem:1,psm,preprocessing:'none',output:'text and blocks',stage:'raw-ocr'};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const languagePacks=await Promise.all(languages.map(async language=>{const file=path.join(langPath,language+'.traineddata.gz'),bytes=await fs.readFile(file);return {language,package:'@tesseract.js-data/'+language,version:require('@tesseract.js-data/'+language+'/package.json').version,sha256:hash(bytes),bytes:bytes.length};}));
const engineKey=hash(Buffer.from(JSON.stringify({engine,languagePacks:languagePacks.map(({language,sha256})=>({language,sha256}))})));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitRead(file,waitMs){const start=Date.now();for(;;){try{return await fs.readFile(file);}catch(error){if(error.code!=='ENOENT'||Date.now()-start>=waitMs)throw error;await sleep(500);}}}
function bounded(promise,milliseconds,label){let timer;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+'_TIMEOUT')),milliseconds);});return Promise.race([promise,deadline]).finally(()=>clearTimeout(timer));}
await fs.mkdir(out,{recursive:true});await fs.mkdir(path.join(out,'cache'),{recursive:true});
const recordsBytes=await waitRead(recordsPath,imageWaitMs);
const records=recordsBytes.toString().trim().split(/\r?\n/).filter(Boolean).map((line,index)=>{const record=JSON.parse(line);if(!/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(record.id||''))throw new Error('Unsafe record id at '+index);if(record.source?.image&&!args.includes('--images'))throw new Error('Pass --images explicitly for externally referenced images');return {...record,split:record.split||'curated',index:record.index??index};});
let availableImages;try{const manifest=JSON.parse(await fs.readFile(path.join(dataset,'manifest.json'),'utf8'));if(Array.isArray(manifest.images))availableImages=new Set(manifest.images.map(image=>image.id));}catch{}
let selectedIds;const idsFile=option('ids-file','');if(idsFile){const contents=await fs.readFile(idsFile,'utf8');selectedIds=new Set(contents.trim().startsWith('[')?JSON.parse(contents):contents.split(/\r?\n/).filter(Boolean));}
const chosen=splits.flatMap(split=>records.filter(record=>record.split===split&&(!selectedIds||selectedIds.has(record.id))&&(!availableImages||availableImages.has(record.id))).sort((a,b)=>a.index-b.index).slice(0,limit));
if(!chosen.length)throw new Error('No selected records');
let next=0,done=0,cached=0,failed=0;
const results=[],started=new Date().toISOString();
console.log(JSON.stringify({benchmark:'raw OCR',dataset,splits,limitPerSplit:limit,selected:chosen.length,workers,engine}));
async function run(slot){let worker;
 const terminate=async()=>{if(!worker)return;const old=worker;worker=null;try{await bounded(old.terminate(),5000,'TERMINATE');}catch{}};
 const ensure=async()=>{if(worker)return;const creating=createWorker(languages,1,{langPath,cachePath:path.join(out,'cache'),errorHandler:()=>{}});try{worker=await bounded(creating,60000,'WORKER');await bounded(worker.setParameters({tessedit_pageseg_mode:psm}),5000,'PARAMETERS');}catch(error){creating.then(w=>{if(w!==worker)w.terminate().catch(()=>{});},()=>{});await terminate();throw error;}};
 try{while(next<chosen.length){const record=chosen[next++],imagePath=path.join(imageRoot,record.id+'.jpg'),resultPath=path.join(out,record.id+'.json');let result;
  try{const bytes=await waitRead(imagePath,imageWaitMs),imageSha256=hash(bytes);let old;try{old=JSON.parse(await fs.readFile(resultPath,'utf8'));}catch{}
   if(old?.ok&&old.engineKey===engineKey&&old.imageSha256===imageSha256){cached++;result={id:record.id,split:record.split,ok:true,cached:true,elapsedMs:old.elapsedMs,imageSha256};}
   else{await ensure();const start=performance.now();const {data}=await bounded(worker.recognize(bytes,{}, {blocks:true}),timeoutMs,'IMAGE');const elapsedMs=Math.round(performance.now()-start);
    const output={id:record.id,source:datasetLabel,revision:record.revision||record.source?.revision,split:record.split,index:record.index,ok:true,engine,engineKey,imageSha256,imageBytes:bytes.length,imagePath:path.relative(process.cwd(),imagePath).replaceAll('\\','/'),elapsedMs,completedAt:new Date().toISOString(),data:{text:data.text,confidence:data.confidence,blocks:data.blocks||[]}};
    await fs.writeFile(resultPath,JSON.stringify(output));result={id:record.id,split:record.split,ok:true,cached:false,elapsedMs,imageSha256};}
  }catch(error){failed++;await terminate();result={id:record.id,split:record.split,ok:false,error:error.message};await fs.writeFile(resultPath,JSON.stringify({...result,engine,engineKey,completedAt:new Date().toISOString()}));}
  results.push(result);done++;if(done%20===0||done===chosen.length)console.log(JSON.stringify({done,total:chosen.length,cached,failed,slot,last:record.id}));
 }}finally{await terminate();}}
await Promise.all(Array.from({length:workers},(_,slot)=>run(slot)));
results.sort((a,b)=>a.id.localeCompare(b.id));
const manifest={dataset:datasetLabel,recordsSha256:hash(recordsBytes),selectedRecordsSha256:hash(Buffer.from(chosen.map(record=>JSON.stringify(record)).join('\n'))),started,completedAt:new Date().toISOString(),engine,engineKey,requested:{splits,limitPerSplit:limit,workers,timeoutMs},selected:chosen.length,languagePacks,successful:results.filter(result=>result.ok).length,failed,cached,uniqueSuccessfulImages:new Set(results.filter(result=>result.ok).map(result=>result.imageSha256)).size,results,limitations:['Raw full-image OCR, not the DAYRIS full recovery pipeline or mobile camera performance.',datasetLabel==='CORD v2'?'CORD v2 has masked merchant/store fields and Indonesian receipts.':'This run uses a curated image subset, not a representative country/merchant sample.','Ground-truth annotations are never used as OCR input.']};
await fs.writeFile(path.join(out,'run-'+splits.join('-')+'.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({complete:true,selected:manifest.selected,successful:manifest.successful,uniqueImages:manifest.uniqueSuccessfulImages,failed,cached,out}));
if(failed)process.exitCode=1;
