// Bound every worker operation, including parameter changes. A terminated worker
// need not resolve its queued promise; cleanup must never hold the review UI open.
export function createReceiptOcrBudget({signal,timeoutMs=90000,onTimeout}={}){
  const end=Date.now()+timeoutMs;let stopped=false;
  return {
    remaining:()=>Math.max(0,end-Date.now()),
    run(operation,limitMs=20000){
      const task=Promise.resolve(operation);task.catch(()=>{});
      if(signal?.aborted)return Promise.reject(new Error('CANCELLED'));
      if(stopped||Date.now()>=end)return Promise.reject(new Error('OCR_TIMEOUT'));
      return new Promise((resolve,reject)=>{
        let settled=false;const finish=(callback,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);callback(value);};
        const abort=()=>finish(reject,new Error('CANCELLED'));
        const timer=setTimeout(()=>{stopped=true;try{onTimeout?.();}catch{}finish(reject,new Error('OCR_TIMEOUT'));},Math.min(limitMs,end-Date.now()));
        signal?.addEventListener('abort',abort,{once:true});
        task.then(value=>finish(resolve,value),error=>finish(reject,error));
      });
    },
  };
}
