import React from 'react';
import {categoryEmoji} from '../lib/categoryIconCatalog.js';
import {Shapes,Tag,Folder,Star,Heart,Sparkles,Diamond,Compass,Leaf,ShoppingBag,ShoppingCart,Coffee,Utensils,House,Car,Plane,Gift,Gamepad2,Music,HeartPulse,GraduationCap,PawPrint,Dumbbell,Wrench,Camera,BookOpen,Briefcase,Laptop,Wallet,Banknote,Coins,Landmark,ChartNoAxesCombined,Repeat2} from 'lucide-react';
const icons={shapes:Shapes,tag:Tag,folder:Folder,star:Star,heart:Heart,sparkles:Sparkles,diamond:Diamond,compass:Compass,leaf:Leaf,bag:ShoppingBag,cart:ShoppingCart,coffee:Coffee,food:Utensils,home:House,car:Car,plane:Plane,gift:Gift,game:Gamepad2,music:Music,health:HeartPulse,study:GraduationCap,pet:PawPrint,sport:Dumbbell,tools:Wrench,camera:Camera,book:BookOpen,work:Briefcase,laptop:Laptop,wallet:Wallet,cash:Banknote,coins:Coins,bank:Landmark,chart:ChartNoAxesCombined,repeat:Repeat2};
const emojiComponents=new Map();
export function categoryIcon(id){
 if(Object.hasOwn(icons,id))return icons[id];
 const emoji=categoryEmoji(id);if(!emoji)return undefined;
 if(!emojiComponents.has(id))emojiComponents.set(id,function EmojiCategoryIcon({size=22,className=''}){return React.createElement('span',{className:`category-icon-emoji ${className}`.trim(),style:{fontSize:size},'aria-hidden':true},emoji);});
 return emojiComponents.get(id);
}
const defaultIds={'Продукты':'cart','Кафе':'coffee','Жильё':'home','Транспорт':'car','Покупки':'bag','Подписки':'repeat','Здоровье':'health','Образование':'study','Путешествия':'plane','Развлечения':'game','Работа':'work','Подарки':'gift','Зарплата':'wallet','Фриланс':'laptop','Инвестиции':'chart','Возврат':'cash'};
export function categoryDefaultIcon(value){return defaultIds[value]||'shapes';}
const tones={cart:150,coffee:32,food:32,home:215,car:205,bag:280,repeat:240,health:350,study:260,plane:195,game:265,work:215,gift:330,wallet:205,laptop:220,chart:160,cash:145,heart:350,star:40,leaf:150,pet:32,music:300,camera:220,diamond:230};
export function categoryIconTone(id,value){return tones[id||defaultIds[value]]??220;}
