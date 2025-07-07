import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { createTelegramBot } from './bot/telegram-bot.js';
import { setupGameSocketHandlers } from './game/socket-handlers.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Configure CORS for Socket.IO and Express
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Setup game socket handlers
setupGameSocketHandlers(io);

// Create and start Telegram bot
const bot = createTelegramBot(process.env.BOT_TOKEN, process.env.MINI_APP_URL);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Game endpoint for Mini App
app.get('/game', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/game.html'));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🎮 Game available at http://localhost:${PORT}/game`);
  
  // Start the bot
  if (process.env.NODE_ENV === 'production') {
    // Use webhooks in production
    bot.launch({
      webhook: {
        domain: process.env.WEBHOOK_URL,
        port: PORT
      }
    });
  } else {
    // Use polling in development
    bot.launch();
  }
  
  console.log('🤖 Telegram bot started');
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Stopping bot...');
  bot.stop('SIGINT');
  server.close();
});

process.once('SIGTERM', () => {
  console.log('🛑 Stopping bot...');
  bot.stop('SIGTERM');
  server.close();
}); 