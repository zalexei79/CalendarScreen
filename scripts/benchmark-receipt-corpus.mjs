import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {parseReceiptPhoto} from '../src/features/receipts/receiptPhoto.js';

const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf('--'+key);return i<0?fallback:args[i+1];};
const baseline=option('baseline',''),parse=baseline?(await import(pathToFileURL(path.resolve(baseline)))).parseReceiptPhoto:parseReceiptPhoto;
const root=option('root','artifacts/receipt-corpus'),fixtures='tests/fixtures/receipt-corpus';
const readGzip=file=>gunzipSync(fs.readFileSync(file)).toString().trim().split('\n').filter(Boolean).map(JSON.parse);
const records=readGzip(path.join(fixtures,'cord-v2.jsonl.gz')),splits=JSON.parse(fs.readFileSync(path.join(fixtures,'splits.json')));
const frozenOcr=new Map(readGzip(path.join(fixtures,'ocr-evaluation.jsonl.gz')).map(r=>[r.cache+'/'+r.id,r]));
const textRecords=new Map(readGzip(path.join(fixtures,'express-transcripts.jsonl.gz')).map(r=>[r.id,r]));
function readOcr(source,id){const file=path.join(root,'ocr',source,id+'.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):frozenOcr.get(source+'/'+id);}
function amount(value){const text=String(value||'').replace(/(?:Rp|IDR)/gi,'').trim().replace(/[.,]$/,'').replace(/[^\d.,'’\s]/g,'');if(!text)return null;const decimal=text.match(/[.,](\d{1,2})$/),whole=(decimal?text.slice(0,decimal.index):text).replace(/\D/g,''),minor=Number(whole)*100+Number((decimal?.[1]||'').padEnd(2,'0'));return Number.isSafeInteger(minor)?minor:null;}
const normalize=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const stats=()=>({documents:0,annotatedTotal:0,exactTotal:0,wrongSelectedTotal:0,missingTotal:0,correctReviewCandidate:0,unknownGold:0,itemsRecognized:0,expectedItems:0,exactNamedItemAmounts:0});
function check(stat,record,draft){
 stat.documents++;stat.itemsRecognized+=draft.items?.length||0;stat.expectedItems+=record.items.length;
 const used=new Set();for(const item of draft.items||[]){const i=record.items.findIndex((gold,index)=>!used.has(index)&&normalize(gold.nm)===normalize(item.name)&&amount(gold.price||gold.itemsubtotal)===amount(item.printedTotal||item.total));if(i>=0){used.add(i);stat.exactNamedItemAmounts++;}}
 const gold=amount(record.total);if(gold===null){stat.unknownGold++;return;}stat.annotatedTotal++;
 const found=amount(draft.total);if(found===gold)stat.exactTotal++;else if(found!==null)stat.wrongSelectedTotal++;else{stat.missingTotal++;if(draft.totalCandidates?.some(value=>amount(value)===gold))stat.correctReviewCandidate++;}
}
const annotation={},raw={},rawWithFallback={};
for(const [split,ids] of Object.entries({train:splits.trainIds,validation:splits.validationIds,test:splits.testIds})){
 const wanted=new Set(ids),reference=stats(),ocr=stats(),fallback=stats();
 for(const record of records.filter(row=>wanted.has(row.id))){
  const data={text:record.rows.map(r=>r.text).join('\n'),imageSize:{width:record.width,height:record.height},blocks:[{paragraphs:[{lines:record.rows.map(row=>({text:row.text,bbox:row.bbox,words:row.words}))}]}]};
  check(reference,record,parse(data,{today:'2026-10-29'}));
  const result=readOcr('cord-v2',record.id);if(!result)continue;
  if(result.ok)check(ocr,record,parse(result.data,{today:'2026-10-29'}));
  const recovered=!result.ok||!result.data?.text?.trim()?readOcr('cord-v2-psm6',record.id)||result:result;
  check(fallback,record,parse(recovered.ok?recovered.data:{text:''},{today:'2026-10-29'}));
 }
 annotation[split]=reference;raw[split]=ocr;rawWithFallback[split]=fallback;
}
function fieldStats(){return {documents:0,merchant:{gold:0,exact:0,unlabelledPredictions:0},date:{gold:0,exact:0,unlabelledPredictions:0},total:{gold:0,exact:0,wrong:0},failures:[]};}
function checkFields(stat,row,draft){
 stat.documents++;
 for(const [field,key]of [['merchant','merchant'],['date','dateKey']]){
  const found=draft.kind==='receipt'?draft[key]:'';
  if(row.gold[key]){stat[field].gold++;if(normalize(found)===normalize(row.gold[key]))stat[field].exact++;else stat.failures.push({id:row.id,field,gold:row.gold[key],predicted:found});}
  else if(found)stat[field].unlabelledPredictions++;
 }
 if(row.gold.total&&!row.requiresReview.total){stat.total.gold++;if(amount(draft.total)===amount(row.gold.total))stat.total.exact++;else if(draft.total)stat.total.wrong++;}
}
const curated={calibration:true,...fieldStats()},curatedOcr={calibration:true,...fieldStats()};
const goldRows=fs.readFileSync(path.join(fixtures,'field-gold.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
for(const row of goldRows){
 checkFields(curated,row,parse(textRecords.get(row.id).text,{today:'2026-10-29'}));
 const primary=readOcr('express-expense',row.id),result=!primary?.ok||!primary.data?.text?.trim()?readOcr('express-expense-psm6',row.id)||primary:primary;
 if(result)checkFields(curatedOcr,row,parse(result.ok?result.data:{text:''},{today:'2026-10-29'}));
}
const fullPipelineReplay={documents:0,exactTotal:0,wrongSelectedTotal:0,correctReviewCandidate:0,missingOrUnhelpful:0,results:[]};
for(const row of readGzip(path.join(fixtures,'full-pipeline.jsonl.gz'))){
 const draft=parse(row.ok?row.data:{text:''},{today:'2026-10-29'}),gold=amount(row.gold),selected=amount(draft.total),correct=selected===gold,review=selected===null&&draft.totalCandidates?.some(value=>amount(value)===gold);
 fullPipelineReplay.documents++;if(correct)fullPipelineReplay.exactTotal++;else if(selected!==null)fullPipelineReplay.wrongSelectedTotal++;else if(review)fullPipelineReplay.correctReviewCandidate++;else fullPipelineReplay.missingOrUnhelpful++;
 fullPipelineReplay.results.push({id:row.id,gold:row.gold,total:draft.total,candidates:draft.totalCandidates||[],elapsedMs:row.elapsedMs});
}
const report={version:3,parser:baseline?'baseline':'current',evaluation:'Separate parsing of annotated transcriptions and frozen raw OCR; no claim of full mobile/app accuracy. Manual40field gold is calibration, not blind validation. Full-pipeline replay re-parses20 frozen browser OCR outputs, not a fresh engine run.',trainingDocuments:splits.trainIds.length,annotation,raw,rawWithFallback,curated,curatedOcr,fullPipelineReplay};
const out=option('out',path.join(root,'reports',baseline?'baseline.json':'current.json'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,curated:{...curated,failures:curated.failures.length},curatedOcr:{...curatedOcr,failures:curatedOcr.failures.length}},null,2));
