// DAYRIS-owned canvas renderer. No external chart widget or branding.
export const CandlestickSeries='candles',LineSeries='line',HistogramSeries='volume',AreaSeries='area';
export const LineStyle={Dashed:1},ColorType={Solid:'solid'};
const numericTime=time=>typeof time==='string'?Date.parse(time+'T00:00:00Z')/1000:Number(time);
export function createChart(host,initial={}){
 const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;user-select:none';canvas.tabIndex=0;host.appendChild(canvas);
 const ctx=canvas.getContext('2d'),all=[],rangeHandlers=new Set(),crossHandlers=new Set(),contacts=new Map(),listeners=[];
 let options=initial,width=1,height=1,range={from:0,to:100},frame=0,removed=false,hover=null,drag=null,pinch=null;const stretches=new Map([[0,5]]);
 const master=()=>all.find(series=>series.kind==='candles'||series.kind==='area')?.data||all[0]?.data||[];
 const bounds=()=>({left:8,right:Math.max(30,width-70),top:8,bottom:Math.max(40,height-25)});
 const schedule=()=>{if(!removed&&!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});};
 function setRange(next){if(!Number.isFinite(next?.from)||!Number.isFinite(next?.to))return;const middle=(next.from+next.to)/2,size=Math.max(.5,Math.min(40000,next.to-next.from));range={from:middle-size/2,to:middle+size/2};rangeHandlers.forEach(fn=>fn({...range}));schedule();}
 const scale={getVisibleLogicalRange:()=>({...range}),setVisibleLogicalRange:setRange,fitContent:()=>setRange({from:-.5,to:Math.max(1.5,master().length-.5)}),subscribeVisibleLogicalRangeChange:fn=>rangeHandlers.add(fn),unsubscribeVisibleLogicalRangeChange:fn=>rangeHandlers.delete(fn)};
 const valueFormat=value=>{try{return options.localization?.priceFormatter?.(value)??new Intl.NumberFormat(options.localization?.locale||'en',{maximumFractionDigits:4}).format(value);}catch{return String(value);}};
 function addSeries(kind,config={},pane=0){const series={kind,config,pane,data:[],map:new Map(),lines:[],setData(data){series.data=data;series.map=new Map(data.map(row=>[numericTime(row.time),row]));schedule();},createPriceLine(line){series.lines.push(line);schedule();return line;},applyOptions(update){series.config={...series.config,...update};schedule();}};all.push(series);schedule();return series;}
 function panes(){const count=Math.max(0,...all.map(s=>s.pane))+1;return Array.from({length:count},(_,index)=>({setStretchFactor(value){stretches.set(index,value);schedule();}}));}
 function paneGeometry(){const b=bounds(),count=panes().length,total=Array.from({length:count},(_,i)=>stretches.get(i)||1).reduce((a,b)=>a+b,0);let y=b.top;return Array.from({length:count},(_,i)=>{const h=(b.bottom-b.top)*(stretches.get(i)||1)/total,geometry={top:y+5,bottom:y+h-7};y+=h;return geometry;});}
 function draw(){
  if(removed)return;const dpr=window.devicePixelRatio||1;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle=options.layout?.background?.color||'#08090c';ctx.fillRect(0,0,width,height);
  const rows=master(),b=bounds(),span=range.to-range.from,x=index=>b.left+(index-range.from)/span*(b.right-b.left),start=Math.max(0,Math.floor(range.from)),end=Math.min(rows.length-1,Math.ceil(range.to));
  ctx.font=`${options.layout?.fontSize||10}px system-ui,sans-serif`;ctx.textBaseline='middle';const muted=options.layout?.textColor||'#8c909a',grid=options.grid?.horzLines?.color||'#ffffff10';
  paneGeometry().forEach((pane,paneIndex)=>{
   const series=all.filter(s=>s.pane===paneIndex);let min=Infinity,max=-Infinity;
   for(let i=start;i<=end;i++){const time=numericTime(rows[i]?.time);for(const s of series){const row=s.map.get(time);if(!row)continue;const values=s.kind==='candles'?[row.low,row.high]:[row.value];for(const value of values){if(Number.isFinite(Number(value))){min=Math.min(min,Number(value));max=Math.max(max,Number(value));}}}}
   const fixed=series.find(s=>s.config.autoscaleInfoProvider)?.config.autoscaleInfoProvider()?.priceRange;if(fixed){min=fixed.minValue;max=fixed.maxValue;}
   if(series.some(s=>s.kind==='volume'))min=0;
   if(!Number.isFinite(min)){min=0;max=1;}const padding=fixed?0:Math.max((max-min)*.1,Math.abs(max)*.002,.00000001);if(!series.some(s=>s.kind==='volume'))min-=padding;max+=padding;if(max===min)max=min+1;
   const y=value=>pane.bottom-(Number(value)-min)/(max-min)*(pane.bottom-pane.top);
   ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.setLineDash([]);
   for(let n=0;n<3;n++){const py=pane.top+(pane.bottom-pane.top)*n/2;ctx.beginPath();ctx.moveTo(b.left,py);ctx.lineTo(b.right,py);ctx.stroke();ctx.fillStyle=muted;const value=max-(max-min)*n/2;ctx.fillText(paneIndex&&series.some(s=>s.kind==='volume')?new Intl.NumberFormat(options.localization?.locale,{notation:'compact',maximumFractionDigits:1}).format(value):valueFormat(value),b.right+7,py);}
   ctx.save();ctx.beginPath();ctx.rect(b.left,pane.top,b.right-b.left,pane.bottom-pane.top);ctx.clip();
   for(const s of series){
    if(s.kind==='candles'||s.kind==='volume'){
     for(let i=start;i<=end;i++){const row=s.map.get(numericTime(rows[i]?.time));if(!row)continue;const px=x(i),body=Math.max(.6,(b.right-b.left)/span*.65);
      if(s.kind==='candles'){const up=row.close>=row.open;ctx.strokeStyle=ctx.fillStyle=up?(s.config.upColor||'#67c7ac'):(s.config.downColor||'#d8989c');ctx.beginPath();ctx.moveTo(px,y(row.high));ctx.lineTo(px,y(row.low));ctx.stroke();ctx.fillRect(px-body/2,Math.min(y(row.open),y(row.close)),body,Math.max(1,Math.abs(y(row.open)-y(row.close))));}
      else{ctx.fillStyle=row.color||'#67c7ac88';ctx.fillRect(px-body/2,y(row.value),body,Math.max(0,pane.bottom-y(row.value)));}
     }
    }else{
     const points=[];for(let i=start;i<=end;i++){const row=s.map.get(numericTime(rows[i]?.time));if(row&&Number.isFinite(row.value))points.push({x:x(i),y:y(row.value)});}if(!points.length)continue;
     ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=s.config.color||s.config.lineColor||'#67c7ac';ctx.lineWidth=s.config.lineWidth||1.5;ctx.stroke();ctx.lineWidth=1;
     if(s.kind==='area'){ctx.lineTo(points.at(-1).x,pane.bottom);ctx.lineTo(points[0].x,pane.bottom);ctx.closePath();const fill=ctx.createLinearGradient(0,pane.top,0,pane.bottom);fill.addColorStop(0,s.config.topColor||'#67c7ac22');fill.addColorStop(1,s.config.bottomColor||'#67c7ac00');ctx.fillStyle=fill;ctx.fill();if(s.config.pointMarkersVisible){ctx.fillStyle=s.config.lineColor||'#67c7ac';for(const p of points){ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();}}}
    }
    for(const line of s.lines){const py=y(line.price);if(py<pane.top||py>pane.bottom)continue;ctx.setLineDash([4,4]);ctx.strokeStyle=line.color||'#edcd87';ctx.beginPath();ctx.moveTo(b.left,py);ctx.lineTo(b.right,py);ctx.stroke();ctx.setLineDash([]);if(line.title){ctx.fillStyle=line.color;ctx.fillText(line.title,b.left+6,py-9);}}
   }
   if(hover){ctx.setLineDash([3,4]);ctx.strokeStyle=muted;ctx.beginPath();ctx.moveTo(hover.x,pane.top);ctx.lineTo(hover.x,pane.bottom);ctx.stroke();ctx.setLineDash([]);}
   ctx.restore();
  });
  const formatter=new Intl.DateTimeFormat(options.localization?.locale,{month:'short',day:'numeric',...(options.timeScale?.timeVisible?{hour:'2-digit',minute:'2-digit'}:{})});ctx.fillStyle=muted;
  for(let n=0;n<4;n++){const i=Math.round(range.from+span*n/3);if(i<0||i>=rows.length)continue;const label=formatter.format(new Date(numericTime(rows[i].time)*1000));ctx.fillText(label,Math.min(b.right-ctx.measureText(label).width,Math.max(b.left,x(i))),height-10);}
 }
 const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
 function inspect(p){const b=bounds(),index=Math.round(range.from+(p.x-b.left)/(b.right-b.left)*(range.to-range.from)),row=master()[index];hover=p;if(row){const time=numericTime(row.time),data=new Map(all.map(s=>[s,s.map.get(time)]).filter(([,row])=>row));crossHandlers.forEach(fn=>fn({time:row.time,seriesData:data}));}schedule();}
 function baseGesture(){const entries=[...contacts.values()],b=bounds();if(entries.length>=2){const [a,z]=entries,p=Math.hypot(a.x-z.x,a.y-z.y)||1,center=(a.x+z.x)/2;pinch={distance:p,span:range.to-range.from,anchor:range.from+(center-b.left)/(b.right-b.left)*(range.to-range.from)};drag=null;}else if(entries.length){drag={x:entries[0].x,range:{...range}};pinch=null;}else{drag=pinch=null;}}
 const listen=(name,fn,settings)=>{canvas.addEventListener(name,fn,settings);listeners.push([name,fn,settings]);};
 listen('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;contacts.set(e.pointerId,point(e));canvas.setPointerCapture(e.pointerId);baseGesture();inspect(point(e));e.preventDefault();});
 listen('pointermove',e=>{const p=point(e);if(!contacts.has(e.pointerId)){inspect(p);return;}contacts.set(e.pointerId,p);const b=bounds();if(contacts.size>=2&&pinch){const [a,z]=[...contacts.values()],distance=Math.hypot(a.x-z.x,a.y-z.y)||1,span=pinch.span*pinch.distance/distance,center=(a.x+z.x)/2,from=pinch.anchor-(center-b.left)/(b.right-b.left)*span;setRange({from,to:from+span});}else if(drag){const shift=(p.x-drag.x)/(b.right-b.left)*(drag.range.to-drag.range.from);setRange({from:drag.range.from-shift,to:drag.range.to-shift});}inspect(p);e.preventDefault();});
 const finish=e=>{contacts.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);baseGesture();};listen('pointerup',finish);listen('pointercancel',finish);listen('pointerleave',()=>{if(!contacts.size){hover=null;crossHandlers.forEach(fn=>fn({seriesData:new Map()}));schedule();}});
 listen('wheel',e=>{e.preventDefault();const b=bounds(),p=point(e),span=range.to-range.from;if(Math.abs(e.deltaX)>Math.abs(e.deltaY)){const shift=e.deltaX/(b.right-b.left)*span;setRange({from:range.from+shift,to:range.to+shift});}else{const next=span*Math.exp(Math.max(-500,Math.min(500,e.deltaY))*.002),anchor=range.from+(p.x-b.left)/(b.right-b.left)*span,from=anchor-(p.x-b.left)/(b.right-b.left)*next;setRange({from,to:from+next});}},{passive:false});
 listen('keydown',e=>{const span=range.to-range.from;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const shift=span*.12*(e.key==='ArrowLeft'?-1:1);setRange({from:range.from+shift,to:range.to+shift});}else if(e.key==='Home'){e.preventDefault();scale.fitContent();}else if(['+','=','-'].includes(e.key)){e.preventDefault();const size=span*(e.key==='-'?1.35:.75),middle=(range.from+range.to)/2;setRange({from:middle-size/2,to:middle+size/2});}});
 const resize=()=>{width=Math.max(1,host.clientWidth);height=Math.max(1,host.clientHeight);const dpr=window.devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);schedule();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
 return{addSeries,timeScale:()=>scale,panes,subscribeCrosshairMove:fn=>crossHandlers.add(fn),applyOptions(update){options={...options,...update,timeScale:{...options.timeScale,...update.timeScale}};schedule();},remove(){removed=true;cancelAnimationFrame(frame);observer.disconnect();listeners.forEach(([name,fn,settings])=>canvas.removeEventListener(name,fn,settings));canvas.remove();all.length=0;rangeHandlers.clear();crossHandlers.clear();}};
}
