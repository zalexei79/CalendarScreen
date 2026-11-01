import {lifeWeeks,localDateValue} from './lifeStoryModel.js';
export const MIN_BIRTHDAY_AGE=13;
export function birthdayBounds(today=new Date()){
 const maxYear=today.getFullYear()-MIN_BIRTHDAY_AGE,month=today.getMonth();
 const maxDay=Math.min(today.getDate(),new Date(maxYear,month+1,0).getDate());
 return {minYear:today.getFullYear()-130,maxYear,maxMonth:month+1,maxDay,maxDate:localDateValue(new Date(maxYear,month,maxDay))};
}
export function allowedBirthday(value,today=new Date()){
 return Boolean(lifeWeeks(value,today))&&value<=birthdayBounds(today).maxDate;
}
export function birthdayDayCount(year,month,today=new Date()){
 if(!month)return 31;
 const bounds=birthdayBounds(today),days=new Date(Number(year||2000),Number(month),0).getDate();
 return Number(year)===bounds.maxYear&&Number(month)===bounds.maxMonth?Math.min(days,bounds.maxDay):days;
}
