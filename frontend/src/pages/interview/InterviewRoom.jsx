import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore.js";
import useRoomStore from "../../store/roomStore.js";
import { roomAPI, interviewAPI } from "../../services/api.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  initSocket,
  getSocket,
  joinRoom,
  leaveRoom,
  sendCodeChange,
  sendCursorMove,
  autoSave,
  loadQuestion,
  changeLanguage,
} from "../../services/socket.js";
import { SOCKET_EVENTS, LANGUAGES, API_URL } from "../../utils/constants.js";
import CodeEditor from "../../components/editor/CodeEditor.jsx";
import VideoPanel from "../../components/video/VideoPanel.jsx";
import RoomControls from "../../components/room/RoomControls.jsx";
import ScoreModal from "../../components/room/ScoreModal.jsx";
import AICopilotPanel from "../../components/room/AICopilotPanel.jsx";

// ─── Handle language change ───────────────────────────────────────────────
const STARTER_TEMPLATES = {
  PYTHON: `import sys\n\ndef solution(data):\n    # Write your solution here\n    pass\n\ndata = sys.stdin.read().strip()\nprint(solution(data))\n`,

  JAVASCRIPT: `const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nlet lines = [];\nrl.on('line', line => lines.push(line));\nrl.on('close', () => {\n    // lines[0], lines[1], ... contain your input\n    // Write your solution here\n    console.log(lines[0]);\n});\n`,

  JAVA: `import java.util.Scanner;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String input = sc.nextLine();\n        \n        // Write your solution here\n        System.out.println(input);\n    }\n}\n`,

  GO: `package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    reader := bufio.NewReader(os.Stdin)\n    input, _ := reader.ReadString('\\\\n')\n    \n    // Write your solution here\n    fmt.Println(input)\n}\n`,

  CPP: `#include <iostream>\n#include <string>\nusing namespace std;\n\nint main() {\n    string input;\n    getline(cin, input);\n    \n    // Write your solution here\n    cout << input << endl;\n    return 0;\n}\n`,
};

// ─── Interview Timer ──────────────────────────────────────────────────────────
const InterviewTimer = ({ startedAt }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = startedAt ? new Date(startedAt).getTime() : Date.now();

    const tick = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;

  const format = (n) => String(n).padStart(2, "0");

  const color =
    elapsed > 3600
      ? "text-[#f85149]" // > 1 hour → red
      : elapsed > 2700
        ? "text-[#d29922]" // > 45 min → yellow
        : "text-[#3fb950]"; // normal → green

  return (
    <div className={`flex items-center gap-1 font-mono text-xs ${color}`}>
      <svg
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {hrs > 0 && `${format(hrs)}:`}
      {format(mins)}:{format(secs)}
    </div>
  );
};
// ─── Output panel — Terminal + Test Cases tabs ────────────────────────────────
const OutputPanel = ({ executionResult, isExecuting }) => {
  const [activeTab, setActiveTab] = useState("testcases");

  const hasTestCases = executionResult?.results?.length > 0;
  const hasOutput = executionResult?.stdout || executionResult?.stderr;

  // Auto switch to terminal when there's an error
  useEffect(() => {
    if (executionResult?.stderr && !executionResult?.passed) {
      setActiveTab("terminal");
    }
  }, [executionResult]);
  return (
    <div
      className="bg-[#161b22] border-t border-[#30363d] shrink-0 flex flex-col"
      style={{ height: "220px" }}
    >
      {/* Tab bar + status */}
      <div className="flex items-center justify-between px-3 border-b border-[#30363d] shrink-0">
        {/* Tabs */}
        <div className="flex items-center">
          <button
            onClick={() => setActiveTab("testcases")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "testcases"
                ? "border-[#238636] text-white"
                : "border-transparent text-[#8b949e] hover:text-white"
            }`}
          >
            Test Cases
            {hasTestCases && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  executionResult.passed
                    ? "bg-[#1a2f1a] text-[#3fb950]"
                    : "bg-[#2d1318] text-[#f85149]"
                }`}
              >
                {executionResult.results.filter((r) => r.passed).length}/
                {executionResult.results.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("terminal")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "terminal"
                ? "border-[#238636] text-white"
                : "border-transparent text-[#8b949e] hover:text-white"
            }`}
          >
            Terminal
            {executionResult?.stderr && (
              <span className="ml-1.5 w-1.5 h-1.5 bg-[#f85149] rounded-full inline-block" />
            )}
          </button>
        </div>

        {/* Status badge */}
        {/* Status badge */}
        {executionResult && (
          <div className="flex items-center gap-2">
            {/* Run vs Submit badge */}
            {executionResult.isSubmission ? (
              <span className="text-xs bg-[#1f2d3d] text-[#58a6ff] px-2 py-0.5 rounded-full border border-[#1f6feb]">
                Submission
              </span>
            ) : (
              <span className="text-xs bg-[#21262d] text-[#8b949e] px-2 py-0.5 rounded-full border border-[#30363d]">
                Run
              </span>
            )}
            <span
              className={`text-xs font-semibold ${
                executionResult.timedOut
                  ? "text-[#d29922]"
                  : executionResult.passed
                    ? "text-[#3fb950]"
                    : "text-[#f85149]"
              }`}
            >
              {executionResult.timedOut
                ? "⏱ TLE"
                : executionResult.passed
                  ? "✅ Accepted"
                  : "❌ Wrong Answer"}
            </span>
            {executionResult.executionTimeMs && (
              <span className="text-xs text-[#484f58]">
                {executionResult.executionTimeMs}ms
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {/* Executing spinner */}
        {isExecuting ? (
          <div className="h-full flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-4 w-4 text-[#238636]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            <span className="text-xs text-[#8b949e]">Running code...</span>
          </div>
        ) : activeTab === "testcases" ? (
          /* ── Test Cases tab ── */
          hasTestCases ? (
            <TestCaseResults results={executionResult.results} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-xs text-[#484f58]">
                {executionResult
                  ? "No test cases for this run"
                  : "Run your code to see results"}
              </p>
            </div>
          )
        ) : (
          /* ── Terminal tab ── */
          <div className="h-full overflow-y-auto bg-[#0d1117] p-3 font-mono">
            {/* Terminal header */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#21262d]">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f85149]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#d29922]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#3fb950]" />
              </div>
              <span className="text-xs text-[#484f58]">stdout / stderr</span>
            </div>

            {/* Output */}
            {!executionResult?.stdout && !executionResult?.stderr ? (
              <p className="text-xs text-[#484f58]">~ no output</p>
            ) : (
              <>
                {/* Summary line */}
                {executionResult?.summary && (
                  <div className="text-xs text-[#8b949e] mb-2 pb-2 border-b border-[#21262d]">
                    {executionResult.summary}
                  </div>
                )}

                {/* Actual program stdout — System.out.println etc */}
                {executionResult?.stdout && (
                  <pre className="text-xs text-[#c9d1d9] whitespace-pre-wrap leading-relaxed">
                    {executionResult.stdout}
                  </pre>
                )}
                {executionResult?.stderr && (
                  <>
                    {executionResult?.stdout && (
                      <div className="border-t border-[#21262d] my-2" />
                    )}
                    <pre className="text-xs text-[#f85149] whitespace-pre-wrap leading-relaxed">
                      {executionResult.stderr}
                    </pre>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
// ─── Test case results — LeetCode style ──────────────────────────────────────
const TestCaseResults = ({ results }) => {
  const [activeTab, setActiveTab] = useState(0);
  const active = results[activeTab];

  return (
    <div className="flex flex-col" style={{ maxHeight: "180px" }}>
      {/* Test case tabs */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-0 overflow-x-auto shrink-0">
        {results.map((r, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors shrink-0 ${
              activeTab === i
                ? "bg-[#0d1117] text-white border border-b-0 border-[#30363d]"
                : "text-[#8b949e] hover:text-white"
            }`}
          >
            <span className={r.passed ? "text-[#3fb950]" : "text-[#f85149]"}>
              {r.passed ? "●" : "●"}
            </span>
            Case {i + 1}
          </button>
        ))}
      </div>

      {/* Active test case detail */}
      {active && (
        <div className="flex-1 overflow-y-auto bg-[#0d1117] p-3 space-y-3">
          {/* Input */}
          {active.input && active.input !== "hidden" && (
            <div>
              <p className="text-xs text-[#484f58] mb-1">Input</p>
              <pre className="text-xs text-[#c9d1d9] font-mono bg-[#161b22] rounded-lg px-3 py-2">
                {active.input}
              </pre>
            </div>
          )}

          {/* Expected output */}
          {active.expectedOutput && active.expectedOutput !== "hidden" && (
            <div>
              <p className="text-xs text-[#484f58] mb-1">Expected Output</p>
              <pre className="text-xs text-[#3fb950] font-mono bg-[#161b22] rounded-lg px-3 py-2">
                {active.expectedOutput}
              </pre>
            </div>
          )}

          {/* Actual output */}
          <div>
            <p className="text-xs text-[#484f58] mb-1">Your Output</p>
            <pre
              className={`text-xs font-mono bg-[#161b22] rounded-lg px-3 py-2 ${
                active.passed ? "text-[#3fb950]" : "text-[#f85149]"
              }`}
            >
              {active.actualOutput === "hidden"
                ? active.passed
                  ? "Correct ✓"
                  : "Wrong answer"
                : active.actualOutput || "(empty)"}
            </pre>
          </div>

          {/* Hidden badge */}
          {active.input === "hidden" && (
            <p className="text-xs text-[#484f58]">
              🔒 Hidden test case — input/output not shown
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const InterviewRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlRole = searchParams.get("role");
  const { user, accessToken, isInterviewer } = useAuthStore();
  const {
    currentCode,
    language,
    question,
    executionResult,
    isExecuting,
    isSubmitting,
    setRoomState,
    setCode,
    setLanguage,
    setQuestion,
    setExecuting,
    setExecutionResult,
    setSubmissionResult,
    addParticipant,
    removeParticipant,
    resetRoom,
  } = useRoomStore();

  const [isConnected, setIsConnected] = useState(false);
  const [isRemoteChange, setIsRemoteChange] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [showQuestion, setShowQuestion] = useState(true);
  const [showVideo, setShowVideo] = useState(true);
  const starterCodeMapRef = useRef(null); // per-language starter codes from the loaded question
  const autoSaveRef = useRef(null);
  const codeRef = useRef(currentCode);
  const debounceRef = useRef(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [interviewRoomId, setInterviewRoomId] = useState(null);
  const [interviewId, setInterviewId] = useState(null);
  const [isLeadInterviewer, setIsLeadInterviewer] = useState(false);
  const showScoreModalRef = useRef(false);

  const [interviewStartedAt, setInterviewStartedAt] = useState(null);

  const socketRef = useRef(null);

  // Keep codeRef in sync
  useEffect(() => {
    codeRef.current = currentCode;
  }, [currentCode]);

  // Reliably determine lead-interviewer status once the room is connected.
  // This runs independently of the ROOM_STATE socket handler so a transient
  // network error in that handler can't silently leave isLeadInterviewer=false.
  useEffect(() => {
    if (!isConnected || !user || user.role !== "INTERVIEWER") return;

    const fetchLeadStatus = async () => {
      try {
        const res = await interviewAPI.getByRoomEntityId(roomId);
        const interview = res.data;
        if (!interviewId) setInterviewId(interview.id);
        const isLead = interview.createdById === user.id;
        setIsLeadInterviewer(isLead);
        console.log(
          `👑 isLeadInterviewer: ${isLead} (createdById=${interview.createdById}, userId=${user.id})`,
        );
      } catch (err) {
        console.error("fetchLeadStatus failed:", err.message);
      }
    };

    fetchLeadStatus();
  }, [isConnected, roomId]);

  // ─── Initialize socket + join room ────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    const setup = async () => {
      // Validate/refresh token by making an API call first
      // If expired, interceptor refreshes and updateToken fires
      // which changes accessToken in store → useEffect re-runs with new token
      try {
        await roomAPI.getById(roomId);
      } catch (err) {
        if (err.response?.status === 401) return; // interceptor handles refresh
      }

      if (cancelled) return;

      const socket = initSocket(accessToken);
      socketRef.current = socket;

      // Remove ALL existing listeners first
      socket.off(SOCKET_EVENTS.ROOM_STATE);
      socket.off(SOCKET_EVENTS.ROOM_USER_JOINED);
      socket.off(SOCKET_EVENTS.ROOM_USER_LEFT);
      socket.off(SOCKET_EVENTS.ROOM_CLOSED);
      socket.off(SOCKET_EVENTS.ROOM_ERROR);
      socket.off(SOCKET_EVENTS.EDITOR_CODE_CHANGED);
      socket.off(SOCKET_EVENTS.ROOM_LANGUAGE_CHANGED);
      socket.off(SOCKET_EVENTS.EDITOR_QUESTION_LOADED);
      socket.off(SOCKET_EVENTS.EDITOR_EXECUTION_STARTED);
      socket.off(SOCKET_EVENTS.EDITOR_EXECUTION_RESULT);
      socket.off(SOCKET_EVENTS.EDITOR_SUBMISSION_RESULT);
      socket.off(SOCKET_EVENTS.EDITOR_SAVED);
      socket.off(SOCKET_EVENTS.AUTH_TOKEN_EXPIRED);

      // ── Room events ───────────────────────────────────────────────────────
      socket.on(SOCKET_EVENTS.ROOM_STATE, async (state) => {
        setRoomState(state);
        setIsConnected(true);
        toast.success("Connected to room");

        if (state.startedAt) setInterviewStartedAt(state.startedAt);
        else setInterviewStartedAt(new Date().toISOString());

        const { user } = useAuthStore.getState();

        if (user?.role === "CANDIDATE") {
          try {
            const interviewRes = await interviewAPI.getByRoomEntityId(roomId);
            const interview = interviewRes.data;
            if (interview.status === "SCHEDULED") {
              await interviewAPI.join(interview.roomId);
            }
          } catch (err) {
            console.log("Join interview error:", err.message);
          }
        } else if (user?.role === "INTERVIEWER") {
          try {
            const interviewRes = await interviewAPI.getByRoomEntityId(roomId);
            const interview = interviewRes.data;
            setInterviewId(interview.id);

            // Check if current user is lead interviewer (created the interview)
            const isLead = interview.createdById === user?.id;
            setIsLeadInterviewer(isLead);
            console.log(`👤 Lead interviewer: ${isLead}`);

            if (urlRole === "interviewer") {
              await interviewAPI.joinAsPanelist(interview.id);
              console.log("✅ Joined as panelist");
            }
          } catch (err) {
            console.log("Interviewer join:", err.message);
          }
        }
      });

      socket.on(SOCKET_EVENTS.ROOM_USER_JOINED, (data) => {
        addParticipant(data.userId, data);
        setParticipants((prev) => [...prev, data]);
        toast.success(`${data.email} joined`);
      });

      socket.on(SOCKET_EVENTS.ROOM_USER_LEFT, (data) => {
        removeParticipant(data.userId);
        setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));
        toast(`${data.email} left`, { icon: "👋" });
      });

      socket.on(SOCKET_EVENTS.ROOM_CLOSED, () => {
        if (showScoreModalRef.current) return;
        toast.error("Interview ended");
        navigate("/dashboard");
      });

      socket.on(SOCKET_EVENTS.ROOM_ERROR, (data) => {
        toast.error(data.message);
        if (data.message === "This interview has ended") {
          setTimeout(() => navigate("/dashboard"), 2000);
        }
      });

      // ── Editor events ─────────────────────────────────────────────────────
      socket.on(SOCKET_EVENTS.EDITOR_CODE_CHANGED, (data) => {
        if (data.userId !== user?.id) {
          setIsRemoteChange(true);
          setCode(data.code);
          setTimeout(() => setIsRemoteChange(false), 100);
        }
      });

      socket.on(SOCKET_EVENTS.ROOM_LANGUAGE_CHANGED, (data) => {
        setLanguage(data.language);
      });

      socket.on(SOCKET_EVENTS.EDITOR_QUESTION_LOADED, (data) => {
        setQuestion(data);
        starterCodeMapRef.current = data.starterCodeMap || null;
        setIsRemoteChange(true);
        setCode(data.starterCode || "");
        setTimeout(() => setIsRemoteChange(false), 100);
        toast.success(`Question loaded: ${data.questionTitle}`);
      });

      socket.on(SOCKET_EVENTS.EDITOR_EXECUTION_STARTED, () => {
        setExecuting(true);
      });

      socket.on(SOCKET_EVENTS.EDITOR_EXECUTION_RESULT, (data) => {
        setExecutionResult(data);
      });

      socket.on(SOCKET_EVENTS.EDITOR_SUBMISSION_RESULT, (data) => {
        setSubmissionResult({ ...data, isSubmission: true });
      });
      socket.on(SOCKET_EVENTS.EDITOR_SAVED, () => {
        console.log("✅ Auto saved");
      });

      // JWT expired mid-session — refresh silently, socket reconnects automatically
      socket.on(SOCKET_EVENTS.AUTH_TOKEN_EXPIRED, async () => {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          navigate("/login");
          return;
        }
        try {
          // Use raw axios (not api instance) to avoid interceptor re-triggering
          const res = await axios.post(
            `${API_URL}/api/auth/refresh`,
            {},
            { headers: { "Refresh-Token": refreshToken } },
          );
          useAuthStore.getState().updateToken(res.data.accessToken);
          toast("Session refreshed — run your code again", { icon: "🔄" });
        } catch {
          toast.error("Session expired — please log in again");
          navigate("/login");
        }
      });

      // ── Join room ─────────────────────────────────────────────────────────
      const doJoin = () => {
        joinRoom(roomId);
        console.log("🚀 Joining room:", roomId);
      };

      if (socket.connected) {
        doJoin();
      } else {
        socket.once("connect", doJoin);
      }

      // ── Auto save every 10 seconds ────────────────────────────────────────
      autoSaveRef.current = setInterval(() => {
        autoSave(roomId, codeRef.current, language);
      }, 10000);
    };

    setup();

    return () => {
      cancelled = true;
      clearInterval(autoSaveRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      resetRoom();
      const s = socketRef.current;
      if (s) {
        s.off(SOCKET_EVENTS.ROOM_STATE);
        s.off(SOCKET_EVENTS.ROOM_USER_JOINED);
        s.off(SOCKET_EVENTS.ROOM_USER_LEFT);
        s.off(SOCKET_EVENTS.ROOM_CLOSED);
        s.off(SOCKET_EVENTS.ROOM_ERROR);
        s.off(SOCKET_EVENTS.EDITOR_CODE_CHANGED);
        s.off(SOCKET_EVENTS.ROOM_LANGUAGE_CHANGED);
        s.off(SOCKET_EVENTS.EDITOR_QUESTION_LOADED);
        s.off(SOCKET_EVENTS.EDITOR_EXECUTION_STARTED);
        s.off(SOCKET_EVENTS.EDITOR_EXECUTION_RESULT);
        s.off(SOCKET_EVENTS.EDITOR_SUBMISSION_RESULT);
        s.off(SOCKET_EVENTS.EDITOR_SAVED);
        s.off(SOCKET_EVENTS.AUTH_TOKEN_EXPIRED);
      }
    };
  }, [roomId, accessToken]);
  // ─── Handle code change ───────────────────────────────────────────────────

  const handleCodeChange = useCallback(
    (newCode) => {
      setCode(newCode);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        sendCodeChange(roomId, newCode, null);
      }, 300);
    },
    [roomId],
  );
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    changeLanguage(roomId, newLanguage);

    // Use question's per-language starter code if available, else generic template
    const map = starterCodeMapRef.current;
    const template = STARTER_TEMPLATES[newLanguage];
    const code =
      (map && (map[newLanguage] || map[Object.keys(map)[0]])) ||
      (template ? template() : "");

    setIsRemoteChange(true);
    setCode(code);
    sendCodeChange(roomId, code, null);
    setTimeout(() => setIsRemoteChange(false), 100);
  };

  const handleEndInterview = async () => {
    try {
      const response = await interviewAPI.end(roomId);
      setInterviewRoomId(response.data.roomId);

      const socket = getSocket();
      socket?.emit(SOCKET_EVENTS.ROOM_CLOSE, { roomId });

      // Set both state and ref
      setShowScoreModal(true);
      showScoreModalRef.current = true;
      toast.success("Interview ended");
    } catch (err) {
      console.log(err);
      toast.error("Failed to end interview");
    }
  };
  const handleLeaveRoom = () => {
    const socket = getSocket();
    socket?.emit(SOCKET_EVENTS.ROOM_LEAVE, { roomId });
    navigate("/dashboard");
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-[#238636] mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          <p className="text-[#8b949e]">Connecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold">
            Code<span className="text-[#238636]">Room</span>
          </h1>
          <span className="text-[#30363d]">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-[#3fb950] rounded-full animate-pulse" />
            <span className="text-xs text-[#8b949e]">Live</span>
          </div>
          {/* Participants */}
          {/* Participants */}
          <div className="flex items-center gap-1">
            {participants.map((p) => (
              <span
                key={p.userId}
                className="text-xs bg-[#21262d] text-[#8b949e] px-2 py-0.5 rounded-full"
              >
                {p.email?.split("@")[0]}
              </span>
            ))}
          </div>

          {/* Timer */}
          {interviewStartedAt && (
            <div className="flex items-center gap-1.5 bg-[#21262d] px-2 py-1 rounded-lg border border-[#30363d]">
              <InterviewTimer startedAt={interviewStartedAt} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-[#21262d] border border-[#30363d] text-white text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-[#238636]"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          {/* Toggle question panel */}
          <button
            onClick={() => setShowQuestion(!showQuestion)}
            className="text-xs text-[#8b949e] hover:text-white border border-[#30363d] px-2 py-1.5 rounded-lg transition-colors"
          >
            {showQuestion ? "Hide" : "Show"} Question
          </button>

          {/* Toggle video */}
          <button
            onClick={() => setShowVideo(!showVideo)}
            className="text-xs text-[#8b949e] hover:text-white border border-[#30363d] px-2 py-1.5 rounded-lg transition-colors"
          >
            {showVideo ? "Hide" : "Show"} Video
          </button>

          {/* End interview — interviewer only */}
          {isInterviewer() && (
            <button
              onClick={handleEndInterview}
              className="text-xs bg-[#da3633] hover:bg-[#f85149] text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              End Interview
            </button>
          )}
          {!isInterviewer() && (
            <button
              onClick={handleLeaveRoom}
              className="text-xs bg-[#da3633] hover:bg-[#f85149] text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              Leave Room
            </button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question panel */}
        {showQuestion && question && (
          <div className="w-80 bg-[#161b22] border-r border-[#30363d] flex flex-col overflow-hidden shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-[#30363d] shrink-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-white font-semibold text-sm leading-tight">
                  {question.questionTitle}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                    question.difficulty === "EASY"
                      ? "text-[#3fb950] bg-[#1a2f1a]"
                      : question.difficulty === "MEDIUM"
                        ? "text-[#d29922] bg-[#2d1f00]"
                        : "text-[#f85149] bg-[#2d1318]"
                  }`}
                >
                  {question.difficulty}
                </span>
              </div>
              {question.tags && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {question.tags.split(",").map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-[#21262d] text-[#58a6ff] px-1.5 py-0.5 rounded"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description — markdown rendered */}
            <div className="flex-1 overflow-y-auto p-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="text-[#8b949e] text-sm leading-relaxed mb-3">
                      {children}
                    </p>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-[#8b949e] italic">{children}</em>
                  ),
                  code: ({ inline, children }) =>
                    inline ? (
                      <code className="bg-[#21262d] text-[#58a6ff] px-1.5 py-0.5 rounded text-xs font-mono">
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 my-3 overflow-x-auto">
                        <code className="text-xs font-mono text-[#c9d1d9]">
                          {children}
                        </code>
                      </pre>
                    ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside text-[#8b949e] text-sm space-y-1 mb-3 pl-2">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside text-[#8b949e] text-sm space-y-1 mb-3 pl-2">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-[#8b949e] text-sm">{children}</li>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-white font-bold text-base mb-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-white font-semibold text-sm mb-2">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-[#8b949e] font-semibold text-sm mb-1">
                      {children}
                    </h3>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-[#238636] pl-3 my-3 text-[#8b949e] italic text-sm">
                      {children}
                    </blockquote>
                  ),
                  img: ({ src, alt }) => (
                    <img
                      src={src}
                      alt={alt}
                      className="rounded-lg max-w-full my-3 border border-[#30363d]"
                    />
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="w-full text-xs border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-[#30363d] bg-[#21262d] text-white px-3 py-1.5 text-left">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-[#30363d] text-[#8b949e] px-3 py-1.5">
                      {children}
                    </td>
                  ),
                  hr: () => <hr className="border-[#30363d] my-4" />,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#58a6ff] hover:underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {question.description}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CodeEditor
            code={currentCode}
            language={language}
            onChange={handleCodeChange}
            roomId={roomId}
            isRemoteChange={isRemoteChange}
          />

          {/* Execution result */}

          {/* ── Output panel — Terminal + Test Cases ─────────────────────────── */}
          {(executionResult || isExecuting) && (
            <OutputPanel
              executionResult={executionResult}
              isExecuting={isExecuting}
            />
          )}
        </div>

        {/* Video panel */}
        {/* Right panel — Video + AI Copilot */}
        <div className="w-80 bg-[#161b22] border-l border-[#30363d] shrink-0 flex flex-col overflow-hidden">
          {/* Video panel */}
          {showVideo && (
            <div className={`shrink-0 ${isInterviewer() ? "h-64" : "flex-1"}`}>
              <VideoPanel
                roomId={roomId}
                participants={participants}
                isLeadInterviewer={isLeadInterviewer}
                interviewId={interviewId}
              />
            </div>
          )}

          {/* AI Copilot — interviewer only */}
          {isInterviewer() && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <AICopilotPanel />
            </div>
          )}
        </div>
      </div>

      {/* Room controls — bottom bar */}
      <RoomControls
        roomId={roomId}
        code={currentCode}
        language={language}
        question={question}
      />

      {/* Score modal */}
      {showScoreModal && (
        <ScoreModal
          roomId={interviewRoomId || roomId}
          candidateName={
            participants.find((p) => p.role === "CANDIDATE")?.email ||
            "Candidate"
          }
          onClose={() => {
            setShowScoreModal(false);
            showScoreModalRef.current = false;
            navigate("/dashboard");
          }}
          onSubmitted={() => {
            setShowScoreModal(false);
            showScoreModalRef.current = false;
            navigate("/dashboard");
          }}
        />
      )}
    </div>
  );
};

export default InterviewRoom;
