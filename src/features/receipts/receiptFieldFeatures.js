// Numeric values are replaced in text features; no hard-coded merchant list.
export const RECEIPT_FIELD_ROLES=['item','total','adjustment','payment'];
export const RECEIPT_FIELD_FEATURES=148;
export function receiptFieldFeatures(line,{width=1,height=1}={}){
 const text=String(line.text||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase(),box=line.bbox||{x0:0,y0:0,x1:width,y1:height};
 const letters=(text.match(/\p{L}/gu)||[]).length,digits=(text.match(/\d/g)||[]).length,words=text.split(/\s+/).filter(Boolean),length=Math.max(1,text.length),f=new Float64Array(RECEIPT_FIELD_FEATURES);
 const values=[1,Math.min(1,box.x0/width),Math.min(1,box.x1/width),Math.min(1,box.y0/height),Math.min(1,box.y1/height),Math.min(1,(box.x1-box.x0)/width),Math.min(1,(box.y1-box.y0)/height*12),letters/length,digits/length,Math.min(1,length/70),Math.min(1,words.length/10),/^\s*\d+\s+(?:x\s+)?\p{L}/u.test(text)?1:0,/\btotal\b/.test(text)?1:0,/\bsub[\s-]*total\b/.test(text)?1:0,/\b(?:cash|card|change|credit|debit|visa|tunai|kembali)\b/.test(text)?1:0,/\b(?:tax|tva|vat|ppn|service|discount|pajak)\b/.test(text)?1:0,/\d[.,]\d/.test(text)?1:0,/\bgrand\b/.test(text)?1:0,Math.min(1,(text.match(/\d+/g)||[]).length/6),/[%@]/.test(text)?1:0];f.set(values);
 const tokens=text.replace(/\d+/g,'#').match(/[\p{L}#@%]+/gu)||[];const grams=[];
 for(const token of tokens){const word='^'+token+'$';if(token.length<=2)grams.push(word);else for(let i=0;i<word.length-2;i++)grams.push(word.slice(i,i+3));}
 for(const gram of grams){let hash=2166136261;for(const c of gram)hash=Math.imul(hash^c.charCodeAt(0),16777619);f[20+(hash>>>0)%128]+=1/Math.sqrt(Math.max(1,grams.length));}
 return f;
}
