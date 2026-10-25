// Average small blocks and remove global exposure changes. Screen banding and
// sensor noise must not restart auto-capture while the document stays in place.
export function receiptFrameStructure(pixels,width,height){
  const cols=16,rows=24,values=new Float32Array(cols*rows);let mean=0;
  for(let gy=0;gy<rows;gy++)for(let gx=0;gx<cols;gx++){
    let sum=0,count=0;for(let y=Math.floor(gy*height/rows);y<Math.floor((gy+1)*height/rows);y++)for(let x=Math.floor(gx*width/cols);x<Math.floor((gx+1)*width/cols);x++){sum+=pixels[y*width+x];count++;}
    const value=count?sum/count:0;values[gy*cols+gx]=value;mean+=value;
  }
  mean/=values.length;for(let i=0;i<values.length;i++)values[i]-=mean;
  return values;
}
export function createReceiptCaptureTracker(){
  let samples=[],lastSeen=0;
  return {
    reset(){samples=[];lastSeen=0;},
    observe({now,detected,motion=Infinity}){
      if(!detected){if(now-lastSeen>650){samples=[];return{capture:false,reset:true,holding:false};}return{capture:false,reset:false,holding:false};}
      lastSeen=now;samples=samples.filter(sample=>now-sample.now<=2000);samples.push({now,still:motion<12});
      const stable=samples.filter(sample=>sample.still).length,elapsed=now-samples[0].now;
      // A rolling majority tolerates a dropped detection or a single hand shake.
      const holding=stable>=2,capture=motion<12&&elapsed>=1000&&samples.length>=5&&stable>=Math.ceil(samples.length*.65);
      return{capture,reset:false,holding};
    },
  };
}
