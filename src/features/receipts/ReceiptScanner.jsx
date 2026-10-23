import React,{useEffect,useRef,useState} from 'react';
import {Camera,Images,X} from 'lucide-react';

export default function ReceiptScanner({c,onClose,onFile,onGallery,onNativeCamera}){
  const video=useRef(null),frame=useRef(null),stream=useRef(null),mounted=useRef(false);
  const [state,setState]=useState('starting'),[capturing,setCapturing]=useState(false);
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
  async function capture(){
    if(state!=='ready'||capturing)return;
    const source=video.current,box=source.getBoundingClientRect(),target=frame.current.getBoundingClientRect();
    if(!source.videoWidth||!source.videoHeight)return;
    setCapturing(true);
    try{
      // Match the visible object-fit:cover preview, including the full framed total.
      const scale=Math.max(box.width/source.videoWidth,box.height/source.videoHeight);
      const x=(target.left-box.left+(source.videoWidth*scale-box.width)/2)/scale;
      const y=(target.top-box.top+(source.videoHeight*scale-box.height)/2)/scale;
      const width=target.width/scale,height=target.height/scale;
      const canvas=document.createElement('canvas');canvas.width=Math.round(width);canvas.height=Math.round(height);
      canvas.getContext('2d').drawImage(source,x,y,width,height,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));
      if(!mounted.current)return;
      if(!blob)throw new Error('CAPTURE_FAILED');
      onFile(new File([blob],'receipt.jpg',{type:'image/jpeg'}));
    }catch{setState('unavailable');setCapturing(false);}
  }
  return <div className="receipt-scanner">
    <header><div><small>DAYRIS <b>PRO</b></small><h2 id="receipt-title" tabIndex={-1}>{c.scanTitle}</h2></div><button type="button" aria-label={c.close} onClick={onClose}><X size={23}/></button></header>
    <div className="receipt-viewfinder"><video ref={video} muted playsInline autoPlay aria-label={c.scanTitle}/><div ref={frame} className="receipt-scan-frame" aria-hidden="true"><i/><i/><i/><i/></div><div className="receipt-scan-guidance" role="status"><strong>{state==='ready'?c.scanFrame:state==='starting'?c.scanStarting:c.scanCameraUnavailable}</strong><span>{c.scanTip}</span></div></div>
    <footer><button type="button" className="receipt-scan-gallery" onClick={onGallery}><Images size={23}/><span>{c.gallery}</span></button><button type="button" className="receipt-shutter" disabled={state==='starting'||capturing} aria-label={c.camera} onClick={state==='ready'?capture:onNativeCamera}><Camera size={25}/></button><span className="receipt-scan-spacer" aria-hidden="true"/></footer>
  </div>;
}
