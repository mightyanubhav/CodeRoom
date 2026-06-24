import axios from "axios";
import {
  getRoomState,
  setRoomState,
  publishToRoom,
} from "../services/redisService.js";
import dotenv from "dotenv";
dotenv.config();

const SPRING_URL = process.env.SPRING_BOOT_URL;

const getRawToken = (socket) => {
  const token =
    socket.handshake.headers.token || socket.handshake.auth?.token || "";
  return token.startsWith("Bearer ") ? token.substring(7) : token;
};

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

        // 2. Build request body
        const requestBody = { code, language };
        if (questionId) requestBody.questionId = questionId;

        // 3. Call Spring Boot execution endpoint
        const response = await axios.post(
          `${SPRING_URL}/api/execute`,
          requestBody,
          {
            headers: {
              Authorization: `Bearer ${getRawToken(socket)}`,
            },
            timeout: 30000, // 30s timeout — execution can take time
          },
        );

        // 4. Broadcast result to BOTH users in room
        io.to(roomId).emit("editor:execution_result", {
          stdout: response.data.stdout,
          stderr: response.data.stderr,
          passed: response.data.passed,
          timedOut: response.data.timedOut,
          results: response.data.results,
          executionTimeMs: response.data.executionTimeMs,
        });

        console.log(
          `⚡ Code executed in room ${roomId} — ${language} — ${response.data.executionTimeMs}ms`,
        );
      } catch (err) {
        console.error("editor:run_code error:", err.message);
        io.to(roomId).emit("editor:execution_result", {
          stdout: "",
          stderr:
            err.response?.data?.error || "Execution failed: " + err.message,
          passed: false,
          timedOut: false,
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

      // Load question into room via Spring Boot
      const response = await axios.post(
        `${SPRING_URL}/api/rooms/${roomId}/question/${questionId}`,
        {},
        { headers: { Authorization: `Bearer ${getRawToken(socket)}` } },
      );

      // Fetch full question details
      const questionResponse = await axios.get(
        `${SPRING_URL}/api/questions/${questionId}`,
        { headers: { Authorization: `Bearer ${getRawToken(socket)}` } },
      );

      const questionData = {
        questionId: questionResponse.data.id,
        questionTitle: questionResponse.data.title,
        description: questionResponse.data.description,
        difficulty: questionResponse.data.difficulty,
        starterCode: questionResponse.data.starterCode,
        tags: questionResponse.data.tags,
      };

      // Update Redis
      const roomState = await getRoomState(roomId);
      if (roomState) {
        roomState.currentCode = questionData.starterCode || "";
        roomState.questionId = questionId;
        await setRoomState(roomId, roomState);
      }

      // Broadcast to everyone
      io.to(roomId).emit("editor:question_loaded", questionData);

      // Publish to other pods
      await publishToRoom(roomId, "editor:question_loaded", questionData);

      console.log(`📝 Question loaded: ${questionData.questionTitle}`);
    } catch (err) {
      console.error("editor:load_question error:", err.message);
      socket.emit("room:error", { message: "Failed to load question" });
    }
  });
};
