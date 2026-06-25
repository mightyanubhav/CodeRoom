import { useEffect, useRef, useState, useCallback } from "react";
import useAuthStore from "../../store/authStore.js";
import { SOCKET_EVENTS } from "../../utils/constants.js";
import { getSocket } from "../../services/socket.js";
import toast from "react-hot-toast";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const VideoPanel = ({ roomId }) => {
  const { user } = useAuthStore();

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const isCallActiveRef = useRef(false);
  const userRef = useRef(user);
  const roomIdRef = useRef(roomId);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [remoteVideos, setRemoteVideos] = useState({});

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    roomIdRef.current = roomId;
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
    setRemoteVideos((prev) => {
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
          const socket = getSocket();
          socket?.emit("webrtc:ice_candidate", {
            roomId: roomIdRef.current,
            candidate: event.candidate,
            targetUserId,
          });
        }
      };

      pc.ontrack = (event) => {
        console.log("🎥 Got remote stream from", targetUserId);
        const stream = event.streams[0];
        setRemoteVideos((prev) => ({
          ...prev,
          [targetUserId]: stream,
        }));
      };

      pc.onconnectionstatechange = () => {
        console.log(`Connection ${targetUserId}:`, pc.connectionState);
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          removePeer(targetUserId);
        }
      };

      peerConnectionsRef.current[targetUserId] = pc;
      return pc;
    },
    [removePeer],
  );

  // ─── Send offer to specific user ──────────────────────────────────────────
  const sendOfferTo = useCallback(
    async (targetUserId) => {
      try {
        if (peerConnectionsRef.current[targetUserId]) return; // already connected

        console.log("📤 Sending offer to", targetUserId);
        const stream = await getUserMedia();
        const pc = createPeerConnection(targetUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const socket = getSocket();
        socket?.emit("webrtc:offer", {
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
        console.log("📥 Got offer from", fromUserId);
        const stream = await getUserMedia();
        const pc = createPeerConnection(fromUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const socket = getSocket();
        socket?.emit("webrtc:answer", {
          roomId: roomIdRef.current,
          answer,
          targetUserId: fromUserId,
        });

        isCallActiveRef.current = true;
        setIsCallActive(true);
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

      // Relay tells us who's already in room when WE start call
      // We send offers TO them
      socket.on("webrtc:peer_in_room", async ({ userId }) => {
        console.log("👥 Sending offer to existing peer:", userId);
        if (userId !== userRef.current?.id) {
          await sendOfferTo(userId);
        }
      });

      // Someone else started call while we're already in call
      // They will send us an offer via webrtc:peer_in_room
      // We don't need to do anything — just wait for their offer
      socket.on("webrtc:user_joined_call", ({ userId }) => {
        console.log(
          "👤 User joined call:",
          userId,
          "| I am in call:",
          isCallActiveRef.current,
        );
        // Do nothing — they will send us an offer via peer_in_room
        // This avoids both sides sending offers simultaneously
      });

      // Incoming offer
      socket.on("webrtc:offer", async ({ offer, fromUserId }) => {
        if (fromUserId === userRef.current?.id) return;
        console.log("📞 Offer from", fromUserId);
        await handleIncomingOffer(offer, fromUserId);
      });

      // Incoming answer
      socket.on(
        "webrtc:answer",
        async ({ answer, fromUserId, targetUserId }) => {
          
          console.log("✅ Answer from", fromUserId);
          const pc = peerConnectionsRef.current[fromUserId];
          if (pc?.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        },
      );

      // ICE candidate
      socket.on(
        "webrtc:ice_candidate",
        async ({ candidate, fromUserId, targetUserId }) => {
          
          const pc = peerConnectionsRef.current[fromUserId];
          if (pc && candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.warn("ICE error:", err.message);
            }
          }
        },
      );

      // Call ended by someone
      socket.on("webrtc:call_end", ({ fromUserId }) => {
        removePeer(fromUserId);
      });

      // User left room
      socket.on(SOCKET_EVENTS.ROOM_USER_LEFT, ({ userId }) => {
        removePeer(userId);
      });
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
  // ─── Start call ───────────────────────────────────────────────────────────
  const handleStartCall = async () => {
    try {
      await getUserMedia();

      isCallActiveRef.current = true;
      setIsCallActive(true);

      // Tell everyone in room we started call
      // They will send us offers if they're already in call
      const socket = getSocket();
      socket?.emit("webrtc:start_call", { roomId });

      toast("Call started!", { icon: "📞" });
    } catch (err) {
      console.error("Start call error:", err);
      toast.error("Could not access camera/microphone");
    }
  };

  // ─── End call ─────────────────────────────────────────────────────────────
  const handleEndCall = () => {
    const socket = getSocket();
    socket?.emit("webrtc:call_end", { roomId });

    Object.keys(peerConnectionsRef.current).forEach(removePeer);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }

    isCallActiveRef.current = false;
    setIsCallActive(false);
    setRemoteVideos({});
  };

  // ─── Mute / Camera ────────────────────────────────────────────────────────
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

  // ─── Recording ────────────────────────────────────────────────────────────
  const handleStartRecording = () => {
    if (!localStreamRef.current) return;
    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(localStreamRef.current, {
      mimeType: "video/webm;codecs=vp9,opus",
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coderoom-${roomId}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const remoteVideoEntries = Object.entries(remoteVideos);

  return (
    <div className="h-full flex flex-col bg-[#161b22]">
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
        <span className="text-xs text-[#8b949e] font-medium">Video Call</span>
        {remoteVideoEntries.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-[#3fb950] rounded-full" />
            <span className="text-xs text-[#3fb950]">
              {remoteVideoEntries.length} connected
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
        {remoteVideoEntries.length > 0 ? (
          <div
            className={`grid gap-2 ${remoteVideoEntries.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
          >
            {remoteVideoEntries.map(([userId, stream]) => (
              <RemoteVideo key={userId} stream={stream} />
            ))}
          </div>
        ) : (
          <div className="flex-1 bg-[#0d1117] rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 bg-[#21262d] rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-xl">👤</span>
              </div>
              <p className="text-xs text-[#484f58]">
                {isCallActive
                  ? "Waiting for others..."
                  : "Start call to connect"}
              </p>
            </div>
          </div>
        )}

        <div className="h-28 bg-[#0d1117] rounded-lg overflow-hidden relative shrink-0">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {isCameraOff && (
            <div className="absolute inset-0 bg-[#0d1117] flex items-center justify-center">
              <span className="text-xs text-[#484f58]">Camera off</span>
            </div>
          )}
          <span className="absolute bottom-1 left-2 text-xs text-white bg-black/50 px-1.5 py-0.5 rounded">
            You
          </span>
        </div>
      </div>

      <div className="p-3 border-t border-[#30363d] space-y-2">
        <div className="flex items-center justify-center gap-2">
          {!isCallActive ? (
            <button
              onClick={handleStartCall}
              className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white text-xs py-2 rounded-lg transition-colors font-medium"
            >
              📞 Start Call
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleMute}
                className={`p-2 rounded-lg text-xs transition-colors ${isMuted ? "bg-[#da3633] text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}
              >
                {isMuted ? "🔇" : "🎤"}
              </button>
              <button
                onClick={handleToggleCamera}
                className={`p-2 rounded-lg text-xs transition-colors ${isCameraOff ? "bg-[#da3633] text-white" : "bg-[#21262d] text-[#8b949e] hover:text-white"}`}
              >
                {isCameraOff ? "📵" : "📷"}
              </button>
              <button
                onClick={handleEndCall}
                className="flex-1 bg-[#da3633] hover:bg-[#f85149] text-white text-xs py-2 rounded-lg transition-colors font-medium"
              >
                📵 End Call
              </button>
            </>
          )}
        </div>
        {isCallActive && (
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`w-full text-xs py-1.5 rounded-lg transition-colors font-medium flex items-center justify-center gap-1.5 ${isRecording ? "bg-[#da3633] hover:bg-[#f85149] text-white" : "bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] border border-[#30363d]"}`}
          >
            {isRecording ? (
              <>
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Stop Recording
              </>
            ) : (
              <>⏺ Record Session</>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

const RemoteVideo = ({ stream }) => {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="bg-[#0d1117] rounded-lg overflow-hidden relative aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default VideoPanel;
