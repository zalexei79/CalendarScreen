const decimal = /^\d+(?:\.\d+)?$/;
export function normalizeCandle(row) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || ''))) return null;
  const date=new Date(`${row.date}T00:00:00Z`);
  if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==row.date) return null;
  const values = ['open','high','low','close'].map(key => String(row[key] ?? (key === 'close' ? row.price : '') ?? ''));
  if (!values.every(value => decimal.test(value) && Number.isFinite(Number(value)) && Number(value)>0)) return null;
  const [open,high,low,close] = values.map(Number);
  if (high<Math.max(open,close) || low>Math.min(open,close) || low>high) return null;
  return {...row, open:values[0], high:values[1], low:values[2], close:values[3], price:values[3]};
}
export function candleHistory(rows) {
  return [...new Map((Array.isArray(rows)?rows:[]).map(normalizeCandle).filter(Boolean).map(row=>[row.date,row])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function buildCandles(rows) {
  if (!rows.length) return null;
  const low=Math.min(...rows.map(row=>Number(row.low))), high=Math.max(...rows.map(row=>Number(row.high)));
  const pad=Math.max((high-low)*.12,high*.001), bottom=low-pad, top=high+pad;
  const y=value=>16+(top-Number(value))*118/(top-bottom), step=328/rows.length;
  return {low:bottom,high:top,step,points:rows.map((row,i)=>({x:12+(i+.5)*step,open:y(row.open),close:y(row.close),high:y(row.high),low:y(row.low),up:Number(row.close)>=Number(row.open)})),ticks:[top,(top+bottom)/2,bottom]};
}
