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

const getRawToken = (socket) => {
  const token =
    socket.handshake.headers.token || socket.handshake.auth?.token || "";
  return token.startsWith("Bearer ") ? token.substring(7) : token;
};

export const roomHandler = (io, socket) => {
  socket.on("room:join", async ({ roomId }) => {
    try {
      // 1. Fetch room from Spring Boot — source of truth
      const response = await axios.get(`${SPRING_URL}/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${getRawToken(socket)}` },
      });

      const roomData = response.data;

      // 2. Check room status
      if (roomData.status === "CLOSED") {
        socket.emit("room:error", { message: "This interview has ended" });
        return;
      }

      // Check interview status — covers COMPLETED/REVIEWED/CANCELLED
      if (
        roomData.interviewStatus === "COMPLETED" ||
        roomData.interviewStatus === "REVIEWED" ||
        roomData.interviewStatus === "CANCELLED"
      ) {
        socket.emit("room:error", { message: "This interview has ended" });
        return;
      }

      // 3. Check if user already in Redis
      const participants = await getParticipants(roomId);
      const alreadyInRoom = participants.hasOwnProperty(socket.userId);

      if (!alreadyInRoom) {
        // Use maxParticipants from Spring Boot — dynamic for panel interviews
        const maxParticipants = roomData.maxParticipants || 2;
        if (roomData.participantCount >= maxParticipants) {
          const redisCount = await getParticipantCount(roomId);
          if (redisCount < roomData.participantCount) {
            console.log(
              `🔄 Stale Spring Boot count — resetting room ${roomId}`,
            );
            try {
              await axios.post(`${SPRING_URL}/api/rooms/${roomId}/reset`);
            } catch (resetErr) {
              console.error("Reset failed:", resetErr.message);
            }
          } else {
            socket.emit("room:error", { message: "Room is full" });
            return;
          }
        }
      }

      // 5. Join Socket.io room
      socket.join(roomId);
      socket.roomId = roomId;

      // 6. Track in Redis
      await addParticipant(roomId, socket.userId, socket.id);

      // 7. Get or initialize room state
      let roomState = await getRoomState(roomId);
      if (!roomState) {
        roomState = {
          roomId,
          currentCode: roomData.currentCode || "",
          language: roomData.language || "JAVASCRIPT",
          status: roomData.status,
          participants: {},
        };
        await setRoomState(roomId, roomState);
      }

      // 8. Only increment Spring Boot count if NEW participant
      if (!alreadyInRoom) {
        await axios.post(
          `${SPRING_URL}/api/rooms/${roomId}/joined`,
          {},
          { headers: { Authorization: `Bearer ${getRawToken(socket)}` } },
        );
      }

      // 9. Subscribe to Redis Pub/Sub
      await subscribeToRoom(roomId, (event, data) => {
        io.to(roomId).emit(event, data);
      });

      // 10. Send room state to joining user
      socket.emit("room:state", roomState);

      // 10b. Notify joining user about pre-existing participants so their
      //      VideoPanel can render role labels immediately (no ROOM_USER_JOINED
      //      fires for users who were already in the room).
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        roomSockets.forEach((socketId) => {
          if (socketId !== socket.id) {
            const existingSocket = io.sockets.sockets.get(socketId);
            if (existingSocket) {
              socket.emit("room:user_joined", {
                userId: existingSocket.userId,
                email: existingSocket.userEmail,
                role: existingSocket.userRole,
                isExisting: true,
              });
            }
          }
        });
      }

      // 11. Notify everyone else only if new participant
      if (!alreadyInRoom) {
        socket.to(roomId).emit("room:user_joined", {
          userId: socket.userId,
          email: socket.userEmail,
          role: socket.userRole,
        });
      }

      console.log(`✅ ${socket.userEmail} joined room ${roomId}`);
    } catch (err) {
      console.error("room:join error:", err.message);
      console.error("room:join full error:", err.response?.data || err.stack);
      socket.emit("room:error", { message: "Failed to join room" });
    }
  });

  socket.on("room:leave", async ({ roomId }) => {
    await handleLeaveRoom(io, socket, roomId);
  });

  socket.on("disconnect", async () => {
    if (socket.roomId) {
      await handleLeaveRoom(io, socket, socket.roomId);
    }
    console.log(`🔌 ${socket.userEmail} disconnected`);
  });

  socket.on("room:get_state", async ({ roomId }) => {
    try {
      const roomState = await getRoomState(roomId);
      socket.emit("room:state", roomState);
    } catch (err) {
      socket.emit("room:error", { message: "Failed to get room state" });
    }
  });

  socket.on("room:language_change", async ({ roomId, language, code }) => {
    try {
      const roomState = await getRoomState(roomId);
      if (roomState) {
        roomState.language = language;
        // Update code atomically with language to prevent race condition where
        // a concurrent editor:code_change read overwrites the new language.
        if (code !== undefined) {
          roomState.currentCode = code;
        }
        await setRoomState(roomId, roomState);
      }

      // Persist immediately to Spring Boot/DB — don't wait for the next
      // 10s auto-save cycle, otherwise a refresh right after switching
      // languages loses the change and falls back to the DB default.
      try {
        const syncPayload = { language };
        if (code !== undefined) syncPayload.currentCode = code;
        await axios.post(`${SPRING_URL}/api/rooms/${roomId}/sync`, syncPayload);
      } catch (syncErr) {
        console.error("Language DB sync failed:", syncErr.message);
      }

      io.to(roomId).emit("room:language_changed", { language, code });
      await publishToRoom(roomId, "room:language_changed", { language, code });
    } catch (err) {
      socket.emit("room:error", { message: "Failed to change language" });
    }
  });

  socket.on("room:close", async ({ roomId }) => {
    try {
      if (socket.userRole !== "INTERVIEWER") {
        socket.emit("room:error", {
          message: "Only interviewer can close room",
        });
        return;
      }

      await axios.post(
        `${SPRING_URL}/api/rooms/${roomId}/close`,
        {},
        { headers: { Authorization: `Bearer ${getRawToken(socket)}` } },
      );

      io.to(roomId).emit("room:closed", { message: "Interview has ended" });

      const roomState = await getRoomState(roomId);
      if (roomState) {
        roomState.status = "CLOSED";
        await setRoomState(roomId, roomState);
      } else {
        await setRoomState(roomId, { roomId, status: "CLOSED" });
      }

      setTimeout(async () => {
        await deleteRoomState(roomId);
        await unsubscribeFromRoom(roomId);
      }, 60000);

      console.log(`🔒 Room ${roomId} closed`);
    } catch (err) {
      console.error("room:close error:", err.message);
      socket.emit("room:error", { message: "Failed to close room" });
    }
  });
};

const handleLeaveRoom = async (io, socket, roomId) => {
  try {
    socket.leave(roomId);
    await removeParticipant(roomId, socket.userId);

    // No auth header — endpoint is public
    try {
      await axios.post(`${SPRING_URL}/api/rooms/${roomId}/left`, {});
    } catch (springErr) {
      console.error(`❌ Spring Boot /left failed:`, springErr.message);
    }

    socket.to(roomId).emit("room:user_left", {
      userId: socket.userId,
      email: socket.userEmail,
    });

    const remaining = await getParticipantCount(roomId);
    if (remaining === 0) {
      // Grace period: a page refresh disconnects then immediately reconnects.
      // Wait 20s before cleaning up so a quick refresh doesn't wipe language/code.
      setTimeout(async () => {
        const stillEmpty = await getParticipantCount(roomId);
        if (stillEmpty === 0) {
          await deleteRoomState(roomId);
          await unsubscribeFromRoom(roomId);
          console.log(`🗑️ Room ${roomId} cleaned up`);
        }
      }, 20000);
    }

    console.log(`👋 ${socket.userEmail} left room ${roomId}`);
  } catch (err) {
    console.error("handleLeaveRoom error:", err.message);
  }
};
