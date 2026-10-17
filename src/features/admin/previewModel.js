import {normalizeConfig} from './siteConfig.js';
import {validLocalCSS} from '../appearance/designModel.js';
export function previewSignature(config,css,codeRevision=0){return JSON.stringify([normalizeConfig(config),validLocalCSS(css),codeRevision]);}
export function previewSnapshot(config,css,device,codeRevision=0){
  return {config:normalizeConfig(config),css:validLocalCSS(css),device:device==='desktop'?'desktop':'mobile',codeRevision,signature:previewSignature(config,css,codeRevision),createdAt:Date.now()};
}
export function canPreparePreview({snapshot,currentSignature,dirty,sourceDirty,reviewed}){return Boolean(snapshot && snapshot.signature===currentSignature && !dirty && !sourceDirty && reviewed);}
export function projectFingerprint(status){return JSON.stringify([status?.branch,status?.head,Boolean(status?.hasStaged),(status?.files||[]).map(file=>[file.path,file.hash]).sort((a,b)=>a[0].localeCompare(b[0]))]);}
