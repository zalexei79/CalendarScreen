import {normalizeProductText,productTypeById} from './productCatalog.js';
export const productIdentity = name => normalizeProductText(name).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const storageKey = owner => `dayris_receipt_types:v1:${owner}`;
export function readProductMemory(owner,storage) {
  if(!owner)return{};
  try{
    const parsed=JSON.parse((storage||globalThis.localStorage).getItem(storageKey(owner))||'{}');
    return Object.fromEntries(Object.entries(parsed).filter(([name,id])=>name&&name.length<=240&&productTypeById(id)).slice(-1000));
  }catch{return{};}
}
export function rememberProductType(owner,name,id,storage) {
  const memory=readProductMemory(owner,storage),key=productIdentity(name);
  if(!owner||!key||key.length>240)return memory;
  delete memory[key];
  if(productTypeById(id))memory[key]=id;
  const next=Object.fromEntries(Object.entries(memory).slice(-1000));
  try{(storage||globalThis.localStorage).setItem(storageKey(owner),JSON.stringify(next));}catch{/* The current selection still works without persistent storage. */}
  return next;
}
export function recalledProductType(memory,name) {const key=productIdentity(name);return Object.hasOwn(memory,key)?memory[key]:'';}
