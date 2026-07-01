import { useEffect, useRef, useState, useCallback } from "react";
import useAuthStore from "../../store/authStore.js";
import { SOCKET_EVENTS } from "../../utils/constants.js";
import { getSocket } from "../../services/socket.js";
import { recordingAPI } from "../../services/api.js";
import toast from "react-hot-toast";

// ─── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#1f6feb","#238636","#da3633","#d29922",
  "#8957e5","#0d419d","#2ea043","#bf4b8a",
];
const getAvatarColor = (str = "") => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const getInitials = (label = "") => {
  const clean = label.replace(/[🎯👑⚡]/g, "").trim();
  const parts = clean.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0]?.length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return "??";
};
const AvatarFallback = ({ label }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1117]">
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold mb-1 select-none"
      style={{ backgroundColor: getAvatarColor(label) }}
    >
      {getInitials(label)}
    </div>
    <span className="text-xs text-[#484f58]">Camera off</span>
  </div>
);

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const VideoPanel = ({
  roomId,
  participants = [],
  isLeadInterviewer = false,
  interviewId = null,
}) => {
  const { user } = useAuthStore();

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const pendingCandidatesRef = useRef({}); // { userId: RTCIceCandidateInit[] }
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const screenStreamRef = useRef(null);
  const isCallActiveRef = useRef(false);
  const userRef = useRef(user);
  const roomIdRef = useRef(roomId);
  const remoteVideoElemsRef = useRef({}); // { userId: HTMLVideoElement }

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [remoteVideos, setRemoteVideos] = useState({});
  const [connectedCount, setConnectedCount] = useState(0);
  const [remoteCameraOff, setRemoteCameraOff] = useState({}); // { userId: boolean }

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  // ─── Auto start call ──────────────────────────────────────────────────────
  useEffect(() => {
    const startWhenReady = () => {
      const socket = getSocket();
      if (!socket) {
        setTimeout(startWhenReady, 100);
        return;
      }

      socket.once(SOCKET_EVENTS.ROOM_STATE, async () => {
        try {
          await getUserMedia();
          isCallActiveRef.current = true;
          socket.emit("webrtc:start_call", { roomId });
        } catch (err) {
          console.error("Auto start call error:", err.message);
        }
      });

      if (socket.connected && !isCallActiveRef.current) {
        setTimeout(async () => {
          if (!isCallActiveRef.current) {
            try {
              await getUserMedia();
              isCallActiveRef.current = true;
              socket.emit("webrtc:start_call", { roomId });
            } catch (err) {
              console.error("Auto start call error:", err.message);
            }
          }
        }, 500);
      }
    };
    startWhenReady();
  }, [roomId]);

  // ─── Get user media ───────────────────────────────────────────────────────
  const getUserMedia = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  // ─── Remove peer ──────────────────────────────────────────────────────────
  const removePeer = useCallback((userId) => {
    if (peerConnectionsRef.current[userId]) {
      peerConnectionsRef.current[userId].close();
      delete peerConnectionsRef.current[userId];
    }
    delete remoteVideoElemsRef.current[userId];
    delete pendingCandidatesRef.current[userId];
    setRemoteVideos((prev) => {
      const next = { ...prev };
      delete next[userId];
      setConnectedCount(Object.keys(next).length);
      return next;
    });
    setRemoteCameraOff((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  // ─── Create peer connection ───────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (targetUserId) => {
      if (peerConnectionsRef.current[targetUserId]) {
        peerConnectionsRef.current[targetUserId].close();
      }
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          getSocket()?.emit("webrtc:ice_candidate", {
            roomId: roomIdRef.current,
            candidate: event.candidate,
            targetUserId,
          });
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        // Create hidden video element for canvas drawing
        const videoElem = document.createElement("video");
        videoElem.srcObject = stream;
        videoElem.autoplay = true;
        videoElem.playsInline = true;
        videoElem.muted = true;
        remoteVideoElemsRef.current[targetUserId] = videoElem;

        // Detect camera on/off for the avatar fallback
        if (event.track.kind === "video") {
          event.track.onmute = () =>
            setRemoteCameraOff((prev) => ({ ...prev, [targetUserId]: true }));
          event.track.onunmute = () =>
            setRemoteCameraOff((prev) => ({ ...prev, [targetUserId]: false }));
        }

        setRemoteVideos((prev) => {
          const next = { ...prev, [targetUserId]: stream };
          setConnectedCount(Object.keys(next).length);
          return next;
        });
      };

      pc.onconnectionstatechange = () => {
        // "disconnected" is transient — the ICE agent may recover automatically.
        // Only tear down on "failed", which is permanent and unrecoverable.
        if (pc.connectionState === "failed") {
          removePeer(targetUserId);
        }
      };

      peerConnectionsRef.current[targetUserId] = pc;
      return pc;
    },
    [removePeer],
  );

  // ─── Send offer ───────────────────────────────────────────────────────────
  const sendOfferTo = useCallback(
    async (targetUserId) => {
      try {
        const existing = peerConnectionsRef.current[targetUserId];
        // Skip only if a healthy connection already exists.
        // "connected" or actively negotiating ("have-local-offer") = don't duplicate.
        // Missing, closed, failed, or stuck-new = safe to (re)try.
        if (
          existing &&
          (existing.connectionState === "connected" ||
            existing.signalingState === "have-local-offer")
        ) {
          return;
        }
        const stream = await getUserMedia();
        const pc = createPeerConnection(targetUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        getSocket()?.emit("webrtc:offer", {
          roomId: roomIdRef.current,
          offer,
          fromUserId: userRef.current?.id,
          targetUserId,
        });
      } catch (err) {
        console.error("Send offer error:", err.message);
      }
    },
    [createPeerConnection],
  );

  // ─── Handle incoming offer ────────────────────────────────────────────────
  const handleIncomingOffer = useCallback(
    async (offer, fromUserId) => {
      try {
        const stream = await getUserMedia();

        // Glare resolution: both peers may have called sendOfferTo() simultaneously
        // (e.g. two interviewers joining within the same 500ms window).  Both end up
        // with a PC in "have-local-offer" for the other.  Without tie-breaking,
        // createPeerConnection() closes the offerer PC; the answer arrives later but
        // finds a "stable" PC → answer silently dropped → ICE never completes.
        //
        // Fix: deterministic tie-break on userId string.
        //   smaller-id peer = "impolite" → keeps its own offer, ignores the incoming one
        //   larger-id peer  = "polite"   → drops its own offer, accepts the incoming one
        //
        // Both sides compute the same winner independently, so exactly one offer
        // survives and proceeds to a proper answer exchange.
        const existingPc = peerConnectionsRef.current[fromUserId];
        if (existingPc?.signalingState === "have-local-offer") {
          const myId = String(userRef.current?.id ?? "");
          const theirId = String(fromUserId ?? "");
          if (myId < theirId) {
            // We are impolite — our offer wins.  Ignore theirs; wait for our answer.
            return;
          }
          // We are polite — their offer wins.
          // Fall through: createPeerConnection() will close our pending-offer PC.
        }

        const pc = createPeerConnection(fromUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Flush ICE candidates that arrived before remote description was ready
        const queued = pendingCandidatesRef.current[fromUserId] || [];
        delete pendingCandidatesRef.current[fromUserId];
        for (const c of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (e) {
            console.warn("Queued ICE flush error:", e.message);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket()?.emit("webrtc:answer", {
          roomId: roomIdRef.current,
          answer,
          targetUserId: fromUserId,
        });
        isCallActiveRef.current = true;
      } catch (err) {
        console.error("Handle offer error:", err.message);
      }
    },
    [createPeerConnection],
  );

  // ─── Socket listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    const setup = () => {
      const socket = getSocket();
      if (!socket) {
        setTimeout(setup, 100);
        return;
      }

      socket.off("webrtc:offer");
      socket.off("webrtc:answer");
      socket.off("webrtc:ice_candidate");
      socket.off("webrtc:call_end");
      socket.off("webrtc:peer_in_room");
      socket.off("webrtc:user_joined_call");
      socket.off(SOCKET_EVENTS.ROOM_USER_LEFT);

      socket.on("webrtc:peer_in_room", async ({ userId }) => {
        if (userId !== userRef.current?.id) await sendOfferTo(userId);
      });

      socket.on("webrtc:user_joined_call", ({ userId }) => {
        console.log("👤 User joined call:", userId);
        if (userId !== userRef.current?.id) {
          // Existing participant proactively connects to the newcomer too —
          // don't rely solely on the newcomer's outgoing offers. This closes
          // the gap where two interviewers joined before the candidate and
          // one of them never independently re-confirms the candidate's link.
          sendOfferTo(userId);
        }
      });

      socket.on("webrtc:offer", async ({ offer, fromUserId }) => {
        if (fromUserId === userRef.current?.id) return;
        await handleIncomingOffer(offer, fromUserId);
      });

      socket.on("webrtc:answer", async ({ answer, fromUserId }) => {
        const pc = peerConnectionsRef.current[fromUserId];
        if (pc?.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          // Flush ICE candidates buffered before answer arrived
          const queued = pendingCandidatesRef.current[fromUserId] || [];
          delete pendingCandidatesRef.current[fromUserId];
          for (const c of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (e) {
              console.warn("Queued ICE flush error:", e.message);
            }
          }
        }
      });

      socket.on("webrtc:ice_candidate", async ({ candidate, fromUserId }) => {
        if (!candidate) return;
        const pc = peerConnectionsRef.current[fromUserId];
        // Buffer candidate if peer connection doesn't exist yet or remote
        // description hasn't been set — ICE candidates can arrive during the
        // async gap in handleIncomingOffer before setRemoteDescription runs.
        if (!pc || !pc.remoteDescription) {
          if (!pendingCandidatesRef.current[fromUserId]) {
            pendingCandidatesRef.current[fromUserId] = [];
          }
          pendingCandidatesRef.current[fromUserId].push(candidate);
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("ICE error:", err.message);
        }
      });

      socket.on("webrtc:call_end", ({ fromUserId }) => removePeer(fromUserId));
      socket.on(SOCKET_EVENTS.ROOM_USER_LEFT, ({ userId }) =>
        removePeer(userId),
      );
    };

    setup();
    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off("webrtc:offer");
        socket.off("webrtc:answer");
        socket.off("webrtc:ice_candidate");
        socket.off("webrtc:call_end");
        socket.off("webrtc:peer_in_room");
        socket.off("webrtc:user_joined_call");
        socket.off(SOCKET_EVENTS.ROOM_USER_LEFT);
      }
    };
  }, [roomId, sendOfferTo, handleIncomingOffer, removePeer]);

  // ─── Toggle mute / camera ─────────────────────────────────────────────────
  const handleToggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((p) => !p);
  };

  const handleToggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsCameraOff((p) => !p);
  };

  // ─── Canvas drawing loop ──────────────────────────────────────────────────
  // Draws screen capture (left 75%) + webcam feeds (right 25%) side-by-side.
  // screenVideoElem is an HTMLVideoElement for the captured screen; if null
  // the layout falls back to webcam-only (original behaviour).
  const startCanvasDrawing = (canvas, screenVideoElem) => {
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;

      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, W, H);

      if (screenVideoElem && screenVideoElem.readyState >= 2) {
        // Left 75% — code editor screen capture
        const screenW = Math.floor(W * 0.75);
        ctx.drawImage(screenVideoElem, 0, 0, screenW, H);

        // Subtle separator
        ctx.fillStyle = "#30363d";
        ctx.fillRect(screenW, 0, 2, H);

        // Right 25% — stack all webcam feeds
        const camW = W - screenW - 2;
        const camX = screenW + 2;
        const remoteElems = Object.values(remoteVideoElemsRef.current);
        const allCams = [...remoteElems, localVideoRef.current].filter(Boolean);
        const camH = Math.floor(H / Math.max(allCams.length, 1));
        allCams.forEach((vid, i) => {
          if (vid?.readyState >= 2) {
            ctx.drawImage(vid, camX, i * camH, camW, camH);
          }
        });

        // Label
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("Code Screen", 8, 22);
      } else {
        // Webcam-only fallback (no screen capture)
        const remoteElems = Object.values(remoteVideoElemsRef.current);

        if (remoteElems.length === 0) {
          if (localVideoRef.current?.readyState >= 2) {
            ctx.drawImage(localVideoRef.current, 0, 0, W, H);
          }
        } else {
          const topH = Math.floor(H * 0.6);
          const botH = H - topH;

          const candidateEntry = Object.entries(
            remoteVideoElemsRef.current,
          ).find(([userId]) => {
            const p = participants.find((p) => p.userId === userId);
            return p?.role === "CANDIDATE";
          });
          const otherElems = Object.entries(remoteVideoElemsRef.current).filter(
            ([userId]) => {
              const p = participants.find((p) => p.userId === userId);
              return p?.role !== "CANDIDATE";
            },
          );

          if (candidateEntry) {
            const [, videoElem] = candidateEntry;
            if (videoElem.readyState >= 2)
              ctx.drawImage(videoElem, 0, 0, W, topH);
          } else if (remoteElems[0]?.readyState >= 2) {
            ctx.drawImage(remoteElems[0], 0, 0, W, topH);
          }

          const bottomVideos = [
            ...otherElems.map(([, v]) => v),
            localVideoRef.current,
          ].filter(Boolean);
          const colW = Math.floor(W / Math.max(bottomVideos.length, 1));
          bottomVideos.forEach((vid, i) => {
            if (vid?.readyState >= 2)
              ctx.drawImage(vid, i * colW, topH, colW, botH);
          });
        }

        ctx.font = "14px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillText("🎯 Candidate", 10, 30);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  // ─── Start recording ──────────────────────────────────────────────────────
  const handleStartRecording = async () => {
    try {
      const stream = await getUserMedia();

      // Request screen capture — includes the code editor
      let screenStream = null;
      let screenVideoElem = null;
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080, frameRate: 30 },
          audio: false,
        });
        screenStreamRef.current = screenStream;
        screenVideoElem = document.createElement("video");
        screenVideoElem.srcObject = screenStream;
        screenVideoElem.autoplay = true;
        screenVideoElem.playsInline = true;
        screenVideoElem.muted = true;
        await new Promise((res) => {
          screenVideoElem.onloadedmetadata = res;
        });
        await screenVideoElem.play();
      } catch {
        // User declined screen share — fall back to webcam-only
        toast("Screen share declined — recording webcam only", { icon: "ℹ️" });
      }

      // Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      canvasRef.current = canvas;

      // Start drawing (screen + webcam composite)
      startCanvasDrawing(canvas, screenVideoElem);

      // Mix all audio: local mic + all remote participant streams
      const audioCtx = new AudioContext();
      const mixDest = audioCtx.createMediaStreamDestination();

      // Local mic
      if (stream.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(stream).connect(mixDest);
      }
      // Remote participants
      Object.values(remoteVideos).forEach((remoteStream) => {
        if (remoteStream.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(remoteStream).connect(mixDest);
        }
      });

      const canvasStream = canvas.captureStream(30);
      mixDest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

      // Start MediaRecorder
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(canvasStream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current);
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        audioCtx.close();
        await uploadRecording();
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast(
        screenVideoElem
          ? "Recording started (screen + webcam)"
          : "Recording started (webcam only)",
        { icon: "⏺" },
      );
    } catch (err) {
      console.error("Start recording error:", err.message);
      toast.error("Failed to start recording");
    }
  };

  // ─── Stop recording ───────────────────────────────────────────────────────
  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    toast("Processing recording...", { icon: "⏳" });
  };

  // ─── Upload to R2 via Spring Boot ─────────────────────────────────────────
  const uploadRecording = async () => {
    if (recordedChunksRef.current.length === 0) return;

    setIsUploading(true);
    toast("Uploading recording to cloud...", { icon: "☁️" });

    try {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const formData = new FormData();
      formData.append("file", blob, `recording-${Date.now()}.webm`);

      const id = interviewId;
      if (!id) {
        // No interviewId — download locally as fallback
        downloadLocally(blob);
        return;
      }

      const response = await recordingAPI.upload(id, formData);
      toast.success("Recording uploaded! Link saved to interview.");
      console.log("✅ Recording URL:", response.data.url);
    } catch (err) {
      console.error("Upload error:", err.message);
      toast.error("Upload failed — downloading locally");
      // Fallback — download locally
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      downloadLocally(blob);
    } finally {
      setIsUploading(false);
      recordedChunksRef.current = [];
    }
  };

  const downloadLocally = (blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coderoom-${roomId}-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const remoteVideoEntries = Object.entries(remoteVideos);
  // total = all remotes + local; drives grid column count
  const totalVideos = remoteVideoEntries.length + 1;
  const gridCols = totalVideos >= 3 ? "grid-cols-2" : "grid-cols-1";

  return (
    <div className="h-full flex flex-col bg-[#161b22]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-[#3fb950] rounded-full animate-pulse" />
          <span className="text-xs text-[#8b949e] font-medium">
            Live · {connectedCount + 1} participant
            {connectedCount + 1 !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleToggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              isMuted
                ? "bg-[#da3633] text-white"
                : "bg-[#21262d] text-[#8b949e] hover:text-white"
            }`}
          >
            {isMuted ? "🔇" : "🎤"}
          </button>
          <button
            onClick={handleToggleCamera}
            title={isCameraOff ? "Turn camera on" : "Turn camera off"}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              isCameraOff
                ? "bg-[#da3633] text-white"
                : "bg-[#21262d] text-[#8b949e] hover:text-white"
            }`}
          >
            {isCameraOff ? "📵" : "📷"}
          </button>
        </div>
      </div>

      {/* Videos — unified equal-size grid, auto-adjusts columns as people join */}
      <div className="flex-1 p-2 overflow-y-auto">
        {remoteVideoEntries.length === 0 && (
          <div className="flex items-center justify-center bg-[#0d1117] rounded-lg py-3 mb-1.5">
            <div className="text-center">
              <div className="w-8 h-8 bg-[#21262d] rounded-full flex items-center justify-center mx-auto mb-1.5">
                <span className="text-base">👤</span>
              </div>
              <p className="text-xs text-[#484f58]">Waiting for others...</p>
            </div>
          </div>
        )}

        <div className={`grid gap-1.5 ${gridCols}`}>
          {/* Remote participants */}
          {remoteVideoEntries.map(([userId, stream]) => {
            const p = participants.find((p) => p.userId === userId);
            const label =
              p?.role === "CANDIDATE"
                ? "🎯 Candidate"
                : p?.email?.split("@")[0] || "Interviewer";
            const camOff = remoteCameraOff[userId];
            return (
              <div
                key={userId}
                className="relative aspect-video rounded-lg overflow-hidden bg-[#0d1117]"
              >
                <RemoteVideoFill stream={stream} />
                {camOff && <AvatarFallback label={label} />}
                <span className="absolute bottom-1 left-2 text-xs text-white bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[90%]">
                  {label}
                </span>
              </div>
            );
          })}

          {/* Local video — same tile size as remotes */}
          {(() => {
            const localLabel = `You${isLeadInterviewer ? " 👑" : ""}`;
            return (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-[#0d1117]">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {isCameraOff && <AvatarFallback label={localLabel} />}
                <span className="absolute bottom-1 left-2 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
                  {localLabel}
                </span>
                {isMuted && (
                  <span className="absolute bottom-1 right-2 text-xs bg-[#da3633] px-1.5 py-0.5 rounded">
                    🔇
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Recording — any interviewer */}
      {user?.role === "INTERVIEWER" && (
        <div className="p-2 border-t border-[#30363d] space-y-1.5">
          {isUploading ? (
            <div className="flex items-center justify-center gap-2 text-xs text-[#8b949e] py-1.5">
              <svg
                className="animate-spin h-3 w-3"
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
              Uploading to cloud...
            </div>
          ) : isRecording ? (
            <>
              <div className="flex items-center justify-center gap-2 text-xs text-[#f85149] py-0.5">
                <span className="w-2 h-2 bg-[#f85149] rounded-full animate-pulse" />
                Recording in progress...
              </div>
              <button
                onClick={handleStopRecording}
                className="w-full text-xs py-1.5 rounded-lg bg-[#da3633] hover:bg-[#f85149] text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                ⏹ Stop &amp; Save
              </button>
            </>
          ) : (
            <button
              onClick={handleStartRecording}
              className="w-full text-xs py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] border border-[#30363d] font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              ⏺ Record Session
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Fills whatever grid cell it's placed in — no wrapper div, no fixed aspect ratio.
const RemoteVideoFill = ({ stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
};

export default VideoPanel;
