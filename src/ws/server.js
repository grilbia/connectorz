import { WebSocket, WebSocketServer } from "ws";
import { db } from "../db/db.js";
import { buzzLogs } from "../db/schema.js";
import url from 'url';
import { sendMessageService } from "../services/chatService.js";

const onlineUsers = new Map();

function sendJson(socket, payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
}

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024
    });

    wss.on('connection', async (socket, req) => {
        const parameters = url.parse(req.url, true).query;
        const userId = parameters.userId;

        if (!userId) {
            socket.close(1008, "User ID required");
            return;
        }

        socket.userId = userId;
        socket.isAlive = true;
        onlineUsers.set(String(userId), socket);
        console.log(`📡 User ${userId} connected`);

        socket.on('pong', () => { socket.isAlive = true; });

        // --- Message Handling ---
        socket.on('message', async (raw) => {
            try {
                const messageString = raw.toString();
                console.log(`📩 Received from ${userId}: ${messageString}`);

                let data;
                try {
                    data = JSON.parse(messageString);
                } catch (e) {
                    sendJson(socket, { type: 'error', message: 'Invalid JSON format' });
                    return;
                }

                // Handle Buzz
                if (data.type === 'send_buzz') {
                    try {
                        // 1. Persist to database
                        await db.insert(buzzLogs).values({
                            senderId: Number(userId), // Ensure it's a number
                            receiverId: Number(data.receiverId),
                        });

                        // 2. Trigger the real-time relay to the receiver
                        handleBuzz(userId, data.receiverId);

                        // 3. Send Success Acknowledge to the SENDER
                        sendJson(socket, {
                            type: 'buzz_ack',
                            status: 'success',
                            receiverId: data.receiverId,
                            message: "Buzzed successfully!"
                        });

                    } catch (e) {
                        console.error("Database error during buzz:", e);

                        // 4. Send Error Acknowledge to the SENDER
                        sendJson(socket, {
                            type: 'buzz_ack',
                            status: 'error',
                            message: "Failed to log buzz in database."
                        });
                    }
                }

                // Handle Chat Messages (using the service for persistence)
                else if (data.type === 'send_message') {
                    if (!data.receiverId || !data.content) {
                        sendJson(socket, { type: 'error', message: 'receiverId and content are required' });
                        return;
                    }

                    try {
                        const result = await sendMessageService({
                            senderId: userId,
                            receiverId: data.receiverId,
                            content: data.content,
                            tempId: data.tempId,
                            onlineUsers,
                            sendJson
                        });

                        sendJson(socket, { 
                            type: 'message_ack', 
                            tempId: data.tempId, 
                            status: result.status 
                        });
                    } catch (serviceErr) {
                        console.error("❌ Service Error:", serviceErr);
                        sendJson(socket, { type: 'error', message: serviceErr.message || 'Failed to send message' });
                    }
                } else {
                    sendJson(socket, { type: 'error', message: `Unknown message type: ${data.type}` });
                }
            } catch (err) {
                console.error("❌ WS Processing Error:", err.message);
                sendJson(socket, { type: 'error', message: 'Internal server error during processing' });
            }
        });

        socket.on('close', () => {
            onlineUsers.delete(String(userId));
            console.log(`🔌 User ${userId} disconnected`);
        });

        sendJson(socket, { type: 'welcome', message: 'Connected to Server' });
    });

    // Heartbeat
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    /**
     * Internal Buzz Logic
     */
    function handleBuzz(senderId, receiverId) {
        const targetSocket = onlineUsers.get(String(receiverId));
        if (targetSocket) {
            sendJson(targetSocket, {
                type: 'buzz_received',
                from: senderId,
                timestamp: new Date().toISOString()
            });
            console.log(`⚡ Buzz: ${senderId} -> ${receiverId}`);
        } else {
            console.log(`🔕 User ${receiverId} offline. (FCM Trigger Point)`);
        }
    }

    /**
     * HELPERS FOR REST API (app.locals)
     */
    return {
        onlineUsers,
        sendJson,
        triggerExternalBuzz: (senderId, receiverId) => {
            handleBuzz(senderId, receiverId);
        },
        triggerExternalMessage: async (senderId, receiverId, content) => {
            // Using the service ensures REST messages are also saved to DB
            return await sendMessageService({
                senderId,
                receiverId,
                content,
                onlineUsers,
                sendJson
            });
        }
    };
}