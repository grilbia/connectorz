import express from 'express';
import http from 'http';
import buzzRouter from './routes/buzzRouter.js';
import { attachWebSocketServer } from './ws/server.js';

const app = express();
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '192.168.1.5';
const server = http.createServer(app);

// Use JSON middleware
app.use(express.json());

const { triggerExternalBuzz } = attachWebSocketServer(server);

app.use((req, res, next) => {
  req.triggerExternalBuzz = triggerExternalBuzz;
  next();
});


app.use('/api/buzz' ,buzzRouter);

// Root GET route
app.get('/', (req, res) => {
  res.send('Hello, this is a simple Express.js server.!');
});

server.listen(PORT,HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`WebSocket Server is running on ${baseUrl.replace('http', 'ws')}/ws`); 
});