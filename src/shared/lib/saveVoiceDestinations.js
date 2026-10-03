// Keep completed steps while the confirmation form is open, so a retry does
// not repeat a successful write to the other ledger.
export async function saveVoiceDestinations({destination,key,progress,saveCalendar,saveWallet}){
 if(progress.key&&progress.key!==key&&(progress.wallet||progress.calendar))throw new Error('Часть записи уже сохранена. Верните исходные поля и завершите сохранение.');
 progress.key=key;
 if(destination==='wallet'||destination==='both'){if(!progress.wallet){const result=await saveWallet();if(result)progress.walletResult=result;progress.wallet=true;}}
 if(destination==='main'||destination==='both'){if(!progress.calendar){const result=await saveCalendar();if(result)progress.calendarResult=result;progress.calendar=true;}}
}
