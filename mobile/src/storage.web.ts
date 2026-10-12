import AsyncStorage from '@react-native-async-storage/async-storage';
import type {CachedTimetable} from '../../shared/mobile';
let currentSession:string|null=null;
export const session={read:async()=>currentSession,write:async(value:string)=>{currentSession=value;},clear:async()=>{currentSession=null;}};
export const cacheKey=(branch:string,semester:number,section:string)=>branch+':'+semester+':'+section;
export const timetableCache={
 async read(key:string):Promise<CachedTimetable|null>{const value=await AsyncStorage.getItem('schedule:'+key);return value?JSON.parse(value):null;},
 async write(value:CachedTimetable){await AsyncStorage.setItem('schedule:'+cacheKey(value.branch,value.semester,value.section),JSON.stringify(value));}
};
