import {receiptDocumentBounds} from './receiptDocumentRegion.js';
// A light, mostly neutral paper region can separate a receipt from a patterned
// table. Bounds are only a recovery hint; an OCR total label is still required.
export function receiptPaperBounds({data,width,height}){
  const scores=Array.from({length:width},(_,x)=>{
    let count=0;
    for(let y=0;y<height;y++){const index=(y*width+x)*4,r=data[index],g=data[index+1],b=data[index+2];if(Math.min(r,g,b)>100&&Math.max(r,g,b)-Math.min(r,g,b)<40)count++;}
    return count/height;
  });
  let start=-1,best=null;
  for(let x=0;x<=width;x++){
    const neighbors=scores.slice(Math.max(0,x-2),Math.min(width,x+3));
    const paper=x<width&&neighbors.reduce((sum,value)=>sum+value,0)/neighbors.length>.35;
    if(paper&&start<0)start=x;
    if(!paper&&start>=0){if(!best||x-start>best.width)best={left:start,width:x-start};start=-1;}
  }
  if(!best||best.width<width*.25||best.width>width*.94)return null;
  const pad=Math.max(2,Math.round(width*.015)),left=Math.max(0,best.left-pad),right=Math.min(width,best.left+best.width+pad);
  return {left:left/width,width:(right-left)/width};
}
export async function receiptPaperImage(file,{fallbackToWhole=false}={}){
  let bitmap;
  try{
    bitmap=await createImageBitmap(file);
    const sample=document.createElement('canvas'),ratio=Math.min(1,300/bitmap.width);sample.width=Math.round(bitmap.width*ratio);sample.height=Math.round(bitmap.height*ratio);
    const context=sample.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0,sample.width,sample.height);
    const pixels=context.getImageData(0,0,sample.width,sample.height);
    const bounds=receiptDocumentBounds(pixels)||receiptPaperBounds(pixels)||(fallbackToWhole?{left:0,top:0,width:1,height:1}:null);
    if(!bounds)return null;
    const sourceWidth=Math.round(bounds.width*bitmap.width),sourceHeight=Math.round((bounds.height||1)*bitmap.height),scale=Math.min(6,1600/sourceWidth,3200/sourceHeight),canvas=document.createElement('canvas');canvas.width=Math.round(sourceWidth*scale);canvas.height=Math.round(sourceHeight*scale);
    const target=canvas.getContext('2d');target.imageSmoothingQuality='high';target.drawImage(bitmap,Math.round(bounds.left*bitmap.width),Math.round((bounds.top||0)*bitmap.height),sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);
    return canvas;
  }catch{return null;}finally{bitmap?.close();}
}
export function receiptFooterImage(paper){
  const canvas=document.createElement('canvas');canvas.width=paper.width;canvas.height=Math.round(paper.height*.3);
  canvas.getContext('2d').drawImage(paper,0,paper.height-canvas.height,paper.width,canvas.height,0,0,canvas.width,canvas.height);
  return canvas;
}
