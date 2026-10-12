import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { id } from "../lib/access.js";
import { HttpError } from "../lib/errors.js";
import { timetable } from "../lib/serialize.js";
import { authenticated, requireAdmin } from "../middleware/auth.js";
import { partialTimetableInput, saveTimetable } from "../services/timetable.js";
import { timetableInput } from "../validators/input.js";

export function timetableRoutes(db: PrismaClient) {
  const router = Router();
  router.get("/", async (req, res) => {
    const query = z
      .object({
        branch: z.string().max(80).optional(),
        semester: z.coerce.number().int().min(1).max(12).optional(),
        section: z.string().max(20).optional(),
        day: z.coerce.number().int().min(1).max(6).optional(),
      })
      .parse(req.query);
    const rows = await db.timetableEntry.findMany({
      where: query,
      orderBy: [{ day: "asc" }, { start: "asc" }],
    });
    res.json({ data: rows.map(timetable) });
  });
  router.get("/:id", async (req, res) => {
    const row = await db.timetableEntry.findUnique({ where: { id: id(req) } });
    if (!row) throw new HttpError(404, "Timetable entry not found.");
    res.json({ data: timetable(row) });
  });
  router.post("/", requireAdmin, async (req, res) => {
    const row = await saveTimetable(
      db,
      authenticated(req).user.id,
      timetableInput.parse(req.body),
    );
    res.status(201).json({ data: timetable(row) });
  });
  router.patch("/:id", requireAdmin, async (req, res) => {
    const row = await db.timetableEntry.findUnique({ where: { id: id(req) } });
    if (!row) throw new HttpError(404, "Timetable entry not found.");
    const patch = partialTimetableInput.parse(req.body);
    const { id: _recordId, ...existing } = timetable(row);
    const merged = timetableInput.parse({ ...existing, ...patch });
    res.json({
      data: timetable(
        await saveTimetable(db, authenticated(req).user.id, merged, row.id),
      ),
    });
  });
  router.delete("/:id", requireAdmin, async (req,res)=>{
    const recordId=id(req),actorId=authenticated(req).user.id;
    await db.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(672886144)`;
      const entry=await tx.timetableEntry.findUnique({where:{id:recordId}});
      if(!entry)throw new HttpError(404,"Timetable entry not found.");
      await tx.timetableEntry.delete({where:{id:recordId}});
      await tx.auditLog.create({data:{actorId,action:"timetable.delete",targetId:recordId}});
      const recipients=await tx.user.findMany({where:{status:"ACTIVE",branch:entry.branch,semester:entry.semester,section:entry.section},select:{id:true}});
      await tx.notification.createMany({data:recipients.map(u=>({userId:u.id,text:"Your timetable was updated. A class was removed.",link:"/timetable"}))});
    });
    res.json({data:{id:recordId,deleted:true}});
  });
  return router;
}
