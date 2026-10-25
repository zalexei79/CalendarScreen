import React,{useEffect,useRef,useState} from 'react';
import {Camera,Images,X} from 'lucide-react';
import {receiptFrameSignal,receiptFrameMotion} from './receiptFrameSignal.js';
import {receiptFrameStructure,createReceiptCaptureTracker} from './receiptCaptureTracker.js';

export default function ReceiptScanner({c,onClose,onFile,onGallery,onNativeCamera}){
  const video=useRef(null),frame=useRef(null),stream=useRef(null),mounted=useRef(false),captureLock=useRef(false),captureLatest=useRef(null),bestFrame=useRef(null),galleryPending=useRef(false);
  const [auto,setAuto]=useState(true),[holding,setHolding]=useState(false),[detected,setDetected]=useState(false);
  const [state,setState]=useState('starting'),[capturing,setCapturing]=useState(false),[frozen,setFrozen]=useState(''),[galleryBusy,setGalleryBusy]=useState(false);
  useEffect(()=>{
    let active=true;mounted.current=true;
    const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;};
    const hide=()=>{if(document.hidden){stop();if(active)setState('unavailable');}};
    document.addEventListener('visibilitychange',hide);
    (async()=>{try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('NO_CAMERA');
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:2560}},audio:false});
      if(!active||document.hidden){media.getTracks().forEach(track=>track.stop());return;}
      stream.current=media;video.current.srcObject=media;
      await video.current.play();if(active)setState('ready');
    }catch{stop();if(active)setState('unavailable');}})();
    return()=>{active=false;mounted.current=false;stop();document.removeEventListener('visibilitychange',hide);};
  },[]);
  function snapshot(){
    const source=video.current,box=source.getBoundingClientRect(),target=frame.current.getBoundingClientRect();
    const scale=Math.max(box.width/source.videoWidth,box.height/source.videoHeight);
    if(!Number.isFinite(scale)||scale<=0)return null;
    const x=(target.left-box.left+(source.videoWidth*scale-box.width)/2)/scale,y=(target.top-box.top+(source.videoHeight*scale-box.height)/2)/scale;
    const width=target.width/scale,height=target.height/scale,canvas=document.createElement('canvas');
    canvas.width=Math.round(width);canvas.height=Math.round(height);
    canvas.getContext('2d').drawImage(source,x,y,width,height,0,0,canvas.width,canvas.height);return canvas;
  }
  async function chooseGallery(){
    galleryPending.current=true;setGalleryBusy(true);
    try{await onGallery();}finally{galleryPending.current=false;if(mounted.current)setGalleryBusy(false);}
  }
  async function capture(candidate){
    if(state!=='ready'||galleryPending.current||captureLock.current||!mounted.current||document.hidden||!video.current.videoWidth)return;
    captureLock.current=true;setCapturing(true);
    try{
      const canvas=candidate||snapshot();if(!canvas)throw new Error('CAPTURE_FAILED');
      setFrozen(canvas.toDataURL('image/jpeg',.85));video.current.pause();
      stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));
      if(!mounted.current)return;
      if(!blob)throw new Error('CAPTURE_FAILED');
      onFile(new File([blob],'receipt.jpg',{type:'image/jpeg'}));
    }catch{captureLock.current=false;if(mounted.current){setState('unavailable');setCapturing(false);setFrozen('');}}
  }
  captureLatest.current=capture;
  useEffect(()=>{
    if(capturing)return;
    setHolding(false);setDetected(false);
    if(state!=='ready')return;
    let previous=null;const tracker=createReceiptCaptureTracker();bestFrame.current=null;
    const sample=document.createElement('canvas');sample.width=160;sample.height=240;
    const context=sample.getContext('2d',{willReadFrequently:true});
    const timer=setInterval(()=>{
      if(document.hidden||galleryPending.current||!video.current?.videoWidth||captureLock.current){previous=null;tracker.reset();bestFrame.current=null;setHolding(false);setDetected(false);return;}
      try{
        const source=video.current,box=source.getBoundingClientRect(),target=frame.current.getBoundingClientRect();
        const scale=Math.max(box.width/source.videoWidth,box.height/source.videoHeight);
        if(!Number.isFinite(scale)||scale<=0)return;
        const x=(target.left-box.left+(source.videoWidth*scale-box.width)/2)/scale,y=(target.top-box.top+(source.videoHeight*scale-box.height)/2)/scale;
        context.drawImage(source,x,y,target.width/scale,target.height/scale,0,0,160,240);
        const signal=receiptFrameSignal(context.getImageData(0,0,160,240));setDetected(signal.document);
        const structure=receiptFrameStructure(signal.pixels,160,240),motion=receiptFrameMotion(previous,structure);previous=structure;
        const now=performance.now(),decision=tracker.observe({now,detected:signal.document,motion});
        if(decision.reset)bestFrame.current=null;
        setHolding(auto&&decision.holding);if(!auto)return;
        if(signal.document){
          let sharpness=0;for(let i=1;i<signal.pixels.length;i++)sharpness+=Math.abs(signal.pixels[i]-signal.pixels[i-1]);sharpness/=signal.pixels.length;
          if(!bestFrame.current||now-bestFrame.current.at>800||sharpness>bestFrame.current.sharpness+1){const image=snapshot();if(image)bestFrame.current={image,at:now,sharpness};}
        }
        if(decision.capture&&bestFrame.current){clearInterval(timer);captureLatest.current?.(bestFrame.current.image);}
      }catch{previous=null;tracker.reset();bestFrame.current=null;setHolding(false);setDetected(false);}
    },250);
    return()=>{clearInterval(timer);bestFrame.current=null;};
  },[state,auto,capturing]);
  return <div className="receipt-scanner">
    <header><div><small>DAYRIS <b>PRO</b></small><h2 id="receipt-title" tabIndex={-1}>{c.scanTitle}</h2></div><button type="button" aria-label={c.close} onClick={onClose}><X size={23}/></button></header>
    <div className="receipt-viewfinder"><video ref={video} muted playsInline autoPlay aria-label={c.scanTitle}/>{frozen&&<img className="receipt-scan-frozen" src={frozen} alt={c.sourcePhoto}/>}<div ref={frame} className="receipt-scan-frame" data-holding={holding} data-detected={detected} aria-hidden="true"><i/><i/><i/><i/></div><div className="receipt-scan-guidance" role="status"><strong>{capturing?c.scanCaptured:state==='ready'?(detected?c.scanHold:c.scanFrame):state==='starting'?c.scanStarting:c.scanCameraUnavailable}</strong><span>{capturing?c.ocrLocal:auto?c.scanAutoHint:c.scanTip}</span></div></div>
    <footer><button type="button" className="receipt-scan-gallery" disabled={capturing||galleryBusy} onClick={chooseGallery}><Images size={23}/><span>{c.scanGallery}</span></button><button type="button" className="receipt-shutter" disabled={state==='starting'||capturing||galleryBusy} aria-label={c.camera} onClick={state==='ready'?()=>capture():onNativeCamera}><Camera size={25}/></button><button type="button" className="receipt-scan-auto" disabled={capturing||galleryBusy} aria-pressed={auto} onClick={()=>setAuto(value=>!value)}>{c.scanAuto}<span>{auto?c.scanAutoOn:c.scanAutoOff}</span></button></footer>
  </div>;
}
