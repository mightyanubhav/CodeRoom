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
      // 1. Fetch room from Spring Boot — source of truth
      const response = await axios.get(`${SPRING_URL}/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${getRawToken(socket)}` },
      });

      const roomData = response.data;

      // 2. Check room status first
      if (roomData.status === "CLOSED" || roomData.status === "COMPLETED") {
        socket.emit("room:error", { message: "This interview has ended" });
        return;
      }

      // 3. Check if this user is already tracked in Redis
      const participants = await getParticipants(roomId);
      const alreadyInRoom = participants.hasOwnProperty(socket.userId);

      if (!alreadyInRoom) {
        // 4. Check capacity using Spring Boot count
        if (roomData.participantCount >= 2) {
          socket.emit("room:error", { message: "Room is full" });
          return;
        }
      }

      // 5. Join Socket.io room
      socket.join(roomId);
      socket.roomId = roomId;

      // 6. Track in Redis — update socketId even if already exists
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

  // socket.on("room:close", async ({ roomId }) => {
  //   try {
  //     if (socket.userRole !== "INTERVIEWER") {
  //       socket.emit("room:error", {
  //         message: "Only interviewer can close room",
  //       });
  //       return;
  //     }

  //     // Tell Spring Boot to close the room
  //     // await axios.post(
  //     //   `${SPRING_URL}/api/rooms/${roomId}/close`,
  //     //   {},
  //     //   {
  //     //     headers: { Authorization: `Bearer ${socket.handshake.auth.token}` },
  //     //   },
  //     // );
  //     await axios.post(
  //       `${SPRING_URL}/api/rooms/${roomId}/close`,
  //       {},
  //       {
  //         headers: { Authorization: `Bearer ${getRawToken(socket)}` },
  //       },
  //     );

  //     // Notify all participants
  //     io.to(roomId).emit("room:closed", {
  //       message: "Interview has ended",
  //     });

  //     // Cleanup Redis
  //     await deleteRoomState(roomId);
  //     await unsubscribeFromRoom(roomId);

  //     console.log(`🔒 Room ${roomId} closed`);
  //   } catch (err) {
  //     socket.emit("room:error", { message: "Failed to close room" });
  //   }
  // });
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
          headers: { Authorization: `Bearer ${getRawToken(socket)}` },
        },
      );

      // Notify all participants — candidate gets this and redirects
      io.to(roomId).emit("room:closed", {
        message: "Interview has ended",
      });

      // Mark as closed in Redis before deleting
      // So any reconnect attempts get blocked
      const roomState = await getRoomState(roomId);
      if (roomState) {
        roomState.status = "CLOSED";
        await setRoomState(roomId, roomState);
      }

      // Cleanup after short delay — give time for reconnects to be blocked
      setTimeout(async () => {
        await deleteRoomState(roomId);
        await unsubscribeFromRoom(roomId);
      }, 30000); // keep for 30 seconds then delete

      console.log(`🔒 Room ${roomId} closed`);
    } catch (err) {
      console.error("room:close error:", err.message);
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
