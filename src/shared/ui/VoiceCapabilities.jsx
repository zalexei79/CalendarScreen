import React from 'react';
import {ChevronDown} from 'lucide-react';

export default function VoiceCapabilities({catalog}){
 return <section className="voice-capabilities" aria-label={catalog.title}>
  <h2>{catalog.title}</h2><p>{catalog.summary}</p>
  <div>{catalog.groups.map(group=><details key={group.title}><summary>{group.title}<ChevronDown size={14}/></summary><p>{group.hint}</p><ul>{group.phrases.map(phrase=><li key={phrase}>«{phrase}»</li>)}</ul></details>)}</div>
 </section>;
}
