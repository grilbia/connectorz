import express from 'express';
import http from 'http';
import buzzRouter from './routes/buzzRouter.js';
import { attachWebSocketServer } from './ws/server.js';
import chatRouter from './routes/chatRouter.js';

const app = express();
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '192.168.1.8';
const server = http.createServer(app);

// Use JSON middleware
app.use(express.json());

const { triggerExternalBuzz, triggerExternalMessage, onlineUsers, sendJson } = attachWebSocketServer(server);

app.use((req, res, next) => {
  req.triggerExternalBuzz = triggerExternalBuzz;
  req.triggerExternalMessage = triggerExternalMessage;
  req.onlineUsers = onlineUsers;
  req.sendJson = sendJson;
  next();
});

app.locals.triggerExternalBuzz = triggerExternalBuzz;
app.locals.triggerExternalMessage = triggerExternalMessage;
app.locals.onlineUsers = onlineUsers;
app.locals.sendJson = sendJson;

app.use('/api/buzz', buzzRouter);
app.use('/api/chat', chatRouter);
// Root GET route
app.get('/', (req, res) => {
  res.send('Hello, this is a simple Express.js server.!');
});


server.listen(PORT,HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`WebSocket Server is running on ${baseUrl.replace('http', 'ws')}/ws`); 
});

