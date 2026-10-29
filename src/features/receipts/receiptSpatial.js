// Merge OCR words on the same visual baseline, even when Tesseract put the
// name/quantity/amount in separate paragraphs. Preserve actual word boxes.
export function receiptSpatialRows(data){
 const lines=(data?.blocks||[]).flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
 const words=lines.flatMap(line=>line.words||[]).filter(word=>word.text?.trim()&&word.bbox&&word.bbox.x1>word.bbox.x0&&word.bbox.y1>word.bbox.y0);
 if(!words.length)return [];
 const heights=words.map(w=>w.bbox.y1-w.bbox.y0).sort((a,b)=>a-b),median=heights[Math.floor(heights.length/2)],rows=[];
 for(const word of [...words].sort((a,b)=>(a.bbox.y0+a.bbox.y1)-(b.bbox.y0+b.bbox.y1)||a.bbox.x0-b.bbox.x0)){
  const center=(word.bbox.y0+word.bbox.y1)/2,height=word.bbox.y1-word.bbox.y0;let row=rows.findLast(r=>Math.abs(r.center-center)<=Math.min(median*.55,Math.min(r.height,height)*.55));
  if(!row){row={center,height,words:[]};rows.push(row);}row.words.push(word);row.center=row.words.reduce((sum,w)=>sum+(w.bbox.y0+w.bbox.y1)/2,0)/row.words.length;row.height=Math.min(row.height,height);
 }
 return rows.sort((a,b)=>a.center-b.center).map(row=>{const words=row.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);return{text:words.map(w=>w.text).join(' '),words,bbox:{x0:Math.min(...words.map(w=>w.bbox.x0)),y0:Math.min(...words.map(w=>w.bbox.y0)),x1:Math.max(...words.map(w=>w.bbox.x1)),y1:Math.max(...words.map(w=>w.bbox.y1))}};});
}
