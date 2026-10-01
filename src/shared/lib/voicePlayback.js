export function voicesForLocale(voices,locale){return voices.filter(voice=>String(voice.lang).toLowerCase().replace(/_/g,'-').split('-')[0]===locale);}
export function selectPlaybackVoice(voices,locale,preferred='',online=true){
 const available=voicesForLocale(voices,locale).filter(voice=>online||voice.localService!==false);
 const selected=available.find(voice=>voice.voiceURI===preferred);if(selected)return selected;
 const score=voice=>(/premium|enhanced|natural|neural/i.test(voice.name)?100:0)+(/google/i.test(voice.name)?20:0)+(voice.default?5:0)+(voice.localService?2:0);
 return available.map((voice,index)=>({voice,index,score:score(voice)})).sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.voice||null;
}
