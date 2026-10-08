import React from 'react';
import {Sparkles,X} from 'lucide-react';
import {getMoneyCategoryLabel} from '../../shared/config/constants.js';
import {savingsText} from './savingsCopy.js';
import './SavingsPlan.css';
export default function SavingsNudge({rule,language,isLight,onClose}){
 if(!rule)return null;
 const t=savingsText(language),name=getMoneyCategoryLabel(rule.category,language);
 return <aside className={`savings-nudge ${isLight?'is-light':''} ${onClose?'savings-toast':''}`} role="status"><Sparkles size={17}/><div><strong>{t('Помнишь свой план?','Remember your plan?','Îți amintești planul?','还记得你的计划吗？')}</strong><p>{rule.choice==='skip'?t(`Ты хотел покупать «${name}» реже. Если хочешь сохранить больше денег, попробуй пропустить следующую такую покупку.`,`You chose fewer purchases in “${name}”. To keep more money, consider skipping the next one.`,`Ai ales să cumperi „${name}” mai rar. Ca să păstrezi bani, încearcă să eviți următoarea cumpărătură.`,`你选择减少“${name}”购买。为了留下更多资金，可考虑跳过下一次购买。`):t(`Ты решил сократить «${name}» на 25%. Проверь, нужна ли эта покупка сейчас или можно выбрать вариант дешевле.`,`You chose to reduce “${name}” by 25%. Consider whether you need this purchase now or could choose a cheaper option.`,`Ai ales să reduci „${name}” cu 25%. Verifică dacă ai nevoie acum sau poți alege ceva mai ieftin.`,`你选择将“${name}”支出减少25%。考虑现在是否需要购买，或选择更便宜的方案。`)}</p></div>{onClose&&<button type="button" aria-label={t('Закрыть подсказку','Dismiss reminder','Închide sugestia','关闭提醒')} onClick={onClose}><X size={16}/></button>}</aside>;
}
