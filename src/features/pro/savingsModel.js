export const savingsCategoryKey = value => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const essential=/жиль|аренд|ипотек|коммун|здоров|лекар|образован|продукт|housing|rent|mortgage|health|medicine|education|grocer|locuin|chirie|sănăt|medicament|educa|alimente|住房|医疗|健康|教育|食品/iu;
const optional=/кафе|кофе|покупк|подпис|развлеч|сигар|пиво|алког|доставк|café|cafe|coffee|shopping|subscription|entertain|tobacco|beer|alcohol|delivery|cafene|cumpăr|abonament|divertisment|tutun|bere|餐饮|购物|订阅|娱乐|烟草|啤酒/iu;
const impulse=/импульс|спонтан|эмоцион|не нужно|ненужн|пожалел|impuls|spontan|emotional|regret|didn.t need|regretat|不需要|冲动|后悔/iu;
// Findings are evidence, never a judgement about a person's needs.
export function analyzeSavings(trades,{currency,isTrading=item=>item.traderMode===true||['cTrader','MT5'].includes(item.platform)}={}) {
 const records=trades.filter(item=>!isTrading(item)&&Number.isFinite(Number(item.pnl))&&(!currency||currency==='ALL'||(item.currency||'USD')===currency));
 const groups=new Map();let income=0,expenses=0;
 for(const item of records){
  const amount=Number(item.pnl);if(amount>=0){income+=amount;continue;}expenses-=amount;
  const key=savingsCategoryKey(item.instrument||'Другое');
  const group=groups.get(key)||{key,name:item.instrument||'Другое',amount:0,count:0,entries:[],essential:essential.test(key),optional:optional.test(key),impulse:false};
  group.amount-=amount;group.count++;group.entries.push(item);group.impulse||=impulse.test(String(item.comment||''));groups.set(key,group);
 }
 const categories=[...groups.values()].map(group=>{
  const average=group.amount/group.count;
  const sameAmount=group.count>=2&&group.entries.every(item=>Math.abs(Math.abs(Number(item.pnl))-average)<=Math.max(.01,average*.05));
  return {...group,average,reason:group.essential?'essential':group.impulse?'impulse':sameAmount?'recurring':group.count>=3?'frequent':group.optional?'optional':'review'};
 }).sort((a,b)=>Number(a.essential)-Number(b.essential)||Number(b.impulse)-Number(a.impulse)||b.amount-a.amount);
 return {income,expenses,balance:income-expenses,categories,count:records.filter(item=>item.pnl<0).length};
}
export function calculateSavings(analysis,choices){
 const actions=analysis.categories.flatMap(group=>{
  const choice=choices[group.key];if(group.essential||!['reduce','skip'].includes(choice))return [];
  return [{category:group.name,key:group.key,choice,amount:group.amount,count:group.count,saving:choice==='skip'?group.average:group.amount*.25}];
 });
 const saving=actions.reduce((sum,item)=>sum+item.saving,0);
 return {actions,saving,after:analysis.balance+saving,expensesAfter:analysis.expenses-saving};
}
export function matchSavingsRule(plan,{instrument,currency='USD',pnl,traderMode,platform,isEditing}){
 if(!plan?.reminders||isEditing||traderMode||['cTrader','MT5'].includes(platform)||!(Number(pnl)<0)||plan.currency!==currency)return null;
 return plan.actions?.find(action=>action.key===savingsCategoryKey(instrument))||null;
}
