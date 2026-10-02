import {parseChineseAmount} from './chineseNumber.js';
const words = {
  ноль:0,один:1,одна:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,
  десять:10,одиннадцать:11,двенадцать:12,тринадцать:13,четырнадцать:14,пятнадцать:15,шестнадцать:16,семнадцать:17,восемнадцать:18,девятнадцать:19,
  двадцать:20,тридцать:30,сорок:40,пятьдесят:50,шестьдесят:60,семьдесят:70,восемьдесят:80,девяносто:90,
  сто:100,двести:200,триста:300,четыреста:400,пятьсот:500,шестьсот:600,семьсот:700,восемьсот:800,девятьсот:900,
  zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,
  un:1,o:1,unu:1,una:1,doi:2,două:2,trei:3,patru:4,cinci:5,șase:6,șapte:7,opt:8,nouă:9,zece:10,unsprezece:11,doisprezece:12,treisprezece:13,paisprezece:14,cincisprezece:15,șaisprezece:16,șaptesprezece:17,optsprezece:18,nouăsprezece:19,douăzeci:20,treizeci:30,patruzeci:40,cincizeci:50,șaizeci:60,șaptezeci:70,optzeci:80,nouăzeci:90,
};
const scales={тысяча:1000,тысячи:1000,тысяч:1000,миллион:1000000,миллиона:1000000,миллионов:1000000,thousand:1000,million:1000000,mie:1000,mii:1000,milion:1000000,milioane:1000000};
const romanianPlain=value=>value.replace(/[șş]/g,'s').replace(/[țţ]/g,'t').replace(/[ăâ]/g,'a').replace(/î/g,'i');
const plainWords=Object.fromEntries(Object.entries(words).map(([word,value])=>[romanianPlain(word),value]));
const units='рубль|рубля|рублей|доллар|доллара|долларов|евро|лей|лея|леев|dollar|dollars|euro|euros|ruble|rubles|leu|lei|usd|eur|rub|mdl';
const cents='копейка|копейки|копеек|цент|цента|центов|cent|cents|ban|bani';
function integer(text) {
  text=text.trim();
  if(!text||/^(and|și|si|de)\b|\b(and|și|si|de)$/.test(text))return null;
  if(/^\d+$/.test(text))return Number(text);
  let total=0,group=0,rank=Infinity,lastScale=Infinity;
  for(const token of text.split(/\s+/)) {
    if(token==='and'||token==='și'||token==='si'||token==='de')continue;
    if(token==='hundred'||token==='sută'||token==='suta'||token==='sute') {
      if(group>9||rank!==1)return null;
      group*=100;rank=100;continue;
    }
    if(scales[token]) {
      if(scales[token]>=lastScale)return null;
      total+=(group||1)*scales[token];group=0;rank=Infinity;lastScale=scales[token];continue;
    }
    const n=words[token]??plainWords[romanianPlain(token)];if(n===undefined)return null;
    const nextRank=n>=100?100:n>=10?10:1;
    if(nextRank>=rank)return null;
    group+=n;rank=nextRank;
  }
  return total+group;
}
// Accept an amount phrase only. Dates, signs, unrelated words and multiple
// amounts are rejected instead of picking the first number from a sentence.
export function parseSpokenAmount(transcript) {
  if (/[零〇一二两三四五六七八九十百千万亿点元块角分]|人民币|美元|美金|欧元|卢布|列伊/.test(String(transcript))) return parseChineseAmount(transcript);
  let text=String(transcript).toLowerCase().trim().replace(/[.!?]$/,'').replace(/ё/g,'е');
  text=text.replace(/^(?:сумма|amount|suma)\s+/,'');
  if(!text)return null;
  let value;
  const centsMatch=text.match(new RegExp(`^(.+?)\\s+(?:${units})\\s+(?:(?:and|и|și|si)\\s+)?(.+?)\\s+(?:${cents})$`));
  if(centsMatch) {
    const main=integer(centsMatch[1]),fraction=integer(centsMatch[2]);
    if(main===null||fraction===null||fraction>99)return null;
    value=main+fraction/100;
  } else {
    text=text.replace(new RegExp(`\\s+(?:${units})$`),'');
    if(/^\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{1,2})?$/.test(text))text=text.replace(/[ \u00a0]/g,'');
    if(/^\d+(?:[.,]\d{1,2})?$/.test(text))value=Number(text.replace(',','.'));
    else {
      const parts=text.split(/\s+(?:точка|запятая|point|comma|virgulă|virgula)\s+/);
      if(parts.length>2)return null;
      const main=integer(parts[0]);if(main===null)return null;
      if(parts.length===1)value=main;
      else {
        const tokens=parts[1].split(/\s+/);
        let fraction=tokens.every(t=>words[t]!==undefined&&words[t]<10)?tokens.map(t=>words[t]).join(''):parts[1];
        if(!/^\d{1,2}$/.test(fraction)) {const n=integer(parts[1]);if(n===null||n>99)return null;fraction=String(n);}
        if(fraction.length>2)return null;
        value=Number(`${main}.${fraction}`);
      }
    }
  }
  return Number.isFinite(value)&&value>=0&&value<1e12?String(Math.round(value*100)/100):null;
}
