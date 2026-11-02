// Device preferences are scoped to the signed-in account. Message keys never enter storage.
const prefix='dayris:friends:v1:';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(prefix+key))??fallback;}catch{return fallback;}}
function write(key,value){try{if(value===null)localStorage.removeItem(prefix+key);else localStorage.setItem(prefix+key,JSON.stringify(value));}catch{/* Storage may be disabled or full. */}window.dispatchEvent(new CustomEvent('dayris:friend-local'));}
export function readFavoriteFriends(owner){const value=read(owner+':favorites',[]);return Array.isArray(value)?value.filter(v=>typeof v==='string').slice(0,100):[];}
export function toggleFavoriteFriend(owner,peer){const previous=readFavoriteFriends(owner),next=previous.includes(peer)?previous.filter(id=>id!==peer):[...previous,peer].slice(-100);write(owner+':favorites',next);return next;}
export function readFriendDraft(owner,peer){const value=read(owner+':draft:'+peer,'');return typeof value==='string'?value.slice(0,2000):'';}
export function saveFriendDraft(owner,peer,value){write(owner+':draft:'+peer,value?value.slice(0,2000):null);}
export function hasProtectedFriendDraft(owner,peer){return read(owner+':protected-draft:'+peer,false)===true;}
export function setProtectedFriendDraft(owner,peer,present){write(owner+':protected-draft:'+peer,present?true:null);}
export function readFriendLockMode(owner,peer){return read(owner+':locked:'+peer,false)===true;}
export function saveFriendLockMode(owner,peer){write(owner+':locked:'+peer,true);}
export function readSavedMessages(owner,peer){const value=read(owner+':saved:'+peer,[]);return Array.isArray(value)?value.filter(v=>typeof v==='string').slice(-100):[];}
export function toggleSavedMessage(owner,peer,id){const previous=readSavedMessages(owner,peer),next=previous.includes(id)?previous.filter(key=>key!==id):[...previous,id].slice(-100);write(owner+':saved:'+peer,next);return next;}
