import {voiceEntryReview,localDateKey} from './voiceEntryReview.js';

// A follow-up inherits only confirmed context, never the previous amount,
// category, sign or mutation metadata. Explicit spoken fields override it.
export function followupVoiceEntry(phrase,lastEntry,locale='ru',categories=[],options={}){
 if(locale!=='ru')return null;
 const match=String(phrase).trim().replace(/ё/g,'е').match(/^(?:и\s+)?еще(?:\s+|[,—-]\s*)(.+)$/i);
 if(!match)return null;
 const seed={dateKey:lastEntry?.dateKey||options.baseDate||options.todayKey||localDateKey(),destination:lastEntry?.destination||'main',...(lastEntry?.currency?{currency:lastEntry.currency}:{})};
 return voiceEntryReview(match[1],seed,locale,categories,{...options,newEntry:true,defaultCurrency:lastEntry?.currency||options.defaultCurrency});
}
