export const windowKey = (id, meta) => id === 'global' && meta?.registered === false ? `${id}:${String(meta.selector).slice(0,600)}` : id;
export function openStudioWindow(windows, {id, view='design', meta=null, label=id}) {
  const key=windowKey(id,meta), existing=windows.find(item=>item.key===key);
  if(existing)return windows.map(item=>item.key===key ? {...item,view,meta:meta || item.meta,label} : item);
  const kept=windows.filter(item=>item.pinned);
  // Never silently discard a pinned editor to make room for another one.
  if(kept.length>=8)return windows;
  return [...kept,{key,id,view,meta,label,pinned:false,x:500+(kept.length%2)*450,y:54+Math.floor(kept.length/2)*520}];
}
export function restoreStudioLayout(raw) {
  const coordinate=n=>Math.max(-10000000,Math.min(10000000,n));
  try {
    const value=JSON.parse(raw);
    const point=value?.calendar;
    return {calendar:point && Number.isFinite(point.x) && Number.isFinite(point.y) ? {x:coordinate(point.x),y:coordinate(point.y)} : {x:24,y:54},positions:Array.isArray(value?.positions)?value.positions.filter(p=>typeof p.key==='string'&&p.key.length<=610&&Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,8).map(p=>({key:p.key,x:coordinate(p.x),y:coordinate(p.y)})):[]};
  }catch{return {calendar:{x:24,y:54},positions:[]};}
}
