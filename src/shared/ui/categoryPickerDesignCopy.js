const copy={
 ru:{frequent:'Под рукой',mine:'Мои разделы',shortMine:'Мои',browse:'Все',symbol:'Значок раздела',universal:'Универсальные',daily:'Повседневные',money:'Деньги и работа',preview:'Предпросмотр',name:'Мой раздел'},
 uk:{frequent:'Під рукою',mine:'Мої категорії',shortMine:'Мої',browse:'Усі',symbol:'Значок категорії',universal:'Універсальні',daily:'Повсякденні',money:'Гроші й робота',preview:'Попередній перегляд',name:'Моя категорія'},
 en:{frequent:'Quick access',mine:'My categories',shortMine:'Custom',browse:'All',symbol:'Category icon',universal:'Universal',daily:'Everyday',money:'Money and work',preview:'Preview',name:'My category'},
 ro:{frequent:'La îndemână',mine:'Categoriile mele',shortMine:'Mele',browse:'Toate',symbol:'Pictograma categoriei',universal:'Universale',daily:'Zilnice',money:'Bani și muncă',preview:'Previzualizare',name:'Categoria mea'},
 zh:{frequent:'常用类别',mine:'我的类别',shortMine:'我的',browse:'全部',symbol:'类别图标',universal:'通用',daily:'日常',money:'金钱与工作',preview:'预览',name:'我的类别'},
};
const iconCopy={
 ru:{symbols:'Символ',emoji:'Эмодзи',ownEmoji:'Свой эмодзи',emojiHint:'Выберите ниже или вставьте свой эмодзи',emojiError:'Нужен один эмодзи',save:'Сохранить',manageHint:'Нажмите на раздел, чтобы изменить значок. Звёздочка закрепит его под рукой.'},
 uk:{symbols:'Символ',emoji:'Емодзі',ownEmoji:'Власний емодзі',emojiHint:'Виберіть нижче або вставте свій емодзі',emojiError:'Потрібен один емодзі',save:'Зберегти',manageHint:'Натисніть категорію, щоб змінити значок. Зірочка закріпить її під рукою.'},
 en:{symbols:'Symbol',emoji:'Emoji',ownEmoji:'Your emoji',emojiHint:'Choose below or paste your own emoji',emojiError:'Enter a single emoji',save:'Save',manageHint:'Tap a category to change its icon. Star it for quick access.'},
 ro:{symbols:'Simbol',emoji:'Emoji',ownEmoji:'Emoji propriu',emojiHint:'Alege mai jos sau lipește un emoji',emojiError:'Introdu un singur emoji',save:'Salvează',manageHint:'Apasă o categorie pentru a-i schimba pictograma. Steaua o fixează la îndemână.'},
 zh:{symbols:'符号',emoji:'表情',ownEmoji:'自选表情',emojiHint:'在下方选择或粘贴一个表情',emojiError:'请输入一个表情',save:'保存',manageHint:'点击类别更改图标。星标可将其加入常用。'},
};
export function categoryPickerDesignCopy(language){const locale=language.startsWith('zh')?'zh':['md','ro'].includes(language)?'ro':language;return {...(copy[locale]||copy.en),...(iconCopy[locale]||iconCopy.en)};}
