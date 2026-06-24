import axios from "axios";
import {
  getRoomState,
  setRoomState,
  publishToRoom,
} from "../services/redisService.js";
import dotenv from "dotenv";
dotenv.config();

const SPRING_URL = process.env.SPRING_BOOT_URL;

// ─── Editor Handler ───────────────────────────────────────────────────────────
// Handles all real-time code editor events
// Called once per socket connection from index.js

export const editorHandler = (io, socket) => {
  // ─── Code Change ──────────────────────────────────────────────────────────
  // Fires every time a user types in Monaco editor
  // Client emits: socket.emit('editor:code_change', { roomId, code, delta })

  socket.on("editor:code_change", async ({ roomId, code, delta }) => {
    try {
      // 1. Update Redis with latest code snapshot
      const roomState = await getRoomState(roomId);
      if (roomState) {
        roomState.currentCode = code;
        await setRoomState(roomId, roomState);
      }

      // 2. Broadcast delta to everyone EXCEPT the sender
      // Delta = just the change, not the full code — efficient
      socket.to(roomId).emit("editor:code_changed", {
        code,
        delta,
        userId: socket.userId,
      });

      // 3. Publish to other relay pods
      await publishToRoom(roomId, "editor:code_changed", {
        code,
        delta,
        userId: socket.userId,
      });
    } catch (err) {
      console.error("editor:code_change error:", err.message);
    }
  });

  // ─── Cursor Position ──────────────────────────────────────────────────────
  // Fires when user moves cursor in Monaco editor
  // Client emits: socket.emit('editor:cursor_move', { roomId, position })
  // position = { lineNumber: 5, column: 12 }

  socket.on("editor:cursor_move", async ({ roomId, position }) => {
    try {
      // Broadcast cursor position to everyone except sender
      socket.to(roomId).emit("editor:cursor_moved", {
        userId: socket.userId,
        email: socket.userEmail,
        position,
      });
    } catch (err) {
      console.error("editor:cursor_move error:", err.message);
    }
  });

  // ─── Run Code ─────────────────────────────────────────────────────────────
  // Client emits: socket.emit('editor:run_code', { roomId, code, language, questionId })

  socket.on(
    "editor:run_code",
    async ({ roomId, code, language, questionId }) => {
      try {
        // 1. Tell everyone code is running
        io.to(roomId).emit("editor:execution_started", {
          userId: socket.userId,
        });

        // 2. Send to Spring Boot execution service
        // For now — placeholder, execution service comes later
        const getRawToken = (socket) => {
          const token =
            socket.handshake.headers.token ||
            socket.handshake.auth?.token ||
            "";
          return token.startsWith("Bearer ") ? token.substring(7) : token;
        };

        const response = await axios.post(
          `${SPRING_URL}/api/execute`,
          { code, language, questionId, roomId },
          {
            headers: {
              Authorization: `Bearer ${getRawToken(socket)}`,
            },
            timeout: 30000,
          },
        );

        // 3. Broadcast result to everyone in room
        io.to(roomId).emit("editor:execution_result", {
          stdout: response.data.stdout,
          stderr: response.data.stderr,
          passed: response.data.passed,
          results: response.data.results,
        });
      } catch (err) {
        // Execution service not built yet — send mock result
        io.to(roomId).emit("editor:execution_result", {
          stdout: "",
          stderr: "Execution service not available yet",
          passed: false,
          results: [],
        });
      }
    },
  );

  // ─── Auto Save ────────────────────────────────────────────────────────────
  // Fires every 10 seconds from React client
  // Client emits: socket.emit('editor:auto_save', { roomId, code, language })

  socket.on("editor:auto_save", async ({ roomId, code, language }) => {
    try {
      // Sync to Spring Boot — persists to Neon DB
      await axios.post(`${SPRING_URL}/api/rooms/${roomId}/sync`, {
        currentCode: code,
        language,
      });

      // Confirm save to sender only
      socket.emit("editor:saved", {
        savedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("editor:auto_save error:", err.message);
    }
  });

  // ─── Load Question ────────────────────────────────────────────────────────
  // Interviewer loads a question into the room
  // Client emits: socket.emit('editor:load_question', { roomId, questionId })

  socket.on("editor:load_question", async ({ roomId, questionId }) => {
    try {
      if (socket.userRole !== "INTERVIEWER") {
        socket.emit("room:error", {
          message: "Only interviewer can load questions",
        });
        return;
      }

      // Tell Spring Boot to load question into room
      const response = await axios.post(
        `${SPRING_URL}/api/rooms/${roomId}/question/${questionId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${socket.handshake.headers.token || socket.handshake.auth?.token || ""}`,
          },
        },
      );

      // Update Redis with starter code
      const roomState = await getRoomState(roomId);
      if (roomState) {
        roomState.currentCode = response.data.starterCode || "";
        roomState.questionId = questionId;
        await setRoomState(roomId, roomState);
      }

      // Broadcast question to everyone in room
      io.to(roomId).emit("editor:question_loaded", {
        questionId: response.data.questionId,
        questionTitle: response.data.questionTitle,
        starterCode: response.data.starterCode,
        language: response.data.language,
      });

      // Publish to other pods
      await publishToRoom(roomId, "editor:question_loaded", {
        questionId,
        starterCode: response.data.starterCode,
      });
    } catch (err) {
      console.error("editor:load_question error:", err.message);
      socket.emit("room:error", { message: "Failed to load question" });
    }
  });
};
