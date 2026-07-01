import axios from "axios";
import {
  getRoomState,
  setRoomState,
  publishToRoom,
} from "../services/redisService.js";
import dotenv from "dotenv";
dotenv.config();

const SPRING_URL = process.env.SPRING_BOOT_URL;

const STARTER_TEMPLATES = {
  PYTHON: () =>
    `import sys\n\ndef solution(data):\n    # Write your solution here\n    pass\n\ndata = sys.stdin.read().strip()\nprint(solution(data))\n`,

  JAVASCRIPT: () =>
    `const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nlet lines = [];\nrl.on('line', line => lines.push(line));\nrl.on('close', () => {\n    // lines[0], lines[1], ... contain your input\n    // Write your solution here\n    console.log(lines[0]);\n});\n`,

  JAVA: () =>
    `import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String input = sc.nextLine();\n        \n        // Write your solution here\n        System.out.println(input);\n    }\n}\n`,

  GO: () =>
    `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    input, _ := reader.ReadString('\\n')\n    \n    // Write your solution here\n    fmt.Println(input)\n}\n`,

  CPP: () =>
    `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string input;\n    getline(cin, input);\n    \n    // Write your solution here\n    cout << input << endl;\n    return 0;\n}\n`,
};

const getRawToken = (socket) => {
  const token =
    socket.handshake.headers.token || socket.handshake.auth?.token || "";
  return token.startsWith("Bearer ") ? token.substring(7) : token;
};

export const editorHandler = (io, socket) => {
  // ─── Code Change ──────────────────────────────────────────────────────────
  socket.on("editor:code_change", async ({ roomId, code, delta }) => {
    try {
      const roomState = await getRoomState(roomId);
      if (roomState) {
        roomState.currentCode = code;
        await setRoomState(roomId, roomState);
      }
      socket.to(roomId).emit("editor:code_changed", {
        code,
        delta,
        userId: socket.userId,
      });
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
  socket.on("editor:cursor_move", async ({ roomId, position }) => {
    try {
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
  socket.on(
    "editor:run_code",
    async ({ roomId, code, language, questionId }) => {
      try {
        io.to(roomId).emit("editor:execution_started", {
          userId: socket.userId,
        });

        const requestBody = { code, language };
        if (questionId) requestBody.questionId = questionId;

        const response = await axios.post(
          `${SPRING_URL}/api/execute`,
          requestBody,
          {
            headers: { Authorization: `Bearer ${getRawToken(socket)}` },
            timeout: 65000,
          },
        );

        io.to(roomId).emit("editor:execution_result", {
          stdout: response.data.stdout,
          stderr: response.data.stderr,
          passed: response.data.passed,
          timedOut: response.data.timedOut,
          results: response.data.results,
          executionTimeMs: response.data.executionTimeMs,
          summary: response.data.summary,
        });

        console.log(
          `⚡ Code executed in room ${roomId} — ${language} — ${response.data.executionTimeMs}ms`,
        );
      } catch (err) {
        if (err.response?.status === 401) {
          // JWT expired — tell only the sender to refresh; clear loading for the room
          socket.emit("auth:token_expired");
          io.to(roomId).emit("editor:execution_result", {
            stdout: "",
            stderr: "Session expired — token refreshed, please run again",
            passed: false,
            timedOut: false,
            results: [],
          });
          return;
        }
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

  // ─── Submit Code — runs ALL test cases including hidden ───────────────────────
  socket.on(
    "editor:submit_code",
    async ({ roomId, code, language, questionId }) => {
      try {
        io.to(roomId).emit("editor:execution_started", {
          userId: socket.userId,
        });

        const requestBody = { code, language, submitAll: true };
        if (questionId) requestBody.questionId = questionId;

        const response = await axios.post(
          `${SPRING_URL}/api/execute`,
          requestBody,
          {
            headers: { Authorization: `Bearer ${getRawToken(socket)}` },
            timeout: 120000, // 2 min — more test cases
          },
        );

        // Emit as submission_result — different from run_result
        io.to(roomId).emit("editor:submission_result", {
          stdout: response.data.stdout,
          stderr: response.data.stderr,
          passed: response.data.passed,
          timedOut: response.data.timedOut,
          results: response.data.results,
          executionTimeMs: response.data.executionTimeMs,
          summary: response.data.summary,
          isSubmission: true,
        });

        const summary =
          response.data.summary ||
          `${response.data.results?.filter((r) => r.passed).length || 0}/${response.data.results?.length || 0} passed`;
        console.log(
          `📤 Submission in room ${roomId} — ${language} — ${summary}`,
        );
      } catch (err) {
        if (err.response?.status === 401) {
          socket.emit("auth:token_expired");
          io.to(roomId).emit("editor:submission_result", {
            stdout: "",
            stderr: "Session expired — token refreshed, please submit again",
            passed: false,
            timedOut: false,
            results: [],
            isSubmission: true,
          });
          return;
        }
        console.error("editor:submit_code error:", err.message);
        io.to(roomId).emit("editor:submission_result", {
          stdout: "",
          stderr:
            err.response?.data?.error || "Submission failed: " + err.message,
          passed: false,
          timedOut: false,
          results: [],
          isSubmission: true,
        });
      }
    },
  );
  // ─── Auto Save ────────────────────────────────────────────────────────────
  socket.on("editor:auto_save", async ({ roomId, code, language }) => {
    try {
      await axios.post(`${SPRING_URL}/api/rooms/${roomId}/sync`, {
        currentCode: code,
        language,
      });
      socket.emit("editor:saved", { savedAt: new Date().toISOString() });
    } catch (err) {
      console.error("editor:auto_save error:", err.message);
    }
  });

  // ─── Load Question ────────────────────────────────────────────────────────
  // Client now sends current language explicitly — no Redis race condition
  socket.on(
    "editor:load_question",
    async ({ roomId, questionId, language }) => {
      try {
        if (socket.userRole !== "INTERVIEWER") {
          socket.emit("room:error", {
            message: "Only interviewer can load questions",
          });
          return;
        }

        // Load question into room via Spring Boot
        await axios.post(
          `${SPRING_URL}/api/rooms/${roomId}/question/${questionId}`,
          {},
          { headers: { Authorization: `Bearer ${getRawToken(socket)}` } },
        );

        // Fetch full question details
        const questionResponse = await axios.get(
          `${SPRING_URL}/api/questions/${questionId}`,
          { headers: { Authorization: `Bearer ${getRawToken(socket)}` } },
        );

        // Use language sent from client — most accurate
        // Fall back to Redis room state if not provided
        const roomState = await getRoomState(roomId);
        const currentLanguage = (
          language ||
          roomState?.language ||
          "PYTHON"
        ).toUpperCase();

        console.log(`🌐 Loading question in language: ${currentLanguage}`);

        // Resolve starter code: stored as JSON map {LANG: code} or plain string
        let starterCode = "";
        let starterCodeMap = null; // full map sent to frontend for language switching
        const rawCode = questionResponse.data.starterCode;
        if (rawCode) {
          try {
            const codeMap = JSON.parse(rawCode);
            if (typeof codeMap === "object" && !Array.isArray(codeMap)) {
              starterCodeMap = codeMap;
              starterCode =
                codeMap[currentLanguage] ||
                codeMap[Object.keys(codeMap)[0]] ||
                "";
            } else {
              starterCode = rawCode;
            }
          } catch {
            starterCode = rawCode;
          }
        }
        // Final fallback: generic language template
        if (!starterCode) {
          const template = STARTER_TEMPLATES[currentLanguage];
          starterCode = template ? template() : "";
        }

        const questionData = {
          questionId: questionResponse.data.id,
          questionTitle: questionResponse.data.title,
          description: questionResponse.data.description,
          difficulty: questionResponse.data.difficulty,
          starterCode,
          starterCodeMap, // per-language map so client can switch languages
          tags: questionResponse.data.tags,
        };

        // Update Redis — store full question so rejoining users can restore it
        if (roomState) {
          roomState.currentCode = starterCode;
          roomState.questionId = questionId;
          roomState.question = questionData;
          await setRoomState(roomId, roomState);
        }

        // Broadcast to everyone
        io.to(roomId).emit("editor:question_loaded", questionData);
        await publishToRoom(roomId, "editor:question_loaded", questionData);

        console.log(
          `📝 Question loaded: ${questionData.questionTitle} (${currentLanguage})`,
        );
      } catch (err) {
        console.error("editor:load_question error:", err.message);
        socket.emit("room:error", { message: "Failed to load question" });
      }
    },
  );
};
