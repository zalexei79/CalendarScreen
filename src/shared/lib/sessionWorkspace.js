// Tab-local drafts are not persisted transactions and are never submitted on restore.
// Keys are account-scoped; malformed or old snapshots are safely discarded.
const prefix='dayris_workspace_v1:';
export function workspaceKey(owner,name){
  return owner&&/^[0-9a-f-]{36}$/i.test(owner)?`${prefix}${owner}:${name}`:null;
}
export function readWorkspace(owner,name){
  const key=workspaceKey(owner,name);if(!key)return null;
  try{const text=sessionStorage.getItem(key);if(!text||text.length>24000)return null;const saved=JSON.parse(text);if(!saved||!Number.isFinite(saved.at)||Date.now()-saved.at>86400000||saved.at>Date.now()+60000)return null;return saved.value;}catch{return null;}
}
export function writeWorkspace(owner,name,value){
  const key=workspaceKey(owner,name);if(!key)return;
  try{const text=JSON.stringify({at:Date.now(),value});if(text.length<=24000)sessionStorage.setItem(key,text);}catch{/* Private mode or full storage must not block input. */}
}
export function clearWorkspace(owner,name){const key=workspaceKey(owner,name);try{if(key)sessionStorage.removeItem(key);}catch{}}
