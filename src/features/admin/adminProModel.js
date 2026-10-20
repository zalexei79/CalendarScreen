export function proExpiry(grants, now=Date.now()) {
  return (grants||[]).filter(g=>(!g.starts_at||g.starts_at==='-infinity'||Date.parse(g.starts_at)<=now)&&(g.ends_at==='infinity'||Date.parse(g.ends_at)>now))
    .reduce((end,g)=>g.ends_at==='infinity'?Infinity:Math.max(end,Date.parse(g.ends_at)),0);
}
export function remainingPro(end,now=Date.now()) {
  const timestamp=end===Infinity||end==='infinity'?Infinity:typeof end==='number'?end:Date.parse(end);
  if(timestamp===Infinity)return 'Без ограничения срока';
  if(!Number.isFinite(timestamp)||timestamp<=now)return 'PRO не активен';
  return `Осталось дней: ${Math.ceil((timestamp-now)/86400000)} · до ${new Date(timestamp).toLocaleString('ru')}`;
}
export function subscriptionActive(s,now=Date.now()) {return s.provider==='lemon_squeezy'&&(['active','on_trial'].includes(s.status)||(s.status==='cancelled'&&Date.parse(s.ends_at)>now));}
export function combinedPro(grants,subscriptions,now=Date.now()) {
  const active=(subscriptions||[]).filter(s=>subscriptionActive(s,now));
  const expiry=Math.max(proExpiry(grants,now),...active.map(s=>{const end=s.status==='cancelled'?s.ends_at:s.ends_at||s.trial_ends_at||s.renews_at;return end==='infinity'?Infinity:Date.parse(end)||0;}));
  return {active:expiry>now||active.length>0,expiry};
}
