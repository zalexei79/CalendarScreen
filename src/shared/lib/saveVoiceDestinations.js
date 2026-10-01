// Keep completed steps while the confirmation form is open, so a retry does
// not repeat a successful write to the other ledger.
export async function saveVoiceDestinations({destination,key,progress,saveCalendar,saveWallet}){
 if(progress.key&&progress.key!==key&&(progress.wallet||progress.calendar))throw new Error('Часть записи уже сохранена. Верните исходные поля и завершите сохранение.');
 progress.key=key;
 if(destination==='wallet'||destination==='both'){if(!progress.wallet){await saveWallet();progress.wallet=true;}}
 if(destination==='main'||destination==='both'){if(!progress.calendar){await saveCalendar();progress.calendar=true;}}
}
