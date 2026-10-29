// Product types are a presentation/classification layer, not calendar categories.
// Many aliases and brands can map to one stable type; unknown products stay intact.
export const normalizeProductText = value => String(value || '').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
export const productLocale = language => String(language).startsWith('zh') ? 3 : ['ro','md'].includes(language) ? 2 : language === 'en' ? 1 : 0;
const wordText = value => normalizeProductText(value).replace(/[^\p{L}\p{N}*]+/gu,' ').trim();
const define = (id,symbol,category,labels,aliases) => {
  const words=[...new Set([...labels,...aliases.split('|')].map(normalizeProductText))];
  const matchers=words.filter(Boolean).map(word=>({needle:wordText(word),parts:wordText(word).split(' '),stem:word.includes('*'),han:/\p{Script=Han}/u.test(word)}));
  return {id,symbol,category,labels,aliases:words,matchers};
};
export const RECEIPT_PRODUCT_TYPES = [
  define('beer','🍺','Продукты',['Пиво','Beer','Bere','啤酒'],'bere blonda|lager|пив*'),
  define('wine','🍷','Продукты',['Вино','Wine','Vin','葡萄酒'],'vin rosu|vin alb|вино|шампанск*|prosecco|champagne'),
  define('spirits','🥃','Продукты',['Крепкий алкоголь','Spirits','Băuturi spirtoase','烈酒'],'vodka|whisky|whiskey|cognac|brandy|водк*|коньяк|виски'),
  define('bread','🍞','Продукты',['Хлеб','Bread','Pâine','面包'],'paine|piine|батон*|хлеб*|bagheta|baguette'),
  define('pastry','🥐','Продукты',['Выпечка','Pastry','Patiserie','糕点'],'croissant*|chifla|placint*|булоч*|круассан*|пирож*|covrig*'),
  define('anchovies','🐟','Продукты',['Анчоусы','Anchovies','Anșoa','凤尾鱼'],'ansoa|anchov*|анчоус*'),
  define('dried_fish','🐟','Продукты',['Вяленая вобла','Dried roach','Voblă uscată','风干鱼'],'vobla|вобл*|таран*|рыба вяленая|peste uscat'),
  define('fish','🐟','Продукты',['Рыба','Fish','Pește','鱼'],'peste|somon|salmon|ton|tuna|скумбр*|лосось|тунец|селед*|hering'),
  define('seafood','🦐','Продукты',['Морепродукты','Seafood','Fructe de mare','海鲜'],'crevet*|shrimp*|prawn*|кревет*|кальмар*|squid|midii|mussel*'),
  define('peanuts','🥜','Продукты',['Арахис','Peanuts','Arahide','花生'],'арахис*|arahide|peanut*'),
  define('nuts','🌰','Продукты',['Орехи','Nuts','Nuci','坚果'],'nuci|migdale|caju|fistic|almond*|cashew*|walnut*|pistachio*|орех*|миндаль|фисташ*|кешью'),
  define('nut_spread','🥜','Продукты',['Ореховая паста','Nut spread','Pastă de nuci','坚果酱'],'peanut butter|unt de arahide|арахисовая паста|nutella'),
  define('milk','🥛','Продукты',['Молоко','Milk','Lapte','牛奶'],'молок*|lapte|milk'),
  define('yogurt','🥛','Продукты',['Йогурт','Yogurt','Iaurt','酸奶'],'iaurt|yoghurt|кефир*|kefir|йогурт*'),
  define('cheese','🧀','Продукты',['Сыр','Cheese','Brânză','奶酪'],'branza|cascaval|сыр*|творог|cottage cheese|mozzarella|parmesan'),
  define('butter','🧈','Продукты',['Сливочное масло','Butter','Unt','黄油'],'unt|butter|масло сливоч*'),
  define('cream','🥛','Продукты',['Сметана и сливки','Cream','Smântână și frișcă','奶油'],'smantana|frisca|sour cream|сметан*|сливки'),
  define('eggs','🥚','Продукты',['Яйца','Eggs','Ouă','鸡蛋'],'oua|egg|яйц*'),
  define('chicken','🍗','Продукты',['Курица','Chicken','Pui','鸡肉'],'pui|chicken|куриц*|курин*|pulpe|piept de pui|鸡胸'),
  define('meat','🥩','Продукты',['Мясо','Meat','Carne','肉'],'carne|porc|vita|beef|pork|свинин*|говядин*|мяс*'),
  define('sausage','🌭','Продукты',['Колбаса и сосиски','Sausages','Mezeluri','香肠'],'salam*|carnat*|crenvur*|sausage*|колбас*|сосиск*|ветчин*|ham'),
  define('coffee','☕','Продукты',['Кофе','Coffee','Cafea','咖啡'],'cafea|кофе|espresso|cappuccino|nescafe|latte|americano|macchiato|flat white|caffe mocha|kopi'),
  define('tea','🍵','Продукты',['Чай','Tea','Ceai','茶'],'ceai|tea|чай|lipton'),
  define('water','💧','Продукты',['Вода','Water','Apă','饮用水'],'apa|вода|mineral water'),
  define('juice','🧃','Продукты',['Сок','Juice','Suc','果汁'],'suc|juice|сок|nectar|нектар'),
  define('soft_drinks','🥤','Продукты',['Газировка','Soft drinks','Băuturi răcoritoare','汽水'],'cola|coca cola|pepsi|fanta|sprite|limonada|лимонад|газиров*'),
  define('energy_drink','🥤','Продукты',['Энергетик','Energy drink','Băutură energizantă','能量饮料'],'red bull|monster energy|energizant*|энергетик*'),
  define('rice','🍚','Продукты',['Рис','Rice','Orez','大米'],'orez|рис'),
  define('pasta','🍝','Продукты',['Макароны','Pasta','Paste făinoase','意大利面'],'paste|spaghetti|macar*|макарон*|спагетти'),
  define('grains','🌾','Продукты',['Крупы и хлопья','Grains and cereal','Crupe și cereale','谷物'],'hrisca|ovaz|fulgi|cereal*|oat*|buckwheat|греч*|овсян*|хлопья|круп*'),
  define('flour','🌾','Продукты',['Мука','Flour','Făină','面粉'],'faina|мука'),
  define('sugar','🍬','Продукты',['Сахар','Sugar','Zahăr','白糖'],'zahar|сахар'),
  define('salt_spices','🧂','Продукты',['Соль и специи','Salt and spices','Sare și condimente','调味料'],'sare|condiment*|spices|соль|специ*|перец молот*'),
  define('cooking_oil','🫒','Продукты',['Растительное масло','Cooking oil','Ulei','食用油'],'ulei|sunflower oil|olive oil|масло подсолнеч*|масло оливк*'),
  define('sauces','🥫','Продукты',['Соусы','Sauces','Sosuri','酱料'],'sos|sosuri|ketchup|maioneza|mustar|кетчуп|майонез|горчиц*|соус*'),
  define('canned_food','🥫','Продукты',['Консервы','Canned food','Conserve','罐头'],'conserv*|canned|консерв*|тушенк*'),
  define('potatoes','🥔','Продукты',['Картофель','Potatoes','Cartofi','土豆'],'cartof*|potato*|картоф*|картош*'),
  define('tomatoes','🍅','Продукты',['Помидоры','Tomatoes','Roșii','番茄'],'rosii|tomato*|помидор*|томат*'),
  define('cucumbers','🥒','Продукты',['Огурцы','Cucumbers','Castraveți','黄瓜'],'castrav*|cucumber*|огур*'),
  define('onions','🧅','Продукты',['Лук','Onions','Ceapă','洋葱'],'ceapa|onion*|лук'),
  define('carrots','🥕','Продукты',['Морковь','Carrots','Morcovi','胡萝卜'],'morcov*|carrot*|морков*'),
  define('vegetables','🥬','Продукты',['Овощи','Vegetables','Legume','蔬菜'],'legume|vegetable*|овощ*|varza|cabbage|капуст*|salata verde|salad leaves|usturoi|garlic|чеснок'),
  define('apples','🍎','Продукты',['Яблоки','Apples','Mere','苹果'],'mere|mere rosii|mere verzi|apple*|яблок*'),
  define('bananas','🍌','Продукты',['Бананы','Bananas','Banane','香蕉'],'banan*|банан*'),
  define('citrus','🍊','Продукты',['Цитрусовые','Citrus fruit','Citrice','柑橘'],'portocal*|mandarin*|lamaie|lemon*|orange*|апельсин*|мандарин*|лимон*'),
  define('berries','🍓','Продукты',['Ягоды','Berries','Fructe de pădure','浆果'],'capsun*|zmeura|afine|strawberr*|blueberr*|raspberr*|клубник*|малин*|черник*'),
  define('fruit','🍇','Продукты',['Фрукты','Fruit','Fructe','水果'],'fructe|fruit|фрукт*|struguri|grape*|виноград|pere|pear*|груш*|piersic*|peach*|персик*'),
  define('chocolate','🍫','Продукты',['Шоколад','Chocolate','Ciocolată','巧克力'],'ciocolat*|шоколад*|snickers|mars bar|milka|kinder'),
  define('sweets','🍬','Продукты',['Конфеты','Sweets','Bomboane','糖果'],'bomboan*|candy|sweets|конфет*|карамель|marmelad*'),
  define('biscuits','🍪','Продукты',['Печенье','Biscuits','Biscuiți','饼干'],'biscuit*|cookie*|печень*|вафл*|napolitane|wafer*'),
  define('ice_cream','🍦','Продукты',['Мороженое','Ice cream','Înghețată','冰淇淋'],'inghetat*|ice cream|морожен*'),
  define('snacks','🍿','Продукты',['Снеки','Snacks','Gustări','零食'],'snack*|chips*|crisps|popcorn|чипс*|сухарик*|попкорн'),
  define('frozen_food','🧊','Продукты',['Замороженные продукты','Frozen food','Produse congelate','冷冻食品'],'congelat*|frozen|пельмен*|вареник*|заморож*'),
  define('baby_food','🍼','Продукты',['Детское питание','Baby food','Hrană pentru copii','婴儿食品'],'baby food|lapte praf|formula de lapte|детская смесь|детское пюре'),
  define('pet_food','🐾','Покупки',['Корм для животных','Pet food','Hrană pentru animale','宠物食品'],'hrana pisici|hrana caini|cat food|dog food|корм*|whiskas|pedigree|purina'),
  define('shampoo','🧴','Покупки',['Шампунь','Shampoo','Șampon','洗发水'],'sampon|шампун*'),
  define('soap','🧼','Покупки',['Мыло и гель для душа','Soap and shower gel','Săpun și gel de duș','香皂和沐浴露'],'sapun|soap|gel de dus|shower gel|мыло|гель для душа'),
  define('toothpaste','🪥','Покупки',['Уход за зубами','Dental care','Îngrijire dentară','口腔护理'],'pasta de dinti|periuta|toothpaste|toothbrush|зубная паста|зубная щетка|colgate'),
  define('skincare','🧴','Покупки',['Уход за кожей','Skin care','Îngrijirea pielii','护肤品'],'crema de fata|apa micelara|face cream|skin care|крем для лица|мицелляр*|лосьон*'),
  define('cosmetics','💄','Покупки',['Косметика','Cosmetics','Cosmetice','化妆品'],'cosmetic*|ruj|mascara|lipstick|makeup|помад*|тушь|косметик*'),
  define('deodorant','🧴','Покупки',['Дезодорант','Deodorant','Deodorant','除臭剂'],'deodorant|antiperspirant|дезодорант*'),
  define('hygiene','🧻','Покупки',['Средства гигиены','Hygiene products','Produse de igienă','卫生用品'],'hartie igienica|servetele|toilet paper|tissue*|прокладк*|салфетк*|туалетная бумага|tampoane'),
  define('diapers','👶','Покупки',['Подгузники','Diapers','Scutece','纸尿裤'],'scutec*|diaper*|nappies|подгузник*|pampers|huggies'),
  define('laundry','🧺','Покупки',['Средства для стирки','Laundry detergent','Detergent de rufe','洗衣用品'],'detergent rufe|praf de spalat|laundry|washing powder|ariel|persil|стиральный порошок|гель для стирки'),
  define('cleaning','🧽','Покупки',['Бытовая химия','Cleaning supplies','Produse de curățenie','清洁用品'],'detergent|curatenie|dishwash*|cleaner|fairy|domestos|чистящее|моющее|губк*'),
  define('clothes','👕','Покупки',['Одежда','Clothing','Haine','衣服'],'haine|clothes|clothing|одежд*|tricou|shirt*|футболк*|camasa|рубашк*'),
  define('trousers','👖','Покупки',['Брюки и джинсы','Trousers and jeans','Pantaloni','裤子'],'pantalon*|trouser*|jeans|брюк*|джинс*'),
  define('shoes','👟','Покупки',['Обувь','Shoes','Încălțăminte','鞋'],'incaltaminte|pantofi|shoe*|sneaker*|обувь|кроссовк*|ботинк*'),
  define('bags','👜','Покупки',['Сумки и рюкзаки','Bags and backpacks','Genți și rucsacuri','包'],'geanta|rucsac|backpack*|handbag*|сумк*|рюкзак*'),
  define('electronics','🔌','Покупки',['Электроника','Electronics','Electronice','电子产品'],'electronic*|электроник*|incarcator|charger|cable|кабель|зарядное|adapter|адаптер'),
  define('phone','📱','Покупки',['Телефон и аксессуары','Phone and accessories','Telefon și accesorii','手机及配件'],'telefon mobil|smartphone|iphone|samsung galaxy|смартфон*|чехол|husa telefon'),
  define('computer','💻','Покупки',['Компьютер и аксессуары','Computer and accessories','Calculator și accesorii','电脑及配件'],'laptop|notebook|keyboard|mouse|monitor|клавиатур*|ноутбук*|монитор*|мышь'),
  define('headphones','🎧','Покупки',['Наушники','Headphones','Căști','耳机'],'casti|headphone*|earphone*|earbud*|airpods|наушник*'),
  define('batteries','🔋','Покупки',['Батарейки','Batteries','Baterii','电池'],'baterii|battery|batteries|батарей*|duracell|energizer'),
  define('homeware','🏠','Жильё',['Товары для дома','Homeware','Articole pentru casă','家居用品'],'homeware|vesela|tigaie|cratita|plate|pan|посуда|тарелк*|сковород*|кастрюл*'),
  define('tools','🔧','Жильё',['Инструменты и ремонт','Tools and repairs','Unelte și reparații','工具和维修'],'unelte|surub*|hammer|screw*|инструмент*|отвертк*|молоток|гвозд*|vopsea|краска'),
  define('flowers','💐','Подарки',['Цветы','Flowers','Flori','鲜花'],'flori|flower*|buchet|bouquet|цветы|букет*|розы|trandafir*'),
  define('toys','🧸','Покупки',['Игрушки','Toys','Jucării','玩具'],'jucari*|toy|toys|игрушк*|lego|puzzle'),
  define('books','📚','Образование',['Книги','Books','Cărți','书籍'],'carte|carti|book|books|книг*|учебник*'),
  define('stationery','✏️','Образование',['Канцелярия','Stationery','Rechizite','文具'],'caiet|pix|creion|stationery|notepad|ручк*|тетрад*|карандаш*'),
  define('medicine','💊','Здоровье',['Лекарства','Medicine','Medicamente','药品'],'medicament*|лекарств*|paracetamol|ibuprofen|парацетамол|ибупрофен|таблетк*'),
  define('vitamins','💊','Здоровье',['Витамины','Vitamins','Vitamine','维生素'],'vitamin*|витамин*|magnesium|магний|omega 3'),
  define('medical_supplies','🩹','Здоровье',['Медицинские товары','Medical supplies','Articole medicale','医疗用品'],'bandaj|plasture|bandage|термометр*|пластырь|бинт|antiseptic|антисептик'),
  define('fuel','⛽','Транспорт',['Топливо','Fuel','Combustibil','燃油'],'benzina|motorina|diesel|petrol|бензин*|дизель|gpl|汽油'),
  define('car_supplies','🚗','Транспорт',['Товары для авто','Car supplies','Articole auto','汽车用品'],'ulei motor|motor oil|antigel|шины|масло мотор*|антифриз|car wash|spalatorie auto|автомойка'),
  define('transport','🚌','Транспорт',['Проезд и такси','Transport and taxi','Transport și taxi','交通和出租车'],'taxi|bolt|uber|bus ticket|bilet transport|проезд|такси|парковк*|parking'),
  define('tobacco','🚬','Сигареты',['Табак и сигареты','Tobacco','Tutun și țigări','烟草'],'tigari|tutun|cigarette*|tobacco|сигарет*|табак|marlboro|winston'),
  define('soup','🥣','Кафе',['Суп','Soup','Supă','汤'],'soup|chicken soup|tomato soup|mushroom soup|суп|куриный суп|супа|supa|ciorba|sop|sup'),
  define('salad','🥗','Кафе',['Салат','Salad','Salată','沙拉'],'salad|caesar salad|салат|salata|цезарь'),
  define('sushi','🍣','Кафе',['Суши и роллы','Sushi','Sushi și rulouri','寿司'],'sushi|sashimi|maki roll|суши|роллы|寿司'),
  define('sandwich','🥪','Кафе',['Сэндвич','Sandwich','Sandviș','三明治'],'sandwich|sandvis|сэндвич|сендвич|панини|panini|三明治'),
  define('dessert','🍰','Кафе',['Десерт','Dessert','Desert','甜点'],'dessert|cheesecake|tiramisu|десерт|чизкейк|тирамису|desert|甜点'),
  define('dining','🍽️','Кафе',['Еда в кафе','Dining','Mâncare la cafenea','餐饮'],'restaurant meal|meniu|business lunch|бизнес ланч|обед комплексный|breakfast|lunch|dinner|set meal|combo meal|готовое блюдо|завтрак|обед|ужин|mic dejun|pranz|cina'),
  define('pizza','🍕','Продукты',['Пицца','Pizza','Pizza','披萨'],'pizza|пицц*'),
  define('burger','🍔','Кафе',['Бургер','Burger','Burger','汉堡'],'burger|бургер*|hamburger'),
  define('subscription','🔁','Подписки',['Подписка','Subscription','Abonament','订阅'],'abonament|subscription|подписк*|netflix|spotify|youtube premium'),
  define('other_food','🛒','Продукты',['Другие продукты','Other groceries','Alte alimente','其他食品'],'alimente|groceries|продукты питания'),
  define('other_purchase','🛍️','Покупки',['Другие покупки','Other purchases','Alte cumpărături','其他购物'],'cumparaturi|purchase*|покупки'),
];
export function productTypeById(id) { return RECEIPT_PRODUCT_TYPES.find(type=>type.id===id) || null; }
function typeScore(text,tokens,type){
  let score=0;const padded=` ${text} `;
  for(const match of type.matchers){
    let found=match.han?text.includes(match.needle):!match.stem&&padded.includes(` ${match.needle} `);
    if(match.stem)for(let start=0;start<=tokens.length-match.parts.length&&!found;start++)found=match.parts.every((word,index)=>word.endsWith('*')?tokens[start+index].startsWith(word.slice(0,-1)):tokens[start+index]===word);
    if(found)score=Math.max(score,match.needle.replaceAll('*','').length);
  }
  return score;
}
const detected=new Map();
export function classifyProduct(value, preferredType = '') {
  const preferred=productTypeById(preferredType); if(preferred)return preferred;
  const text=wordText(value);
  if(detected.has(text))return productTypeById(detected.get(text));
  const tokens=text.split(' ');
  let best=null,score=0;
  for(const type of RECEIPT_PRODUCT_TYPES){const candidate=typeScore(text,tokens,type);if(candidate>score){best=type;score=candidate;}}
  if(detected.size>=5000)detected.clear();detected.set(text,best?.id||'');
  return best;
}
export function searchProductTypes(query,language='ru') {
  const terms=normalizeProductText(query).split(' ').filter(Boolean),locale=productLocale(language);
  return RECEIPT_PRODUCT_TYPES.filter(type=>terms.every(term=>normalizeProductText([...type.labels,...type.aliases,type.category].join(' ')).includes(term)))
    .sort((a,b)=>a.labels[locale].localeCompare(b.labels[locale],language==='md'?'ro':language));
}
export function presentProduct(value,language='ru',preferredType='') {
  const original=String(value||'').replace(/^[|\\\s]+|[|\\\s]+$/g,'').replace(/\s+/g,' ').trim();
  const matched=classifyProduct(original,preferredType);
  if(!matched)return{title:original,detail:'',original,symbol:'🛍️',type:'',category:'Другое'};
  const first=original.split(' ')[0],normalized=normalizeProductText(first);
  const distinctive=/^[\p{Lu}\d-]{2,24}$/u.test(first)||/\p{Lu}.*\p{Lu}/u.test(first);
  const brand=distinctive&&!typeScore(wordText(normalized),wordText(normalized).split(' '),matched)&&!/^(?:snack|fresh|bio)$/i.test(first)?first:'';
  const size=original.match(/\b\d+(?:[.,]\d+)?\s*(?:kg|кг|ml|мл|g|г|l|л)\b/iu)?.[0]||'';
  return{title:[matched.labels[productLocale(language)],brand].filter(Boolean).join(' '),detail:size,original,symbol:matched.symbol,type:matched.id,category:matched.category};
}
