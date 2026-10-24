// Coarse connected paper regions; no requirement for all four unobstructed corners.
// Coordinates are normalized so the original camera pixels are used for OCR.
export function receiptDocumentBounds({data,width,height}){
  const cell=4,cols=Math.ceil(width/cell),rows=Math.ceil(height/cell),size=cols*rows;
  const light=new Float32Array(size),neutral=new Float32Array(size),hist=new Uint32Array(256);
  for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){
    let sum=0,n=0,plain=0;
    for(let y=gy*cell;y<Math.min(height,(gy+1)*cell);y++)for(let x=gx*cell;x<Math.min(width,(gx+1)*cell);x++){
      const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];sum+=.299*r+.587*g+.114*b;n++;if(Math.max(r,g,b)-Math.min(r,g,b)<55)plain++;
    }
    const at=gy*cols+gx;light[at]=sum/n;neutral[at]=plain/n;hist[Math.round(light[at])]++;
  }
  let count=0,p90=255;for(let i=0;i<256;i++){count+=hist[i];if(count>=size*.9){p90=i;break;}}
  const thresholds=[...new Set([p90-12,225,205,175,140].map(v=>Math.max(105,v)))];let best=null;
  for(const threshold of thresholds){
    const mask=Uint8Array.from(light,(value,i)=>value>=threshold&&neutral[i]>.55?1:0),closed=mask.slice();
    // Bridge text and narrow shadows without joining a whole hand to the paper.
    for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++){
      const at=y*cols+x;if(!mask[at]&&((mask[at-1]&&mask[at+1])||(mask[at-cols]&&mask[at+cols])))closed[at]=1;
    }
    const queue=new Int32Array(size);
    for(let seed=0;seed<size;seed++){
      if(!closed[seed])continue;let head=0,tail=1;queue[0]=seed;closed[seed]=0;let x0=cols,x1=0,y0=rows,y1=0,paper=0,brightness=0;
      while(head<tail){const at=queue[head++],x=at%cols,y=Math.floor(at/cols);paper++;brightness+=light[at];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
        for(const next of [x?at-1:-1,x<cols-1?at+1:-1,y?at-cols:-1,y<rows-1?at+cols:-1])if(next>=0&&closed[next]){closed[next]=0;queue[tail++]=next;}
      }
      const w=x1-x0+1,h=y1-y0+1,area=w*h/size,aspect=(h*cell)/(w*cell),fill=paper/(w*h);
      if(area<.025||area>.9||aspect<.8||aspect>10||fill<.48||w<3||h<7)continue;
      let surrounding=0,outside=0;for(let y=Math.max(0,y0-3);y<=Math.min(rows-1,y1+3);y++)for(let x=Math.max(0,x0-3);x<=Math.min(cols-1,x1+3);x++){if(x>=x0&&x<=x1&&y>=y0&&y<=y1)continue;surrounding+=light[y*cols+x];outside++;}
      const contrast=brightness/paper-(outside?surrounding/outside:brightness/paper);
      if(contrast<9)continue;
      const score=area*Math.min(aspect,3)*fill*Math.min(contrast,65);
      if(!best||score>best.score){const pad=Math.max(2,Math.round(width*.015));const left=Math.max(0,x0*cell-pad),top=Math.max(0,y0*cell-pad),right=Math.min(width,(x1+1)*cell+pad),bottom=Math.min(height,(y1+1)*cell+pad);best={left:left/width,top:top/height,width:(right-left)/width,height:(bottom-top)/height,score};}
    }
  }
  if(!best)return null;const {score,...bounds}=best;return bounds;
}
