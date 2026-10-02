import {parseChineseAmount} from './chineseNumber.js';

export const chineseCurrency = text => /美元|美金|usd/i.test(text)?'USD':/欧元|eur/i.test(text)?'EUR':/卢布|rub/i.test(text)?'RUB':/列伊|mdl/i.test(text)?'MDL':/人民币|元|块|cny/i.test(text)?'CNY':null;

export function chineseDate(value) {
  const match=String(value).replace(/\s+/g,'').match(/^(.+?)年(.+?)月(.+?)(?:日|号)$/);
  if(!match)return null;
  const [year,month,day]=match.slice(1).map(v=>Number(parseChineseAmount(v)));
  const date=new Date(year,month-1,day);
  if(year<1900||year>9999||month<1||month>12||day<1||day>31||date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return null;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function parseChineseVoiceCommand(value) {
  const text=String(value).toLowerCase().replace(/[，。！？!?]/g,'').replace(/^请/,'').replace(/\s+/g,'');
  const navigation={history:/^(?:打开|查看|进入)(?:交易)?(?:历史|历史记录)$/,settings:/^(?:打开|进入)设置$/,wallet:/^(?:打开|进入)(?:我的)?钱包$/,today:/^(?:(?:回到|返回|打开))?(?:今天|本月|当前月份)$/};
  for(const [type,pattern] of Object.entries(navigation))if(pattern.test(text))return {type};
  if(/^(?:打开|切换到|查看)?(?:下个|下一|下)月$/.test(text))return {type:'month',direction:1};
  if(/^(?:打开|切换到|查看)?(?:上个|上一|上)月$/.test(text))return {type:'month',direction:-1};
  const theme=text.match(/^(?:开启|打开|切换)(?:到)?(深色|浅色|黑暗|明亮)(?:主题|模式)$/);if(theme)return {type:'theme',theme:/深色|黑暗/.test(theme[1])?'dark':'light'};
  const mode=text.match(/^(开启|打开|关闭)(交易|pro)模式$/);if(mode)return {type:mode[2]==='pro'?'pro':'trader',enabled:mode[1]!=='关闭'};
  if(/^(?:添加|新增|创建)(?:一条)?(?:记录|交易)$/.test(text))return {type:'add',kind:text.endsWith('交易')?'trade':'record'};
  const category=text.match(/^(?:创建|新增|添加)(?:新)?类别(.*)$/);if(category)return category[1]?category[1].length<=60?{type:'category',name:category[1]}:null:{type:'category-prompt'};
  const date=text.match(/^(?:打开|查看)(.+年.+月.+(?:日|号))$/);if(date){const dateKey=chineseDate(date[1]);if(!dateKey)return null;const [year,month,day]=dateKey.split('-').map(Number);return {type:'date',dateKey,year,month:month-1,day};}
  if(/^(?:总结|汇总)(?:这个月|本月)$/.test(text))return {type:'question',metric:'summary',period:'current-month'};
  const question=text.match(/^(这个月|本月|全部时间|所有时间)(.*?)(花了多少|支出多少|收入多少|赚了多少)$/);
  if(question)return {type:'question',metric:/收入|赚/.test(question[3])?'income':'expense',period:/全部|所有/.test(question[1])?'all-time':'current-month',...(question[2]?{category:question[2]}:{})};
  const money=text.match(/^(?:(?:记录|添加|记一笔))?(?:(?:我|今天))?(支出|花了|花费|收入|收到|赚了)(.+?)(人民币|美元|美金|欧元|卢布|列伊|块|元|cny|usd|eur|rub|mdl)(?:(?:用于|在|买)(.+))?$/);
  if(money){const amount=parseChineseAmount(money[2]);if(amount===null||Number(amount)<=0||money[4]?.length>60)return null;return {type:'entry',kind:'record',amount,currency:chineseCurrency(money[3]),sign:/支出|花/.test(money[1])?'minus':'plus',...(money[4]?{category:money[4]}:{})};}
  return null;
}
