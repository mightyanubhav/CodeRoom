import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// ─── HTTP middleware — for Express routes ─────────────────────────────────────
// Same as your Node.js JWT middleware you already know

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// ─── Socket.io middleware — for WebSocket connections ─────────────────────────
// Runs once when client first connects via socket.io
// Same concept as above but for WebSocket handshake

export const verifySocketToken = (socket, next) => {

    // Check auth object first (correct way)
    let token = socket.handshake.auth?.token;

    // Fallback — check headers (Postman sends it here)
    if (!token) {
        token = socket.handshake.headers?.token;
    }

    if (!token) {
        return next(new Error('No token provided'));
    }

    const rawToken = token.startsWith('Bearer ') ? token.substring(7) : token;

    try {
        const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
        socket.userId = decoded.sub;
        socket.userEmail = decoded.email;
        socket.userRole = decoded.role;
        next();
    } catch (err) {
        return next(new Error('Invalid or expired token'));
    }
};