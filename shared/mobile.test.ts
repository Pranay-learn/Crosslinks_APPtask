import {describe,it,expect} from 'vitest';
import {classStatus,nextReminder} from './mobile';
import type {TimetableEntry} from './model';
const entry:TimetableEntry={id:'one',subject:'DSA',code:'CS201',faculty:'Dr Rao',room:'AB1',day:1,start:'09:00',end:'10:00',branch:'CSE',semester:5,section:'A',color:'#4567eb'};
describe('persistent timetable time contracts',()=>{
 it('selects campus-time current and upcoming classes',()=>{expect(classStatus([entry],new Date('2026-10-12T03:20:00Z')).next?.id).toBe('one');expect(classStatus([entry],new Date('2026-10-12T03:30:00Z')).current?.id).toBe('one');expect(classStatus([entry],new Date('2026-10-12T04:30:00Z')).current).toBeUndefined();});
 it('reminds ten minutes before campus time irrespective of device timezone',()=>expect(nextReminder(entry,10,new Date('2026-10-12T03:00:00Z'))?.toISOString()).toBe('2026-10-12T03:20:00.000Z'));
 it('skips elapsed reminder times until the next weekly class',()=>expect(nextReminder(entry,10,new Date('2026-10-12T03:21:00Z'))?.toISOString()).toBe('2026-10-19T03:20:00.000Z'));
 it('does not remind or select cancelled classes',()=>{expect(nextReminder({...entry,cancelled:true},5)).toBeNull();expect(classStatus([{...entry,cancelled:true}],new Date('2026-10-12T03:00:00Z')).next).toBeUndefined();});
});
