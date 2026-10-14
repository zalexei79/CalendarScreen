import {parseScaled,QUANTITY_SCALE,MONEY_SCALE,multiplyScaled} from './decimal.js';
export function salePreview(asset,quantity,price,fee='0') {
 if(!asset)return null;
 try{const q=parseScaled(quantity,QUANTITY_SCALE),p=parseScaled(price,MONEY_SCALE),f=parseScaled(fee||'0',MONEY_SCALE);
 if(q<=0n||q>asset.quantity||asset.quantity<=0n)return null;
 const gross=multiplyScaled(q,QUANTITY_SCALE,p,MONEY_SCALE),cost=(asset.invested*q+asset.quantity/2n)/asset.quantity;
 return {quantity:q,gross,fee:f,proceeds:gross-f,cost,pnl:gross-f-cost};
 }catch{return null;}
}
