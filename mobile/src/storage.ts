import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {CachedTimetable} from '../../shared/mobile';
let webSession:string|null=null;
export const session={read:async()=>Platform.OS==='web'?webSession:SecureStore.getItemAsync('nsut-session'),write:async(value:string)=>{if(Platform.OS==='web')webSession=value;else await SecureStore.setItemAsync('nsut-session',value);},clear:async()=>{webSession=null;if(Platform.OS!=='web')await SecureStore.deleteItemAsync('nsut-session');}};
let database:Promise<SQLite.SQLiteDatabase>|null=null;
async function db(){return database??(database=(async()=>{const d=await SQLite.openDatabaseAsync('nsut-timetable.db');await d.execAsync('CREATE TABLE IF NOT EXISTS schedule (cache_key TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL);');return d;})());}
export const cacheKey=(branch:string,semester:number,section:string)=>branch+':'+semester+':'+section;
export const timetableCache={
 async read(key:string):Promise<CachedTimetable|null>{if(Platform.OS==='web'){const v=await AsyncStorage.getItem('schedule:'+key);return v?JSON.parse(v):null;}const row=await(await db()).getFirstAsync<{payload:string}>('SELECT payload FROM schedule WHERE cache_key = ?',key);return row?JSON.parse(row.payload):null;},
 async write(value:CachedTimetable){const key=cacheKey(value.branch,value.semester,value.section),payload=JSON.stringify(value);if(Platform.OS==='web')await AsyncStorage.setItem('schedule:'+key,payload);else await(await db()).runAsync('INSERT OR REPLACE INTO schedule(cache_key,payload) VALUES(?,?)',key,payload);}
};
