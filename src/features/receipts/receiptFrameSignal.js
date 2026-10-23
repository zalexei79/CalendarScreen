// Preview-only document hint. Reading and confirming the total happens after capture.
export function receiptFrameSignal({data,width,height}){
  const pixels=new Uint8Array(width*height),histogram=new Uint32Array(256);
  const left=Math.ceil(width*.08),right=Math.floor(width*.92),top=Math.ceil(height*.04),bottom=Math.floor(height*.96);
  let count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const at=y*width+x,i=at*4,light=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);pixels[at]=light;
    if(x>=left&&x<right&&y>=top&&y<bottom){histogram[light]++;count++;}
  }
  let background=0,total=0;for(;background<255;background++){total+=histogram[background];if(total>=count*.8)break;}
  const inkThreshold=background-32;let paper=0,dark=0,edges=0;const rows=[];
  for(let y=top;y<bottom;y++){
    let rowInk=0,rowEdges=0;
    for(let x=left;x<right;x++){
      const at=y*width+x,i=at*4,light=pixels[at];
      if(light>=background-24&&Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])<95)paper++;
      if(light<inkThreshold){dark++;rowInk++;}
      if(x>left&&Math.abs(light-pixels[at-1])>18){edges++;rowEdges++;}
    }
    const span=right-left;
    if(rowInk>span*.035&&rowInk<span*.75&&rowEdges>=3)rows.push(y);
  }
  let groups=0,last=-3;for(const y of rows){if(y-last>1)groups++;last=y;}
  const ink=dark/count;
  const document=background>=100&&paper/count>.4&&ink>.018&&ink<.4&&edges/count>.012&&rows.length>=8&&groups>=4&&rows.at(-1)-rows[0]>height*.35;
  return {document,pixels};
}
export function receiptFrameMotion(previous,current){
  if(!previous||previous.length!==current.length)return Infinity;
  let difference=0;for(let i=0;i<current.length;i++)difference+=Math.abs(previous[i]-current[i]);
  return difference/current.length;
}
