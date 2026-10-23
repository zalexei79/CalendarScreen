// Small preview samples only: detect a light document with multiple printed rows.
// This is a capture hint, never evidence authorizing a financial amount.
export function receiptFrameSignal({data,width,height}){
  const pixels=new Uint8Array(width*height);let paper=0,dark=0,edges=0;const rows=[];
  for(let y=0;y<height;y++){
    let rowInk=0;
    for(let x=0;x<width;x++){
      const at=y*width+x,i=at*4,r=data[i],g=data[i+1],b=data[i+2],light=Math.round(.299*r+.587*g+.114*b);
      pixels[at]=light;
      if(light>135&&Math.max(r,g,b)-Math.min(r,g,b)<85)paper++;
      if(light<110){dark++;if(x>width*.1&&x<width*.9)rowInk++;}
      if(x&&Math.abs(light-pixels[at-1])>40)edges++;
    }
    if(rowInk>width*.035&&rowInk<width*.55)rows.push(y);
  }
  const count=width*height,ink=dark/count;
  const document=paper/count>.55&&ink>.018&&ink<.3&&edges/count>.015&&rows.length>=8&&rows.length<height*.65&&rows.at(-1)-rows[0]>height*.4;
  return {document,pixels};
}
export function receiptFrameMotion(previous,current){
  if(!previous||previous.length!==current.length)return Infinity;
  let difference=0;for(let i=0;i<current.length;i++)difference+=Math.abs(previous[i]-current[i]);
  return difference/current.length;
}
