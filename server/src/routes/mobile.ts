import { Router } from "express";
import { createHash,createCipheriv,randomBytes } from "node:crypto";
import { z } from "zod";
import { Expo } from "expo-server-sdk";
import type { PrismaClient } from "@prisma/client";
import { authenticated,requireAdmin } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { hashToken } from "../services/auth.js";
import { accessibleDiscussion,accessiblePost } from "../lib/access.js";
import { timetable } from "../lib/serialize.js";
export const defaults={announcement:true,reply:true,discussion:false,timetable:true,urgent:true,classReminder:true,reminderMinutes:10};
const preferenceInput=z.object({announcement:z.boolean(),reply:z.boolean(),discussion:z.boolean(),timetable:z.boolean(),urgent:z.boolean(),classReminder:z.boolean(),reminderMinutes:z.union([z.literal(5),z.literal(10),z.literal(15)])}).strict();
const selection=z.object({branch:z.string().min(1).max(80),semester:z.coerce.number().int().min(1).max(12),section:z.string().min(1).max(20)});
export function mobileRoutes(db:PrismaClient){
 const r=Router();
 r.get("/preferences",async(req,res)=>{const row=await db.pushPreference.findUnique({where:{userId:authenticated(req).user.id}});res.json({data:{...defaults,...(row?.settings as object??{})}});});
 r.put("/preferences",async(req,res)=>{const settings=preferenceInput.parse(req.body),userId=authenticated(req).user.id;await db.pushPreference.upsert({where:{userId},create:{userId,settings},update:{settings}});res.json({data:settings});});
 r.post("/devices",async(req,res)=>{
  const v=z.object({token:z.string().max(300),platform:z.enum(["android","ios"])}).strict().parse(req.body);
  if(!Expo.isExpoPushToken(v.token))throw new HttpError(400,"Invalid Expo push token.");
  const key=Buffer.from(process.env.DEVICE_TOKEN_KEY??"","base64");if(key.length!==32)throw new HttpError(503,"Configure a 32-byte DEVICE_TOKEN_KEY on the server.");
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv),encrypted=Buffer.concat([cipher.update(v.token,"utf8"),cipher.final()]);
  const sealedToken=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString("base64"),userId=authenticated(req).user.id;
  const device=await db.pushDevice.upsert({where:{tokenHash:hashToken(v.token)},create:{tokenHash:hashToken(v.token),sealedToken,userId,platform:v.platform},update:{sealedToken,userId,enabled:true,platform:v.platform}});
  res.json({data:{id:device.id}});
 });
 r.delete("/devices/:id",async(req,res)=>{await db.pushDevice.updateMany({where:{id:String(req.params.id),userId:authenticated(req).user.id},data:{enabled:false}});res.json({data:{success:true}});});
 r.get("/timetable/sync",async(req,res)=>{
  const key=selection.parse(req.query);
  const snapshot=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(672886144)`;
   const rows=await tx.timetableEntry.findMany({where:key,orderBy:[{day:"asc"},{start:"asc"},{id:"asc"}]});
   if(!rows.length)throw new HttpError(404,"No timetable has been published for this selection.");
   const entries=rows.map(timetable),hash=createHash("sha256").update(JSON.stringify(entries)).digest("hex");
   const latest=await tx.timetableSnapshot.findFirst({where:key,orderBy:{version:"desc"}});
   if(latest?.hash===hash)return {entries,version:latest.version};
   const created=await tx.timetableSnapshot.create({data:{...key,hash,version:(latest?.version??0)+1,snapshot:JSON.parse(JSON.stringify(entries))}});
   return {entries,version:created.version};
  });
  res.json({data:{...key,...snapshot,syncedAt:new Date().toISOString(),timezone:"Asia/Kolkata"}});
 });
 r.get("/bookmarks",async(req,res)=>{res.json({data:(await db.discussionBookmark.findMany({where:{userId:authenticated(req).user.id,discussion:{hidden:false}},select:{discussionId:true}})).map(x=>x.discussionId)});});
 for(const method of ["post","delete"] as const)r[method]("/discussions/:id/bookmark",async(req,res)=>{
  const viewer=authenticated(req).user,record=await accessibleDiscussion(db,String(req.params.id),viewer),key={discussionId:record.id,userId:viewer.id};
  if(method==="post")await db.discussionBookmark.upsert({where:{discussionId_userId:key},create:key,update:{}});
  else await db.discussionBookmark.deleteMany({where:key});
  res.json({data:{saved:method==="post"}});
 });
 r.get("/replies/:id/votes",async(req,res)=>{
  const reply=await db.discussionReply.findUnique({where:{id:String(req.params.id)}});
  if(!reply)throw new HttpError(404,"Reply not found.");await accessibleDiscussion(db,reply.discussionId,authenticated(req).user);
  const votes=await db.replyVote.findMany({where:{replyId:reply.id}});res.json({data:{count:votes.length,voted:votes.some(v=>v.userId===authenticated(req).user.id)}});
 });
 for(const method of ["post","delete"] as const)r[method]("/replies/:id/votes",async(req,res)=>{
  const viewer=authenticated(req).user,reply=await db.discussionReply.findUnique({where:{id:String(req.params.id)}});
  if(!reply)throw new HttpError(404,"Reply not found.");await accessibleDiscussion(db,reply.discussionId,viewer);
  const key={replyId:reply.id,userId:viewer.id};
  if(method==="post")await db.replyVote.upsert({where:{replyId_userId:key},create:key,update:{}});
  else await db.replyVote.deleteMany({where:key});res.json({data:{success:true}});
 });
 r.post("/reports",async(req,res)=>{
  const v=z.object({targetId:z.string().min(1).max(100),type:z.enum(["post","discussion"]),reason:z.string().trim().min(5).max(500)}).strict().parse(req.body),viewer=authenticated(req).user;
  if(v.type==="post")await accessiblePost(db,v.targetId,viewer);else await accessibleDiscussion(db,v.targetId,viewer);
  const key={userId:viewer.id,targetId:v.targetId,type:v.type};
  await db.contentReport.upsert({where:{userId_targetId_type:key},create:{...key,reason:v.reason},update:{reason:v.reason,resolved:false}});
  res.status(201).json({data:{success:true}});
 });
 r.get("/admin/reports",requireAdmin,async(req,res)=>{
  const page=z.coerce.number().int().min(1).default(1).parse(req.query.page);
  const rows=await db.contentReport.findMany({where:{resolved:false},orderBy:{createdAt:"desc"},skip:(page-1)*20,take:20});
  res.json({data:rows.map(({userId,...row})=>row)});
 });
 r.patch("/admin/reports/:id",requireAdmin,async(req,res)=>{
  const v=z.object({hide:z.boolean()}).strict().parse(req.body),report=await db.contentReport.findUnique({where:{id:String(req.params.id)}});
  if(!report)throw new HttpError(404,"Report not found.");
  await db.$transaction(async tx=>{
   if(v.hide){if(report.type==="post")await tx.post.updateMany({where:{id:report.targetId},data:{hidden:true}});else await tx.discussion.updateMany({where:{id:report.targetId},data:{hidden:true}});}
   await tx.contentReport.update({where:{id:report.id},data:{resolved:true}});
   await tx.auditLog.create({data:{actorId:authenticated(req).user.id,action:v.hide?"report.hide":"report.dismiss",targetId:report.targetId}});
  });res.json({data:{success:true}});
 });
 r.post("/admin/notifications",requireAdmin,async(req,res)=>{
  const v=z.object({text:z.string().trim().min(3).max(300),branch:z.string().max(80).optional(),link:z.string().max(200)}).strict().parse(req.body);
  const match=v.link.match(/^\/(announcements|discussions|timetable)(?:\/([A-Za-z0-9_-]+))?$/);
  if(!match)throw new HttpError(400,"Choose an announcement, discussion, or timetable target.");
  if(match[1]==="announcements"&&(!match[2]||!await db.announcement.findUnique({where:{id:match[2]}})))throw new HttpError(404,"Announcement not found.");
  if(match[1]==="discussions"&&(!match[2]||!await db.discussion.findUnique({where:{id:match[2]}})))throw new HttpError(404,"Discussion not found.");
  await db.$transaction(async tx=>{
   const recipients=await tx.user.findMany({where:{status:"ACTIVE",...(v.branch?{branch:v.branch}:{})},select:{id:true}});
   await tx.notification.createMany({data:recipients.map(u=>({userId:u.id,text:v.text,link:v.link}))});
   await tx.auditLog.create({data:{actorId:authenticated(req).user.id,action:"notification.targeted",targetId:v.link}});
  });res.status(202).json({data:{queued:true}});
 });
 return r;
}
