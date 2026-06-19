import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifySocketToken } from './middleware/authMiddleware.js';
import { roomHandler } from './handlers/roomHandler.js';
import { editorHandler } from './handlers/editorHandler.js';
import { webrtcHandler } from './handlers/webrtcHandler.js'; 

dotenv.config();

// ─── Express + HTTP Server ────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Health check — Spring Boot and Docker will ping this
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'coderoom-relay',
        timestamp: new Date().toISOString()
    });
});

const httpServer = createServer(app);

// ─── Socket.io Server ─────────────────────────────────────────────────────────

const io = new Server(httpServer, {
    cors: {
        origin: [
            'http://localhost:5173',        // Vite dev server
            'http://localhost:3000',        // fallback
            'https://coderoom.vercel.app'   // production later
        ],
        methods: ['GET', 'POST'],
        credentials: true
    },
    // Reconnection settings
    pingTimeout: 60000,
    pingInterval: 25000
});

// ─── Socket.io Middleware ─────────────────────────────────────────────────────
// Runs on every new WebSocket connection before any event handlers

io.use(verifySocketToken);

// ─── Socket.io Connection Handler ────────────────────────────────────────────

io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.userEmail} (${socket.userRole}) — socket: ${socket.id}`);

    // Register all handlers for this socket
    roomHandler(io, socket);
    editorHandler(io, socket);
    webrtcHandler(io, socket);
    // ─── Ping/Pong — keep connection alive ───────────────────────────────────
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
    });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
    console.log(`
🚀 CodeRoom Relay running on port ${PORT}
📡 WebSocket ready
🔴 Redis connecting...
    `);
});