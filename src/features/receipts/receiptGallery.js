// Keep auto capture paused until the native picker selects a file or is cancelled.
export function openReceiptGallery(input){
  if(!input)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const done=()=>{input.removeEventListener('change',done);input.removeEventListener('cancel',done);resolve();};
    input.addEventListener('change',done,{once:true});input.addEventListener('cancel',done,{once:true});
    try{input.click();}catch(error){input.removeEventListener('change',done);input.removeEventListener('cancel',done);reject(error);}
  });
}
