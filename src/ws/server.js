import { WebSocket, WebSocketServer } from "ws";
// import { wsArcjet } from "../arcjet.js"; // Keeping your security middleware
import url from 'url';

function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
}

// Memory store to map UserIDs to their active Sockets
const onlineUsers = new Map();

export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 1024 * 1024
    });

    wss.on('connection', async (socket, req) => {
        // 1. Extract UserID from URL params (e.g., ws://your-url/ws?userId=123)
        const parameters = url.parse(req.url, true).query;
        const userId = parameters.userId;

        if (!userId) {
            socket.close(1008, "User ID required");
            return;
        }

        // 2. Arcjet Security Check
        // if (wsArcjet) {
        //     try {
        //         const decision = await wsArcjet.protect(req);
        //         if (decision.isDenied()) {
        //             const code = decision.reason.isRateLimit() ? 1013 : 1008;
        //             socket.close(code, 'Access denied');
        //             return;
        //         }
        //     } catch (e) {
        //         console.error('WS upgrade protection error', e);
        //         socket.close(1011, 'Server security error');
        //         return;
        //     }
        // }

        // 3. Register User as Online
        socket.userId = userId;
        socket.isAlive = true;
        onlineUsers.set(userId, socket);
        console.log(`User ${userId} connected`);

        socket.on('pong', () => { socket.isAlive = true; });

        // 4. Handle Incoming Messages (e.g., Buzz requests via Socket)
        socket.on('message', (message) => {
            try {
                const payload = JSON.parse(message);
                
                if (payload.type === 'send_buzz') {
                    handleBuzz(userId, payload.receiverId);
                }
            } catch (err) {
                console.error("Invalid JSON received");
            }
        });

        // 5. Cleanup on Disconnect
        socket.on('close', () => {
            onlineUsers.delete(userId);
            console.log(`User ${userId} disconnected`);
        });

        sendJson(socket, { type: 'welcome', message: 'Connected to BuzzServer' });
    });

    // Heartbeat to clear broken connections
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    /**
     * Logic to send a buzz to a specific friend
     */
    function handleBuzz(senderId, receiverId) {
        const targetSocket = onlineUsers.get(receiverId.toString());

        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
            sendJson(targetSocket, {
                type: 'buzz_received',
                from: senderId,
                timestamp: new Date().toISOString()
            });
            console.log(`Buzz sent from ${senderId} to ${receiverId}`);
        } else {
            // Here you would trigger FCM (Firebase) for background push notifications
            console.log(`User ${receiverId} is offline. Triggering Push Notification...`);
        }
    }

    // Exported helper for your REST API to use
    function triggerExternalBuzz(senderId, receiverId) {
        handleBuzz(senderId, receiverId);
    }

    return { triggerExternalBuzz };
}