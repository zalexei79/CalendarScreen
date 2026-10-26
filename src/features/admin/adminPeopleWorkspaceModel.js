import {DATASETS,monthBounds} from './adminUsersModel.js';
// A feed row may only navigate within the currently selected owner's data.
export function entryLocation(row,userId) {
 if(!row||row.user_id!==userId||!DATASETS.some(d=>d.id===row.dataset))return null;
 const date=String(row.record_date||'').slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 try{const bounds=monthBounds(date.slice(0,7));if(date<bounds.from||date>bounds.to)return null;}catch{return null;}
 return {month:date.slice(0,7),day:date,dataset:row.dataset,key:String(row.record_key||'')};
}
