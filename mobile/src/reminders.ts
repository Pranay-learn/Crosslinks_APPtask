import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {nextReminder,type Preferences,type CachedTimetable} from '../../shared/mobile';
import {request,DEMO} from './api';
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:true,shouldSetBadge:false})});
export async function enableNotifications(){
 if(Platform.OS==='web')return 'Push and local class reminders are supported in native Android/iOS builds. Use the notification center in the browser demo.';
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('campus',{name:'Campus updates',importance:Notifications.AndroidImportance.HIGH});
 if(!(await Notifications.requestPermissionsAsync()).granted)throw new Error('Notification permission was not granted. You can enable it in system settings.');
 if(!DEMO){const projectId=Constants.expoConfig?.extra?.eas?.projectId;if(!projectId)throw new Error('Configure the EAS project ID first.');const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;const device=await request<{id:string}>('/mobile/devices','POST',{token,platform:Platform.OS});await AsyncStorage.setItem('nsut-device',device.id);}
 return 'Notifications enabled on this device.';
}
let queue=Promise.resolve();
export function schedule(t:CachedTimetable|null,p:Preferences){
 queue=queue.catch(()=>{}).then(async()=>{
  if(Platform.OS==='web')return;
  const previous=JSON.parse(await AsyncStorage.getItem('nsut-reminders')??'[]') as string[];
  await Promise.all(previous.map(id=>Notifications.cancelScheduledNotificationAsync(id).catch(()=>{})));
  await AsyncStorage.removeItem('nsut-reminders');
  if(!t||!p.classReminder||!(await Notifications.getPermissionsAsync()).granted)return;
  const candidates=t.entries.flatMap(e=>{const at=nextReminder(e,p.reminderMinutes);return at?[0,1,2].map(w=>({entry:e,date:new Date(at.getTime()+w*7*86400000)})):[];}).sort((a,b)=>a.date.getTime()-b.date.getTime()).slice(0,48);
  const ids:string[]=[];
  for(const {entry,date} of candidates){ids.push(await Notifications.scheduleNotificationAsync({content:{title:entry.subject+' starts soon',body:p.reminderMinutes+' minutes • '+entry.room,data:{link:'/timetable'},sound:'default'},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date,channelId:'campus'}}));await AsyncStorage.setItem('nsut-reminders',JSON.stringify(ids));}
 });return queue;
}

export async function enableAndSchedule(){
 const message=await enableNotifications();
 const selection=JSON.parse(await AsyncStorage.getItem('nsut-selection')??'null');
 if(selection){const {cacheKey,timetableCache}=await import('./storage');const {api}=await import('./api');await schedule(await timetableCache.read(cacheKey(selection.branch,selection.semester,selection.section)),await api.preferences());}
 return message;
}
