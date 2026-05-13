import { db } from "../db/db.js";
import { messages } from "../db/schema.js";

/**
 * Shared logic to save a message and notify the receiver
 */
export async function sendMessageService({ senderId, receiverId, content, onlineUsers, sendJson, tempId = null }) {
    // 1. Persist to Database
    const [savedMsg] = await db.insert(messages).values({
        senderId: Number(senderId),
        receiverId: Number(receiverId),
        content: content,
        newColumn: "hi"
    }).returning();

    const targetSocket = onlineUsers?.get(String(receiverId));

    // 2. Real-time Delivery
    if (targetSocket) {
        sendJson(targetSocket, {
            type: 'receive_message',
            ...savedMsg,
            tempId
        });
        return { status: 'delivered', data: savedMsg };
    }

    return { status: 'sent_offline', data: savedMsg };
}