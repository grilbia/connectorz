import express from "express";
import { db } from "../db/db.js";
import { buzzLogs } from "../db/schema.js";
import { SendBuzzSchema } from "../validations/buzz.js";
import { eq, and, gt, desc } from "drizzle-orm";
import { z } from "zod";
import { or } from "drizzle-orm"; // Import 'or' from drizzle
import { connections } from "../db/schema.js"; // Import your connections table

const buzzRouter = express.Router();

function getAuthenticatedUserId(req) {
  // Replace this with real authentication extraction later.
  const userId = req.user?.id;
  return typeof userId === 'number' ? userId : Number(userId || NaN);
}

// POST /api/buzz/send
buzzRouter.post("/send", async (req, res) => {
  
  try {
    // 1. Validate Input
    const { receiverId } = SendBuzzSchema.parse(req.body);
    const senderId = getAuthenticatedUserId(req) || 1;
    if (!senderId || Number.isNaN(senderId)) {
      return res.status(401).json({ error: "Unauthorizd" ,id: `${senderId}`});
    }

    if (senderId === receiverId) {
      return res.status(400).json({ error: "You cannot buzz yourself." });
    }

    // 2. Anti-Spam Check: Limit to 1 buzz every 5 seconds per pair
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    
    const recentBuzz = await db
      .select()
      .from(buzzLogs)
      .where(
        and(
          eq(buzzLogs.senderId, senderId),
          eq(buzzLogs.receiverId, receiverId),
          gt(buzzLogs.createdAt, fiveSecondsAgo)
        )
      )
      .limit(1);

    if (recentBuzz.length > 0) {
      return res.status(429).json({ error: "Too many buzzes! Wait a moment." });
    }

    // 2.5 Validation: Check if a connection exists and is accepted
    const connection = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.status, 'accepted'),
          or(
            and(eq(connections.senderId, senderId), eq(connections.receiverId, receiverId)),
            and(eq(connections.senderId, receiverId), eq(connections.receiverId, senderId))
          )
        )
      )
      .limit(1);

    if (connection.length === 0) {
      return res.status(403).json({ 
        error: "No connection found. You must be connected to buzz this user." 
      });
    }
    // 3. Log the Buzz in Neon/Postgres
    await db.insert(buzzLogs).values({
      senderId,
      receiverId,
    });

    // 4. Trigger Real-time logic using the helper
    const triggerBuzz = typeof req.triggerExternalBuzz === 'function'
      ? req.triggerExternalBuzz
      : req.app.locals.triggerExternalBuzz;

    if (typeof triggerBuzz === 'function') {
      triggerBuzz(senderId, receiverId);
    } else {
      console.error("WS helper not initialized");
    }

    return res.status(200).json({ success: true, message: "Buzzed!" });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/buzz/history
buzzRouter.get("/history", async (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId || Number.isNaN(userId)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const history = await db
    .select()
    .from(buzzLogs)
    .where(eq(buzzLogs.receiverId, userId))
    .orderBy(desc(buzzLogs.createdAt))
    .limit(20);

  res.json(history);
});

export default buzzRouter;