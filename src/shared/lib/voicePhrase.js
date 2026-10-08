// Shared conversational cleanup, before intent/slot parsing. Never rewrite
// amounts, dates, negation or arbitrary category names to guess an action.
export function normalizeVoicePhrase(value){
 let text=String(value??'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
 const quoted=[];
 text=text.replace(/«[^»]*»|"[^"]*"/gu,part=>{quoted.push(part);return `__quoted_${quoted.length-1}__`;});
 const polite=/^(?:ну|ну-ка|вот|так|слушай|слушайте|смотри|бро|короче|в общем|эм|ээ+|пожалуйста|плиз|плз|окей|ок|давай|well|hey|okay|ok|please|te rog|请帮我|麻烦你|请)(?:[,!:\s]+|(?=[\u3400-\u9fff]))/u;
 for(let i=0;i<10;i++){
  const before=text;text=text.replace(polite,'').trim();
  text=text.replace(/^(?:скажи|расскажи|подскажи|напомни|посчитай)(?:\s+мне)?[,\s]+(?:пожалуйста[,\s]+)?(?=(?:что|че|сколько|скока|когда|как|какие|какой)\s)/u,'');
  text=text.replace(/^(?:(?:а\s+)?(?:ты\s+)?можешь(?:\s+ли(?:\s+ты)?)?(?:\s+мне)?|не мог(?:ла)? бы(?:\s+ты)?(?:\s+мне)?|мог(?:ла)? бы(?:\s+ты)?(?:\s+мне)?|можно|can you|could you|would you|poți să|poti sa)[,\s]+(?:пожалуйста[,\s]+|please\s+)?(?=(?:показать|покажи|открыть|открой|найти|найди|записать|запиши|добавить|добавь|сказать|рассказать|вернуть|включить|выключить|show|open|find|tell|record|add|help|arăta|arata|deschide|spune)(?:\s|$))/u,'');
  text=text.replace(/^(?:сказать|рассказать|tell me|spune-mi)[,\s]+(?=(?:что|сколько|когда|как|какие|what|how|when|ce|cât|cat)(?:\s|$))/u,'');
  text=text.replace(/^(?:я\s+)?(?:хочу|хотел(?:а)? бы)\s+(?:узнать|понять)[,\s]+(?=(?:что|сколько|когда|как|какие)\s)/u,'');
  text=text.replace(/^(?:я\s+)?(?:хочу|хотел(?:а)? бы)\s+(?:посмотреть|увидеть)\s+/u,'покажи ');
  text=text.replace(/^(?:я\s+)?(?:хочу|хотел(?:а)? бы)\s+(?=(?:записать|добавить|открыть|найти)\s)/u,'');
  text=text.replace(/^помоги(?:\s+мне)?\s+(?=(?:записать|добавить|открыть|найти)\s)/u,'');
  text=text.replace(/^(?:а\s+)(?=(?:что|че|сколько|когда|как|какие|покажи|открой|найди)\s)/u,'');
  if(text===before)break;
 }
 // Infinitives are requests too. Scope these aliases to the first word.
 const verbs={показать:'покажи',покажите:'покажи',открыть:'открой',откройте:'открой',найти:'найди',найдите:'найди',записать:'запиши',запишем:'запиши',запишите:'запиши',зафиксируй:'запиши',добавить:'добавь',добавьте:'добавь',включить:'включи',выключить:'выключи',вернуть:'верни'};
 text=text.replace(/^(показать|покажите|открыть|откройте|найти|найдите|записать|запишем|запишите|зафиксируй|добавить|добавьте|включить|выключить|вернуть)(?=\s)/u,word=>verbs[word]);
 // Move an explicit read-only request into canonical order. Do not turn a
 // bare statement about spending into a request, or reorder corrections.
 text=text.replace(/^(.+?)\s+(покажи|найди)$/u,(_,body,verb)=>/(?:расходы|траты|доходы|записи)/u.test(body)&&!/(?:^|\s)не\s/u.test(body)?`${verb} ${body}`:`${body} ${verb}`);
 text=text.replace(/^(.+?)\s+(сколько(?:\s+я)?\s+(?:потратил[аи]?|заплатил[аи]?|заработал[аи]?|получил[аи]?))$/u,'$2 $1');
 text=text.replace(/^(?:как много|сколько денег)(?=\s)/u,'сколько');
 text=text.replace(/(^|\s)у меня\s+(?=(?:ушло|списали|списалось|пришло|поступило)(?:\s|$))/u,'$1');
 // Common spoken question forms. Limit aliases to the question prefix so a
 // category or shop called “Че” keeps its name.
 text=text.replace(/^че(?=\s+(?:ты|вы|тут|здесь|умеешь|можешь|можно))/u,'что');
 text=text.replace(/^скока(?=\s)/u,'сколько');
 text=text.replace(/^во\s+сколько\s+(?:мне\s+)?(?:обошлось|обошелся|обошлась)\s+/u,'сколько потратил на ');
 text=text.replace(/^сколько\s+(?:денег\s+)?(?:у меня\s+)?(?:ушло|списалось)(?=\s|$)/u,'сколько потратил');
 // Only remove hesitation inside the command before the category. The same
 // words after «на» may be the user's actual category or shop name.
 const boundary=text.search(/(?:^|\s)(?:на|за|для|раздел|категорию|on|for|pe|pentru)\s/u);
 const end=boundary<0?text.length:boundary;
 const head=text.slice(0,end).replace(/(^|\s)мне\s+(?:перевели|перечислили|заплатили)(?=\s|$)/gu,'$1получил')
  .replace(/(^|\s)с меня\s+(?:сняли|списали)(?=\s|$)/gu,'$1списали')
  .replace(/(^|\s|,)\s*(?:пожалуйста|ну|эм|ээ+|вообще|короче|получается|собственно|как бы|please)\s*(?=\s|,|$)/gu,'$1');
 text=(head+text.slice(end)).replace(/(?:[,\s]+)(?:пожалуйста|плиз|плз|please|te rog)[.!?]*$/u,'').replace(/\s+/g,' ').trim();
 return text.replace(/__quoted_(\d+)__/gu,(_,index)=>quoted[Number(index)]);
}
