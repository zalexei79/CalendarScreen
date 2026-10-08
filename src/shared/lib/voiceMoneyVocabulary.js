// Exact spoken aliases shared by slot extraction and the strict amount parser.
// No approximate matching: similar shop names must not become currencies.
const currencyWords={
 RUB:'рубль рубля рублей рубли рублях рублями рублем руб рублик рублика рубликов рублики рубчиков ruble rubles rouble roubles rubla ruble rub',
 EUR:'евро еврах еврик еврика евриков еврики euro euros eur',
 MDL:'лей лея леев леи леях леями лэй лэя лэев lei leu mdl',
 USD:'доллар доллара долларов доллары долларах долларами долларом бакс бакса баксов баксы dollar dollars dolari dolar buck bucks usd',
 CNY:'юань юаня юаней юани юанях юанями юанем yuan yuans cny',
};
const plain=value=>String(value).toLowerCase().replace(/ё/g,'е').replace(/[ăâ]/g,'a').replace(/[șş]/g,'s').replace(/[țţ]/g,'t').replace(/î/g,'i');
const byWord=new Map(Object.entries(currencyWords).flatMap(([currency,words])=>words.split(' ').map(word=>[word,currency])));
for(const [word,currency] of [['₽','RUB'],['€','EUR'],['$','USD'],['¥','CNY']])byWord.set(word,currency);
export const voiceCurrencyFor=word=>byWord.get(plain(word))||null;
export const voiceCurrencyUnits=[...byWord.keys()].map(word=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
// Accept “50лей”, “$50” and ordinary separated units, but never strip a
// currency-like ending from another word (for example “шоуруб”).
export function stripVoiceAmountCurrency(value){
 return plain(value).replace(/^[₽€$¥]\s*(?=\d)/u,'').replace(new RegExp(`(?:\\s+|(?<=\\d))(?:${voiceCurrencyUnits})$`,'u'),'').trim();
}
export const isVoiceExpense=word=>/^(?:потратил[аи]?|потрачено|потратить|тратил[аи]?|трачу|расход[ы]?|расходом|расходовал[аи]?|израсходовал[аи]?|израсходовано|затратил[аи]?|заплатил[аи]?|заплачено|оплатил[аи]?|оплачено|платил[аи]?|уплатил[аи]?|уплачено|плата|ушло|списали|списано|списалось|обошлось|обошелся|обошлась|выложил[аи]?|потратилось|spent|spend|paid|expense|expenses|cheltuit|cheltuiala|platit|achitat)$/u.test(plain(word));
export const isVoiceIncome=word=>/^(?:получил[аи]?|получено|получить|заработал[аи]?|заработано|доход[ы]?|доходом|пришло|поступило|поступили|поступление|зачислили|зачислено|зачислилось|начислили|начислено|вернули|вернулось|received|earned|income|primit|venit|castigat)$/u.test(plain(word));
