import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import request from 'supertest';
import {createHash,randomUUID} from 'node:crypto';
import {createApp} from './app.js';
import {createDatabase} from './lib/db.js';
import {createSession,hashToken} from './services/auth.js';
import {applyMigrations} from '../scripts/migrate.js';
const url=process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('Native mobile secure API contracts',()=>{
 const db=url?createDatabase(url):undefined,prefix='mobile-'+randomUUID();
 let app:ReturnType<typeof createApp>,userId:string,adminId:string,token:string,csrf:string,adminToken:string,adminCsrf:string,discussionId:string,replyId:string,timetableId:string;
 const headers=(admin=false)=>({Authorization:'Bearer '+(admin?adminToken:token),'x-csrf-token':admin?adminCsrf:csrf});
 beforeAll(async()=>{
  if(!db||url===process.env.DATABASE_URL)throw new Error('Use a separate test database.');
  await applyMigrations(url!);app=createApp({db});
  const student=await db.user.create({data:{email:prefix+'@nsut.ac.in',name:'Mobile Student',branch:prefix,semester:5,section:'A'}});userId=student.id;
  const admin=await db.user.create({data:{email:prefix+'admin@nsut.ac.in',name:'Mobile Admin',role:'ADMIN'}});adminId=admin.id;
  const session=await createSession(db,userId),privileged=await createSession(db,adminId);token=session.token;csrf=session.csrfToken;adminToken=privileged.token;adminCsrf=privileged.csrfToken;
  const d=await db.discussion.create({data:{authorId:userId,title:'Mobile contracts discussion',text:'Persistent content',tags:[]}});discussionId=d.id;
  const r=await db.discussionReply.create({data:{authorId:adminId,discussionId,text:'Helpful answer'}});replyId=r.id;
 });
 afterAll(async()=>{if(db){await db.auditLog.deleteMany({where:{actorId:{in:[userId,adminId]}}});await db.user.deleteMany({where:{id:{in:[userId,adminId]}}});await db.timetableEntry.deleteMany({where:{branch:prefix}});await db.timetableSnapshot.deleteMany({where:{branch:prefix}});await db.$disconnect();}});
 it('authenticates native bearer sessions and still enforces CSRF on mutations',async()=>{
  await request(app).get('/api/auth/me').set(headers()).expect(200);
  await request(app).put('/api/mobile/preferences').set({Authorization:'Bearer '+token}).send({}).expect(403);
  await request(app).get('/api/mobile/admin/reports').set(headers()).expect(403);
  await request(app).post('/api/mobile/admin/notifications').set(headers()).send({}).expect(403);
 });
 it('stores validated notification preferences with ownership',async()=>{
  const prefs=(await request(app).get('/api/mobile/preferences').set(headers()).expect(200)).body.data;
  await request(app).put('/api/mobile/preferences').set(headers()).send({...prefs,reminderMinutes:15,discussion:true}).expect(200);
  expect((await request(app).get('/api/mobile/preferences').set(headers())).body.data.reminderMinutes).toBe(15);
  await request(app).put('/api/mobile/preferences').set(headers()).send({...prefs,reminderMinutes:1}).expect(400);
 });
 it('binds expiring one-time auth handoffs to the mobile PKCE verifier',async()=>{
  const code='A'.repeat(43),verifier='B'.repeat(43);
  await db!.mobileLogin.create({data:{codeHash:hashToken(code),userId,challenge:createHash('sha256').update(verifier).digest('base64url'),expiresAt:new Date(Date.now()+60000)}});
  await request(app).post('/api/auth/mobile/exchange').send({code,codeVerifier:'C'.repeat(43)}).expect(401);
  const result=await request(app).post('/api/auth/mobile/exchange').send({code,codeVerifier:verifier}).expect(200);
  expect(result.body.data.token).toHaveLength(43);expect(result.body.data.user.role).toBe('STUDENT');
  await request(app).post('/api/auth/mobile/exchange').send({code,codeVerifier:verifier}).expect(401);
 });
 it('supports idempotent discussion bookmarks and helpful-answer votes',async()=>{
  for(let n=0;n<2;n++)await request(app).post('/api/mobile/discussions/'+discussionId+'/bookmark').set(headers()).send({}).expect(200);
  expect((await request(app).get('/api/mobile/bookmarks').set(headers())).body.data).toEqual([discussionId]);
  for(let n=0;n<2;n++)await request(app).post('/api/mobile/replies/'+replyId+'/votes').set(headers()).send({}).expect(200);
  expect((await request(app).get('/api/mobile/replies/'+replyId+'/votes').set(headers())).body.data).toEqual({count:1,voted:true});
 });
 it('creates timetable snapshots and advances versions after an admin update',async()=>{
  const row=await db!.timetableEntry.create({data:{subject:'DSA',code:'CS201',faculty:'Dr Mobile',room:'AB-'+prefix.slice(-8),day:1,start:'09:00',end:'10:00',branch:prefix,semester:5,section:'A'}});timetableId=row.id;
  const path='/api/mobile/timetable/sync?branch='+prefix+'&semester=5&section=A';
  const first=(await request(app).get(path).set(headers()).expect(200)).body.data;expect(first.version).toBe(1);
  expect((await request(app).get(path).set(headers())).body.data.version).toBe(1);
  await request(app).patch('/api/timetable/'+timetableId).set(headers(true)).send({cancelled:true}).expect(200);
  const second=(await request(app).get(path).set(headers())).body.data;expect(second.version).toBe(2);expect(second.entries[0].cancelled).toBe(true);
 });
 it('synchronizes an empty version and queues an update when the last class is deleted',async()=>{
  await request(app).delete('/api/timetable/'+timetableId).set(headers(true)).expect(200);
  const current=(await request(app).get('/api/mobile/timetable/sync?branch='+prefix+'&semester=5&section=A').set(headers()).expect(200)).body.data;
  expect(current.version).toBe(3);expect(current.entries).toEqual([]);
  expect(await db!.notification.count({where:{userId,link:'/timetable',text:{contains:'removed'}}})).toBe(1);
 });
 it('persists reports, hides reporter identity, and permits only admin resolution',async()=>{
  await request(app).post('/api/mobile/reports').set(headers()).send({targetId:discussionId,type:'discussion',reason:'A meaningful example report'}).expect(201);
  const rows=(await request(app).get('/api/mobile/admin/reports').set(headers(true))).body.data;
  const report=rows.find((r:any)=>r.targetId===discussionId);expect(report.userId).toBeUndefined();
  await request(app).patch('/api/mobile/admin/reports/'+report.id).set(headers()).send({hide:true}).expect(403);
  await request(app).patch('/api/mobile/admin/reports/'+report.id).set(headers(true)).send({hide:true}).expect(200);
  await request(app).get('/api/discussions/'+discussionId).set(headers()).expect(404);
 });
 it('does not reveal push tokens and encrypts them at rest',async()=>{
  process.env.DEVICE_TOKEN_KEY=Buffer.alloc(32,3).toString('base64');
  const push='ExponentPushToken[mobile-contract-fixture]';
  const registered=await request(app).post('/api/mobile/devices').set(headers()).send({token:push,platform:'android'}).expect(200);
  expect(Object.keys(registered.body.data)).toEqual(['id']);
  const saved=await db!.pushDevice.findUniqueOrThrow({where:{id:registered.body.data.id}});expect(saved.sealedToken).not.toContain(push);expect(saved.tokenHash).toBe(hashToken(push));
  await request(app).post('/api/auth/logout').set(headers()).send({deviceId:saved.id}).expect(200);
  expect((await db!.pushDevice.findUniqueOrThrow({where:{id:saved.id}})).enabled).toBe(false);
 });
});
