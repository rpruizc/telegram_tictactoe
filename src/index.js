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

// Debug environment variables
console.log('🔍 Environment variables check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'SET' : 'NOT SET');
console.log('MINI_APP_URL:', process.env.MINI_APP_URL ? 'SET' : 'NOT SET');
console.log('WEBHOOK_URL:', process.env.WEBHOOK_URL ? 'SET' : 'NOT SET');

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
  if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
    // Use webhooks in production when webhook URL is available
    console.log('🔗 Starting bot with webhook:', process.env.WEBHOOK_URL);
    bot.launch({
      webhook: {
        domain: process.env.WEBHOOK_URL,
        port: PORT
      }
    });
  } else {
    // Use polling in development or when webhook URL is not set
    console.log('🔄 Starting bot with polling (no webhook URL set)');
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