import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore.js";
import useRoomStore from "../../store/roomStore.js";
import { roomAPI, interviewAPI } from "../../services/api.js";
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
import { SOCKET_EVENTS, LANGUAGES } from "../../utils/constants.js";
import CodeEditor from "../../components/editor/CodeEditor.jsx";
import VideoPanel from "../../components/video/VideoPanel.jsx";
import RoomControls from "../../components/room/RoomControls.jsx";
import ScoreModal from "../../components/room/ScoreModal.jsx";

const InterviewRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, accessToken, isInterviewer } = useAuthStore();
  const {
    currentCode,
    language,
    question,
    executionResult,
    isExecuting,
    setRoomState,
    setCode,
    setLanguage,
    setQuestion,
    setExecuting,
    setExecutionResult,
    addParticipant,
    removeParticipant,
    resetRoom,
  } = useRoomStore();

  const [isConnected, setIsConnected] = useState(false);
  const [isRemoteChange, setIsRemoteChange] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [showQuestion, setShowQuestion] = useState(true);
  const [showVideo, setShowVideo] = useState(true);
  const autoSaveRef = useRef(null);
  const codeRef = useRef(currentCode);
  const debounceRef = useRef(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [interviewRoomId, setInterviewRoomId] = useState(null);
  const showScoreModalRef = useRef(false);

  const socketRef = useRef(null);

  // Keep codeRef in sync
  useEffect(() => {
    codeRef.current = currentCode;
  }, [currentCode]);

  // ─── Initialize socket + join room ────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;

    const socket = initSocket(accessToken);
    socketRef.current = socket;

    // Remove old listeners first
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
    socket.off(SOCKET_EVENTS.EDITOR_SAVED);

    // Register all handlers
    socket.on(SOCKET_EVENTS.ROOM_STATE, async (state) => {
      setRoomState(state);
      setIsConnected(true);
      toast.success("Connected to room");

      const { user } = useAuthStore.getState();
      if (user?.role === "CANDIDATE") {
        try {
          // Only join if interview is SCHEDULED — not already IN_PROGRESS
          const interviewRes = await interviewAPI.getByRoomEntityId(roomId);
          const interview = interviewRes.data;

          if (interview.status === "SCHEDULED") {
            await interviewAPI.join(interview.roomId);
            console.log("✅ Interview status → IN_PROGRESS");
          } else {
            console.log("ℹ️ Interview already:", interview.status);
          }
        } catch (err) {
          console.log("Join interview error:", err.message);
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
      toast.success(`Question loaded: ${data.questionTitle}`);
    });

    socket.on(SOCKET_EVENTS.EDITOR_EXECUTION_STARTED, () => {
      setExecuting(true);
    });

    socket.on(SOCKET_EVENTS.EDITOR_EXECUTION_RESULT, (data) => {
      setExecutionResult(data);
    });

    socket.on(SOCKET_EVENTS.EDITOR_SAVED, () => {
      console.log("✅ Auto saved");
    });

    // Join room
    const doJoin = () => {
      joinRoom(roomId);
      console.log("🚀 Joining room:", roomId);
    };

    if (socket.connected) {
      doJoin();
    } else {
      socket.once("connect", doJoin);
    }

    // Auto save
    autoSaveRef.current = setInterval(() => {
      autoSave(roomId, codeRef.current, language);
    }, 10000);

    return () => {
      clearInterval(autoSaveRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      resetRoom();
      // Use socketRef to ensure we remove from correct socket
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
        s.off(SOCKET_EVENTS.EDITOR_SAVED);
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

  // ─── Handle language change ───────────────────────────────────────────────
  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    changeLanguage(roomId, newLanguage);
  };

  // ─── End interview ────────────────────────────────────────────────────────
  //   const handleEndInterview = async () => {
  //     try {
  //       const response = await interviewAPI.end(roomId); // ← capture response
  //       setInterviewRoomId(response.data.roomId);
  //       setShowScoreModal(true);
  //       toast.success("Interview ended");
  //     } catch (err) {
  //       console.log(err);
  //       toast.error("Failed to end interview");
  //     }
  //   };
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
            <div className="p-4 border-b border-[#30363d]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white font-semibold text-sm">
                  {question.questionTitle}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
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
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[#8b949e] text-sm leading-relaxed">
                {question.description}
              </p>
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
          {executionResult && (
            <div className="bg-[#161b22] border-t border-[#30363d] p-3 h-32 overflow-y-auto shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs font-medium ${executionResult.passed ? "text-[#3fb950]" : "text-[#f85149]"}`}
                >
                  {executionResult.passed
                    ? "✅ All tests passed"
                    : "❌ Tests failed"}
                </span>
              </div>
              {executionResult.stdout && (
                <pre className="text-xs text-[#8b949e] font-mono">
                  {executionResult.stdout}
                </pre>
              )}
              {executionResult.stderr && (
                <pre className="text-xs text-[#f85149] font-mono">
                  {executionResult.stderr}
                </pre>
              )}
            </div>
          )}

          {/* Executing indicator */}
          {isExecuting && (
            <div className="bg-[#161b22] border-t border-[#30363d] p-3 shrink-0">
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-3 w-3 text-[#238636]"
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
            </div>
          )}
        </div>

        {/* Video panel */}
        {showVideo && (
          <div className="w-72 bg-[#161b22] border-l border-[#30363d] shrink-0">
            <VideoPanel roomId={roomId} />
          </div>
        )}
      </div>

      {/* Room controls — bottom bar */}
      <RoomControls roomId={roomId} code={currentCode} language={language} />

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
