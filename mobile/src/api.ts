import AsyncStorage from '@react-native-async-storage/async-storage';
import {createDemo} from '../../src/data/demo';
import {applyAction} from '../../src/lib/domain';
import type {Snapshot,User,ActionName,Input,TimetableEntry} from '../../shared/model';
import {defaultPreferences,type Preferences,type CachedTimetable} from '../../shared/mobile';
import {session} from './storage';
export const DEMO=process.env.EXPO_PUBLIC_DEMO_MODE!=='false',API=(process.env.EXPO_PUBLIC_API_URL||'http://localhost:3001').replace(/\/$/,'');
interface Local{snapshot:Snapshot;userId:string|null;bookmarks:string[];reports:{id:string;type:string;targetId:string;reason:string;resolved:boolean}[];votes:Record<string,string[]>;preferences:Preferences;}
let local:Local|null=null,queue=Promise.resolve();
export class ApiError extends Error{constructor(message:string,public status:number){super(message);}}
export async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const stored=await session.read(),auth=stored?JSON.parse(stored) as {token:string;csrfToken:string}:null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetch(API+'/api'+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth.token,'x-csrf-token':auth.csrfToken}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});const value=await response.json();if(!response.ok)throw new ApiError(value.error||'Request failed.',response.status);return value.data;}
 finally{clearTimeout(timer);}
}
async function state(){if(!local){const raw=await AsyncStorage.getItem('nsut-native-demo');local=raw?JSON.parse(raw):{snapshot:createDemo(),userId:null,bookmarks:[],reports:[],votes:{},preferences:defaultPreferences};}return local!;}
async function change<T>(fn:(s:Local)=>T):Promise<T>{const task=queue.then(async()=>{const s=await state(),value=fn(s);await AsyncStorage.setItem('nsut-native-demo',JSON.stringify(s));return value;});queue=task.then(()=>{},()=>{});return task;}
const guard=(s:Local)=>{if(s.snapshot.users.find(u=>u.id===s.userId)?.role!=='ADMIN')throw new Error('Administrator access required.');};
export const api={
 async restore():Promise<User|null>{if(DEMO){const s=await state();return s.snapshot.users.find(u=>u.id===s.userId)??null;}if(!await session.read())return null;try{return(await request<{user:User}>('/auth/me')).user;}catch(e){if(e instanceof ApiError&&e.status===401){await session.clear();return null;}throw e;}},
 async loginDemo(admin=false){return change(s=>{s.userId=admin?'admin':'aarav';return s.snapshot.users.find(u=>u.id===s.userId)!;});},
 async exchange(code:string,codeVerifier:string){const result=await request<{token:string;csrfToken:string;user:User}>('/auth/mobile/exchange','POST',{code,codeVerifier});await session.write(JSON.stringify({token:result.token,csrfToken:result.csrfToken}));return result.user;},
 async logout(){if(DEMO)await change(s=>{s.userId=null;});else try{await request('/auth/logout','POST',{deviceId:await AsyncStorage.getItem('nsut-device')});}finally{await session.clear();}},
 async snapshot():Promise<Snapshot>{return DEMO?(await state()).snapshot:request('/snapshot');},
 async action(name:ActionName,input:Input,user:User,snapshot:Snapshot):Promise<Snapshot>{
  if(DEMO)return change(s=>{s.snapshot=applyAction(s.snapshot,user,name,input);if(name==='profile.edit'){const u=s.snapshot.users.find(u=>u.id===user.id)!;u.batch=Number(input.batch??u.batch??2025);u.privateProfile=input.privateProfile===true;}return s.snapshot;});
  const id=encodeURIComponent(String(input.id??'')),body={...input};delete body.id;let path='',method='POST';
  switch(name){
   case 'post.create':path='/posts';break;
   case 'post.edit':path='/posts/'+id;method='PATCH';break;
   case 'post.delete':path='/posts/'+id;method='DELETE';break;
   case 'post.like':path='/posts/'+id+'/likes';method=snapshot.posts.find(p=>p.id===input.id)?.likes.includes(user.id)?'DELETE':'POST';break;
   case 'post.bookmark':path='/posts/'+id+'/bookmark';method=snapshot.posts.find(p=>p.id===input.id)?.bookmarks.includes(user.id)?'DELETE':'POST';break;
   case 'post.comment':path='/posts/'+id+'/comments';break;
   case 'discussion.create':path='/discussions';body.tags=String(body.tags||'').split(',').map(x=>x.trim()).filter(Boolean);break;
   case 'discussion.edit':path='/discussions/'+id;method='PATCH';body.tags=String(body.tags||'').split(',').map(x=>x.trim()).filter(Boolean);break;
   case 'discussion.delete':path='/discussions/'+id;method='DELETE';break;
   case 'discussion.vote':path='/discussions/'+id+'/votes';method=snapshot.discussions.find(d=>d.id===input.id)?.votes.includes(user.id)?'DELETE':'POST';break;
   case 'discussion.reply':path='/discussions/'+id+'/replies';break;
   case 'announcement.save':path='/announcements'+(id?'/'+id:'');method=id?'PATCH':'POST';break;
   case 'announcement.delete':path='/announcements/'+id;method='DELETE';break;
   case 'timetable.save':path='/timetable'+(id?'/'+id:'');method=id?'PATCH':'POST';break;
   case 'timetable.delete':path='/timetable/'+id;method='DELETE';break;
   case 'profile.edit':path='/users/me';method='PATCH';break;
   case 'notification.read':path='/notifications/'+id+'/read';method='PATCH';body.read=true;break;
   case 'admin.moderate':path='/admin/moderation/'+id+'/action';body.type=body.kind;body.action='hide';delete body.kind;break;
   default:throw new Error('This action is unavailable on mobile.');
  }
  await request(path,method,method==='DELETE'?undefined:body);return api.snapshot();
 },
 async timetable(branch:string,semester:number,section:string):Promise<CachedTimetable>{
  if(!DEMO)return request('/mobile/timetable/sync?'+new URLSearchParams({branch,semester:String(semester),section}));
  const entries=(await state()).snapshot.timetable.filter(e=>e.branch===branch&&e.semester===semester&&e.section===section);
  if(!entries.length)throw new ApiError('No timetable for this selection. Demo: CSE / semester 5 / section A.',404);
  return {branch,semester,section,entries,version:1,syncedAt:new Date().toISOString(),timezone:'Asia/Kolkata'};
 },
 async preferences():Promise<Preferences>{return DEMO?(await state()).preferences:request('/mobile/preferences');},
 async preferencesSave(value:Preferences){await AsyncStorage.setItem('nsut-preferences',JSON.stringify(value));return DEMO?change(s=>{s.preferences=value;}):request('/mobile/preferences','PUT',value);},
 async bookmarks():Promise<string[]>{return DEMO?(await state()).bookmarks:request('/mobile/bookmarks');},
 async bookmark(id:string,active:boolean){return DEMO?change(s=>{s.bookmarks=active?[...new Set([...s.bookmarks,id])]:s.bookmarks.filter(x=>x!==id);}):request('/mobile/discussions/'+id+'/bookmark',active?'POST':'DELETE');},
 async votes(id:string):Promise<{count:number;voted:boolean}>{if(!DEMO)return request('/mobile/replies/'+id+'/votes');const s=await state(),votes=s.votes[id]??[];return {count:votes.length,voted:votes.includes(s.userId!)};},
 async vote(id:string,active:boolean){if(!DEMO)return request('/mobile/replies/'+id+'/votes',active?'POST':'DELETE');return change(s=>{const votes=s.votes[id]??[];s.votes[id]=active?[...new Set([...votes,s.userId!])]:votes.filter(x=>x!==s.userId);});},
 async report(targetId:string,type:string,reason:string){if(reason.trim().length<5)throw new Error('Please describe the issue in at least five characters.');return DEMO?change(s=>{s.reports.unshift({id:Date.now().toString(36),targetId,type,reason,resolved:false});}):request('/mobile/reports','POST',{targetId,type,reason});},
 async reports(page=1){if(!DEMO)return request<Local['reports']>('/mobile/admin/reports?page='+page);const s=await state();guard(s);return s.reports.filter(r=>!r.resolved).slice((page-1)*20,page*20);},
 async moderateReport(id:string,hide:boolean){if(!DEMO)return request('/mobile/admin/reports/'+id,'PATCH',{hide});return change(s=>{guard(s);const r=s.reports.find(r=>r.id===id)!;r.resolved=true;if(hide){if(r.type==='post')s.snapshot.posts.find(p=>p.id===r.targetId)!.hidden=true;else s.snapshot.discussions.find(d=>d.id===r.targetId)!.hidden=true;}s.snapshot.auditLogs.unshift({id:Date.now().toString(36),actorId:s.userId!,action:hide?'report.hide':'report.dismiss',targetId:r.targetId,createdAt:new Date().toISOString()});});},
 async notify(text:string,branch:string,link:string){if(!text||!/^\/(announcements|discussions|timetable)/.test(link))throw new Error('Add text and a valid campus content link.');if(!DEMO)return request('/mobile/admin/notifications','POST',{text,branch:branch||undefined,link});return change(s=>{guard(s);for(const u of s.snapshot.users.filter(u=>!branch||u.branch===branch))s.snapshot.notifications.unshift({id:Date.now().toString(36)+u.id,userId:u.id,text,link,read:false,createdAt:new Date().toISOString()});s.snapshot.auditLogs.unshift({id:Date.now().toString(36),actorId:s.userId!,action:'notification.targeted',targetId:link,createdAt:new Date().toISOString()});});}
};

export async function subscribe(signal:AbortSignal,onChange:()=>void){
 if(DEMO)return;
 const {fetch:streamFetch}=await import('expo/fetch');
 while(!signal.aborted){
  try{const value=await session.read();if(!value)return;const auth=JSON.parse(value);const response=await streamFetch(API+'/api/mobile/stream',{headers:{Authorization:'Bearer '+auth.token},signal});
   if(!response.ok||!response.body)throw new Error('Stream unavailable');const reader=response.body.getReader();let buffer='';
   while(!signal.aborted){const {done,value}=await reader.read();if(done)break;buffer+=new TextDecoder().decode(value);const chunks=buffer.split('\n\n');buffer=chunks.pop()!;for(const chunk of chunks)if(chunk.includes('"changed"'))onChange();}
  }catch{if(signal.aborted)return;}
  await new Promise<void>(resolve=>{const timer=setTimeout(resolve,5000);signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
 }
}
