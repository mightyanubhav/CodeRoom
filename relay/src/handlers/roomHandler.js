import axios from "axios";
import {
  setRoomState,
  getRoomState,
  deleteRoomState,
  addParticipant,
  removeParticipant,
  getParticipants,
  getParticipantCount,
  publishToRoom,
  subscribeToRoom,
  unsubscribeFromRoom,
} from "../services/redisService.js";
import dotenv from "dotenv";
dotenv.config();

const SPRING_URL = process.env.SPRING_BOOT_URL;

// Strip "Bearer " prefix if present — token stored on socket already has it
const getRawToken = (socket) => {
  const token =
    socket.handshake.headers.token || socket.handshake.auth?.token || "";
  return token.startsWith("Bearer ") ? token.substring(7) : token;
};

// ─── Room Handler ─────────────────────────────────────────────────────────────
// Called once per socket connection from index.js
// All room-related socket events are registered here

export const roomHandler = (io, socket) => {
  // ─── Join Room ────────────────────────────────────────────────────────────
  // Client emits: socket.emit('room:join', { roomId })

  socket.on("room:join", async ({ roomId }) => {
    try {
      // 1. Check participant count — max 2 allowed
      const count = await getParticipantCount(roomId);
      if (count >= 2) {
        socket.emit("room:error", { message: "Room is full" });
        return;
      }

      // 2. Join Socket.io room — all sockets in same room get broadcasts
      socket.join(roomId);
      socket.roomId = roomId; // store on socket for disconnect cleanup

      // 3. Track participant in Redis
      await addParticipant(roomId, socket.userId, socket.id);

      // 4. Get or initialize room state from Redis
      let roomState = await getRoomState(roomId);
      if (!roomState) {
        // First person joining — fetch from Spring Boot
        const response = await axios.get(`${SPRING_URL}/api/rooms/${roomId}`, {
          headers: {
            Authorization: `Bearer ${getRawToken(socket)}`,
          },
        });
        roomState = {
          roomId,
          currentCode: response.data.currentCode || "",
          language: response.data.language || "JAVASCRIPT",
          participants: {},
        };
        await setRoomState(roomId, roomState);
      }

      // 5. Tell Spring Boot a participant joined
      await axios.post(
        `${SPRING_URL}/api/rooms/${roomId}/joined`,
        {},
        {
          headers: {
            Authorization: `Bearer ${getRawToken(socket)}`,
          },
        },
      );

      // 6. Subscribe to Redis Pub/Sub for this room
      // When another relay pod publishes — this pod receives and broadcasts
      await subscribeToRoom(roomId, (event, data) => {
        io.to(roomId).emit(event, data);
      });

      // 7. Send current room state to the joining user
      socket.emit("room:state", roomState);

      // 8. Notify everyone else in the room
      socket.to(roomId).emit("room:user_joined", {
        userId: socket.userId,
        email: socket.userEmail,
        role: socket.userRole,
      });

      console.log(`✅ ${socket.userEmail} joined room ${roomId}`);
    } catch (err) {
      console.error("room:join error:", err.message);
      socket.emit("room:error", { message: "Failed to join room" });
    }
  });

  // ─── Leave Room ───────────────────────────────────────────────────────────
  // Client emits: socket.emit('room:leave', { roomId })

  socket.on("room:leave", async ({ roomId }) => {
    await handleLeaveRoom(io, socket, roomId);
  });

  // ─── Disconnect — browser closed or network lost ──────────────────────────
  // Automatically fired by Socket.io

  socket.on("disconnect", async () => {
    if (socket.roomId) {
      await handleLeaveRoom(io, socket, socket.roomId);
    }
    console.log(`🔌 ${socket.userEmail} disconnected`);
  });

  // ─── Get Room State ───────────────────────────────────────────────────────

  socket.on("room:get_state", async ({ roomId }) => {
    try {
      const roomState = await getRoomState(roomId);
      socket.emit("room:state", roomState);
    } catch (err) {
      socket.emit("room:error", { message: "Failed to get room state" });
    }
  });

  // ─── Change Language ──────────────────────────────────────────────────────
  // Client emits: socket.emit('room:language_change', { roomId, language })

  socket.on("room:language_change", async ({ roomId, language }) => {
    try {
      // Update Redis
      const roomState = await getRoomState(roomId);
      if (roomState) {
        roomState.language = language;
        await setRoomState(roomId, roomState);
      }

      // Broadcast to everyone in room including sender
      io.to(roomId).emit("room:language_changed", { language });

      // Publish to other relay pods
      await publishToRoom(roomId, "room:language_changed", { language });
    } catch (err) {
      socket.emit("room:error", { message: "Failed to change language" });
    }
  });

  // ─── Close Room (interviewer ends session) ────────────────────────────────

  socket.on("room:close", async ({ roomId }) => {
    try {
      if (socket.userRole !== "INTERVIEWER") {
        socket.emit("room:error", {
          message: "Only interviewer can close room",
        });
        return;
      }

      // Tell Spring Boot to close the room
      await axios.post(
        `${SPRING_URL}/api/rooms/${roomId}/close`,
        {},
        {
          headers: { Authorization: `Bearer ${socket.handshake.auth.token}` },
        },
      );

      // Notify all participants
      io.to(roomId).emit("room:closed", {
        message: "Interview has ended",
      });

      // Cleanup Redis
      await deleteRoomState(roomId);
      await unsubscribeFromRoom(roomId);

      console.log(`🔒 Room ${roomId} closed`);
    } catch (err) {
      socket.emit("room:error", { message: "Failed to close room" });
    }
  });
};

// ─── Shared leave room logic ──────────────────────────────────────────────────

const handleLeaveRoom = async (io, socket, roomId) => {
  try {
    // 1. Leave Socket.io room
    socket.leave(roomId);

    // 2. Remove from Redis participant tracking
    await removeParticipant(roomId, socket.userId);

    // 3. Tell Spring Boot participant left
    await axios.post(
      `${SPRING_URL}/api/rooms/${roomId}/left`,
      {},
      {
        headers: {
          Authorization: `Bearer ${getRawToken(socket)}`,
        },
      },
    );

    // 4. Notify remaining participants
    socket.to(roomId).emit("room:user_left", {
      userId: socket.userId,
      email: socket.userEmail,
    });

    // 5. If no participants left — cleanup
    const remaining = await getParticipantCount(roomId);
    if (remaining === 0) {
      await deleteRoomState(roomId);
      await unsubscribeFromRoom(roomId);
      console.log(`🗑️ Room ${roomId} cleaned up — no participants`);
    }

    console.log(`👋 ${socket.userEmail} left room ${roomId}`);
  } catch (err) {
    console.error("handleLeaveRoom error:", err.message);
  }
};
