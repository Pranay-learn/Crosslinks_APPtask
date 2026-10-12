import "dotenv/config";
import {createDecipheriv} from "node:crypto";
import {Expo} from "expo-server-sdk";
import {createDatabase} from "./lib/db.js";
import {defaults} from "./routes/mobile.js";
const db=createDatabase(process.env.DATABASE_URL!),expo=new Expo();
function unseal(value:string){
 const b=Buffer.from(value,"base64"),d=createDecipheriv("aes-256-gcm",Buffer.from(process.env.DEVICE_TOKEN_KEY??"","base64"),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString("utf8");
}
function kind(link:string,text:string){return link.startsWith("/announcements")?(/urgent/i.test(text)?"urgent":"announcement"):link.startsWith("/timetable")?"timetable":/replied|commented/i.test(text)?"reply":"discussion";}
let running=true;for(const s of ["SIGINT","SIGTERM"])process.on(s,()=>{running=false;});
while(running){
 try{
  for(const n of await db.notification.findMany({where:{dispatchedAt:null},include:{user:{include:{devices:{where:{enabled:true}},pushPreferences:true}}},take:50,orderBy:{createdAt:"asc"}})){
   const prefs={...defaults,...(n.user.pushPreferences?.settings as object??{})},enabled=prefs[kind(n.link,n.text)];
   await db.$transaction(async tx=>{
    if(enabled)await tx.pushDelivery.createMany({data:n.user.devices.map(d=>({notificationId:n.id,deviceId:d.id})),skipDuplicates:true});
    await tx.notification.update({where:{id:n.id},data:{dispatchedAt:new Date()}});
   });
  }
  const stale=new Date(Date.now()-300000);
  for(const job of await db.pushDelivery.findMany({where:{deliveredAt:null,attempts:{lt:5},availableAt:{lte:new Date()},OR:[{leasedAt:null},{leasedAt:{lt:stale}}]},include:{device:true,notification:{include:{user:{include:{pushPreferences:true}}}}},take:40})){
   const claimed=await db.pushDelivery.updateMany({where:{id:job.id,deliveredAt:null,OR:[{leasedAt:null},{leasedAt:{lt:stale}}]},data:{leasedAt:new Date(),attempts:{increment:1}}});if(!claimed.count)continue;
   const n=job.notification,prefs={...defaults,...(n.user.pushPreferences?.settings as object??{})};
   if(!job.device.enabled||job.device.userId!==n.userId||n.user.status!=="ACTIVE"||!prefs[kind(n.link,n.text)]){
    await db.pushDelivery.update({where:{id:job.id},data:{deliveredAt:new Date(),error:"Suppressed by device/account/preference"}});continue;
   }
   try{
    const [ticket]=await expo.sendPushNotificationsAsync([{to:unseal(job.device.sealedToken),title:"NSUT Connect",body:n.text,sound:"default",data:{link:n.link,notificationId:n.id},channelId:"campus"}]);
    if(ticket.status==="error"){if(ticket.details?.error==="DeviceNotRegistered")await db.pushDevice.update({where:{id:job.deviceId},data:{enabled:false}});throw new Error("Push provider error");}
    await db.pushDelivery.update({where:{id:job.id},data:{deliveredAt:new Date(),receiptId:ticket.id,leasedAt:null}});
   }catch{await db.pushDelivery.update({where:{id:job.id},data:{leasedAt:null,availableAt:new Date(Date.now()+30000*2**job.attempts),error:"Provider delivery failed"}});}
  }
  const jobs=await db.pushDelivery.findMany({where:{receiptId:{not:null},deliveredAt:{lt:new Date(Date.now()-900000)}},take:100});
  if(jobs.length){const receipts=await expo.getPushNotificationReceiptsAsync(jobs.map(j=>j.receiptId!));for(const j of jobs){const receipt=receipts[j.receiptId!];if(!receipt)continue;if(receipt.status==="error"&&receipt.details?.error==="DeviceNotRegistered")await db.pushDevice.update({where:{id:j.deviceId},data:{enabled:false}});await db.pushDelivery.update({where:{id:j.id},data:{receiptId:null,error:receipt.status==="error"?"Provider receipt error":null}});}}
  await db.mobileLogin.deleteMany({where:{expiresAt:{lt:new Date()}}});
 }catch{console.error(JSON.stringify({level:"error",event:"push_worker_tick_failed",time:new Date().toISOString()}));}
 await new Promise(resolve=>setTimeout(resolve,10000));
}
await db.$disconnect();
