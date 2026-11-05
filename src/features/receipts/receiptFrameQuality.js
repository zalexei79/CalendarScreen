// Text-edge acutance is independent of paper brightness. A stationary blurred
// frame is not ready just because its outline and total area look like a receipt.
export function receiptFrameQuality(pixels,width,height){
  const left=Math.max(2,Math.round(width*.1)),right=Math.min(width-2,Math.round(width*.9));
  const top=Math.max(2,Math.round(height*.06)),bottom=Math.min(height-2,Math.round(height*.94));
  if(right<=left||bottom<=top)return {ready:false,sharpness:0,detail:0};
  const histogram=new Uint32Array(256);let count=0;
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){histogram[pixels[y*width+x]]++;count++;}
  const percentile=fraction=>{let total=0;for(let value=0;value<256;value++){total+=histogram[value];if(total>=count*fraction)return value;}return 255;};
  const contrast=percentile(.9)-percentile(.03),threshold=Math.max(10,contrast*.08);
  let gradient=0,curvature=0,edges=0;const textRows=new Set();
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const at=y*width+x,center=pixels[at],l=pixels[at-1],r=pixels[at+1],u=pixels[at-width],d=pixels[at+width];
    const energy=Math.abs(r-l)+Math.abs(d-u);
    if(energy<threshold)continue;
    gradient+=energy;curvature+=Math.abs(l-2*center+r)+Math.abs(u-2*center+d);edges++;
    textRows.add(Math.floor((y-top)*16/(bottom-top)));
  }
  const sharpness=gradient?curvature/gradient:0,detail=edges/count;
  return {ready:sharpness>=.24&&detail>=.012&&textRows.size>=6,sharpness,detail};
}
