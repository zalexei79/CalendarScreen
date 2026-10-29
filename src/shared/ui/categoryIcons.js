import React from 'react';
import {categoryEmoji} from '../lib/categoryIconCatalog.js';
import {Shapes,Tag,Folder,Star,Heart,Sparkles,Diamond,Compass,Leaf,ShoppingBag,ShoppingCart,Coffee,Utensils,House,Car,Plane,Gift,Gamepad2,Music,HeartPulse,GraduationCap,PawPrint,Dumbbell,Wrench,Camera,BookOpen,Briefcase,Laptop,Wallet,Banknote,Coins,Landmark,ChartNoAxesCombined,Repeat2} from 'lucide-react';
import {Circle,Square,Triangle,Hexagon,Flame,Sun,Moon,Cloud,Rainbow,Globe,ShieldCheck,KeyRound,Flag,MapPin,Rocket,Bike,Bus,TrainFront,Fuel,ShoppingBasket,Pizza,CakeSlice,Wine,Shirt,Baby,Flower2,Trees,Tent,Brush,Ticket,CreditCard,ReceiptText,Percent,Calculator,PiggyBank,HandCoins,Store,Building2} from 'lucide-react';
const icons={shapes:Shapes,tag:Tag,folder:Folder,star:Star,heart:Heart,sparkles:Sparkles,diamond:Diamond,compass:Compass,leaf:Leaf,bag:ShoppingBag,cart:ShoppingCart,coffee:Coffee,food:Utensils,home:House,car:Car,plane:Plane,gift:Gift,game:Gamepad2,music:Music,health:HeartPulse,study:GraduationCap,pet:PawPrint,sport:Dumbbell,tools:Wrench,camera:Camera,book:BookOpen,work:Briefcase,laptop:Laptop,wallet:Wallet,cash:Banknote,coins:Coins,bank:Landmark,chart:ChartNoAxesCombined,repeat:Repeat2};
Object.assign(icons,{circle:Circle,square:Square,triangle:Triangle,hexagon:Hexagon,flame:Flame,sun:Sun,moon:Moon,cloud:Cloud,rainbow:Rainbow,globe:Globe,shield:ShieldCheck,key:KeyRound,flag:Flag,pin:MapPin,rocket:Rocket,bike:Bike,bus:Bus,train:TrainFront,fuel:Fuel,basket:ShoppingBasket,pizza:Pizza,cake:CakeSlice,wine:Wine,shirt:Shirt,baby:Baby,flower:Flower2,trees:Trees,tent:Tent,brush:Brush,ticket:Ticket,card:CreditCard,receipt:ReceiptText,percent:Percent,calculator:Calculator,savings:PiggyBank,payment:HandCoins,store:Store,building:Building2});
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
