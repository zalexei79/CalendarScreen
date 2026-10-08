// src/shared/lib/voiceCategory.js
function normalizeVoiceCategory(value) {
  return String(value || "").toLocaleLowerCase("ru").replace(/ё/g, "\u0435").replace(/[șş]/g, "s").replace(/[țţ]/g, "t").replace(/[ăâ]/g, "a").replace(/î/g, "i").replace(/[«»"']/g, "").replace(/\s+/g, " ").trim();
}
function categoryMatches(a, b) {
  const left = normalizeVoiceCategory(a), right = normalizeVoiceCategory(b);
  if (left === right) return true;
  const stem = (value) => value.split(" ").map((word) => word.length > 5 ? word.replace(/(?:ами|ями|ах|ях|ов|ев|ей|ы|и|а|у|е)$/, "") : word).join(" ");
  return stem(left) === stem(right);
}

// src/shared/lib/voicePhrase.js
function normalizeVoicePhrase(value) {
  let text = String(value ?? "").toLowerCase().replace(/ё/g, "\u0435").replace(/\s+/g, " ").trim();
  const quoted = [];
  text = text.replace(/«[^»]*»|"[^"]*"/gu, (part) => {
    quoted.push(part);
    return `__quoted_${quoted.length - 1}__`;
  });
  const polite = /^(?:ну|ну-ка|вот|так|слушай|слушайте|смотри|бро|короче|в общем|эм|ээ+|пожалуйста|плиз|плз|окей|ок|давай|well|hey|okay|ok|please|te rog|请帮我|麻烦你|请)(?:[,!:\s]+|(?=[\u3400-\u9fff]))/u;
  for (let i = 0; i < 10; i++) {
    const before = text;
    text = text.replace(polite, "").trim();
    text = text.replace(/^(?:скажи|расскажи|подскажи|напомни|посчитай)(?:\s+мне)?[,\s]+(?:пожалуйста[,\s]+)?(?=(?:что|че|сколько|скока|когда|как|какие|какой)\s)/u, "");
    text = text.replace(/^(?:(?:а\s+)?(?:ты\s+)?можешь(?:\s+ли(?:\s+ты)?)?(?:\s+мне)?|не мог(?:ла)? бы(?:\s+ты)?(?:\s+мне)?|мог(?:ла)? бы(?:\s+ты)?(?:\s+мне)?|можно|can you|could you|would you|poți să|poti sa)[,\s]+(?:пожалуйста[,\s]+|please\s+)?(?=(?:показать|покажи|открыть|открой|найти|найди|записать|запиши|добавить|добавь|сказать|рассказать|вернуть|включить|выключить|show|open|find|tell|record|add|help|arăta|arata|deschide|spune)(?:\s|$))/u, "");
    text = text.replace(/^(?:сказать|рассказать|tell me|spune-mi)[,\s]+(?=(?:что|сколько|когда|как|какие|what|how|when|ce|cât|cat)(?:\s|$))/u, "");
    text = text.replace(/^(?:я\s+)?(?:хочу|хотел(?:а)? бы)\s+(?:узнать|понять)[,\s]+(?=(?:что|сколько|когда|как|какие)\s)/u, "");
    text = text.replace(/^(?:я\s+)?(?:хочу|хотел(?:а)? бы)\s+(?:посмотреть|увидеть)\s+/u, "\u043F\u043E\u043A\u0430\u0436\u0438 ");
    text = text.replace(/^(?:я\s+)?(?:хочу|хотел(?:а)? бы)\s+(?=(?:записать|добавить|открыть|найти)\s)/u, "");
    text = text.replace(/^помоги(?:\s+мне)?\s+(?=(?:записать|добавить|открыть|найти)\s)/u, "");
    text = text.replace(/^(?:а\s+)(?=(?:что|че|сколько|когда|как|какие|покажи|открой|найди)\s)/u, "");
    if (text === before) break;
  }
  const verbs = { \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C: "\u043F\u043E\u043A\u0430\u0436\u0438", \u043F\u043E\u043A\u0430\u0436\u0438\u0442\u0435: "\u043F\u043E\u043A\u0430\u0436\u0438", \u043E\u0442\u043A\u0440\u044B\u0442\u044C: "\u043E\u0442\u043A\u0440\u043E\u0439", \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435: "\u043E\u0442\u043A\u0440\u043E\u0439", \u043D\u0430\u0439\u0442\u0438: "\u043D\u0430\u0439\u0434\u0438", \u043D\u0430\u0439\u0434\u0438\u0442\u0435: "\u043D\u0430\u0439\u0434\u0438", \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C: "\u0437\u0430\u043F\u0438\u0448\u0438", \u0437\u0430\u043F\u0438\u0448\u0435\u043C: "\u0437\u0430\u043F\u0438\u0448\u0438", \u0437\u0430\u043F\u0438\u0448\u0438\u0442\u0435: "\u0437\u0430\u043F\u0438\u0448\u0438", \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0439: "\u0437\u0430\u043F\u0438\u0448\u0438", \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C: "\u0434\u043E\u0431\u0430\u0432\u044C", \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435: "\u0434\u043E\u0431\u0430\u0432\u044C", \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C: "\u0432\u043A\u043B\u044E\u0447\u0438", \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u0442\u044C: "\u0432\u044B\u043A\u043B\u044E\u0447\u0438", \u0432\u0435\u0440\u043D\u0443\u0442\u044C: "\u0432\u0435\u0440\u043D\u0438" };
  text = text.replace(/^(показать|покажите|открыть|откройте|найти|найдите|записать|запишем|запишите|зафиксируй|добавить|добавьте|включить|выключить|вернуть)(?=\s)/u, (word) => verbs[word]);
  text = text.replace(/^(.+?)\s+(покажи|найди)$/u, (_, body, verb) => /(?:расходы|траты|доходы|записи)/u.test(body) && !/(?:^|\s)не\s/u.test(body) ? `${verb} ${body}` : `${body} ${verb}`);
  text = text.replace(/^(.+?)\s+(сколько(?:\s+я)?\s+(?:потратил[аи]?|заплатил[аи]?|заработал[аи]?|получил[аи]?))$/u, "$2 $1");
  text = text.replace(/^(?:как много|сколько денег)(?=\s)/u, "\u0441\u043A\u043E\u043B\u044C\u043A\u043E");
  text = text.replace(/(^|\s)у меня\s+(?=(?:ушло|списали|списалось|пришло|поступило)(?:\s|$))/u, "$1");
  text = text.replace(/^че(?=\s+(?:ты|вы|тут|здесь|умеешь|можешь|можно))/u, "\u0447\u0442\u043E");
  text = text.replace(/^скока(?=\s)/u, "\u0441\u043A\u043E\u043B\u044C\u043A\u043E");
  text = text.replace(/^во\s+сколько\s+(?:мне\s+)?(?:обошлось|обошелся|обошлась)\s+/u, "\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u043B \u043D\u0430 ");
  text = text.replace(/^сколько\s+(?:денег\s+)?(?:у меня\s+)?(?:ушло|списалось)(?=\s|$)/u, "\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u043B");
  const boundary = text.search(/(?:^|\s)(?:на|за|для|раздел|категорию|on|for|pe|pentru)\s/u);
  const end = boundary < 0 ? text.length : boundary;
  const head = text.slice(0, end).replace(/(^|\s)мне\s+(?:перевели|перечислили|заплатили)(?=\s|$)/gu, "$1\u043F\u043E\u043B\u0443\u0447\u0438\u043B").replace(/(^|\s)с меня\s+(?:сняли|списали)(?=\s|$)/gu, "$1\u0441\u043F\u0438\u0441\u0430\u043B\u0438").replace(/(^|\s|,)\s*(?:пожалуйста|ну|эм|ээ+|вообще|короче|получается|собственно|как бы|please)\s*(?=\s|,|$)/gu, "$1");
  text = (head + text.slice(end)).replace(/(?:[,\s]+)(?:пожалуйста|плиз|плз|please|te rog)[.!?]*$/u, "").replace(/\s+/g, " ").trim();
  return text.replace(/__quoted_(\d+)__/gu, (_, index) => quoted[Number(index)]);
}

// src/shared/lib/voiceNavigation.js
function parseVoiceNavigation(value) {
  const text = normalizeVoicePhrase(value).replace(/^(?:можешь |можно |давай |can you |please )/, "").replace(/ пожалуйста$| please$/, "").replace(/^(activează|activeaza) (tema|temă) (.+)$/, "$1 $3 $2");
  const request2 = text.replace(/^(?:открой|открыть|зайди|войди|перейди|покажи|включи|вернись|верни меня|переключись|open|show|go|take me|deschide|arata|arată|mergi|intra|intră)(?: (?:в|на|к|to|the|my|la|in|în))? /, "");
  const targets = { history: /^(?:история|историю|история записей|историю записей|история сделок|историю сделок|записи|мои записи|сделки|history|transaction history|istoric|istoricul)$/, settings: /^(?:настройки|settings|setari|setări)$/, wallet: /^(?:кошелек|мой кошелек|wallet|portofel|portofelul)$/, today: /^(?:сегодня|текущий месяц|этот месяц|today|current month|astazi|astăzi|luna curenta|luna curentă)$/ };
  if (request2 !== text || text === "\u0441\u0435\u0433\u043E\u0434\u043D\u044F" || text === "today") {
    for (const [type, pattern] of Object.entries(targets)) if (pattern.test(request2)) return { type };
  }
  const theme = text.match(/^(?:включи|переключи на|выбери|enable|switch to|activeaza|activează) (темную|темный|темная|светлую|светлый|светлая|dark|light|intunecata|întunecată|luminoasa|luminoasă) (?:тему|режим|theme|mode|tema|temă)$/);
  if (theme) return { type: "theme", theme: /свет|light|lumino/.test(theme[1]) ? "light" : "dark" };
  const trader = text.match(/^(включи|выключи|отключи|enable|disable|activeaza|activează|dezactiveaza|dezactivează) (?:режим трейдера|трейдерский режим|трейдера|trader mode|trading mode|modul trader)$/);
  if (trader) return { type: "trader", enabled: /^(включи|enable|activeaz)/.test(trader[1]) };
  if (/^(?:листай|листни|перелистай|перейди|давай|go|move|treci) (?:вперед|дальше|forward|inainte|înainte)$/.test(text)) return { type: "month", direction: 1 };
  if (/^(?:листай|листни|перелистай|перейди|давай|go|move|treci) (?:назад|back|inapoi|înapoi)$/.test(text)) return { type: "month", direction: -1 };
  return null;
}

// src/shared/lib/chineseNumber.js
var digits = { \u96F6: 0, "\u3007": 0, \u4E00: 1, \u4E8C: 2, \u4E24: 2, \u4E09: 3, \u56DB: 4, \u4E94: 5, \u516D: 6, \u4E03: 7, \u516B: 8, \u4E5D: 9 };
function integer(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const scaled = text.match(/^(\d+)(万|亿)$/);
  if (scaled) return Number(scaled[1]) * (scaled[2] === "\u4E07" ? 1e4 : 1e8);
  if (!/^[零〇一二两三四五六七八九十百千万亿]+$/.test(text)) return null;
  if (!/[十百千万亿]/.test(text)) return Number([...text].map((c) => digits[c]).join(""));
  let total = 0, section = 0, digit = 0, lastSmall = Infinity, lastLarge = Infinity, hasDigit = false;
  for (const c of text) {
    if (c in digits) {
      const next = digits[c];
      if (hasDigit && digit !== 0 && next !== 0) return null;
      digit = next;
      hasDigit = true;
      continue;
    }
    const scale = { \u5341: 10, \u767E: 100, \u5343: 1e3, \u4E07: 1e4, \u4EBF: 1e8 }[c];
    if (scale < 1e4) {
      if (scale >= lastSmall || !hasDigit && (scale !== 10 || section !== 0)) return null;
      section += (hasDigit ? digit : 1) * scale;
      lastSmall = scale;
      digit = 0;
      hasDigit = false;
    } else {
      if (scale >= lastLarge || section + digit === 0) return null;
      total += (section + digit) * scale;
      section = 0;
      digit = 0;
      hasDigit = false;
      lastSmall = Infinity;
      lastLarge = scale;
    }
  }
  return total + section + digit;
}
function parseChineseAmount(value) {
  const text = String(value).trim().replace(/^金额\s*/, "").replace(/[。！？!?]$/, "").replace(/\s+/g, "");
  let result;
  const money = !/(?:美元|欧元|美金|卢布|列伊)$/.test(text) && text.match(/^(.+?)(?:元|块)(?:([零〇一二两三四五六七八九\d])角)?(?:([零〇一二两三四五六七八九\d])分)?$/);
  if (money) {
    const whole = parseChineseAmount(money[1]);
    if (whole === null || Number(whole) % 1 !== 0 && (money[2] || money[3])) return null;
    result = Number(whole) + Number(money[2] in digits ? digits[money[2]] : money[2] || 0) / 10 + Number(money[3] in digits ? digits[money[3]] : money[3] || 0) / 100;
  } else {
    const normalized = text.replace(/(?:人民币|美元|美金|欧元|卢布|列伊|元|块)$/, "");
    const parts = normalized.split(/[点.]/);
    if (parts.length > 2) return null;
    const whole = integer(parts[0]);
    if (whole === null) return null;
    if (parts.length === 2) {
      if (!/^[零〇一二两三四五六七八九\d]{1,2}$/.test(parts[1])) return null;
      result = whole + Number([...parts[1]].map((c) => c in digits ? digits[c] : c).join("")) / 10 ** parts[1].length;
    } else result = whole;
  }
  if (!Number.isFinite(result) || result < 0 || result >= 1e12) return null;
  return String(Math.round(result * 100) / 100);
}

// src/shared/lib/voiceMoneyVocabulary.js
var currencyWords = {
  RUB: "\u0440\u0443\u0431\u043B\u044C \u0440\u0443\u0431\u043B\u044F \u0440\u0443\u0431\u043B\u0435\u0439 \u0440\u0443\u0431\u043B\u0438 \u0440\u0443\u0431\u043B\u044F\u0445 \u0440\u0443\u0431\u043B\u044F\u043C\u0438 \u0440\u0443\u0431\u043B\u0435\u043C \u0440\u0443\u0431 \u0440\u0443\u0431\u043B\u0438\u043A \u0440\u0443\u0431\u043B\u0438\u043A\u0430 \u0440\u0443\u0431\u043B\u0438\u043A\u043E\u0432 \u0440\u0443\u0431\u043B\u0438\u043A\u0438 \u0440\u0443\u0431\u0447\u0438\u043A\u043E\u0432 ruble rubles rouble roubles rubla ruble rub",
  EUR: "\u0435\u0432\u0440\u043E \u0435\u0432\u0440\u0430\u0445 \u0435\u0432\u0440\u0438\u043A \u0435\u0432\u0440\u0438\u043A\u0430 \u0435\u0432\u0440\u0438\u043A\u043E\u0432 \u0435\u0432\u0440\u0438\u043A\u0438 euro euros eur",
  MDL: "\u043B\u0435\u0439 \u043B\u0435\u044F \u043B\u0435\u0435\u0432 \u043B\u0435\u0438 \u043B\u0435\u044F\u0445 \u043B\u0435\u044F\u043C\u0438 \u043B\u044D\u0439 \u043B\u044D\u044F \u043B\u044D\u0435\u0432 lei leu mdl",
  USD: "\u0434\u043E\u043B\u043B\u0430\u0440 \u0434\u043E\u043B\u043B\u0430\u0440\u0430 \u0434\u043E\u043B\u043B\u0430\u0440\u043E\u0432 \u0434\u043E\u043B\u043B\u0430\u0440\u044B \u0434\u043E\u043B\u043B\u0430\u0440\u0430\u0445 \u0434\u043E\u043B\u043B\u0430\u0440\u0430\u043C\u0438 \u0434\u043E\u043B\u043B\u0430\u0440\u043E\u043C \u0431\u0430\u043A\u0441 \u0431\u0430\u043A\u0441\u0430 \u0431\u0430\u043A\u0441\u043E\u0432 \u0431\u0430\u043A\u0441\u044B dollar dollars dolari dolar buck bucks usd",
  CNY: "\u044E\u0430\u043D\u044C \u044E\u0430\u043D\u044F \u044E\u0430\u043D\u0435\u0439 \u044E\u0430\u043D\u0438 \u044E\u0430\u043D\u044F\u0445 \u044E\u0430\u043D\u044F\u043C\u0438 \u044E\u0430\u043D\u0435\u043C yuan yuans cny"
};
var plain = (value) => String(value).toLowerCase().replace(/ё/g, "\u0435").replace(/[ăâ]/g, "a").replace(/[șş]/g, "s").replace(/[țţ]/g, "t").replace(/î/g, "i");
var byWord = new Map(Object.entries(currencyWords).flatMap(([currency, words2]) => words2.split(" ").map((word) => [word, currency])));
for (const [word, currency] of [["\u20BD", "RUB"], ["\u20AC", "EUR"], ["$", "USD"], ["\xA5", "CNY"]]) byWord.set(word, currency);
var voiceCurrencyFor = (word) => byWord.get(plain(word)) || null;
var voiceCurrencyUnits = [...byWord.keys()].map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
function stripVoiceAmountCurrency(value) {
  return plain(value).replace(/^[₽€$¥]\s*(?=\d)/u, "").replace(new RegExp(`(?:\\s+|(?<=\\d))(?:${voiceCurrencyUnits})$`, "u"), "").trim();
}
var isVoiceExpense = (word) => /^(?:потратил[аи]?|потрачено|потратить|тратил[аи]?|трачу|расход[ы]?|расходом|расходовал[аи]?|израсходовал[аи]?|израсходовано|затратил[аи]?|заплатил[аи]?|заплачено|оплатил[аи]?|оплачено|платил[аи]?|уплатил[аи]?|уплачено|плата|ушло|списали|списано|списалось|обошлось|обошелся|обошлась|выложил[аи]?|потратилось|spent|spend|paid|expense|expenses|cheltuit|cheltuiala|platit|achitat)$/u.test(plain(word));
var isVoiceIncome = (word) => /^(?:получил[аи]?|получено|получить|заработал[аи]?|заработано|доход[ы]?|доходом|пришло|поступило|поступили|поступление|зачислили|зачислено|зачислилось|начислили|начислено|вернули|вернулось|received|earned|income|primit|venit|castigat)$/u.test(plain(word));

// src/shared/lib/spokenAmount.js
var words = {
  \u043D\u043E\u043B\u044C: 0,
  \u043E\u0434\u0438\u043D: 1,
  \u043E\u0434\u043D\u0430: 1,
  \u0434\u0432\u0430: 2,
  \u0434\u0432\u0435: 2,
  \u0442\u0440\u0438: 3,
  \u0447\u0435\u0442\u044B\u0440\u0435: 4,
  \u043F\u044F\u0442\u044C: 5,
  \u0448\u0435\u0441\u0442\u044C: 6,
  \u0441\u0435\u043C\u044C: 7,
  \u0432\u043E\u0441\u0435\u043C\u044C: 8,
  \u0434\u0435\u0432\u044F\u0442\u044C: 9,
  \u0434\u0435\u0441\u044F\u0442\u044C: 10,
  \u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 11,
  \u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 12,
  \u0442\u0440\u0438\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 13,
  \u0447\u0435\u0442\u044B\u0440\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 14,
  \u043F\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 15,
  \u0448\u0435\u0441\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 16,
  \u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 17,
  \u0432\u043E\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 18,
  \u0434\u0435\u0432\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C: 19,
  \u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C: 20,
  \u0442\u0440\u0438\u0434\u0446\u0430\u0442\u044C: 30,
  \u0441\u043E\u0440\u043E\u043A: 40,
  \u043F\u044F\u0442\u044C\u0434\u0435\u0441\u044F\u0442: 50,
  \u0448\u0435\u0441\u0442\u044C\u0434\u0435\u0441\u044F\u0442: 60,
  \u0441\u0435\u043C\u044C\u0434\u0435\u0441\u044F\u0442: 70,
  \u0432\u043E\u0441\u0435\u043C\u044C\u0434\u0435\u0441\u044F\u0442: 80,
  \u0434\u0435\u0432\u044F\u043D\u043E\u0441\u0442\u043E: 90,
  \u0441\u0442\u043E: 100,
  \u0434\u0432\u0435\u0441\u0442\u0438: 200,
  \u0442\u0440\u0438\u0441\u0442\u0430: 300,
  \u0447\u0435\u0442\u044B\u0440\u0435\u0441\u0442\u0430: 400,
  \u043F\u044F\u0442\u044C\u0441\u043E\u0442: 500,
  \u0448\u0435\u0441\u0442\u044C\u0441\u043E\u0442: 600,
  \u0441\u0435\u043C\u044C\u0441\u043E\u0442: 700,
  \u0432\u043E\u0441\u0435\u043C\u044C\u0441\u043E\u0442: 800,
  \u0434\u0435\u0432\u044F\u0442\u044C\u0441\u043E\u0442: 900,
  \u043F\u043E\u043B\u0442\u0438\u043D\u043D\u0438\u043A: 50,
  \u043F\u043E\u043B\u0442\u043E\u0441: 50,
  \u0441\u043E\u0442\u043A\u0430: 100,
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  un: 1,
  o: 1,
  unu: 1,
  una: 1,
  doi: 2,
  dou\u0103: 2,
  trei: 3,
  patru: 4,
  cinci: 5,
  \u0219ase: 6,
  \u0219apte: 7,
  opt: 8,
  nou\u0103: 9,
  zece: 10,
  unsprezece: 11,
  doisprezece: 12,
  treisprezece: 13,
  paisprezece: 14,
  cincisprezece: 15,
  \u0219aisprezece: 16,
  \u0219aptesprezece: 17,
  optsprezece: 18,
  nou\u0103sprezece: 19,
  dou\u0103zeci: 20,
  treizeci: 30,
  patruzeci: 40,
  cincizeci: 50,
  \u0219aizeci: 60,
  \u0219aptezeci: 70,
  optzeci: 80,
  nou\u0103zeci: 90
};
var scales = { \u0442\u044B\u0441\u044F\u0447\u0430: 1e3, \u0442\u044B\u0441\u044F\u0447\u0438: 1e3, \u0442\u044B\u0441\u044F\u0447: 1e3, \u0442\u044B\u0449\u0430: 1e3, \u0442\u044B\u0449\u0438: 1e3, \u0442\u044B\u0449: 1e3, \u043A\u043E\u0441\u0430\u0440\u044C: 1e3, \u043A\u043E\u0441\u0430\u0440\u044F: 1e3, \u043A\u043E\u0441\u0430\u0440\u0435\u0439: 1e3, \u043C\u0438\u043B\u043B\u0438\u043E\u043D: 1e6, \u043C\u0438\u043B\u043B\u0438\u043E\u043D\u0430: 1e6, \u043C\u0438\u043B\u043B\u0438\u043E\u043D\u043E\u0432: 1e6, thousand: 1e3, thousands: 1e3, million: 1e6, millions: 1e6, mie: 1e3, mii: 1e3, milion: 1e6, milioane: 1e6 };
var romanianPlain = (value) => value.replace(/[șş]/g, "s").replace(/[țţ]/g, "t").replace(/[ăâ]/g, "a").replace(/î/g, "i");
var plainWords = Object.fromEntries(Object.entries(words).map(([word, value]) => [romanianPlain(word), value]));
var units = voiceCurrencyUnits;
var cents = "\u043A\u043E\u043F\u0435\u0439\u043A\u0430|\u043A\u043E\u043F\u0435\u0439\u043A\u0438|\u043A\u043E\u043F\u0435\u0435\u043A|\u0446\u0435\u043D\u0442|\u0446\u0435\u043D\u0442\u0430|\u0446\u0435\u043D\u0442\u043E\u0432|cent|cents|ban|bani";
function integer2(text) {
  text = text.trim();
  if (!text || /^(and|și|si|de)\b|\b(and|și|si|de)$/.test(text)) return null;
  if (/^\d+$/.test(text)) return Number(text);
  let total = 0, group = 0, rank = Infinity, lastScale = Infinity;
  const tokens = text.split(/\s+/);
  for (const [index, token] of tokens.entries()) {
    if (token === "and" || token === "\u0219i" || token === "si" || token === "de") continue;
    if (["hundred", "sut\u0103", "suta", "sute", "\u0441\u043E\u0442\u043D\u044F", "\u0441\u043E\u0442\u043D\u0438", "\u0441\u043E\u0442\u0435\u043D", "\u0441\u043E\u0442\u043A\u0438"].includes(token)) {
      if (group > 9 || rank !== 1) return null;
      group *= 100;
      rank = 100;
      continue;
    }
    if (scales[token]) {
      if (scales[token] >= lastScale) return null;
      total += (group || 1) * scales[token];
      group = 0;
      rank = Infinity;
      lastScale = scales[token];
      continue;
    }
    const numeric = /^\d+$/.test(token) && group === 0 && (scales[tokens[index + 1]] || index === tokens.length - 1 && lastScale < Infinity && Number(token) < lastScale);
    const n = numeric ? Number(token) : words[token] ?? plainWords[romanianPlain(token)];
    if (n === void 0) return null;
    const nextRank = n >= 100 ? 100 : n >= 10 ? 10 : 1;
    if (nextRank >= rank) return null;
    group += n;
    rank = nextRank;
  }
  return total + group;
}
function parseSpokenAmount(transcript) {
  if (/[零〇一二两三四五六七八九十百千万亿点元块角分]|人民币|美元|美金|欧元|卢布|列伊/.test(String(transcript))) return parseChineseAmount(transcript);
  let text = romanianPlain(String(transcript).toLowerCase().trim().replace(/[.!?]$/, "").replace(/ё/g, "\u0435")).replace(/(?<=[a-z])-(?=[a-z])/g, " ");
  text = text.replace(new RegExp(`(\\d)(?=(?:${Object.keys(scales).join("|")})(?:\\s|$))`, "gu"), "$1 ");
  text = text.replace(/^(?:сумма|amount|suma)\s+/, "");
  if (!text) return null;
  const shortThousands = stripVoiceAmountCurrency(text).match(/^(.+?\s+|\d+(?:[.,]\d{1,2})?)(?:к|k|ка)$/u);
  if (shortThousands) {
    const baseText = shortThousands[1].trim();
    if (/[кk]$|\sка$/.test(baseText)) return null;
    const base = /^(?:полтора|полторы)$/.test(baseText) ? "1.5" : parseSpokenAmount(baseText);
    const scaled = base === null ? NaN : Number(base) * 1e3;
    return Number.isFinite(scaled) && scaled >= 0 && scaled < 1e12 ? String(Math.round(scaled * 100) / 100) : null;
  }
  let value;
  const centsMatch = text.match(new RegExp(`^(.+?)(?:\\s+|(?<=\\d))(?:${units})\\s+(?:(?:and|\u0438|\u0219i|si)\\s+)?(.+?)(?:\\s+|(?<=\\d))(?:${cents})$`));
  if (centsMatch) {
    const main = integer2(centsMatch[1]), fraction = integer2(centsMatch[2]);
    if (main === null || fraction === null || fraction > 99) return null;
    value = main + fraction / 100;
  } else {
    text = stripVoiceAmountCurrency(text);
    const halfScale = text.match(/^(?:полтора|полторы)\s+(тысячи|тыщи|косаря|миллиона)$/u);
    if (halfScale) return String(1.5 * scales[halfScale[1]]);
    if (/^\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d{1,2})?$/.test(text)) text = text.replace(/[ \u00a0]/g, "");
    if (/^\d+(?:[.,]\d{1,2})?$/.test(text)) value = Number(text.replace(",", "."));
    else {
      const parts = text.split(/\s+(?:точка|запятая|point|comma|virgulă|virgula)\s+/);
      if (parts.length > 2) return null;
      const main = integer2(parts[0]);
      if (main === null) return null;
      if (parts.length === 1) value = main;
      else {
        const tokens = parts[1].split(/\s+/);
        let fraction = tokens.every((t) => words[t] !== void 0 && words[t] < 10) ? tokens.map((t) => words[t]).join("") : parts[1];
        if (!/^\d{1,2}$/.test(fraction)) {
          const n = integer2(parts[1]);
          if (n === null || n > 99) return null;
          fraction = String(n);
        }
        if (fraction.length > 2) return null;
        value = Number(`${main}.${fraction}`);
      }
    }
  }
  return Number.isFinite(value) && value >= 0 && value < 1e12 ? String(Math.round(value * 100) / 100) : null;
}

// src/shared/lib/chineseVoiceCommand.js
var chineseCurrency = (text) => /美元|美金|usd/i.test(text) ? "USD" : /欧元|eur/i.test(text) ? "EUR" : /卢布|rub/i.test(text) ? "RUB" : /列伊|mdl/i.test(text) ? "MDL" : /人民币|元|块|cny/i.test(text) ? "CNY" : null;
function chineseDate(value) {
  const match = String(value).replace(/\s+/g, "").match(/^(.+?)年(.+?)月(.+?)(?:日|号)$/);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map((v) => Number(parseChineseAmount(v)));
  const date = new Date(year, month - 1, day);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function parseChineseVoiceCommand(value) {
  const text = String(value).toLowerCase().replace(/[，。！？!?]/g, "").replace(/^请/, "").replace(/\s+/g, "");
  const navigation = { history: /^(?:打开|查看|进入)(?:交易)?(?:历史|历史记录)$/, settings: /^(?:打开|进入)设置$/, wallet: /^(?:打开|进入)(?:我的)?钱包$/, today: /^(?:(?:回到|返回|打开))?(?:今天|本月|当前月份)$/ };
  for (const [type, pattern] of Object.entries(navigation)) if (pattern.test(text)) return { type };
  if (/^(?:打开|切换到|查看)?(?:下个|下一|下)月$/.test(text)) return { type: "month", direction: 1 };
  if (/^(?:打开|切换到|查看)?(?:上个|上一|上)月$/.test(text)) return { type: "month", direction: -1 };
  const theme = text.match(/^(?:开启|打开|切换)(?:到)?(深色|浅色|黑暗|明亮)(?:主题|模式)$/);
  if (theme) return { type: "theme", theme: /深色|黑暗/.test(theme[1]) ? "dark" : "light" };
  const mode = text.match(/^(开启|打开|关闭)(交易|pro)模式$/);
  if (mode) return { type: mode[2] === "pro" ? "pro" : "trader", enabled: mode[1] !== "\u5173\u95ED" };
  if (/^(?:添加|新增|创建)(?:一条)?(?:记录|交易)$/.test(text)) return { type: "add", kind: text.endsWith("\u4EA4\u6613") ? "trade" : "record" };
  const category = text.match(/^(?:创建|新增|添加)(?:新)?类别(.*)$/);
  if (category) return category[1] ? category[1].length <= 60 ? { type: "category", name: category[1] } : null : { type: "category-prompt" };
  const date = text.match(/^(?:打开|查看)(.+年.+月.+(?:日|号))$/);
  if (date) {
    const dateKey = chineseDate(date[1]);
    if (!dateKey) return null;
    const [year, month, day] = dateKey.split("-").map(Number);
    return { type: "date", dateKey, year, month: month - 1, day };
  }
  if (/^(?:总结|汇总)(?:这个月|本月)$/.test(text)) return { type: "question", metric: "summary", period: "current-month" };
  const question = text.match(/^(这个月|本月|全部时间|所有时间)(.*?)(花了多少|支出多少|收入多少|赚了多少)$/);
  if (question) return { type: "question", metric: /收入|赚/.test(question[3]) ? "income" : "expense", period: /全部|所有/.test(question[1]) ? "all-time" : "current-month", ...question[2] ? { category: question[2] } : {} };
  const money = text.match(/^(?:(?:记录|添加|记一笔))?(?:(?:我|今天))?(支出|花了|花费|收入|收到|赚了)(.+?)(人民币|美元|美金|欧元|卢布|列伊|块|元|cny|usd|eur|rub|mdl)(?:(?:用于|在|买)(.+))?$/);
  if (money) {
    const amount = parseChineseAmount(money[2]);
    if (amount === null || Number(amount) <= 0 || money[4]?.length > 60) return null;
    return { type: "entry", kind: "record", amount, currency: chineseCurrency(money[3]), sign: /支出|花/.test(money[1]) ? "minus" : "plus", ...money[4] ? { category: money[4] } : {} };
  }
  return null;
}

// src/shared/lib/localizedVoiceCommand.js
function parseLocalizedVoiceCommand(text) {
  const chinese = parseChineseVoiceCommand(text);
  if (chinese) return chinese;
  const normalized = text.replace(/[șş]/g, "s").replace(/[țţ]/g, "t").replace(/[ăâ]/g, "a").replace(/î/g, "i");
  const restore = (value) => value ? text.slice(normalized.lastIndexOf(value), normalized.lastIndexOf(value) + value.length) : value;
  const created = normalized.match(/^(?:create|add) (?:a )?(?:new )?(?:category|section)(?: (.*))?$/) || normalized.match(/^(?:creeaza|adauga|inregistreaza) (?:o |un )?(?:noua |nou )?(?:categorie|categoria|sectiune|sectiunea)(?: (.*))?$/);
  if (created) {
    const name = (created[1] || "").trim();
    return !name || /^(?:create|add|record|creeaza|adauga|inregistreaza)$/.test(name) ? { type: "category-prompt" } : name.length <= 60 ? { type: "category", name: restore(name) } : null;
  }
  if (/^(?:deschide|intra in) (?:portofel|portofelul)$/.test(normalized)) return { type: "wallet" };
  const pro = normalized.match(/^(activeaza|dezactiveaza|porneste|opreste) (?:modul |modul de )?pro$/);
  if (pro) return { type: "pro", enabled: ["activeaza", "porneste"].includes(pro[1]) };
  if (/^(?:(?:treci|mergi|schimba) (?:la |in )?)?luna (?:urmatoare|viitoare)$/.test(normalized)) return { type: "month", direction: 1 };
  if (/^(?:(?:treci|mergi|schimba) (?:la |in )?)?luna (?:precedenta|trecuta|anterioara)$/.test(normalized)) return { type: "month", direction: -1 };
  if (/^adauga (?:o )?(?:inregistrare|tranzactie)$/.test(normalized)) return { type: "add", kind: normalized.endsWith("tranzactie") ? "trade" : "record" };
  const query = normalized.replace(/^(?:tell me|spune-mi|spune mi) /, "");
  const english = query.match(/^how much (?:did i|have i|i)? ?(spend|spent|earn|earned)(?: this month)?(?: (?:on|for|from) (.+?))?(?: this month)?$/);
  const romanian = query.match(/^cat (?:am )?(cheltuit|castigat)(?: (?:luna aceasta|in aceasta luna))?(?: (?:pe|pentru|din) (.+?))?(?: (?:luna aceasta|in aceasta luna))?$/);
  const question = english || romanian;
  if (question) {
    const category = question[2];
    if (category && (/last month|yesterday|anul|luna trecuta|saptamana/.test(category) || category.length > 60)) return null;
    return { type: "question", metric: /earn|castig/.test(question[1]) ? "income" : "expense", period: "current-month", ...category ? { category: restore(category) } : {} };
  }
  if (/^(?:summarize|summary for) (?:this month|the month)$|^(?:rezumat|fa rezumatul|arata totalul)(?: pentru)? (?:luna aceasta|aceasta luna)$/.test(query)) return { type: "question", metric: "summary", period: "current-month" };
  const moneyText = normalized.replace(/^(?:record|add) (?:an? )?expense /, "spent ").replace(/^(?:record|add) (?:an? )?income /, "received ").replace(/^(?:inregistreaza|adauga|noteaza) (?:o )?cheltuiala /, "cheltuit ").replace(/^(?:inregistreaza|adauga|noteaza) (?:un )?venit /, "primit ");
  const money = moneyText.match(/^(?:(?:record|add) (?:an? )?(?:expense )?)?(?:today )?(?:i )?(spent|received|earned) (.+?) (rubles?|euros?|lei|leu|dollars?)(?: (?:on|for) (.+))?$/) || moneyText.match(/^(?:(?:inregistreaza|adauga|noteaza) )?(?:astazi )?(?:am )?(cheltuit|primit|castigat) (.+?) (ruble|euro|lei|leu|dolari)(?: (?:pe|pentru) (.+))?$/);
  if (money) {
    const amount = parseSpokenAmount(money[2].replace(/ de$/, ""));
    if (amount === null || Number(amount) <= 0 || money[4]?.length > 60) return null;
    return { type: "entry", kind: "record", amount, currency: /^rubl/.test(money[3]) ? "RUB" : /^euro/.test(money[3]) ? "EUR" : /^le/.test(money[3]) ? "MDL" : "USD", sign: /spent|cheltuit/.test(money[1]) ? "minus" : "plus", ...money[4] ? { category: restore(money[4]) } : {} };
  }
  return null;
}

// src/shared/lib/financialVoiceQuery.js
var months = [
  ["\u044F\u043D\u0432\u0430\u0440\u044C", "\u044F\u043D\u0432\u0430\u0440\u044F", "\u044F\u043D\u0432\u0430\u0440\u0435", "january"],
  ["\u0444\u0435\u0432\u0440\u0430\u043B\u044C", "\u0444\u0435\u0432\u0440\u0430\u043B\u044F", "\u0444\u0435\u0432\u0440\u0430\u043B\u0435", "february"],
  ["\u043C\u0430\u0440\u0442", "\u043C\u0430\u0440\u0442\u0430", "\u043C\u0430\u0440\u0442\u0435", "march"],
  ["\u0430\u043F\u0440\u0435\u043B\u044C", "\u0430\u043F\u0440\u0435\u043B\u044F", "\u0430\u043F\u0440\u0435\u043B\u0435", "april"],
  ["\u043C\u0430\u0439", "\u043C\u0430\u044F", "\u043C\u0430\u0435", "may"],
  ["\u0438\u044E\u043D\u044C", "\u0438\u044E\u043D\u044F", "\u0438\u044E\u043D\u0435", "june"],
  ["\u0438\u044E\u043B\u044C", "\u0438\u044E\u043B\u044F", "\u0438\u044E\u043B\u0435", "july"],
  ["\u0430\u0432\u0433\u0443\u0441\u0442", "\u0430\u0432\u0433\u0443\u0441\u0442\u0430", "\u0430\u0432\u0433\u0443\u0441\u0442\u0435", "august"],
  ["\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C", "\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044F", "\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u0435", "september"],
  ["\u043E\u043A\u0442\u044F\u0431\u0440\u044C", "\u043E\u043A\u0442\u044F\u0431\u0440\u044F", "\u043E\u043A\u0442\u044F\u0431\u0440\u0435", "october"],
  ["\u043D\u043E\u044F\u0431\u0440\u044C", "\u043D\u043E\u044F\u0431\u0440\u044F", "\u043D\u043E\u044F\u0431\u0440\u0435", "november"],
  ["\u0434\u0435\u043A\u0430\u0431\u0440\u044C", "\u0434\u0435\u043A\u0430\u0431\u0440\u044F", "\u0434\u0435\u043A\u0430\u0431\u0440\u0435", "december"]
];
var periodPatterns = [
  ["all-time", /(?:за )?(?:все время|всю историю)|\ball time\b/],
  ["current-week", /(?:(?:за|на|в) )?(?:этой|эту|текущую|текущей) недел[юеи]|\bthis week\b/],
  ["last-week", /(?:(?:за|на|в) )?(?:прошлой|прошлую|предыдущую|предыдущей) недел[юеи]|\blast week\b/],
  ["last-month", /(?:(?:за|в) )?(?:прошлый|прошлом|предыдущий|предыдущем) месяц(?:е)?|\blast month\b/],
  ["current-month", /(?:(?:за|в) )?(?:(?:этот|этом|текущий|текущем) )?месяц(?:е)?|\bthis month\b/],
  ["yesterday", /(?:за )?вчера|\byesterday\b/],
  ["today", /(?:за )?сегодня|\btoday\b/]
];
function parseFinancialVoiceQuery(value) {
  let text = normalizeVoiceCategory(normalizeVoicePhrase(value)).replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim().replace(/^(?:пожалуйста |можешь |скажи |расскажи |tell me |please )/, "").replace(/ пожалуйста$/, "");
  const last = /^when did i last (?:pay|spend)(?: |$)/.test(text);
  const lastRu = /^когда (?:я )?(?:последний раз |в последний раз )?(?:платил|платила|оплатил|оплатила|потратил|потратила)(?: |$)/.test(text);
  const search = /^(?:покажи|найди|показать|найти|show|find)(?: |$)/.test(text) && /(?:расход|трат|доход|запис|платеж|покуп|expense|spending|income|entries|payments)/.test(text);
  const question = /^(?:сколько|какие|какой|подведи|итог|итоги|how much|summarize|summary for)(?: |$)/.test(text);
  if (!last && !lastRu && !search && !question) return null;
  const income = text.split(" ").some(isVoiceIncome) || /(?:заработал|заработала|получил|получила|доход|earn|income|receive)/.test(text);
  const expense = text.split(" ").some(isVoiceExpense) || /(?:потратил|потратила|потрачено|расход|трат|платил|платила|оплатил|оплатила|платеж|покуп|spend|spent|expense|pay)/.test(text);
  const summary = /(?:итог|summar|записи|entries)/.test(text);
  if (!income && !expense && !summary) return null;
  if (income && expense) return null;
  const command = { type: search || last || lastRu ? "financial-search" : "question", metric: income ? "income" : expense ? "expense" : "summary", period: last || lastRu ? "all-time" : "current-month" };
  if (search || last || lastRu) command.mode = last || lastRu ? "last" : "search";
  let explicitPeriod = false;
  for (const [period, pattern] of periodPatterns) {
    if (pattern.test(text)) {
      if (explicitPeriod) return null;
      explicitPeriod = true;
      command.period = period;
      text = text.replace(pattern, " ").replace(/\s+/g, " ").trim();
    }
  }
  const named = new RegExp(`(?:^| )(?:\u0437\u0430 |\u0432 |in |for )?(${months.flat().join("|")})(?: (20\\d{2}|19\\d{2})(?: \u0433\u043E\u0434\u0430)?)?(?= |$)`);
  const match = text.match(named);
  if (match) {
    if (explicitPeriod) return null;
    command.period = "named-month";
    command.month = months.findIndex((names) => names.includes(match[1])) + 1;
    if (match[2]) command.year = Number(match[2]);
    text = text.replace(match[0], " ").replace(/\s+/g, " ").trim();
  }
  if (/недел|месяц|год|сегодня|вчера|завтра|week|month|year|20\d{2}|19\d{2}/.test(text)) return null;
  const category = text.match(/(?:^| )(?:на|за|по|категория|категории|раздел|разделу|on|for)(?: категорию| категории| разделу)? (.+)$/);
  if (category) {
    const name = category[1].replace(/\s+(?:потратил|потратила|потрачено|заработал|заработала|получил|получила)$/, "").replace(/\s+/g, " ").trim();
    if (!name || name.length > 60) return null;
    command.category = name;
  } else {
    const remainder = text.replace(/^(?:покажи|найди|показать|найти|show|find) /, "").replace(/^(?:все |мои |my |all )+/, "").replace(/^(?:расходы|траты|доходы|записи|платежи|покупки|expenses|spending|income|entries|payments)(?: |$)/, "").trim();
    if (search && remainder) {
      if (remainder.length > 60) return null;
      command.category = remainder;
    }
  }
  return command;
}

// src/shared/lib/voiceCapabilities.js
function isVoiceHelpRequest(phrase) {
  const text = normalizeVoicePhrase(phrase).toLowerCase().replace(/ё/g, "\u0435").replace(/[!?.,«»？！。，、：；"]/g, " ").replace(/\s+/g, " ").trim().replace(/^(?:пожалуйста |скажи |расскажи |а )+/, "").replace(/ пожалуйста$/, "");
  const words2 = text.replace(/что-нибудь|что-то/g, "\u0447\u0442\u043E").replace(/(?:умеешь|можешь)-то/g, (word) => word.slice(0, -3)).split(/\s+/);
  const helpWords = new Set("\u0447\u0442\u043E \u0447\u0435\u0433\u043E \u0434\u043B\u044F \u043C\u0435\u043D\u044F \u043C\u043D\u0435 \u0441 \u0432 \u044D\u0442\u043E\u043C \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u0435\u043C \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u043C\u043E\u0436\u043D\u043E \u0442\u044B \u0432\u044B \u0443\u043C\u0435\u0435\u0448\u044C \u0443\u043C\u0435\u0435\u0442\u0435 \u0443\u043C\u0435\u0435\u0442 \u043C\u043E\u0436\u0435\u0448\u044C \u043C\u043E\u0436\u0435\u0442\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u043E\u043E\u0431\u0449\u0435 \u0435\u0449\u0435 \u0436\u0435 \u0434\u0435\u043B\u0430\u0442\u044C \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043A\u0430\u043A\u0438\u0435 \u043A\u0430\u043A\u0430\u044F \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0435 \u0435\u0441\u0442\u044C \u0443 \u0442\u0435\u0431\u044F \u0432\u0430\u0441 \u0442\u0432\u043E\u0438 \u0441\u0432\u043E\u0438 \u0441\u0432\u043E\u0438\u0445 \u043E \u043F\u043E\u043A\u0430\u0436\u0438 \u0437\u043D\u0430\u0435\u0448\u044C \u0437\u043D\u0430\u0435\u0442\u0435 \u0437\u0434\u0435\u0441\u044C \u0442\u0443\u0442 \u0447\u0435\u043C \u043F\u043E\u043B\u0435\u0437\u0435\u043D \u043F\u043E\u043B\u0435\u0437\u043D\u044B \u043F\u043E\u043C\u043E\u0447\u044C \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E\u043C\u043E\u0449\u043D\u0438\u043A \u044D\u0442\u043E \u044D\u0442\u043E\u0442".split(" "));
  const knownHelp = words2.every((word) => helpWords.has(word));
  if (knownHelp && (words2.some((word) => ["\u0447\u0442\u043E", "\u0447\u0435\u0433\u043E", "\u0447\u0435\u043C"].includes(word)) && words2.some((word) => ["\u0443\u043C\u0435\u0435\u0448\u044C", "\u0443\u043C\u0435\u0435\u0442\u0435", "\u0443\u043C\u0435\u0435\u0442", "\u043C\u043E\u0436\u0435\u0448\u044C", "\u043C\u043E\u0436\u0435\u0442\u0435", "\u043C\u043E\u0436\u0435\u0442", "\u043C\u043E\u0436\u043D\u043E", "\u043F\u043E\u043B\u0435\u0437\u0435\u043D"].includes(word)) || words2.some((word) => ["\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438", "\u0444\u0443\u043D\u043A\u0446\u0438\u0438", "\u043A\u043E\u043C\u0430\u043D\u0434\u044B"].includes(word)) && words2.some((word) => ["\u043A\u0430\u043A\u0438\u0435", "\u043F\u043E\u043A\u0430\u0436\u0438", "\u0441\u0432\u043E\u0438\u0445"].includes(word)))) return true;
  if (/^(?:(?:расскажи )?о (?:своих|твоих) возможностях|как с тобой (?:работать|разговаривать)|как пользоваться (?:тобой|голосом)|какие команды (?:можно|могу) (?:сказать|произнести)|помоги разобраться|what are your capabilities|how can you help me|what commands are available)$/.test(text)) return true;
  return /^(?:(?:что(?:-то| то)?|чего) (?:же |вообще )?(?:ты )?(?:вообще |еще |же )?(?:умеешь|можешь)(?: делать)?|что ты можешь делать|что можно (?:сказать|сделать голосом)|(?:какие|все) (?:у тебя )?(?:возможности|команды)|какие команды (?:ты )?знаешь|покажи (?:все )?(?:возможности|команды)|чем (?:ты )?можешь помочь|какие (?:у тебя )?функции|что (?:здесь|тут) можно делать|помоги|помощь|как (?:тобой пользоваться|пользоваться голосом))$/.test(text) || /^(?:what can you do|what do you do|what can i say|help(?: me)?|show (?:all )?commands|ce (?:poți|poti) (?:face|să faci|sa faci)|ajutor|你会什么|你能做什么|有什么功能|帮助)$/.test(text);
}

// src/shared/lib/calendarVoiceCommand.js
var months2 = [
  ["\u044F\u043D\u0432\u0430\u0440\u044C", "\u044F\u043D\u0432\u0430\u0440\u044F", "january", "ianuarie"],
  ["\u0444\u0435\u0432\u0440\u0430\u043B\u044C", "\u0444\u0435\u0432\u0440\u0430\u043B\u044F", "february", "februarie"],
  ["\u043C\u0430\u0440\u0442", "\u043C\u0430\u0440\u0442\u0430", "march", "martie"],
  ["\u0430\u043F\u0440\u0435\u043B\u044C", "\u0430\u043F\u0440\u0435\u043B\u044F", "april", "aprilie"],
  ["\u043C\u0430\u0439", "\u043C\u0430\u044F", "may", "mai"],
  ["\u0438\u044E\u043D\u044C", "\u0438\u044E\u043D\u044F", "june", "iunie"],
  ["\u0438\u044E\u043B\u044C", "\u0438\u044E\u043B\u044F", "july", "iulie"],
  ["\u0430\u0432\u0433\u0443\u0441\u0442", "\u0430\u0432\u0433\u0443\u0441\u0442\u0430", "august"],
  ["\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C", "\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044F", "september", "septembrie"],
  ["\u043E\u043A\u0442\u044F\u0431\u0440\u044C", "\u043E\u043A\u0442\u044F\u0431\u0440\u044F", "october", "octombrie"],
  ["\u043D\u043E\u044F\u0431\u0440\u044C", "\u043D\u043E\u044F\u0431\u0440\u044F", "november", "noiembrie"],
  ["\u0434\u0435\u043A\u0430\u0431\u0440\u044C", "\u0434\u0435\u043A\u0430\u0431\u0440\u044F", "december", "decembrie"]
];
function parseCalendarVoiceCommand(transcript) {
  if (isVoiceHelpRequest(transcript)) return { type: "voice-help" };
  const text = normalizeVoicePhrase(transcript).toLowerCase().replace(/ё/g, "\u0435").replace(/([\d])[,.](?=\d)/g, "$1DECIMAL").replace(/[,.!?]/g, " ").replace(/DECIMAL/g, ",").replace(/\s+/g, " ").trim().replace(/^пожалуйста | пожалуйста$/g, "");
  const navigation = parseVoiceNavigation(text);
  if (navigation) return navigation;
  const financialQuery = parseFinancialVoiceQuery(transcript);
  if (financialQuery) return financialQuery;
  const lifetime = text.match(/^сколько (?:я )?(?:всего )?(?:потратил|потратила)(?: за все время)? на (.+?)(?: за все время)?$/);
  if (lifetime && text.includes("\u0437\u0430 \u0432\u0441\u0435 \u0432\u0440\u0435\u043C\u044F")) return { type: "question", metric: "expense", period: "all-time", category: lifetime[1] };
  const localized = parseLocalizedVoiceCommand(text);
  if (localized) return localized;
  const categoryCreate = text.match(/^(?:создай|создать|добавь|добавить|запиши|записать) (?:новую |новый )?(?:категорию|раздел)(?: (.*))?$/);
  if (categoryCreate) {
    const name = String(categoryCreate[1] || "").replace(/[«»"']/g, "").replace(/^(?:(?:создай|создать|добавь|добавить|запиши|записать)(?: категорию| раздел)? )+/, "").trim();
    if (!name || /^(?:создай|создать|добавь|добавить|запиши|записать|категория|категорию|раздел)$/.test(name)) return { type: "category-prompt" };
    if (name.length <= 60) return { type: "category", name };
  }
  const categoryQuestion = text.replace(/^(?:скажи|расскажи) /, "").match(/^сколько (?:я )?(?:всего )?(потратил|потратила|потрачено|заработал|заработала)(?: (?:за|в) (?:(?:этот|этом|текущий|текущем) )?месяц(?:е)?)? на (.+)$/);
  if (categoryQuestion) {
    const category = categoryQuestion[2].replace(/ (?:за|в) (?:(?:этот|этом|текущий|текущем) )?месяц(?:е)?$/, "").replace(/[«»"']/g, "").trim();
    if (category && category.length <= 60 && !/прошл|предыдущ|год|недел|вчера/.test(category)) return { type: "question", metric: categoryQuestion[1].startsWith("\u0437\u0430\u0440\u0430\u0431\u043E\u0442") ? "income" : "expense", period: "current-month", category };
  }
  const categorized = text.match(/^(.+?) на (.+)$/);
  if (categorized && !/^сколько/.test(text)) {
    const base = parseCalendarVoiceCommand(categorized[1]);
    const category = categorized[2].replace(/[«»"']/g, "").trim();
    if (base?.type === "entry" && category && category.length <= 60) return { ...base, category };
    const words2 = categorized[2].split(" ");
    for (let i = 1; i < words2.length; i++) {
      const entry = parseCalendarVoiceCommand(`${categorized[1]} ${words2.slice(i).join(" ")}`);
      const name = words2.slice(0, i).join(" ");
      if (entry?.type === "entry" && name.length <= 60) return { ...entry, category: name };
    }
  }
  if (/^(?:войди|зайди|перейди|открой)(?: в)? (?:мой )?кошелек$|^open (?:my )?wallet$|^deschide portofelul$/.test(text)) return { type: "wallet" };
  const pro = text.match(/^(включи|включить|выключи|выключить|отключи|отключить) (?:режим )?(?:про|pro)$/);
  if (pro) return { type: "pro", enabled: /^включ/.test(pro[1]) };
  if (/^(?:turn|switch) (on|off) pro(?: mode)?$/.test(text)) return { type: "pro", enabled: / on /.test(text) };
  if (/^(?:перемотай|перелистни|переключи|листай|перейди)(?: (?:на|в))? (?:следующий месяц|вперед)$|^следующий месяц$|^next month$/.test(text)) return { type: "month", direction: 1 };
  if (/^(?:перемотай|перелистни|переключи|листай|перейди)(?: (?:на|в))? (?:предыдущий месяц|прошлый месяц|назад)$|^предыдущий месяц$|^previous month$/.test(text)) return { type: "month", direction: -1 };
  if (/(?:рубль|рубля|рублей|евро|лей|лея|леев|доллар|доллара|долларов)/.test(text) && /(?:потратил|потратила|расход|получил|получила|заработал|заработала|доход)/.test(text)) {
    const stripped = text.replace(/в календарь|в календаре/g, " ").split(" ").filter((word) => !["\u0434\u043E\u0431\u0430\u0432\u044C", "\u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C", "\u0437\u0430\u043F\u0438\u0448\u0438", "\u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C", "\u044F", "\u0441\u0435\u0433\u043E\u0434\u043D\u044F", "\u043F\u043E\u0442\u0440\u0430\u0442\u0438\u043B", "\u043F\u043E\u0442\u0440\u0430\u0442\u0438\u043B\u0430", "\u043F\u043E\u043B\u0443\u0447\u0438\u043B", "\u043F\u043E\u043B\u0443\u0447\u0438\u043B\u0430", "\u0437\u0430\u0440\u0430\u0431\u043E\u0442\u0430\u043B", "\u0437\u0430\u0440\u0430\u0431\u043E\u0442\u0430\u043B\u0430", "\u0440\u0430\u0441\u0445\u043E\u0434", "\u0434\u043E\u0445\u043E\u0434", "\u0437\u0430\u043F\u0438\u0441\u044C"].includes(word)).join(" ").trim();
    const amountMatch = stripped.match(/^(.+?) (рубль|рубля|рублей|евро|лей|лея|леев|доллар|доллара|долларов)$/);
    if (amountMatch) {
      const amount = parseSpokenAmount(amountMatch[1]);
      if (amount !== null && Number(amount) > 0) {
        const expense = /потратил|потратила|расход/.test(text), income = /получил|получила|заработал|заработала|доход/.test(text);
        if (expense !== income) return { type: "entry", kind: "record", amount, currency: /^руб/.test(amountMatch[2]) ? "RUB" : amountMatch[2] === "\u0435\u0432\u0440\u043E" ? "EUR" : /^ле/.test(amountMatch[2]) ? "MDL" : "USD", sign: expense ? "minus" : "plus" };
      }
    }
  }
  const question = text.replace(/^(расскажи[,]? |скажи[,]? |tell me |spune-mi )/, "");
  const monthly = question.match(/^(.*?) (?:за|в) (?:(?:этот|этом|текущий|текущем) )?месяц(?:е)?$/);
  if (monthly) {
    const intent = monthly[1];
    if (/^(?:сколько (?:я )?(?:заработал|заработала|получил|получила)|(?:какие|сколько) (?:у меня )?(?:мои )?доходы)$/.test(intent)) return { type: "question", metric: "income", period: "current-month" };
    if (/^(?:сколько (?:я )?(?:потратил|потратила|потрачено)|(?:какие|сколько) (?:у меня )?(?:мои )?расходы)$/.test(intent)) return { type: "question", metric: "expense", period: "current-month" };
    if (/^(?:подведи (?:итог|итоги)|(?:какой|какие) (?:итог|итоги)|итог|итоги|покажи итог|расскажи итог)$/.test(intent)) return { type: "question", metric: "summary", period: "current-month" };
  }
  const questions = { expense: /^(?:сколько (?:я )?(?:потратил|потратила)|какие (?:мои )?расходы) (?:за |в )?(?:этом|этот|текущий) месяц(?:е)?$|^how much (?:did i spend|have i spent) this month$|^cât am cheltuit luna aceasta$/, income: /^сколько (?:я )?(?:заработал|заработала|получил|получила) (?:за |в )?(?:этом|этот|текущий) месяц(?:е)?$|^how much (?:did i earn|have i earned) this month$|^cât am câștigat luna aceasta$/, summary: /^(?:какой итог|подведи итог|итоги|итог) (?:за |в )?(?:этом|этот|текущий) месяц(?:е)?$|^(?:summarize|summary for) this month$|^rezumat pentru luna aceasta$/ };
  for (const [metric, pattern] of Object.entries(questions)) if (pattern.test(question)) return { type: "question", metric, period: "current-month" };
  const money = text.match(/^(?:сегодня )?(?:я )?(потратил|потратила|получил|получила|заработал|заработала) (.+) (рубль|рубля|рублей|евро|лей|лея|леев|доллар|доллара|долларов)$/) || text.match(/^(?:today )?i (spent|received|earned) (.+) (rubles?|euros?|lei|dollars?)$/) || text.match(/^(?:astăzi )?am (cheltuit|primit|câștigat) (.+) (ruble|euro|lei|dolari)$/);
  if (money) {
    const amount = parseSpokenAmount(money[2]);
    if (amount === null || Number(amount) <= 0) return null;
    const currency = /^(руб|rubl)/.test(money[3]) ? "RUB" : /^(евро|euro)/.test(money[3]) ? "EUR" : /^(лей|лея|леев|lei)$/.test(money[3]) ? "MDL" : "USD";
    return { type: "entry", kind: "record", amount, currency, sign: /^(потрат|spent|cheltuit)/.test(money[1]) ? "minus" : "plus" };
  }
  if (/^(добавь|добавить|создай) (новую )?(запись|сделку)$/.test(text)) return { type: "add", kind: text.endsWith("\u0441\u0434\u0435\u043B\u043A\u0443") ? "trade" : "record" };
  if (/^(add|create) (a |new )?(record|entry|trade)$/.test(text)) return { type: "add", kind: text.endsWith("trade") ? "trade" : "record" };
  if (/^adaugă (o )?(înregistrare|tranzacție)$/.test(text)) return { type: "add", kind: text.endsWith("tranzac\u021Bie") ? "trade" : "record" };
  const date = text.replace(/^(открой|открыть|покажи|включи|перейди на|open|show|go to|deschide|arată|arata)\s+/, "");
  if (date === text) return null;
  const match = date.match(new RegExp(`^(.+?)\\s+(${months2.flat().join("|")})\\s+(.+)$`));
  if (!match) return null;
  const day = Number(parseSpokenAmount(match[1])), year = Number(parseSpokenAmount(match[3]));
  if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(year) || year < 1900 || year > 9999) return null;
  const month = months2.findIndex((names) => names.includes(match[2]));
  const checked = new Date(year, month, day);
  if (checked.getFullYear() !== year || checked.getMonth() !== month || checked.getDate() !== day) return null;
  return { type: "date", year, month, day, dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

// src/shared/lib/chineseEntryDialog.js
function chineseEntryDialog(phrase, draft, categories, options) {
  const text = String(phrase).replace(/\s+/g, "").replace(/[，。！？!?]$/, "");
  if (/^(?:取消|停止|不用了)$/.test(text)) return draft ? { cancelled: true } : null;
  const full = parseChineseVoiceCommand(text);
  if (!draft && full && full.type !== "entry") return null;
  if (!draft && !full && !/^(?:记录|添加|我|今天)?(?:支出|收入|花了|花费|收到|赚了|买了)/.test(text)) return null;
  const next = { ...draft, ...full?.type === "entry" ? full : {} };
  if (/支出|花了|花费|买了/.test(text) && /收入|收到|赚了/.test(text)) return null;
  if (/^(?:记录|添加|我|今天)?(?:支出|花了|花费|买了)/.test(text)) next.sign = "minus";
  if (/^(?:记录|添加|我|今天)?(?:收入|收到|赚了)/.test(text)) next.sign = "plus";
  const purchase2 = text.match(/^买了(.+?)(?:花了|花费|共|要)(.+)$/);
  if (purchase2) {
    next.item = purchase2[1];
    next.sign = "minus";
  }
  const currency = chineseCurrency(text);
  if (currency) next.currency = currency;
  if (draft?.suggestedCurrency && /^(?:是|对|好的|可以)$/.test(text)) next.currency = draft.suggestedCurrency;
  const amountText = (purchase2 ? purchase2[2] : text).replace(/^(?:不对[,，]?|不是[,，]?|不[,，]?)?/, "").replace(/^(?:记录|添加|我|今天)?(?:金额|支出|收入|花了|花费|收到|赚了)?/, "").replace(/(?:用于|在|买).+$/, "").replace(/(?:人民币|美元|美金|欧元|卢布|列伊|CNY|USD|EUR|RUB|MDL)$/i, "");
  const amount = parseChineseAmount(amountText);
  if (amount !== null && Number(amount) > 0) next.amount = amount;
  const category = text.match(/^(?:类别|用于)(.+)$/);
  const chosen = categories.find((c) => [c.value, c.label].includes(category?.[1] || text));
  if (chosen) {
    next.category = chosen.value;
    next.categoryConfirmed = true;
  } else if (category && category[1].length <= 60) {
    next.category = category[1];
    next.categoryConfirmed = true;
  }
  if (next.item && full?.type === "category") {
    next.category = full.name;
    next.categoryConfirmed = true;
  }
  if (/^(?:日历和钱包|两者|都要)$/.test(text) && options.walletAvailable) next.destination = "both";
  if (/^(?:保存到|添加到)?钱包$/.test(text) && options.walletAvailable) next.destination = "wallet";
  if (/^(?:保存到|添加到)?日历$/.test(text)) next.destination = "main";
  const field = !next.sign ? "sign" : !next.amount ? "amount" : !next.currency ? "currency" : next.item && !next.categoryConfirmed ? "category" : options.askDestination && !next.destination ? "destination" : null;
  if (!field) return { command: { type: "entry", kind: "record", amount: next.amount, currency: next.currency, sign: next.sign, ...next.category ? { category: next.category } : {}, ...next.destination ? { destination: next.destination } : {} } };
  const prompts = { sign: "\u8FD9\u662F\u652F\u51FA\u8FD8\u662F\u6536\u5165\uFF1F", amount: "\u8BB0\u5F55\u591A\u5C11\u91D1\u989D\uFF1F", currency: "\u4F7F\u7528\u54EA\u79CD\u8D27\u5E01\uFF1A\u4EBA\u6C11\u5E01\u3001\u7F8E\u5143\u3001\u6B27\u5143\u3001\u5362\u5E03\u8FD8\u662F\u5217\u4F0A\uFF1F", category: `\u5C06\u201C${next.item}\u201D\u5F52\u5165\u54EA\u4E2A\u7C7B\u522B\uFF1F\u8BF7\u9009\u62E9\u5DF2\u6709\u7C7B\u522B\u6216\u521B\u5EFA\u65B0\u7C7B\u522B\u3002`, destination: options.walletAvailable ? "\u4FDD\u5B58\u5230\u65E5\u5386\u3001\u94B1\u5305\uFF0C\u8FD8\u662F\u4E24\u8005\uFF1F" : "\u6DFB\u52A0\u5230\u65E5\u5386\uFF1F\u8BF7\u8BF4\u201C\u65E5\u5386\u201D\u3002" };
  if (field === "currency" && options.defaultCurrency) {
    next.suggestedCurrency = options.defaultCurrency;
    prompts.currency = `\u4F7F\u7528 ${options.defaultCurrency} \u8BB0\u5F55\uFF1F\u8BF7\u8BF4\u201C\u662F\u201D\u6216\u6307\u5B9A\u5176\u4ED6\u8D27\u5E01\u3002`;
  }
  return { draft: next, field, prompt: prompts[field] };
}

// src/shared/lib/voiceEntryDialog.js
function voiceEntryDialog(phrase, draft = null, locale = "ru", categories = [], options = {}) {
  if (String(locale).startsWith("zh")) return chineseEntryDialog(phrase, draft, categories, options);
  const raw = String(phrase).toLowerCase().replace(/ё/g, "\u0435").replace(/[.!?]$/, "").replace(/\s+/g, " ").trim();
  const destination = /(?:календарь и (?:в )?кошелек|кошелек и (?:в )?календарь|оба|both|ambele)/.test(raw) ? "both" : /(?:в кошелек|^кошелек$|wallet)/.test(raw) ? "wallet" : /(?:в календарь|^календарь$|calendar)/.test(raw) ? "main" : null;
  const text = raw.replace(/^(?:(?:я|сегодня|например|ну) )+/, "").replace(/[, ]+(?:записать|запиши|добавить|добавь)(?: это)? (?:в календарь и кошелек|в кошелек|в календарь)$/, "").trim();
  if (/^(отмена|отмени|не надо|cancel|stop|anuleaza|anulează)$/.test(text)) return draft ? { cancelled: true } : null;
  const purchase2 = !/вчера|завтра|yesterday|tomorrow/.test(text) && text.match(/^(?:(?:сегодня|я|запиши) )*купил[а]? (.+?)(?: за (.+))?$/);
  const full = parseCalendarVoiceCommand(text);
  const categoryReply = draft?.item && draft.amount && draft.currency && full?.type === "category";
  if (full?.type === "entry" && !draft?.item && !options.askDestination) return { command: full };
  if (!draft && !purchase2 && full?.type !== "entry" && !/^(?:запиши|добавь|я потратил|потратил|потратила|расход|доход|получил|получила|заработал|заработала|record|add|i spent|spent|received|earned|am cheltuit|cheltuit|am primit|am câștigat|am castigat|primit|câștigat|castigat|adauga|adaugă)\b/u.test(text) && !/^(?:запиши|добавь|потратил|потратила|расход|доход|получил|получила|заработал|заработала|am cheltuit|am primit|am câștigat|am castigat|adaugă)(?: |$)/.test(text)) return null;
  if (!draft && full && full.type !== "entry") return null;
  const next = { ...draft, ...full?.type === "entry" ? full : {} };
  if (categoryReply) {
    next.category = full.name;
    next.categoryConfirmed = true;
  }
  if (!/^(?:не |not |nu )/.test(raw) && destination && (destination === "main" || options.walletAvailable)) next.destination = destination;
  if (options.askDestination && draft?.amount && draft?.currency && /^(да|yes|da)$/.test(text) && !options.walletAvailable) next.destination = "main";
  if (!next.currency && draft?.suggestedCurrency && /^(да|ага|верно|правильно|yes|correct|da)$/.test(text)) next.currency = draft.suggestedCurrency;
  if (purchase2) {
    next.item = purchase2[1].trim();
    next.sign = "minus";
  }
  if (draft?.item) {
    const chosen = categories.find((item) => [item.value, item.label].some((name) => normalizeVoiceCategory(name) === normalizeVoiceCategory(text.replace(/^(?:в категорию |в |категория |in |category |categoria )/, ""))));
    if (chosen) {
      next.category = chosen.value;
      next.categoryConfirmed = true;
    } else if (/^(новую|новая категория|создай новую|отдельную|new category|categorie noua|categorie nouă)$/.test(text)) {
      next.category = next.item;
      next.categoryConfirmed = true;
    }
  }
  if (/потрат|расход|spent|expense|cheltuit|cheltuial/.test(text)) next.sign = "minus";
  if (/получ|заработ|доход|received|earned|income|primit|venit|castig|câștig/.test(text)) next.sign = "plus";
  const currency = text.match(/руб\w*|руб[а-я]*|ruble?s?|rub|евро|euros?|eur|ле[йя]|леев|lei|leu|mdl|доллар[а-я]*|dollars?|usd/iu);
  if (currency) next.currency = /руб|rub/i.test(currency[0]) ? "RUB" : /евро|eur/i.test(currency[0]) ? "EUR" : /ле|lei|leu|mdl/i.test(currency[0]) ? "MDL" : "USD";
  const category = text.match(/(?: на | on | pe )(.+)$/);
  if (category && category[1].length <= 60) next.category = category[1];
  let amountText = (purchase2 ? purchase2[2] || "" : text).replace(/(?: на | on | pe ).+$/, "").replace(/^(?:нет[, ]+|no[, ]+|nu[, ]+)?(?:сумма |amount |suma )?/, "");
  amountText = amountText.replace(/^(?:(?:запиши|добавь|запись|я|сегодня|потратил|потратила|расход|доход|получил|получила|заработал|заработала|record|add|i|today|spent|received|earned|am|cheltuit|primit|câștigat|castigat|adauga|adaugă)\s*)+/, "");
  amountText = amountText.replace(/\s+(?:руб[а-я]*|rubles?|rub|евро|euros?|eur|ле[йя]|леев|lei|leu|mdl|доллар[а-я]*|dollars?|usd)$/i, "");
  const amount = parseSpokenAmount(amountText);
  if (amount !== null && Number(amount) > 0) next.amount = amount;
  const field = !next.sign ? "sign" : !next.amount ? "amount" : !next.currency ? "currency" : next.item && !next.categoryConfirmed ? "category" : options.askDestination && !next.destination ? "destination" : null;
  if (!field) return { command: { type: "entry", kind: "record", amount: next.amount, currency: next.currency, sign: next.sign, ...next.category ? { category: next.category } : {}, ...next.destination ? { destination: next.destination } : {} } };
  const questions = {
    zh: { sign: "\u8FD9\u662F\u652F\u51FA\u8FD8\u662F\u6536\u5165\uFF1F", amount: "\u8BB0\u5F55\u591A\u5C11\u91D1\u989D\uFF1F", currency: "\u4F7F\u7528\u54EA\u79CD\u8D27\u5E01\uFF1A\u4EBA\u6C11\u5E01\u3001\u5362\u5E03\u3001\u6B27\u5143\u3001\u5217\u4F0A\u8FD8\u662F\u7F8E\u5143\uFF1F" },
    ru: { sign: "\u042D\u0442\u043E \u0440\u0430\u0441\u0445\u043E\u0434 \u0438\u043B\u0438 \u0434\u043E\u0445\u043E\u0434?", amount: "\u041A\u0430\u043A\u0443\u044E \u0441\u0443\u043C\u043C\u0443 \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C?", currency: "\u0412 \u043A\u0430\u043A\u043E\u0439 \u0432\u0430\u043B\u044E\u0442\u0435: \u0440\u0443\u0431\u043B\u0438, \u0435\u0432\u0440\u043E, \u043B\u0435\u0438 \u0438\u043B\u0438 \u0434\u043E\u043B\u043B\u0430\u0440\u044B?" },
    en: { sign: "Is this an expense or income?", amount: "What amount should I record?", currency: "Which currency: rubles, euros, lei or dollars?" },
    ro: { sign: "Este o cheltuial\u0103 sau un venit?", amount: "Ce sum\u0103 s\u0103 \xEEnregistrez?", currency: "\xCEn ce moned\u0103: ruble, euro, lei sau dolari?" }
  };
  if (field === "currency") {
    next.suggestedCurrency = ["RUB", "EUR", "MDL", "USD"].includes(options.defaultCurrency) ? options.defaultCurrency : "USD";
    if (options.defaultCurrency) {
      const name = { RUB: "\u0440\u0443\u0431\u043B\u044F\u0445", EUR: "\u0435\u0432\u0440\u043E", MDL: "\u043B\u0435\u044F\u0445", USD: "\u0434\u043E\u043B\u043B\u0430\u0440\u0430\u0445" }[next.suggestedCurrency];
      return { draft: next, field, prompt: locale === "zh" ? `\u4F7F\u7528 ${next.suggestedCurrency} \u8BB0\u5F55\uFF1F\u8BF7\u8BF4\u201C\u662F\u201D\u6216\u6307\u5B9A\u5176\u4ED6\u8D27\u5E01\u3002` : locale === "ru" ? `\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0441\u0443\u043C\u043C\u0443 \u0432 ${name}? \u041E\u0442\u0432\u0435\u0442\u044C\u0442\u0435 \xAB\u0434\u0430\xBB \u0438\u043B\u0438 \u043D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0443\u044E \u0432\u0430\u043B\u044E\u0442\u0443.` : locale === "en" ? `Record in ${next.suggestedCurrency}? Say yes or another currency.` : `\xCEnregistr\u0103m \xEEn ${next.suggestedCurrency}? Spune da sau alt\u0103 moned\u0103.` };
    }
  }
  if (field === "destination") return { draft: next, field, prompt: locale === "zh" ? options.walletAvailable ? "\u6DFB\u52A0\u5230\u65E5\u5386\u3001\u94B1\u5305\uFF0C\u8FD8\u662F\u4E24\u8005\uFF1F" : "\u6DFB\u52A0\u5230\u65E5\u5386\uFF1F\u8BF7\u8BF4\u201C\u662F\u201D\u3002" : locale === "ru" ? options.walletAvailable ? "\u041A\u0443\u0434\u0430 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C: \u0432 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C, \u043A\u043E\u0448\u0435\u043B\u0451\u043A \u0438\u043B\u0438 \u0432 \u043E\u0431\u0430?" : "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C? \u041E\u0442\u0432\u0435\u0442\u044C\u0442\u0435 \xAB\u0434\u0430\xBB." : locale === "en" ? options.walletAvailable ? "Calendar, wallet or both?" : "Add to the calendar? Say yes." : options.walletAvailable ? "\xCEn calendar, portofel sau ambele?" : "Ad\u0103ug\u0103m \xEEn calendar? Spune da." };
  return { draft: next, field, prompt: field === "category" ? {
    zh: `\u5C06\u201C${next.item}\u201D\u5F52\u5165\u54EA\u4E2A\u7C7B\u522B\uFF1F\u9009\u62E9\u5DF2\u6709\u7C7B\u522B\u6216\u521B\u5EFA\u65B0\u7C7B\u522B\u3002`,
    ru: `\u0412 \u043A\u0430\u043A\u0443\u044E \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E \u043E\u0442\u043D\u0435\u0441\u0442\u0438 \u043F\u043E\u043A\u0443\u043F\u043A\u0443 \xAB${next.item}\xBB? \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0443\u044E \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E.`,
    en: `Which category should contain ${next.item}? Choose an existing one or create a separate category.`,
    ro: `\xCEn ce categorie includem ${next.item}? Alege una existent\u0103 sau creeaz\u0103 una separat\u0103.`
  }[locale] : questions[locale][field] };
}

// src/shared/lib/naturalVoiceEntry.js
function resolveVoiceCorrections(value) {
  let text = normalizeVoicePhrase(value).toLowerCase().replace(/ё/g, "\u0435").replace(/[«»]/g, '"');
  const quoted = [];
  text = text.replace(/"[^"]*"/gu, (part) => {
    quoted.push(part);
    return `__voicequote_${quoted.length - 1}__`;
  });
  const restore = (value2) => value2.replace(/__voicequote_(\d+)__/gu, (_, index) => quoted[Number(index)]);
  let correction = /^(?:нет|no|nu)(?=[,\s]|$)/u.test(text);
  text = text.replace(/(^|\s)не забудь(?:те)?\s+(?:записать|добавить)/g, "$1\u0437\u0430\u043F\u0438\u0448\u0438");
  const replacement = (_, prefix) => {
    correction = true;
    return prefix;
  };
  text = text.replace(/(^|\s)не\s+(.+?)\s*[,;]?\s+(?:а|но)\s+/g, replacement).replace(/(^|\s)not\s+(.+?)\s*[,;]?\s+but\s+/g, replacement).replace(/(^|\s)nu\s+(.+?)\s*[,;]?\s+ci\s+/g, replacement);
  const pair = text.match(/^вместо\s+(.+?)\s*(?:[—–]|,|\s+(?:запиши|поставь|укажи|сделай)\s+)\s*(.+)$/u) || text.match(/^исправь\s+(?:сумму\s+)?с\s+(.+?)\s+на\s+(.+)$/u);
  if (pair && parseSpokenAmount(pair[1]) !== null && parseSpokenAmount(pair[2]) !== null) {
    text = pair[2];
    correction = true;
  }
  const reverse = text.match(/^(.+?)\s+(?:вместо|а не)\s+(.+)$/u);
  if (reverse && parseSpokenAmount(reverse[1]) !== null && parseSpokenAmount(reverse[2]) !== null) {
    text = reverse[1];
    correction = true;
  }
  const clarification = text.match(/^(?:(?:нет|no|nu)[,\s]+)?(?:точнее|вернее|ой|поправка|я ошибся|я ошиблась|имел в виду|имела в виду|я имел в виду|я имела в виду|должно быть|actually|i meant|de fapt)[,:\s]+(.+)$/u);
  if (clarification) {
    const slots = parseNaturalVoiceEntry(restore(clarification[1]), { draft: {} });
    if (slots && !slots.invalid && !slots.ambiguous.length) {
      text = clarification[1];
      correction = true;
    }
  }
  const negated = /(^|\s)(?:не|not|n-am)(?=\s|$)/.test(text) || /(^|\s)nu\s+(?![,\s]*\d)/.test(text);
  return { text: restore(text).replace(/\s+/g, " ").trim(), negated, correction };
}
var purchase = /^(?:купил[аи]?|покупка|bought|cumparat|cumpărat)$/u;
var transfer = /^(?:перевел[аи]?|перевод|отдал[аи]?|одолжил[аи]?|transferred|transfer)$/u;
var request = /^(?:запиши|записать|добавь|добавить|внеси|занеси|учти|сохрани|исправь|измени|поменяй|замени|record|add|save|note|change|correct|adauga|adaugă|inregistreaza|înregistrează|noteaza|notează|schimba|schimbă)$/u;
var filler = new Set("\u044F \u043C\u044B \u043C\u043D\u0435 \u044D\u0442\u043E \u0431\u044B\u043B\u043E \u0431\u044B\u043B \u0431\u044B\u043B\u0430 \u0431\u044B\u043B\u0438 \u043D\u0443 \u0432\u043E\u0442 \u043F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430 \u0434\u0430\u0432\u0430\u0439 \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0437\u0430 \u0432 \u043D\u0430 \u043F\u043E \u0441\u0443\u043C\u043C\u0430 \u0441\u0443\u043C\u043C\u0443 \u0441\u0443\u043C\u043C\u043E\u0439 \u0432\u0441\u0435\u0433\u043E \u0438\u0442\u043E\u0433\u043E \u043E\u043A\u043E\u043B\u043E \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0437\u0430\u043F\u0438\u0441\u044C \u0437\u0430\u043F\u0438\u0448\u0435\u043C \u0434\u0435\u043D\u044C\u0433\u0438 \u0434\u0435\u043D\u0435\u0433 \u0432\u044B\u0448\u043B\u043E \u0441\u043E\u0441\u0442\u0430\u0432\u0438\u043B \u0441\u043E\u0441\u0442\u0430\u0432\u0438\u043B\u0430 the i we it a an am was were is amount total for to in of please on pe pentru \xEEn din de o un".split(" "));
var categoryMarkers = /* @__PURE__ */ new Set(["\u043D\u0430", "\u0437\u0430", "\u0434\u043B\u044F", "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", "\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E", "\u0440\u0430\u0437\u0434\u0435\u043B", "category", "on", "for", "pe", "pentru", "categoria"]);
var aliases = { \u0435\u0434\u0430: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u044B", \u0435\u0434\u0443: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u044B", \u0435\u0434\u043E\u0439: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u044B", food: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u044B", groceries: "\u041F\u0440\u043E\u0434\u0443\u043A\u0442\u044B", \u043A\u043E\u0444\u0435: "\u041A\u0430\u0444\u0435", coffee: "\u041A\u0430\u0444\u0435", cafea: "\u041A\u0430\u0444\u0435", \u0431\u0435\u043D\u0437\u0438\u043D: "\u0422\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442", fuel: "\u0422\u0440\u0430\u043D\u0441\u043F\u043E\u0440\u0442" };
var tokensOf = (text) => Array.from(text.matchAll(/\d+(?:[.,]\d+)?|[\p{L}]+|[₽€$¥]|[-−]/gu), (match) => ({ value: match[0], start: match.index, end: match.index + match[0].length, used: false }));
function naturalAmount(value) {
  const direct = parseSpokenAmount(value);
  if (direct !== null) return direct;
  let text = value.trim();
  const tail = text.split(/\s+/).at(-1);
  if (voiceCurrencyFor(tail)) text = text.slice(0, text.length - tail.length).trim();
  const shortThousands = text.match(/^(.+?\s+|\d+(?:[.,]\d{1,2})?)(?:к|k|ка)$/u);
  if (shortThousands && !/[кk]$|\sка$/.test(shortThousands[1])) {
    const base2 = naturalAmount(shortThousands[1]);
    return base2 !== null && Number(base2) * 1e3 < 1e12 ? String(Math.round(Number(base2) * 1e5) / 100) : null;
  }
  const halves = { \u043F\u043E\u043B\u0441\u043E\u0442\u043D\u0438: 50, \u043F\u043E\u043B\u0442\u044B\u0441\u044F\u0447\u0438: 500, \u043F\u043E\u043B\u043C\u0438\u043B\u043B\u0438\u043E\u043D\u0430: 5e5, \u043F\u043E\u043B\u0442\u043E\u0440\u0430: 1.5, \u043F\u043E\u043B\u0442\u043E\u0440\u044B: 1.5 };
  if (halves[text]) return String(halves[text]);
  const fraction = text.match(/^(полтора|полторы|.+? с половиной)(?:\s+(сотни|сотня|сотен|тысяча|тысячи|тысяч|миллион|миллиона|миллионов))?$/);
  if (!fraction) return null;
  const base = halves[fraction[1]] ?? (() => {
    const amount = parseSpokenAmount(fraction[1].replace(/ с половиной$/, ""));
    return amount !== null && Number.isInteger(Number(amount)) ? Number(amount) + 0.5 : null;
  })();
  const scale = fraction[2] ? /сот/.test(fraction[2]) ? 100 : /тысяч/.test(fraction[2]) ? 1e3 : 1e6 : 1;
  return base !== null && base * scale < 1e12 ? String(base * scale) : null;
}
function parseNaturalVoiceEntry(value, { draft = null, categories = [], newEntry = false, includeInvalidSlots = false } = {}) {
  const text = normalizeVoicePhrase(value).toLowerCase().replace(/ё/g, "\u0435").trim();
  if (!text || /[\u3400-\u9fff]/u.test(text)) return null;
  if (/(^|\s)(?:сколько|покажи|открой|удали|удалить|баланс|остаток|how|delete|open|cât|cat|deschide)(?=\s|$)/u.test(text)) return null;
  const tokens = tokensOf(text);
  if (tokens.length > 80 || text.length > 600) return { invalid: true };
  if (!tokens.length) return null;
  const patch = {}, ambiguous = /* @__PURE__ */ new Set(), provided = /* @__PURE__ */ new Set(), categoryHits = [];
  const mark = (start, end) => {
    for (let i = start; i < end; i++) tokens[i].used = true;
  };
  const signs = /* @__PURE__ */ new Set();
  let hasRequest = false, hasPurchase = false, hasTransfer = false;
  for (const match of text.matchAll(/(?:^|\s)(?:на|за|для|категория|категорию|раздел|on|for|pe|pentru|categoria)\s+[«"]([^»"]{1,60})[»"]/gu)) {
    const start = match.index + match[0].search(/[«"]/u) + 1, end = start + match[1].length;
    categoryHits.push(match[1]);
    for (const token of tokens) if (token.start >= start && token.end <= end) token.used = true;
  }
  const known = categories.flatMap((item) => [item.value, item.label].filter(Boolean).map((label) => ({ value: item.value, label, type: item.type, size: tokensOf(label).length })));
  for (let start = 0; start < tokens.length; start++) {
    if (tokens[start].used) continue;
    for (let end = Math.min(tokens.length, start + 12); end > start; end--) {
      const name = text.slice(tokens[start].start, tokens[end - 1].end);
      if (/^(?:к|k|ка)$/.test(name) && start > 0 && naturalAmount(tokens[start - 1].value) !== null) continue;
      const matches = [...new Set(known.filter((item) => item.size === end - start && categoryMatches(item.label, name)).map((item) => item.value))];
      const alias = aliases[normalizeVoiceCategory(name)];
      if (!matches.length && alias && categories.some((item) => item.value === alias)) matches.push(alias);
      if (matches.length) {
        if (matches.length > 1) ambiguous.add("category");
        categoryHits.push(...matches);
        mark(start, end);
        start = end - 1;
        break;
      }
    }
  }
  const destinations = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].used) continue;
    const word = tokens[i].value;
    if (/^(?:кошелек|wallet|portofel|календарь|calendar|оба|both|ambele)$/.test(word)) {
      const explicit = draft || i > 0 && /^(?:в|to|in|în)$/.test(tokens[i - 1].value) || tokens.length === 1 || tokens.some((token) => request.test(token.value));
      if (explicit) {
        destinations.push(/оба|both|ambele/.test(word) ? "both" : /кошелек|wallet|portofel/.test(word) ? "wallet" : "main");
        tokens[i].used = true;
      }
    }
  }
  if (destinations.length) {
    const unique = [...new Set(destinations)];
    patch.destination = unique.includes("both") ? "both" : unique.length === 1 ? unique[0] : /\s(?:и|and|și|si)\s/.test(text) ? "both" : null;
    if (!patch.destination) ambiguous.add("destination");
    provided.add("destination");
  }
  if (patch.destination === "both") {
    for (const token of tokens) if (/^(?:и|and|și|si)$/.test(token.value)) token.used = true;
  }
  for (const token of tokens) {
    if (token.used) continue;
    if (isVoiceExpense(token.value)) {
      signs.add("minus");
      token.used = true;
    } else if (isVoiceIncome(token.value)) {
      signs.add("plus");
      token.used = true;
    } else if (purchase.test(token.value)) {
      hasPurchase = true;
      signs.add("minus");
      token.used = true;
    } else if (transfer.test(token.value)) {
      hasTransfer = true;
      token.used = true;
    } else if (request.test(token.value)) {
      hasRequest = true;
      token.used = true;
    }
  }
  if (signs.size) {
    provided.add("sign");
    if (signs.size === 1) patch.sign = [...signs][0];
    else ambiguous.add("sign");
  }
  if (hasTransfer && !signs.size) ambiguous.add("sign");
  const currencyHits = [];
  for (const token of tokens) {
    if (token.used) continue;
    const found = voiceCurrencyFor(token.value);
    if (found) currencyHits.push(found);
  }
  if (currencyHits.length) {
    provided.add("currency");
    const unique = [...new Set(currencyHits)];
    if (unique.length === 1) patch.currency = unique[0];
    else ambiguous.add("currency");
  }
  const amounts = [];
  for (let start = 0; start < tokens.length; start++) {
    if (tokens[start].used || naturalAmount(tokens[start].value) === null || voiceCurrencyFor(tokens[start].value)) continue;
    if (["o", "un"].includes(tokens[start].value) && tokens[start + 1]?.used) {
      tokens[start].used = true;
      continue;
    }
    let found = null;
    for (let end = start + 1; end <= Math.min(tokens.length, start + 18); end++) {
      if (tokens[end - 1].used) break;
      const amount = naturalAmount(text.slice(tokens[start].start, tokens[end - 1].end));
      if (amount !== null) found = { start, end, amount };
    }
    if (found) {
      amounts.push(found);
      mark(found.start, found.end);
      start = found.end - 1;
    }
  }
  if (amounts.length) {
    provided.add("amount");
    if (amounts.length === 1 && Number(amounts[0].amount) > 0) patch.amount = amounts[0].amount;
    else ambiguous.add("amount");
  }
  for (const token of tokens) if (voiceCurrencyFor(token.value)) token.used = true;
  let spendingCategory = false;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].used || !categoryMarkers.has(tokens[i].value)) continue;
    const marker = tokens[i].value;
    tokens[i].used = true;
    if (marker === "\u0437\u0430" && hasPurchase) continue;
    if (["\u043D\u0430", "\u0437\u0430", "\u0434\u043B\u044F", "on", "for", "pe", "pentru"].includes(marker)) spendingCategory = true;
    if (i + 1 >= tokens.length || tokens[i + 1].used) continue;
    let end = i + 1;
    while (end < tokens.length && !tokens[end].used && !["\u043D\u0430", "\u0437\u0430", "\u0434\u043B\u044F", "on", "pe", "for", "pentru"].includes(tokens[end].value) && !request.test(tokens[end].value) && !["\u0438", "and", "\u0219i", "si"].includes(tokens[end].value)) end++;
    const words2 = tokens.slice(i + 1, end);
    while (words2.length && filler.has(words2.at(-1).value)) words2.pop();
    if (words2.length) {
      const name = text.slice(words2[0].start, words2.at(-1).end).trim();
      if (name.length > 60) return { invalid: true };
      categoryHits.push(name);
      mark(i + 1, i + 1 + words2.length);
    }
  }
  if (categoryHits.length) {
    provided.add("category");
    const unique = [...new Set(categoryHits.map((name) => known.find((item) => categoryMatches(item.label, name))?.value || name))];
    if (unique.length === 1) patch.category = unique[0];
    else ambiguous.add("category");
  }
  if (!draft?.sign && !signs.size && !hasTransfer && spendingCategory && patch.category) {
    patch.sign = "minus";
    provided.add("sign");
  }
  for (const token of tokens) if (filler.has(token.value) || request.test(token.value) || /^(?:нет|no|nu|да|yes|da|это|is|este|составило)$/.test(token.value)) token.used = true;
  const leftover = tokens.filter((token) => !token.used);
  if (ambiguous.size) {
    for (const token of leftover) if (/^(?:и|and|și|si)$/.test(token.value)) token.used = true;
  }
  const shorthand = (!draft || newEntry) && !hasRequest && !hasPurchase && !hasTransfer && !signs.size && amounts.length > 0;
  if (shorthand && leftover.length && !patch.category && !ambiguous.has("category") && leftover.every((token) => /^[\p{L}]+$/u.test(token.value) && !["\u0438", "and", "\u0219i", "si"].includes(token.value)) && !/^(?:что|когда|как|где|почему|зачем|какой|какие)\s/u.test(text)) {
    const name = leftover.map((token) => token.value).join(" ");
    if (name.length > 60) return { invalid: true };
    patch.category = aliases[normalizeVoiceCategory(name)] || name;
    provided.add("category");
    for (const token of leftover) token.used = true;
  }
  if (shorthand && patch.category && !draft?.sign && !patch.sign) {
    const name = normalizeVoiceCategory(patch.category), types = [...new Set(known.filter((item) => categoryMatches(item.value, patch.category)).map((item) => item.type).filter(Boolean))];
    const commonExpense = /^(?:такси|taxi|кофе|coffee|кафе|продукты|еда|еду|бензин|транспорт|жилье|покупки|подписки|здоровье|образование|путешествия|развлечения|сигареты)$/u;
    const commonIncome = /^(?:зарплата|salary|salariu|возврат)$/u;
    const sign = types.length === 1 ? types[0] : commonExpense.test(name) ? "minus" : commonIncome.test(name) ? "plus" : null;
    if (sign) {
      patch.sign = sign;
      provided.add("sign");
    }
  }
  const recognized = provided.size > 0 || signs.size > 0 || hasRequest || hasTransfer;
  if (!recognized) return null;
  if (hasPurchase && leftover.length) {
    const item = leftover.map((token) => token.value).join(" ");
    if (item.length > 60) return { invalid: true };
    patch.item = item;
    for (const token of leftover) token.used = true;
  }
  if (leftover.some((token) => !token.used && /^(?:и|and|și|si|-|−)$/.test(token.value)) && amounts.length <= 1) return { invalid: true };
  if (leftover.some((token) => !token.used) && !hasTransfer) return includeInvalidSlots ? { invalid: true, patch, provided: [...provided], ambiguous: [...ambiguous], unparsed: leftover.filter((token) => !token.used).map((token) => token.value).join(" "), amountRanges: amounts.map(({ start, end, amount }) => ({ start: tokens[start].start, end: tokens[end - 1].end, amount })) } : { invalid: true };
  if (!draft && !hasRequest && !signs.size && !hasTransfer && !patch.category && !patch.currency) return null;
  for (const field of ambiguous) delete patch[field];
  return { patch, provided: [...provided], ambiguous: [...ambiguous], shorthand, amountRanges: amounts.map(({ start, end, amount }) => ({ start: tokens[start].start, end: tokens[end - 1].end, amount })) };
}

// src/shared/lib/voiceEntryReview.js
function localDateKey(date = /* @__PURE__ */ new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function validDate(key) {
  const [year, month, day] = key.split("-").map(Number), date = new Date(year, month - 1, day);
  return year >= 1900 && year <= 9999 && localDateKey(date) === key;
}
var monthNames = "\u044F\u043D\u0432\u0430\u0440[\u044C\u044F]|\u0444\u0435\u0432\u0440\u0430\u043B[\u044C\u044F]|\u043C\u0430\u0440\u0442\u0430?|\u0430\u043F\u0440\u0435\u043B[\u044C\u044F]|\u043C\u0430[\u0439\u044F]|\u0438\u044E\u043D[\u044C\u044F]|\u0438\u044E\u043B[\u044C\u044F]|\u0430\u0432\u0433\u0443\u0441\u0442\u0430?|\u0441\u0435\u043D\u0442\u044F\u0431\u0440[\u044C\u044F]|\u043E\u043A\u0442\u044F\u0431\u0440[\u044C\u044F]|\u043D\u043E\u044F\u0431\u0440[\u044C\u044F]|\u0434\u0435\u043A\u0430\u0431\u0440[\u044C\u044F]|january|february|march|april|may|june|july|august|september|october|november|december|ianuarie|februarie|martie|aprilie|mai|iunie|iulie|septembrie|octombrie|noiembrie|decembrie";
var ordinals = { \u043F\u0435\u0440\u0432\u043E\u0433\u043E: "\u043E\u0434\u0438\u043D", \u0432\u0442\u043E\u0440\u043E\u0433\u043E: "\u0434\u0432\u0430", \u0442\u0440\u0435\u0442\u044C\u0435\u0433\u043E: "\u0442\u0440\u0438", \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0433\u043E: "\u0447\u0435\u0442\u044B\u0440\u0435", \u043F\u044F\u0442\u043E\u0433\u043E: "\u043F\u044F\u0442\u044C", \u0448\u0435\u0441\u0442\u043E\u0433\u043E: "\u0448\u0435\u0441\u0442\u044C", \u0441\u0435\u0434\u044C\u043C\u043E\u0433\u043E: "\u0441\u0435\u043C\u044C", \u0432\u043E\u0441\u044C\u043C\u043E\u0433\u043E: "\u0432\u043E\u0441\u0435\u043C\u044C", \u0434\u0435\u0432\u044F\u0442\u043E\u0433\u043E: "\u0434\u0435\u0432\u044F\u0442\u044C", \u0434\u0435\u0441\u044F\u0442\u043E\u0433\u043E: "\u0434\u0435\u0441\u044F\u0442\u044C", \u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u0442\u0440\u0438\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0442\u0440\u0438\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u0447\u0435\u0442\u044B\u0440\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0447\u0435\u0442\u044B\u0440\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u043F\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u043F\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u0448\u0435\u0441\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0448\u0435\u0441\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u0432\u043E\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0432\u043E\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u0434\u0435\u0432\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0434\u0435\u0432\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C", \u0434\u0432\u0430\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C", \u0442\u0440\u0438\u0434\u0446\u0430\u0442\u043E\u0433\u043E: "\u0442\u0440\u0438\u0434\u0446\u0430\u0442\u044C" };
function extractEntryDate(phrase, today = localDateKey()) {
  let text = String(phrase).toLowerCase().replace(/ё/g, "\u0435").trim(), dateKey = null;
  const matches = [];
  text = text.replace(/(^|\s)(\d{1,3}|один|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:день|дня|дней|days?)\s+(?:назад|ago)(?=$|[\s,.!?])/g, (_, prefix, value) => {
    const offset = Number(parseSpokenAmount(value)), [year, month, day] = today.split("-").map(Number);
    matches.push(offset >= 1 && offset <= 366 ? localDateKey(new Date(year, month - 1, day - offset)) : "invalid");
    return prefix;
  });
  text = text.replace(/今天|昨天|前天|明天/g, (word) => {
    const offset = { \u4ECA\u5929: 0, \u6628\u5929: -1, \u524D\u5929: -2, \u660E\u5929: 1 }[word];
    const [year, month, day] = today.split("-").map(Number);
    matches.push(localDateKey(new Date(year, month - 1, day + offset)));
    return "";
  });
  text = text.replace(/[零〇一二两三四五六七八九十百千\d]+年[零〇一二两三四五六七八九十\d]+月[零〇一二两三四五六七八九十\d]+[日号]/g, (value) => {
    matches.push(chineseDate(value) || "invalid");
    return "";
  });
  text = text.replace(/(^|\s)(сегодня|вчера|позавчера|завтра|today|yesterday|tomorrow|astăzi|astazi|ieri|alaltăieri|alaltaieri|mâine|maine)(?=$|[\s,.!?])/g, (_, prefix, word) => {
    const offset = /позавчера|alalt/.test(word) ? -2 : /вчера|yesterday|^ieri$/.test(word) ? -1 : /завтра|tomorrow|mâine|maine/.test(word) ? 1 : 0;
    const [year, month, day] = today.split("-").map(Number);
    matches.push(localDateKey(new Date(year, month - 1, day + offset)));
    return prefix;
  });
  text = text.replace(/(^|\s)(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})(?=$|[\s,!?])/g, (_, prefix, value) => {
    const key = value.includes(".") ? value.split(".").reverse().map((part, index) => index ? part.padStart(2, "0") : part).join("-") : value;
    matches.push(validDate(key) ? key : "invalid");
    return prefix;
  });
  const dayPattern = `(?:\\d{1,2}|(?:(?:\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C|\u0442\u0440\u0438\u0434\u0446\u0430\u0442\u044C) )?(?:${Object.keys(ordinals).join("|")}))`;
  text = text.replace(new RegExp(`(^|\\s)(${dayPattern}\\s+(?:${monthNames})(?:\\s+\\d{4})?)(?=$|[\\s,.!?])`, "g"), (_, prefix, value) => {
    const cardinal = value.split(" ").map((word) => ordinals[word] || word).join(" ");
    const command = parseCalendarVoiceCommand(`\u043E\u0442\u043A\u0440\u043E\u0439 ${cardinal}${/\d{4}$/.test(value) ? "" : ` ${today.slice(0, 4)}`}`);
    matches.push(command?.dateKey || "invalid");
    return prefix;
  });
  if (matches.length) dateKey = matches[0];
  return { text: text.replace(/\s+/g, " ").replace(/[, ]+$/, "").trim(), dateKey, invalid: matches.includes("invalid") || new Set(matches).size > 1 };
}
var copy = {
  zh: { date: "\u8BF7\u9009\u62E9\u4ECA\u5929\u6216\u8FC7\u53BB\u7684\u65E5\u671F\u3002", future: "\u65E0\u6CD5\u4FDD\u5B58\u672A\u6765\u65E5\u671F\u7684\u8BB0\u5F55\uFF0C\u8BF7\u9009\u62E9\u8FC7\u53BB\u65E5\u671F\u3002", correction: "\u8BF7\u8BF4\u51FA\u4FEE\u6539\u5185\u5BB9\uFF0C\u4F8B\u5982\u201C\u4E0D\uFF0C350\u201D\u201C\u6536\u5165\u201D\u6216\u201C\u7528\u4E8E\u98DF\u54C1\u201D\u3002", wallet: "\u94B1\u5305\u9700\u8981 PRO\uFF0C\u8BF7\u9009\u62E9\u65E5\u5386\u3002" },
  ru: { date: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0434\u0430\u0442\u0443 \u0437\u0430\u043F\u0438\u0441\u0438 \u2014 \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0438\u043B\u0438 \u043F\u0440\u043E\u0448\u0435\u0434\u0448\u0438\u0439 \u0434\u0435\u043D\u044C.", future: "\u0411\u0443\u0434\u0443\u0449\u0443\u044E \u0437\u0430\u043F\u0438\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F. \u041D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u043F\u0440\u043E\u0448\u0435\u0434\u0448\u0443\u044E \u0434\u0430\u0442\u0443.", correction: "\u0421\u043A\u0430\u0436\u0438\u0442\u0435, \u0447\u0442\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C: \xAB\u043D\u0435\u0442, 350\xBB, \xAB\u044D\u0442\u043E \u0434\u043E\u0445\u043E\u0434\xBB \u0438\u043B\u0438 \xAB\u043D\u0430 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u044B\xBB.", wallet: "\u041A\u043E\u0448\u0435\u043B\u0451\u043A \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0441 PRO. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C." },
  en: { date: "Choose today or a past date.", future: "Future entries cannot be saved. Choose a past date.", correction: "Say what to change: \u201Cno, 350\u201D, \u201Cincome\u201D or \u201Con groceries\u201D.", wallet: "Wallet requires PRO. Choose Calendar." },
  ro: { date: "Alege ast\u0103zi sau o dat\u0103 din trecut.", future: "Nu po\u021Bi salva \xEEn viitor. Alege o dat\u0103 din trecut.", correction: "Spune ce modific\u0103m: \u201Enu, 350\u201D, \u201Evenit\u201D sau \u201Epe produse\u201D.", wallet: "Portofelul necesit\u0103 PRO. Alege calendarul." }
};
var ambiguityPrompts = { ru: { sign: "\u041D\u0435\u044F\u0441\u043D\u043E: \u044D\u0442\u043E \u0440\u0430\u0441\u0445\u043E\u0434 \u0438\u043B\u0438 \u0434\u043E\u0445\u043E\u0434?", amount: "\u0412 \u0444\u0440\u0430\u0437\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0443\u043C\u043C. \u041A\u0430\u043A\u0443\u044E \u043E\u0434\u043D\u0443 \u0441\u0443\u043C\u043C\u0443 \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C?", currency: "\u0412 \u0444\u0440\u0430\u0437\u0435 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u043B\u044E\u0442. \u041A\u0430\u043A\u0443\u044E \u0432\u0430\u043B\u044E\u0442\u0443 \u0432\u044B\u0431\u0440\u0430\u0442\u044C?", category: "\u041D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u043E\u0434\u043D\u0443 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438.", destination: "\u041A\u0443\u0434\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C: \u0432 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C, \u043A\u043E\u0448\u0435\u043B\u0451\u043A \u0438\u043B\u0438 \u0432 \u043E\u0431\u0430?" }, en: { sign: "Is this an expense or income?", amount: "Several amounts heard. Which single amount should I record?", currency: "Several currencies heard. Which currency should I use?", category: "Choose one category for this entry.", destination: "Save to calendar, wallet or both?" }, ro: { sign: "Este cheltuial\u0103 sau venit?", amount: "Am auzit mai multe sume. Ce sum\u0103 s\u0103 \xEEnregistrez?", currency: "Am auzit mai multe monede. Ce moned\u0103 s\u0103 folosesc?", category: "Alege o categorie pentru aceast\u0103 \xEEnregistrare.", destination: "\xCEn calendar, portofel sau ambele?" } };
function voiceEntryReview(phrase, draft = null, locale = "ru", categories = [], options = {}) {
  const today = options.todayKey || localDateKey(), labels = copy[locale] || copy.ru;
  const corrected = resolveVoiceCorrections(phrase);
  if (draft && ["question", "financial-search", "voice-help"].includes(parseCalendarVoiceCommand(corrected.text)?.type)) return null;
  if (/^(取消|停止|不用了|отмена|отмени|не надо|cancel|stop|anuleaza|anulează)$/i.test(corrected.text)) return draft ? { cancelled: true } : null;
  if (corrected.negated) return { invalid: true };
  if (!draft) {
    const existing = parseCalendarVoiceCommand(corrected.text);
    if (existing && existing.type !== "entry") return null;
  }
  const date = extractEntryDate(corrected.text, today);
  let raw = date.text.replace(/[.!?]$/, "").trim(), destination = null;
  if (locale === "zh") {
    const chineseRoute = raw.match(/(?:保存到|添加到|记到|到)(日历和钱包|钱包和日历|日历|钱包)$/);
    if (chineseRoute) {
      destination = /和/.test(chineseRoute[1]) ? "both" : chineseRoute[1] === "\u94B1\u5305" ? "wallet" : "main";
      raw = raw.slice(0, chineseRoute.index).trim();
    }
  }
  const route = locale === "zh" && raw.match(/(?:^|[, ]+)(?:(?:запиши|записать|добавь|сохрани|save|record|înregistrează|inregistreaza|salvează|salveaza)\s+(?:это\s+|it\s+)?)?(?:в |to |in |în )?(календарь и (?:в )?кошелек|кошелек и (?:в )?календарь|calendar and wallet|calendar și portofel|calendar si portofel|оба|both|ambele|кошелек|wallet|portofel|календарь|calendar)$/i);
  if (route && !/(?:^|\s)(?:не|not|nu)\s*$/.test(raw.slice(0, route.index))) {
    destination = /оба|both|ambele| и | and | și | si /.test(route[1]) ? "both" : /кошелек|wallet|portofel/.test(route[1]) ? "wallet" : "main";
    raw = raw.slice(0, route.index).trim();
  }
  const next = draft ? { ...draft } : null;
  const dateError = date.invalid || date.dateKey > today || !date.dateKey && next?.dateKey > today;
  if (next && date.dateKey && !dateError) {
    next.dateKey = date.dateKey;
    delete next.datePending;
  }
  const category = next && raw.match(/^(?:категория|в категорию|на|category|on|categoria|pe)\s+(.+)$/i);
  let result;
  const categoryCommand = next?.item && parseCalendarVoiceCommand(raw)?.type === "category";
  let natural = locale === "zh" || categoryCommand ? null : parseNaturalVoiceEntry(raw, { draft: next, categories, newEntry: options.newEntry });
  if (next?.pendingFields?.includes("category") && (!natural || natural.invalid) && !parseCalendarVoiceCommand(raw) && /^[\p{L}][\p{L}\s'-]{0,59}$/u.test(raw) && !/(?:^|\s)(?:что|почему|сколько|когда|как|открой|покажи|вернись|сохрани|what|why|how|when|show|open|save|ce|cât|cat|cum|deschide|salvează|salveaza)(?:\s|$)/iu.test(raw)) natural = parseNaturalVoiceEntry(`${locale === "en" ? "on" : locale === "ro" ? "pe" : "\u043D\u0430"} ${raw}`, { draft: next, categories });
  if (natural?.invalid) return { invalid: true };
  if (natural) {
    const prepared = { ...next, ...natural.patch };
    if (natural.shorthand && !prepared.currency && ["RUB", "EUR", "MDL", "USD", "CNY"].includes(options.defaultCurrency)) prepared.currency = options.defaultCurrency;
    if (natural.patch.category) prepared.categoryConfirmed = true;
    for (const field of natural.ambiguous) prepared[field] = void 0;
    if (natural.ambiguous.length) {
      const field = ["sign", "amount", "currency", "category", "destination"].find((value) => natural.ambiguous.includes(value));
      prepared.pendingFields = [.../* @__PURE__ */ new Set([...next?.pendingFields || [], ...natural.ambiguous])];
      result = { draft: prepared, field, prompt: ambiguityPrompts[locale]?.[field] || ambiguityPrompts.ru[field] };
    } else {
      prepared.pendingFields = (prepared.pendingFields || []).filter((field) => !natural.provided.includes(field));
      const dialog = voiceEntryDialog("", prepared, locale, categories, { ...options, askDestination: false });
      result = dialog ? { ...dialog, context: prepared } : null;
    }
  } else if (category && category[1].length <= 60) {
    next.category = category[1];
    next.categoryConfirmed = true;
    result = voiceEntryDialog("", next, locale, categories, { ...options, askDestination: false });
  } else if (next && !raw && next.sign && next.amount && next.currency && (!next.item || next.categoryConfirmed)) result = { command: { ...next, type: "entry" } };
  else result = voiceEntryDialog(raw, next, locale, categories, { ...options, askDestination: false });
  if (!result) return null;
  if (result.cancelled) return result;
  const entry = { ...next, ...result.context, ...result.draft || result.command, dateKey: !dateError && date.dateKey || next?.dateKey || today };
  if (destination) entry.destination = destination;
  if (result.command?.type !== "entry" && !result.draft) return null;
  if (dateError) return { draft: { ...entry, datePending: true }, field: "date", prompt: date.invalid ? labels.date : labels.future };
  if (entry.datePending) return { draft: entry, field: "date", prompt: labels.date };
  if (!entry.sign || !entry.amount || !entry.currency) return result.draft ? { ...result, draft: entry } : null;
  if (entry.destination && entry.destination !== "main" && !options.walletAvailable) return { draft: entry, field: "destination", prompt: labels.wallet };
  const pending = (entry.pendingFields || []).filter((field) => !entry[field]);
  if (pending.length && !result.field) {
    const field = pending[0];
    return { draft: entry, field, prompt: ambiguityPrompts[locale]?.[field] || ambiguityPrompts.ru[field] };
  }
  const chosen = categories.find((item) => [item.value, item.label].some((name) => normalizeVoiceCategory(name) === normalizeVoiceCategory(entry.category)));
  if (chosen) entry.category = chosen.value;
  if (!entry.pendingFields?.includes("destination")) entry.destination = entry.destination || "main";
  if (result.field) return { ...result, draft: entry };
  if (next && !natural && !date.dateKey && !category && !destination && ["amount", "currency", "sign", "category", "destination"].every((key) => (next[key] || "main") === (entry[key] || "main")) && !/^(?:это )?(?:支出|收入|расход|доход|expense|income|cheltuiala|cheltuială|venit)$|^(?:是|对|好的|да|yes|da)$/i.test(raw)) return { invalid: true };
  if (options.requireCategory && !entry.category && !entry.mutation) {
    return { draft: { ...entry, pendingFields: [.../* @__PURE__ */ new Set([...entry.pendingFields || [], "category"])] }, field: "category", prompt: { ru: entry.sign === "minus" ? "\u041D\u0430 \u0447\u0442\u043E \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u043B\u0438? \u041D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E." : "\u041E\u0442\u043A\u0443\u0434\u0430 \u0434\u043E\u0445\u043E\u0434? \u041D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E.", en: entry.sign === "minus" ? "What did you spend it on? Name a category." : "Where did the income come from? Name a category.", ro: entry.sign === "minus" ? "Pe ce ai cheltuit? Spune categoria." : "De unde este venitul? Spune categoria.", zh: entry.sign === "minus" ? "\u82B1\u5728\u4EC0\u4E48\u4E0A\uFF1F\u8BF7\u8BF4\u51FA\u7C7B\u522B\u3002" : "\u6536\u5165\u6765\u81EA\u54EA\u91CC\uFF1F\u8BF7\u8BF4\u51FA\u7C7B\u522B\u3002" }[locale] };
  }
  return { entry: { type: "entry", kind: "record", amount: entry.amount, currency: entry.currency, sign: entry.sign, dateKey: entry.dateKey, destination: entry.destination, ...entry.category ? { category: entry.category } : {} } };
}
function shortEntryAnswer(entry, locale = "ru") {
  const kind = entry.sign === "minus";
  return locale === "zh" ? `\u5DF2\u8BB0\u5F55${kind ? "\u652F\u51FA" : "\u6536\u5165"} ${entry.amount} ${entry.currency}\u3002` : locale === "en" ? `Recorded ${kind ? "expense" : "income"} ${entry.amount} ${entry.currency}.` : locale === "ro" ? `Am \xEEnregistrat ${kind ? "cheltuiala" : "venitul"} ${entry.amount} ${entry.currency}.` : `\u0417\u0430\u043F\u0438\u0441\u0430\u043B ${kind ? "\u0440\u0430\u0441\u0445\u043E\u0434" : "\u0434\u043E\u0445\u043E\u0434"} ${entry.amount} ${entry.currency}.`;
}

// src/shared/lib/voiceEntryBatch.js
var trimConnector = (text) => text.replace(/(?:[,;]|\s(?:и|and|și|si))\s*$/u, "").trim();
var prefixes = { ru: (index, count, common) => common ? "\u0414\u043B\u044F \u0432\u0441\u0435\u0445 \u0437\u0430\u043F\u0438\u0441\u0435\u0439. " : `\u0417\u0430\u043F\u0438\u0441\u044C ${index + 1} \u0438\u0437 ${count}. `, en: (index, count, common) => common ? "For all entries. " : `Entry ${index + 1} of ${count}. `, ro: (index, count, common) => common ? "Pentru toate \xEEnregistr\u0103rile. " : `\xCEnregistrarea ${index + 1} din ${count}. `, zh: (index, count, common) => common ? "\u6240\u6709\u8BB0\u5F55\uFF1A" : `\u7B2C${index + 1}\u6761\uFF0C\u5171${count}\u6761\u3002` };
function resultFor(batch, locale) {
  const pending = batch.states.findIndex((state2) => state2.draft);
  const activeIndex = pending >= 0 ? pending : Math.min(batch.activeIndex || 0, batch.states.length - 1);
  const next = { ...batch, activeIndex }, state = batch.states[activeIndex];
  if (state.draft) return { ...state, batch: next, prompt: (prefixes[locale] || prefixes.ru)(activeIndex, batch.states.length, batch.commonFields.includes(state.field)) + state.prompt };
  return { batch: next, entry: state.entry };
}
function naturalPart(text, categories, today) {
  return parseNaturalVoiceEntry(extractEntryDate(text, today).text, { categories, includeInvalidSlots: true });
}
var unclearCategory = (state) => state?.invalid && state.patch?.amount && state.patch.sign && !state.patch.category && !state.ambiguous?.length && /^[\p{L}]{2,30}(?: [\p{L}]{2,30}){0,2}$/u.test(state.unparsed || "") && !/(?:^|\s)(?:не|нет|удали|открой|покажи|not|delete|open|show)(?:\s|$)/u.test(state.unparsed);
function meaningful(parts, categories, today) {
  const parsed = parts.map((part) => naturalPart(part, categories, today));
  if (parts.length >= 2 && parsed.filter(unclearCategory).length === 1 && parsed.filter((state) => state && !state.invalid && !state.ambiguous.length && state.patch.amount && (state.patch.category || state.patch.item)).length === parts.length - 1) return true;
  if (parts.length < 2 || parsed.some((state) => !state || state.invalid || state.ambiguous.length || !state.patch.amount || !(state.patch.category || state.patch.item || state.patch.sign))) return false;
  const explicit = parts.map((part) => part.split(/\s+/).some((word) => naturalPart(word, categories, today)?.patch?.sign));
  return parsed.filter((state) => state.patch.category || state.patch.item).length >= 2 || explicit.every(Boolean) || new Set(parsed.map((state) => state.patch.sign).filter(Boolean)).size > 1;
}
function partsFor(text, categories, today) {
  const dates = extractEntryDate(text, today);
  if (!dates.invalid) {
    const parsed = parseNaturalVoiceEntry(dates.text, { categories, includeInvalidSlots: true }), ranges = parsed?.amountRanges;
    if (ranges?.length >= 2) {
      const parts2 = ranges.map((range, index) => trimConnector(dates.text.slice(index ? range.start : 0, ranges[index + 1]?.start || dates.text.length)));
      if (meaningful(parts2, categories, today)) return { parts: parts2, sharedDate: dates.dateKey };
    }
  }
  const parts = text.split(/;\s*|,\s+|\s+(?:и|and|și|si)\s+/u).map((part) => part.trim()).filter(Boolean);
  return meaningful(parts, categories, today) ? { parts, sharedDate: !dates.invalid ? dates.dateKey : null } : null;
}
var targetNumbers = { \u043F\u0435\u0440\u0432\u043E\u0439: 1, \u043F\u0435\u0440\u0432\u0430\u044F: 1, \u0432\u0442\u043E\u0440\u043E\u0439: 2, \u0432\u0442\u043E\u0440\u0430\u044F: 2, \u0442\u0440\u0435\u0442\u044C\u0435\u0439: 3, \u0442\u0440\u0435\u0442\u044C\u044F: 3, \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u043E\u0439: 4, \u0447\u0435\u0442\u0432\u0435\u0440\u0442\u0430\u044F: 4, \u043F\u044F\u0442\u043E\u0439: 5, \u043F\u044F\u0442\u0430\u044F: 5, \u0448\u0435\u0441\u0442\u043E\u0439: 6, \u0448\u0435\u0441\u0442\u0430\u044F: 6, \u0441\u0435\u0434\u044C\u043C\u043E\u0439: 7, \u0441\u0435\u0434\u044C\u043C\u0430\u044F: 7, \u0432\u043E\u0441\u044C\u043C\u043E\u0439: 8, \u0432\u043E\u0441\u044C\u043C\u0430\u044F: 8, \u0434\u0435\u0432\u044F\u0442\u043E\u0439: 9, \u0434\u0435\u0432\u044F\u0442\u0430\u044F: 9, \u0434\u0435\u0441\u044F\u0442\u043E\u0439: 10, \u0434\u0435\u0441\u044F\u0442\u0430\u044F: 10, first: 1, second: 2, third: 3 };
function voiceEntryBatch(phrase, batch = null, locale = "ru", categories = [], options = {}) {
  const corrected = resolveVoiceCorrections(phrase), text = corrected.text;
  if (batch) {
    if (/^(?:отмена|отмени|не надо|cancel|stop|anulează|anuleaza|取消)$/.test(text)) return { cancelled: true };
    if (corrected.negated) return { invalid: true };
    const target = text.match(/^(?:(?:в|во|in)\s+)?(\d+|первой|первая|второй|вторая|третьей|третья|четвертой|четвертая|пятой|пятая|шестой|шестая|седьмой|седьмая|восьмой|восьмая|девятой|девятая|десятой|десятая|first|second|third)\s+(?:записи|запись|entry)\s*(.*)$/);
    const index = target ? (targetNumbers[target[1]] || Number(target[1])) - 1 : batch.activeIndex;
    if (index < 0 || index >= batch.states.length) return { invalid: true };
    const old = batch.states[index], state = voiceEntryReview(target ? target[2] : text, old.draft || old.entry, locale, categories, options);
    if (!state || state.invalid) return { invalid: true };
    if (state.cancelled) return state;
    const states2 = batch.states.slice();
    states2[index] = state;
    const field = old.field, value = (state.entry || state.draft)?.[field === "date" ? "dateKey" : field];
    if (batch.commonFields.includes(field) && value && state.field !== field) {
      const reply = field === "destination" ? { main: "calendar", wallet: "wallet", both: "both" }[value] : String(value);
      for (let i = 0; i < states2.length; i++) if (i !== index && states2[i].field === field) {
        const updated = voiceEntryReview(reply, states2[i].draft, locale, categories, options);
        if (updated && !updated.invalid) states2[i] = updated;
      }
    }
    return resultFor({ ...batch, states: states2, activeIndex: index, commonFields: batch.commonFields.filter((name) => states2.some((state2) => state2.field === name)) }, locale);
  }
  if (corrected.negated || text.length > 1500) return null;
  const split = partsFor(text, categories, options.todayKey);
  if (!split) return null;
  if (split.parts.length > 10) return { invalid: true };
  const parsed = split.parts.map((part) => naturalPart(part, categories, options.todayKey));
  const shared = {};
  for (const field of ["sign", "currency", "destination"]) {
    const values = [...new Set(parsed.map((state) => state.patch[field]).filter(Boolean))];
    if (values.length === 1) shared[field] = values[0];
  }
  if (split.sharedDate) shared.dateKey = split.sharedDate;
  const states = split.parts.map((part, index) => {
    const parsedPart = parsed[index];
    if (unclearCategory(parsedPart)) {
      const pending = voiceEntryReview("", { ...shared, ...parsedPart.patch, pendingFields: ["category"] }, locale, categories, { ...options, requireCategory: true });
      if (pending?.draft && locale === "ru") pending.prompt = `\u041D\u0435 \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u043B \xAB${parsedPart.unparsed}\xBB. \u041D\u0430 \u0447\u0442\u043E \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u043B\u0438 ${parsedPart.patch.amount}${pending.draft.currency ? " " + pending.draft.currency : ""}?`;
      return pending;
    }
    return voiceEntryReview(part, shared, locale, categories, options);
  });
  if (states.some((state) => !state || state.invalid || state.cancelled)) return null;
  const commonFields = ["currency", "date", "destination"].filter((field) => states.every((state) => state.field === field));
  return resultFor({ states, activeIndex: 0, commonFields }, locale);
}

// src/shared/lib/voiceAutoSave.js
var signature = (entry) => JSON.stringify(["amount", "currency", "sign", "category", "dateKey", "destination"].map((key) => entry[key]));
function canAutoSaveVoiceEntry(phrase, dialog, locale, categories = [], options = {}, evidence = null) {
  const entry = dialog?.entry;
  if (!evidence?.isFinal || evidence.usedAlternative || !entry || dialog.batch || entry.mutation || !entry.category || entry.kind !== "record") return false;
  if (evidence.confidence > 0 && evidence.confidence < 0.6) return false;
  const corrected = resolveVoiceCorrections(phrase), date = extractEntryDate(corrected.text, options.todayKey);
  if (corrected.negated || corrected.correction || date.invalid) return false;
  if (locale === "zh") {
    const command = parseCalendarVoiceCommand(phrase);
    if (command?.type !== "entry" || !command.category || !command.currency || !command.amount) return false;
  } else {
    const natural = parseNaturalVoiceEntry(date.text, { categories });
    if (!natural || natural.invalid || natural.ambiguous.length || natural.shorthand || !["sign", "amount", "currency", "category"].every((field) => natural.provided.includes(field))) return false;
  }
  for (const alternative of evidence.alternatives || []) {
    const parsed = voiceEntryReview(alternative, null, locale, categories, { ...options, requireCategory: true });
    if (parsed?.entry && signature(parsed.entry) !== signature(entry)) return false;
    if (parsed?.draft && (parsed.draft.datePending || ["amount", "currency", "sign", "category"].some((field) => parsed.draft[field] && parsed.draft[field] !== entry[field]))) return false;
  }
  return true;
}

// src/shared/lib/spokenText.js
function spokenText(value, locale = "ru") {
  const currency = {
    zh: { USD: "\u7F8E\u5143", EUR: "\u6B27\u5143", MDL: "\u5217\u4F0A", RUB: "\u5362\u5E03", CNY: "\u4EBA\u6C11\u5E01" },
    ru: { USD: "\u0434\u043E\u043B\u043B\u0430\u0440\u043E\u0432", EUR: "\u0435\u0432\u0440\u043E", MDL: "\u043B\u0435\u0435\u0432", RUB: "\u0440\u0443\u0431\u043B\u0435\u0439", CNY: "\u044E\u0430\u043D\u0435\u0439" },
    en: { USD: "dollars", EUR: "euros", MDL: "lei", RUB: "rubles", CNY: "yuan" },
    ro: { USD: "dolari", EUR: "euro", MDL: "lei", RUB: "ruble", CNY: "yuani" }
  }[locale];
  return String(value).replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\[nrt]/g, " ").replace(/[\\/⁄∕／]+/g, ", ").replace(/\b(?:USD|EUR|MDL|RUB|CNY)\b/g, (code) => (currency || {})[code] || code).replace(/[*_`#]/g, "").replace(/(?:\s*,\s*){2,}/g, ", ").replace(/\s+/g, " ").replace(/\s+,/g, ",").replace(/^\s*,\s*|\s*,\s*$/g, "").trim();
}

// src/shared/lib/widgetVoiceConversation.js
var copy2 = {
  ru: { ready: "\u0421\u043A\u0430\u0436\u0438\u0442\u0435 \u0440\u0430\u0441\u0445\u043E\u0434 \u0438\u043B\u0438 \u0434\u043E\u0445\u043E\u0434. \u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u043F\u043E\u0442\u0440\u0430\u0442\u0438\u043B 50 \u043B\u0435\u0439 \u043D\u0430 \u0441\u043E\u043A.", invalid: "\u041D\u0435 \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u043B \u0444\u0440\u0430\u0437\u0443. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0438\u043B\u0438 \u0441\u043A\u0430\u0436\u0438\u0442\u0435 \xAB\u043E\u0442\u043C\u0435\u043D\u0430\xBB.", confirm: "\u0421\u043A\u0430\u0436\u0438\u0442\u0435 \xAB\u0441\u043E\u0445\u0440\u0430\u043D\u0438\xBB, \u043D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u0438\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u0441\u043A\u0430\u0436\u0438\u0442\u0435 \xAB\u043E\u0442\u043C\u0435\u043D\u0430\xBB.", cancelled: "\u041E\u0442\u043C\u0435\u043D\u0438\u043B. \u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E.", empty: "\u041F\u043E\u043A\u0430 \u043D\u0435\u0447\u0435\u0433\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u044C. \u041D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u0440\u0430\u0441\u0445\u043E\u0434 \u0438\u043B\u0438 \u0434\u043E\u0445\u043E\u0434.", help: "\u0417\u0430\u043F\u0438\u0441\u044B\u0432\u0430\u044E \u0434\u043E\u0445\u043E\u0434\u044B \u0438 \u0440\u0430\u0441\u0445\u043E\u0434\u044B \u0432 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C. \u041C\u043E\u0436\u043D\u043E \u043D\u0430\u0437\u0432\u0430\u0442\u044C \u0441\u0443\u043C\u043C\u0443, \u0432\u0430\u043B\u044E\u0442\u0443, \u043F\u043E\u043A\u0443\u043F\u043A\u0443 \u0438 \u0434\u0430\u0442\u0443 \u0432 \u043B\u044E\u0431\u043E\u043C \u043F\u043E\u0440\u044F\u0434\u043A\u0435. \u0415\u0441\u043B\u0438 \u0434\u0430\u043D\u043D\u044B\u0445 \u043D\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442, \u0443\u0442\u043E\u0447\u043D\u044E. \u041D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u043A\u0443\u043F\u043E\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u044E \u0432\u043C\u0435\u0441\u0442\u0435. \u041C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u0443\u043C\u043C\u0443 \u0438\u043B\u0438 \u0441\u043A\u0430\u0437\u0430\u0442\u044C \xAB\u043E\u0442\u043C\u0435\u043D\u0430\xBB.", saved: "\u0417\u0430\u043F\u0438\u0441\u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B." },
  en: { ready: "Say an expense or income. For example: spent 50 dollars on juice.", invalid: "I could not understand. Repeat or say cancel.", confirm: "Say save, a correction, or cancel.", cancelled: "Cancelled. Nothing was recorded.", empty: "Nothing to save yet. Say an expense or income.", help: "I record expenses and income in the calendar. Say the amount, currency, category and date in any order. I ask for missing details. You can correct amounts, record several purchases, or cancel.", saved: "Entries added." },
  ro: { ready: "Spune o cheltuial\u0103 sau un venit. De exemplu: am cheltuit 50 de lei pe suc.", invalid: "Nu am \xEEn\u021Beles. Repet\u0103 sau spune anuleaz\u0103.", confirm: "Spune salveaz\u0103, o corectare sau anuleaz\u0103.", cancelled: "Anulat. Nu am \xEEnregistrat nimic.", empty: "Nimic de salvat \xEEnc\u0103. Spune o cheltuial\u0103 sau un venit.", help: "\xCEnregistrez cheltuieli \u0219i venituri \xEEn calendar. Spune suma, moneda, categoria \u0219i data \xEEn orice ordine. \xCEntreb ce lipse\u0219te. Po\u021Bi corecta sume, \xEEnregistra mai multe cump\u0103r\u0103turi sau anula.", saved: "\xCEnregistr\u0103ri ad\u0103ugate." },
  zh: { ready: "\u8BF7\u8BF4\u51FA\u652F\u51FA\u6216\u6536\u5165\uFF0C\u4F8B\u5982\uFF1A\u4ECA\u5929\u82B1\u4E8650\u5143\u4E70\u679C\u6C41\u3002", invalid: "\u6CA1\u542C\u6E05\uFF0C\u8BF7\u91CD\u590D\u6216\u8BF4\u53D6\u6D88\u3002", confirm: "\u8BF7\u8BF4\u4FDD\u5B58\u3001\u4FEE\u6539\u5185\u5BB9\u6216\u53D6\u6D88\u3002", cancelled: "\u5DF2\u53D6\u6D88\uFF0C\u6CA1\u6709\u4FDD\u5B58\u8BB0\u5F55\u3002", empty: "\u8FD8\u6CA1\u6709\u8BB0\u5F55\uFF0C\u8BF7\u8BF4\u51FA\u652F\u51FA\u6216\u6536\u5165\u3002", help: "\u6211\u80FD\u5728\u65E5\u5386\u4E2D\u8BB0\u5F55\u652F\u51FA\u548C\u6536\u5165\uFF0C\u53EF\u4EE5\u8BF4\u91D1\u989D\u3001\u5E01\u79CD\u3001\u7C7B\u522B\u548C\u65E5\u671F\u3002\u4FE1\u606F\u4E0D\u5B8C\u6574\u65F6\u6211\u4F1A\u8BE2\u95EE\u3002\u4E5F\u53EF\u4EE5\u4FEE\u6539\u3001\u6DFB\u52A0\u591A\u7B14\u6216\u53D6\u6D88\u3002", saved: "\u8BB0\u5F55\u5DF2\u6DFB\u52A0\u3002" }
};
function widgetLocale(language) {
  const locale = String(language).toLowerCase().split(/[-_]/u)[0];
  return ["zh", "en", "ro"].includes(locale) ? locale : "ru";
}
function widgetSettings(value = {}) {
  const locale = widgetLocale(value.locale);
  const currency = ["MDL", "USD", "EUR", "RUB", "CNY"].includes(value.currency) ? value.currency : "MDL";
  const categories = Array.isArray(value.categories) ? value.categories.slice(0, 200).flatMap((item) => {
    if (!item || typeof item.value !== "string" || !item.value.trim() || item.value.length > 60) return [];
    return [{ value: item.value.trim(), label: typeof item.label === "string" ? item.label.slice(0, 80) : item.value, type: ["plus", "minus"].includes(item.type) ? item.type : void 0 }];
  }) : [];
  return { locale, currency, categories };
}
function checkedEntries(entries, todayKey) {
  if (!Array.isArray(entries) || !entries.length || entries.length > 10) return [];
  return entries.map((entry) => {
    if (!entry || !Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0 || Number(entry.amount) >= 1e12 || !["plus", "minus"].includes(entry.sign) || !["MDL", "USD", "EUR", "RUB", "CNY"].includes(entry.currency) || entry.destination !== "main" || !entry.category?.trim() || entry.category.length > 60 || !/^\d{4}-\d{2}-\d{2}$/.test(entry.dateKey) || entry.dateKey > todayKey) throw new Error("INVALID_ENTRY");
    return { amount: String(entry.amount), sign: entry.sign, currency: entry.currency, category: entry.category.trim(), dateKey: entry.dateKey, destination: "main" };
  });
}
function recordedAnswer(entry, locale) {
  const answer = shortEntryAnswer(entry, locale).replace(/[.。]$/u, "");
  return locale === "ru" ? `${answer}: ${entry.category}.` : locale === "zh" ? `${answer}\uFF0C${entry.category}\u3002` : `${answer}: ${entry.category}.`;
}
function widgetVoiceTurn({ phrase, context = null, settings = {}, todayKey, confidence = 0, alternatives = [], now = Date.now() }) {
  const prefs = widgetSettings(settings), { locale, categories } = prefs, labels = copy2[locale];
  if (typeof phrase !== "string" || !phrase.trim() || phrase.length > 1500) throw new Error("INVALID_PHRASE");
  const text = normalizeVoicePhrase(phrase).toLowerCase();
  const old = context && Number.isFinite(context.updatedAt) && now - context.updatedAt < 10 * 60 * 1e3 && now >= context.updatedAt ? context : null;
  const result = (status, reply, next = old, entries2 = []) => ({ status, reply, context: next ? { ...next, updatedAt: now } : null, entries: entries2 });
  if (/^(отмена|отмени|не надо|cancel|stop|anuleaza|anulează|取消)$/u.test(text)) return result("cancelled", labels.cancelled, null);
  if (isVoiceHelpRequest(text)) return result("clarify", labels.help, old);
  const save = /^(сохрани|сохранить|готово|запиши|save|done|salveaza|salvează|gata|保存|完成)$/u.test(text);
  if (save) {
    const entries2 = checkedEntries(old?.entries || [], todayKey);
    if (entries2.length) return result("saved", entries2.length === 1 ? recordedAnswer(entries2[0], locale) : labels.saved, null, entries2);
    return result("clarify", old?.prompt || labels.empty, old);
  }
  const options = { todayKey, defaultCurrency: prefs.currency, requireCategory: true, askDestination: false, walletAvailable: false };
  const batch = voiceEntryBatch(phrase, old?.batch || null, locale, categories, options);
  const parsed = batch || voiceEntryReview(phrase, old?.draft || old?.entries?.[0] || null, locale, categories, options);
  if (!parsed || parsed.invalid) return result("clarify", old?.prompt ? `${labels.invalid} ${old.prompt}` : labels.invalid);
  if (parsed.cancelled) return result("cancelled", labels.cancelled, null);
  if (parsed.draft) return result("clarify", parsed.prompt, { draft: parsed.draft, batch: parsed.batch || null, prompt: parsed.prompt });
  const entries = checkedEntries(parsed.batch ? parsed.batch.states.map((state) => state.entry) : [parsed.entry], todayKey);
  if (!entries.length) return result("clarify", labels.invalid);
  const safe = !old && canAutoSaveVoiceEntry(phrase, parsed, locale, categories, options, { isFinal: true, confidence, alternatives });
  const corrected = resolveVoiceCorrections(phrase).correction || /^(нет|no|nu|не |точнее|вернее|ой|исправь|измени|not |actually|de fapt)/u.test(text);
  const categoryAnswer = old?.draft?.pendingFields?.includes("category");
  const explicitCategory = !categoryAnswer || /^(?:на|за|для|on|for|pe|pentru|用于|类别)(?:\s|[\u3400-\u9fff])/u.test(text) || !text.includes(" ") || categories.some((item) => categoryMatches(item.value, text) || categoryMatches(item.label, text));
  const signature2 = (entry) => JSON.stringify(["amount", "currency", "sign", "category", "dateKey", "destination"].map((key) => entry[key]));
  const alternativesAgree = alternatives.every((alternative) => {
    const candidate = voiceEntryBatch(alternative, old?.batch || null, locale, categories, options) || voiceEntryReview(alternative, old?.draft || null, locale, categories, options);
    if (candidate?.cancelled || candidate?.batch) return false;
    if (candidate?.entry) return signature2(candidate.entry) === signature2(entries[0]);
    return !candidate?.draft || !candidate.draft.datePending && !["amount", "currency", "sign", "category"].some((field) => candidate.draft[field] && candidate.draft[field] !== entries[0][field]);
  });
  if (safe || old?.draft && !parsed.batch && !corrected && explicitCategory && alternativesAgree && !(confidence > 0 && confidence < 0.6)) return result("saved", recordedAnswer(entries[0], locale), null, entries);
  const review = entries.map((entry) => `${entry.category}: ${entry.sign === "minus" ? "\u2212" : "+"}${entry.amount} ${entry.currency}`).join("; ");
  const prompt = `${review}. ${labels.confirm}`;
  return result("clarify", prompt, { entries, batch: parsed.batch || null, prompt });
}
export {
  widgetLocale,
  widgetSettings,
  spokenText as widgetSpokenReply,
  widgetVoiceTurn
};
