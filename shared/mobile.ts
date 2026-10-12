import type {TimetableEntry} from './model';
export interface Preferences {announcement:boolean;reply:boolean;discussion:boolean;timetable:boolean;urgent:boolean;classReminder:boolean;reminderMinutes:5|10|15;}
export const defaultPreferences:Preferences={announcement:true,reply:true,discussion:false,timetable:true,urgent:true,classReminder:true,reminderMinutes:10};
export interface CachedTimetable{branch:string;semester:number;section:string;version:number;entries:TimetableEntry[];syncedAt:string;timezone:string;}
export function campusTime(now=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));return {day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday),minute:+parts.hour*60+(+parts.minute)};}
export const minute=(time:string)=>+time.slice(0,2)*60+(+time.slice(3));
export function classStatus(entries:TimetableEntry[],now=new Date()){const {day,minute:current}=campusTime(now),today=entries.filter(e=>e.day===day&&!e.cancelled).sort((a,b)=>a.start.localeCompare(b.start));return {day,minute:current,current:today.find(e=>minute(e.start)<=current&&current<minute(e.end)),next:today.find(e=>minute(e.start)>current)};}
export function nextReminder(e:TimetableEntry,lead:number,now=new Date()){
 if(e.cancelled)return null;
 const shifted=new Date(now.getTime()+330*60000),midnight=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())-330*60000;
 let date=midnight+((e.day-shifted.getUTCDay()+7)%7)*86400000+(minute(e.start)-lead)*60000;
 if(date<=now.getTime())date+=7*86400000;
 return new Date(date);
}
