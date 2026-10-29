const copy={
 ru:{frequent:'Под рукой',mine:'Мои разделы',shortMine:'Мои',browse:'Все',symbol:'Значок раздела',universal:'Универсальные',daily:'Повседневные',money:'Деньги и работа',preview:'Предпросмотр',name:'Мой раздел'},
 uk:{frequent:'Під рукою',mine:'Мої категорії',shortMine:'Мої',browse:'Усі',symbol:'Значок категорії',universal:'Універсальні',daily:'Повсякденні',money:'Гроші й робота',preview:'Попередній перегляд',name:'Моя категорія'},
 en:{frequent:'Quick access',mine:'My categories',shortMine:'Custom',browse:'All',symbol:'Category icon',universal:'Universal',daily:'Everyday',money:'Money and work',preview:'Preview',name:'My category'},
 ro:{frequent:'La îndemână',mine:'Categoriile mele',shortMine:'Mele',browse:'Toate',symbol:'Pictograma categoriei',universal:'Universale',daily:'Zilnice',money:'Bani și muncă',preview:'Previzualizare',name:'Categoria mea'},
 zh:{frequent:'常用类别',mine:'我的类别',shortMine:'我的',browse:'全部',symbol:'类别图标',universal:'通用',daily:'日常',money:'金钱与工作',preview:'预览',name:'我的类别'},
};
export function categoryPickerDesignCopy(language){return copy[language.startsWith('zh')?'zh':['md','ro'].includes(language)?'ro':language]||copy.en;}
