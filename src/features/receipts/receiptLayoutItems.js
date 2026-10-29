import{receiptSpatialRows}from'./receiptSpatial.js';
import{classifyReceiptField}from'./receiptFieldClassifier.js';
import{receiptMoney,moneyText,receiptLineTotal,validReceiptName,looksLikeReceiptMath}from'./receiptModel.js';
import{receiptNonItemLine,receiptMetadataLine,receiptTotalAnchor}from'./receiptStructure.js';
const amountWord=value=>/^[@$€₽¥₴]?[\d]+(?:[.,'’]\d+)*[A-D]?$/u.test(String(value).trim())?moneyText(receiptMoney(String(value).replace(/^[@$€₽¥₴]/u,'').replace(/[A-D]$/u,''))):'';
// The learned role only nominates a table row. Amounts and factors must still
// occur in its actual printed columns; missing factors are never back-calculated.
export function receiptLayoutItems(data){
 const rows=receiptSpatialRows(data);if(!rows.length)return [];
 const width=data.imageSize?.width||Math.max(...rows.map(r=>r.bbox.x1)),height=data.imageSize?.height||Math.max(...rows.map(r=>r.bbox.y1));
 const candidates=[];
 for(const row of rows){
  if(receiptTotalAnchor(row.text)||receiptNonItemLine(row.text)){if(candidates.length)break;continue;}
  if(receiptMetadataLine(row.text)||looksLikeReceiptMath(row.text))continue;
  const role=classifyReceiptField(row,{width,height});if(role.role!=='item'||role.confidence<.8)continue;
  const amounts=row.words.map((word,index)=>({word,index,amount:amountWord(word.text)})).filter(value=>value.amount&&value.word.bbox.x0>width*.5);
  const last=amounts.at(-1);if(!last||last.word.bbox.x1<width*.62)continue;
  const after=row.words.slice(last.index+1).map(w=>w.text).join(' ');if(after&&!/^[A-D]$/.test(after))continue;
  const firstPrice=amounts[0],leading=row.words[0]?.text||'',quantityMatch=leading.match(/^(\d{1,3}(?:[.,]\d{1,3})?)\s*[xX×]?$/u),explicitQty=quantityMatch&&Number(quantityMatch[1].replace(',','.'))>0&&Number(quantityMatch[1].replace(',','.'))<=100;
  const name=row.words.slice(explicitQty?1:0,firstPrice.index).map(w=>w.text).join(' ').trim();if(!validReceiptName(name)||!/[\p{L}]/u.test(name))continue;
  const quantity=explicitQty?quantityMatch[1].replace(',','.'):'1',unitPrice=amounts.length>1?amounts[0].amount:quantity==='1'?last.amount:'',total=receiptLineTotal(quantity,unitPrice);
  candidates.push({name:name.slice(0,180),quantity,unit:'pcs',unitPrice,total,printedTotal:last.amount,...(total!==last.amount||!Number.isInteger(Number(quantity))?{mathUncertain:true}:{}),column:last.word.bbox.x1/width});
 }
 // A single spatial guess is insufficient evidence of a price column.
 if(candidates.length<2)return [];
 const centers=candidates.map(c=>c.column).sort((a,b)=>a-b),median=centers[Math.floor(centers.length/2)];
 return candidates.filter(item=>Math.abs(item.column-median)<.12).map(({column,...item})=>item);
}
