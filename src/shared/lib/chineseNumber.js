const digits = {零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};

function integer(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const scaled=text.match(/^(\d+)(万|亿)$/);if(scaled)return Number(scaled[1])*(scaled[2]==='万'?10000:100000000);
  if (!/^[零〇一二两三四五六七八九十百千万亿]+$/.test(text)) return null;
  if (!/[十百千万亿]/.test(text)) return Number([...text].map(c => digits[c]).join(''));
  let total=0,section=0,digit=0,lastSmall=Infinity,lastLarge=Infinity,hasDigit=false;
  for (const c of text) {
    if (c in digits) {
      const next=digits[c];
      if (hasDigit && digit!==0 && next!==0) return null;
      digit=next;hasDigit=true;continue;
    }
    const scale={十:10,百:100,千:1000,万:10000,亿:100000000}[c];
    if (scale<10000) {
      if (scale>=lastSmall || (!hasDigit && (scale!==10 || section!==0))) return null;
      section+=(hasDigit?digit:1)*scale;lastSmall=scale;digit=0;hasDigit=false;
    } else {
      if (scale>=lastLarge || section+digit===0) return null;
      total+=(section+digit)*scale;section=0;digit=0;hasDigit=false;lastSmall=Infinity;lastLarge=scale;
    }
  }
  return total+section+digit;
}

export function parseChineseAmount(value) {
  const text=String(value).trim().replace(/^金额\s*/,'').replace(/[。！？!?]$/,'').replace(/\s+/g,'');
  let result;
  const money=!/(?:美元|欧元|美金|卢布|列伊)$/.test(text)&&text.match(/^(.+?)(?:元|块)(?:([零〇一二两三四五六七八九\d])角)?(?:([零〇一二两三四五六七八九\d])分)?$/);
  if(money){const whole=parseChineseAmount(money[1]);if(whole===null||(Number(whole)%1!==0&&(money[2]||money[3])))return null;result=Number(whole)+Number(money[2] in digits?digits[money[2]]:money[2]||0)/10+Number(money[3] in digits?digits[money[3]]:money[3]||0)/100;}
  else {
    const normalized=text.replace(/(?:人民币|美元|美金|欧元|卢布|列伊|元|块)$/,'');
    const parts=normalized.split(/[点.]/);if(parts.length>2)return null;
    const whole=integer(parts[0]);if(whole===null)return null;
    if(parts.length===2){if(!/^[零〇一二两三四五六七八九\d]{1,2}$/.test(parts[1]))return null;result=whole+Number([...parts[1]].map(c=>c in digits?digits[c]:c).join(''))/10**parts[1].length;}
    else result=whole;
  }
  if(!Number.isFinite(result)||result<0||result>=1e12)return null;
  return String(Math.round(result*100)/100);
}
