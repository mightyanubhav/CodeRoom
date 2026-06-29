export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
export const RELAY_URL =
  import.meta.env.VITE_RELAY_URL || "http://localhost:4000";

export const LANGUAGES = [
  { label: "JavaScript", value: "JAVASCRIPT", monacoLang: "javascript" },
  { label: "Java", value: "JAVA", monacoLang: "java" },
  { label: "Python", value: "PYTHON", monacoLang: "python" },
  { label: "Go", value: "GO", monacoLang: "go" },
  { label: "C++", value: "CPP", monacoLang: "cpp" },
];

export const ROLES = {
  INTERVIEWER: "INTERVIEWER",
  CANDIDATE: "CANDIDATE",
  ADMIN: "ADMIN",
};

export const INTERVIEW_STATUS = {
  SCHEDULED: "SCHEDULED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  REVIEWED: "REVIEWED",
  CANCELLED: "CANCELLED",
};

export const ROOM_STATUS = {
  WAITING: "WAITING",
  ACTIVE: "ACTIVE",
  LOCKED: "LOCKED",
  CLOSED: "CLOSED",
};

export const SOCKET_EVENTS = {
  // Room
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_CLOSE: "room:close", // ← ADD THIS
  ROOM_STATE: "room:state",
  ROOM_USER_JOINED: "room:user_joined",
  ROOM_USER_LEFT: "room:user_left",
  ROOM_ERROR: "room:error",
  ROOM_CLOSED: "room:closed",
  ROOM_LANGUAGE_CHANGE: "room:language_change",
  ROOM_LANGUAGE_CHANGED: "room:language_changed",

  // Editor
  EDITOR_CODE_CHANGE: "editor:code_change",
  EDITOR_CODE_CHANGED: "editor:code_changed",
  EDITOR_CURSOR_MOVE: "editor:cursor_move",
  EDITOR_CURSOR_MOVED: "editor:cursor_moved",
  EDITOR_RUN_CODE: "editor:run_code",
  EDITOR_EXECUTION_STARTED: "editor:execution_started",
  EDITOR_EXECUTION_RESULT: "editor:execution_result",
  EDITOR_AUTO_SAVE: "editor:auto_save",
  EDITOR_SAVED: "editor:saved",
  EDITOR_LOAD_QUESTION: "editor:load_question",
  EDITOR_QUESTION_LOADED: "editor:question_loaded",
  EDITOR_SUBMIT_CODE: "editor:submit_code",
  EDITOR_SUBMISSION_RESULT: "editor:submission_result",

  // Auth
  AUTH_TOKEN_EXPIRED: "auth:token_expired",

  // WebRTC
  WEBRTC_OFFER: "webrtc:offer",
  WEBRTC_ANSWER: "webrtc:answer",
  WEBRTC_ICE_CANDIDATE: "webrtc:ice_candidate",
  WEBRTC_CALL_END: "webrtc:call_end",
  WEBRTC_CALL_STARTED: "webrtc:call_started",
  WEBRTC_USER_STARTED_CALL: "webrtc:user_started_call",
  WEBRTC_START_CALL: "webrtc:start_call",
  WEBRTC_PEER_IN_ROOM: "webrtc:peer_in_room",
};

export const STUN_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};
