// Average small blocks and remove global exposure/contrast changes. Screen banding and
// sensor noise must not restart auto-capture while the document stays in place.
export function receiptFrameStructure(pixels,width,height){
  const cols=32,rows=48,values=new Float32Array(cols*rows);let mean=0;
  for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){
    let sum=0,count=0;for(let y=Math.floor(gy*height/rows);y<Math.floor((gy+1)*height/rows);y++)for(let x=Math.floor(gx*width/cols);x<Math.floor((gx+1)*width/cols);x++){sum+=pixels[y*width+x];count++;}
    const value=count?sum/count:0;values[gy*cols+gx]=value;mean+=value;
  }
  mean/=values.length;let variance=0;
  for(let i=0;i<values.length;i++){values[i]-=mean;variance+=values[i]*values[i];}
  const normalize=24/Math.max(12,Math.sqrt(variance/values.length));
  for(let i=0;i<values.length;i++)values[i]*=normalize;
  return values;
}
export const RECEIPT_STEADY_MS=1500;
export function createReceiptCaptureTracker(){
  let started=null,lastSample=null,lastSeen=null,samples=[];
  const clear=()=>{started=null;samples=[];};
  return {
    reset(){clear();lastSample=null;lastSeen=null;},
    observe({now,detected,motion=Infinity,drift=motion,quality}){
      const gap=lastSample!==null&&(now-lastSample>500||now<=lastSample);lastSample=now;
      if(detected)lastSeen=now;
      // Exposure flicker may hide the paper hint for one or two samples. Keep
      // measuring motion and sharpness through that gap, but never shoot in it.
      const recognized=detected||(started!==null&&lastSeen!==null&&now-lastSeen<=600);
      const phase=!recognized?'searching':!quality?.ready?'focusing':'moving';
      if(gap||!recognized||!quality?.ready||!Number.isFinite(quality.sharpness)||!Number.isFinite(motion)||!Number.isFinite(drift)||motion>=4.5||drift>=6){
        clear();return {capture:false,reset:true,holding:false,detected:!!detected,phase,progress:0};
      }
      if(started===null)started=now;
      samples.push({now,sharpness:quality.sharpness});
      samples=samples.filter(sample=>now-sample.now<=750);
      const sharpness=samples.map(sample=>sample.sharpness),peak=Math.max(...sharpness);
      // Let autofocus finish settling; one good frame between soft frames is
      // insufficient. No elapsed-time fallback may force a blurry capture.
      const focused=samples.length>=3&&Math.min(...sharpness)>=peak*.8;
      const elapsed=now-started,holding=elapsed>=250;
      return {capture:!!detected&&elapsed>=RECEIPT_STEADY_MS&&focused,reset:false,holding,detected:true,phase:focused?'steady':'focusing',progress:Math.min(1,elapsed/RECEIPT_STEADY_MS)};
    },
  };
}
