import {extractEntryDate,voiceEntryReview} from './voiceEntryReview.js';
import {parseNaturalVoiceEntry,resolveVoiceCorrections} from './naturalVoiceEntry.js';
import {parseCalendarVoiceCommand} from './calendarVoiceCommand.js';

const signature=entry=>JSON.stringify(['amount','currency','sign','category','dateKey','destination'].map(key=>entry[key]));

// Only a complete first utterance with explicit money fields can skip review.
// Defaults, corrections, batches and partial recognition retain the dialog.
export function canAutoSaveVoiceEntry(phrase,dialog,locale,categories=[],options={},evidence=null){
 const entry=dialog?.entry;
 if(!evidence?.isFinal||evidence.usedAlternative||!entry||dialog.batch||entry.mutation||!entry.category||entry.kind!=='record')return false;
 if(evidence.confidence>0&&evidence.confidence<0.6)return false;
 const corrected=resolveVoiceCorrections(phrase),date=extractEntryDate(corrected.text,options.todayKey);
 if(corrected.negated||date.invalid)return false;
 if(locale==='zh'){
  const command=parseCalendarVoiceCommand(phrase);
  if(command?.type!=='entry'||!command.category||!command.currency||!command.amount)return false;
 }else{
  const natural=parseNaturalVoiceEntry(date.text,{categories});
  if(!natural||natural.invalid||natural.ambiguous.length||natural.shorthand||!['sign','amount','currency','category'].every(field=>natural.provided.includes(field)))return false;
 }
 for(const alternative of evidence.alternatives||[]){
  const parsed=voiceEntryReview(alternative,null,locale,categories,{...options,requireCategory:true});
  if(parsed?.entry&&signature(parsed.entry)!==signature(entry))return false;
  if(parsed?.draft&&(parsed.draft.datePending||['amount','currency','sign','category'].some(field=>parsed.draft[field]&&parsed.draft[field]!==entry[field])))return false;
 }
 return true;
}
