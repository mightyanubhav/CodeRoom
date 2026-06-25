import { io } from "socket.io-client";
import { RELAY_URL, SOCKET_EVENTS } from "../utils/constants.js";

let socket = null;
let currentToken = null; // ← track token separately

export const initSocket = (token) => {
    // Same token + connected → return existing socket
    if (socket?.connected && currentToken === token) {
        return socket;
    }

    // Token changed or disconnected → create new socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    currentToken = token;

    socket = io(RELAY_URL, {
        auth: { token: `Bearer ${token}` },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
    });

    socket.on("connect", () => {
        console.log("✅ Socket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
        console.log("🔌 Socket disconnected:", reason);
        // Clear token tracking on disconnect
        if (reason === 'io server disconnect') {
            currentToken = null;
        }
    });

    socket.on("connect_error", (err) => {
        console.error("❌ Socket connection error:", err.message);
    });

    socket.on(SOCKET_EVENTS.ROOM_ERROR, (data) => {
        console.error("❌ Room error:", data.message);
    });

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        currentToken = null;
    }
};

export const joinRoom = (roomId) => {
    socket?.emit(SOCKET_EVENTS.ROOM_JOIN, { roomId });
};

export const leaveRoom = (roomId) => {
    socket?.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId });
};

export const changeLanguage = (roomId, language) => {
    socket?.emit(SOCKET_EVENTS.ROOM_LANGUAGE_CHANGE, { roomId, language });
};

export const closeRoom = (roomId) => {
    socket?.emit(SOCKET_EVENTS.ROOM_CLOSE, { roomId });
};

export const sendCodeChange = (roomId, code, delta) => {
    socket?.emit(SOCKET_EVENTS.EDITOR_CODE_CHANGE, { roomId, code, delta });
};

export const sendCursorMove = (roomId, position) => {
    socket?.emit(SOCKET_EVENTS.EDITOR_CURSOR_MOVE, { roomId, position });
};

export const runCode = (roomId, code, language, questionId) => {
    socket?.emit(SOCKET_EVENTS.EDITOR_RUN_CODE, { roomId, code, language, questionId });
};

export const autoSave = (roomId, code, language) => {
    socket?.emit(SOCKET_EVENTS.EDITOR_AUTO_SAVE, { roomId, code, language });
};

export const loadQuestion = (roomId, questionId) => {
    socket?.emit(SOCKET_EVENTS.EDITOR_LOAD_QUESTION, { roomId, questionId });
};

export const sendOffer = (roomId, offer, targetUserId) => {
    socket?.emit(SOCKET_EVENTS.WEBRTC_OFFER, { roomId, offer, targetUserId });
};

export const sendAnswer = (roomId, answer, targetUserId) => {
    socket?.emit(SOCKET_EVENTS.WEBRTC_ANSWER, { roomId, answer, targetUserId });
};

export const sendIceCandidate = (roomId, candidate, targetUserId) => {
    socket?.emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, { roomId, candidate, targetUserId });
};

export const endCall = (roomId) => {
    socket?.emit(SOCKET_EVENTS.WEBRTC_CALL_END, { roomId });
};