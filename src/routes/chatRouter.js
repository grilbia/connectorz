import express from "express";
import { db } from "../db/db.js";
import { messages, connections } from "../db/schema.js";
import { SendMessageSchema } from "../validations/chat.js";
import { eq, and, or, desc } from "drizzle-orm";
import { z } from "zod";
import { sendMessageService } from "../services/chatService.js";

const chatRouter = express.Router();
const getSenderId = () => 1; // Testing Mock

chatRouter.post("/send", async (req, res) => {
    try {
        const { receiverId, content } = SendMessageSchema.parse(req.body);
        const senderId = getSenderId();

        if (senderId === receiverId) {
            return res.status(400).json({ error: "You cannot message yourself." });
        }

        // 1. Connection Validation
        const connection = await db.select().from(connections).where(
            and(
                eq(connections.status, "accepted"),
                or(
                    and(eq(connections.senderId, senderId), eq(connections.receiverId, receiverId)),
                    and(eq(connections.senderId, receiverId), eq(connections.receiverId, senderId))
                )
            )
        ).limit(1);

        if (connection.length === 0) {
            return res.status(403).json({ error: "No connection found." });
        }

        // 2. Use the Service
        // We pass the onlineUsers map from the app locals
        const result = await sendMessageService({
            senderId,
            receiverId,
            content,
            onlineUsers: req.app.locals.onlineUsers, 
            sendJson: req.app.locals.sendJson 
        });

        return res.status(200).json({ success: true, ...result });

    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

chatRouter.get("/history/:friendId", async (req, res) => {
    const senderId = getSenderId();
    const friendId = Number(req.params.friendId);
    const history = await db.select().from(messages).where(
        or(
            and(eq(messages.senderId, senderId), eq(messages.receiverId, friendId)),
            and(eq(messages.senderId, friendId), eq(messages.receiverId, senderId))
        )
    ).orderBy(desc(messages.createdAt)).limit(50);
    res.json(history);
});

export default chatRouter;