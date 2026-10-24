import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { dateLabel, money, shiftMonth, tradeCount } from './botCalendarModel.js';
import { performanceScore } from './botAnalyticsModel.js';
import BotPerformanceChart from './BotPerformanceChart.jsx';

export default function BotAnalyticsDialog({ client, overview, start, today, month, onClose }) {
  const dialog = useRef(null);
  const [scope,setScope]=useState('all'),[chartMode,setChartMode]=useState('total');
  const [from,setFrom]=useState(month>start?month:start),[to,setTo]=useState(today);
  const [range,setRange]=useState(null),[invalid,setInvalid]=useState(false),[retry,setRetry]=useState(0);
  const [state,setState]=useState({data:overview,loading:!overview,error:false});
  useEffect(()=>{if(!dialog.current.open)dialog.current.showModal();},[]);
  useEffect(()=>{
    if(!range&&overview&&retry===0){setState({data:overview,loading:false,error:false});return;}
    let cancelled=false;setState({data:null,loading:true,error:false});
    client.rpc('get_bot_calendar_analytics',{p_slug:'bot',p_from:range?.from||null,p_to:range?.to||null}).then(({data,error})=>{
      if(!cancelled)setState({data,loading:false,error:Boolean(error||!data)});
    }).catch(()=>{if(!cancelled)setState({data:null,loading:false,error:true});});
    return ()=>{cancelled=true;};
  },[client,overview,range,retry]);
  const choose = value => {
    setScope(value);setInvalid(false);
    if(value==='all'){setRange(null);return;}
    if(value==='month'){
      const last=new Date(`${shiftMonth(month,1)}T12:00:00Z`);last.setUTCDate(0);
      setRange({from:month>start?month:start,to:[today,last.toISOString().slice(0,10)].sort()[0]});return;
    }
  };
  const apply=event=>{event.preventDefault();if(!from||!to||from<start||to>today||from>to){setInvalid(true);return;}setInvalid(false);setRange({from,to});};
  const data=state.data, s=data?.stats, score=performanceScore(s);
  const format=value=>value==null?'—':money(value,data.currency);
  const decimal=value=>value==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(value));
  return <dialog ref={dialog} className="bot-dialog bot-analytics-dialog" aria-labelledby="bot-analytics-title" onClose={onClose} onCancel={onClose} onClick={event=>{if(event.target===dialog.current)onClose();}}>
    <div className="bot-dialog-inner">
      <header><div><p>DAYRIS · ТОРГОВАЯ СТАТИСТИКА</p><h2 id="bot-analytics-title">Аналитика бота</h2></div><button type="button" aria-label="Закрыть аналитику" onClick={onClose}><X aria-hidden="true" /></button></header>
      <div className="bot-history-modes" aria-label="Период аналитики">{[['all','Вся история'],['month','За месяц'],['custom','Период']].map(([value,label])=><button key={value} type="button" aria-pressed={scope===value} onClick={()=>choose(value)}>{label}</button>)}</div>
      {scope==='custom'&&<form className="bot-date-filter" onSubmit={apply}><label>С<input type="date" aria-label="Начало периода аналитики" min={start} max={today} value={from} required onChange={e=>setFrom(e.target.value)}/></label><label>По<input type="date" aria-label="Конец периода аналитики" min={start} max={today} value={to} required onChange={e=>setTo(e.target.value)}/></label><button type="submit">Применить</button>{invalid&&<p role="alert">Начало периода должно быть не позже конца, в пределах опубликованной истории.</p>}</form>}
      {state.loading?<p className="bot-state" role="status">Рассчитываем аналитику…</p>:state.error?<div className="bot-state" role="alert"><p>Не удалось загрузить аналитику.</p><button type="button" onClick={()=>setRetry(n=>n+1)}>Повторить</button></div>:data&&<>
        <p className="bot-analytics-period">{dateLabel(data.from)} — {dateLabel(data.to)} · {tradeCount(s.total)}</p>
        {Number(s.total)===0&&<p className="bot-analytics-empty" role="status">В выбранном периоде нет закрытых сделок.</p>}
        <div className="bot-analytics-dashboard">
          <section className="bot-score-card" aria-label="Скор результата"><div className="bot-score-heading"><span>Скор результата</span><ArrowUpRight size={16} aria-hidden="true" /></div>
            <div className="bot-score-ring" style={{'--score-angle':`${(score?.value||0)*3.6}deg`}}><div><strong>{score?score.value:'—'}</strong><span>/ 100</span></div></div>
            <p>{score?'Индекс выбранной истории':'Недостаточно данных для оценки'}</p>
            <small>{score?'Не прогноз доходности':'Нужно от 30 сделок и 5 торговых дней'}</small>
          </section>
          <section className="bot-analytics-curve" aria-label="График торгового результата">
            <div className="bot-chart-title"><div><span>Закрытый PnL</span><strong className={Number(s.pnl)>=0?'bot-profit':'bot-loss'}>{money(s.pnl,data.currency,true)}</strong></div><div className="bot-chart-modes" aria-label="Вид графика">{[['total','Результат'],['pnl','По дням'],['drawdown','Просадка']].map(([mode,label])=><button key={mode} type="button" aria-pressed={chartMode===mode} onClick={()=>setChartMode(mode)}>{label}</button>)}</div></div>
            <BotPerformanceChart key={`${data.from}-${data.to}-${chartMode}`} data={data} mode={chartMode}/>
          </section>
        </div>
        <div className="bot-analytics-metrics">
          {[
            ['Доля прибыльных',s.win_rate==null?'—':`${decimal(s.win_rate)}%`,`${s.wins} в плюс · ${s.losses} в минус · ${s.breakeven} в ноль`],
            ['Profit factor',s.profit_factor==null?Number(s.gross_profit)>0?'Нет убытков':'—':decimal(s.profit_factor),'Валовая прибыль / валовой убыток'],
            ['Макс. просадка',format(s.max_drawdown),'По каждой закрытой сделке'],
            ['Средняя сделка',format(s.avg_trade),'Ожидание по выбранной истории'],
            ['Средняя прибыль',format(s.avg_win),'Только прибыльные сделки'],
            ['Средний убыток',s.avg_loss==null?'—':format(-Number(s.avg_loss)),'Только убыточные сделки'],
            ['Лучшая сделка',format(s.best_trade),'После торговых издержек'],
            ['Худшая сделка',format(s.worst_trade),'После торговых издержек'],
          ].map(([label,value,note])=><article key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
        </div>
        <div className="bot-analytics-days"><span>Прибыльных торговых дней</span><strong>{s.positive_days} / {s.active_days}</strong><div><i style={{width:`${s.active_days?Number(s.positive_days)/Number(s.active_days)*100:0}%`}}/></div></div>
        <details className="bot-score-explanation"><summary>Как считается скор</summary><p>Минимум 30 закрытых сделок и 5 торговых дней. Четыре компонента от 0 до 1 умножаются на вес, затем сумма округляется.</p>{(score?.parts||[{label:'Profit factor',weight:35,rule:'PF / 2, максимум 1'},{label:'Прибыльные дни',weight:25,rule:'Прибыльные / торговые дни'},{label:'Восстановление',weight:25,rule:'Результат / просадка / 3, от 0 до 1'},{label:'Доля прибыльных сделок',weight:15,rule:'Прибыльные / все закрытые сделки'}]).map(part=><div key={part.label}><span>{part.label}<small>{part.rule}</small></span><strong>{part.value==null?`${part.weight} баллов`:`${decimal(part.value*part.weight)} / ${part.weight}`}</strong></div>)}<p>Без убытков компонент PF равен максимуму, если есть прибыль. Без просадки компонент восстановления равен максимуму только при положительном результате. Это описательная метрика журнала, не оценка надёжности стратегии.</p></details>
        <p className="bot-analytics-note">Кривая показывает накопленный результат на конец дня, начиная с нуля. Просадка учитывает каждую закрытую сделку. Открытые позиции и баланс счёта не входят; комиссии и свопы включены в результат.</p>
        {data.timestamp_precision==='minute'&&<p className="bot-analytics-note">Время части записей округлено до минуты. Просадка внутри одной минуты может быть неточной до обновления истории.</p>}
      </>}
    </div>
  </dialog>;
}
