import { useEffect, useRef, useState } from "react";
import useAuthStore from "../../store/authStore.js";
import { SOCKET_EVENTS } from "../../utils/constants.js";
import { getSocket } from "../../services/socket.js";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const VideoPanel = ({ roomId }) => {
  const { user } = useAuthStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [remoteConnected, setRemoteConnected] = useState(false);

  // ─── Setup socket WebRTC signaling ────────────────────────────────────────
  useEffect(() => {
    // Wait for socket to be ready
    let socket = getSocket();
    if (!socket) {
      const interval = setInterval(() => {
        socket = getSocket();
        if (socket) {
          clearInterval(interval);
          setupSocketListeners(socket);
        }
      }, 100);
      return () => clearInterval(interval);
    }
    setupSocketListeners(socket);

    function setupSocketListeners(socket) {
      socket.on(SOCKET_EVENTS.WEBRTC_OFFER, async ({ offer, fromUserId }) => {
        console.log("📞 Received offer from", fromUserId);
        await handleReceiveOffer(offer, fromUserId);
      });

      socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, async ({ answer }) => {
        console.log("✅ Received answer");
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
        }
      });

      socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, async ({ candidate }) => {
        if (peerConnectionRef.current && candidate) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate),
          );
        }
      });

      socket.on(SOCKET_EVENTS.WEBRTC_CALL_END, () => {
        console.log("📵 Remote peer ended call");
        handleCallEnd();
      });
    }

    return () => {
      const s = getSocket();
      if (s) {
        s.off(SOCKET_EVENTS.WEBRTC_OFFER);
        s.off(SOCKET_EVENTS.WEBRTC_ANSWER);
        s.off(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE);
        s.off(SOCKET_EVENTS.WEBRTC_CALL_END);
      }
    };
  }, [roomId]);

  // ─── Create peer connection ───────────────────────────────────────────────
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // When we have an ICE candidate — send to remote peer via relay
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    // When remote stream arrives — show in remote video
    pc.ontrack = (event) => {
      console.log("🎥 Remote stream received");
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteConnected(true);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      console.log("🔗 Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setIsConnecting(false);
        setRemoteConnected(true);
      }
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        setRemoteConnected(false);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // ─── Get user media ───────────────────────────────────────────────────────
  const getUserMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    return stream;
  };

  // ─── Start call (initiator) ───────────────────────────────────────────────
  const handleStartCall = async () => {
    try {
      setIsConnecting(true);
      const stream = await getUserMedia();
      const pc = createPeerConnection();

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to remote peer via relay
      const socket = getSocket();
      socket?.emit(SOCKET_EVENTS.WEBRTC_OFFER, {
        roomId,
        offer,
        fromUserId: user?.id,
      });

      setIsCallActive(true);
      console.log("📞 Offer sent");
    } catch (err) {
      console.error("Failed to start call:", err);
      setIsConnecting(false);
    }
  };

  // ─── Receive offer (responder) ────────────────────────────────────────────
  const handleReceiveOffer = async (offer, fromUserId) => {
    try {
      setIsConnecting(true);
      const stream = await getUserMedia();
      const pc = createPeerConnection();

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Set remote description from offer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer back via relay
      const socket = getSocket();
      socket?.emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
        roomId,
        answer,
        targetUserId: fromUserId,
      });

      setIsCallActive(true);
      console.log("✅ Answer sent");
    } catch (err) {
      console.error("Failed to receive offer:", err);
      setIsConnecting(false);
    }
  };

  // ─── End call ─────────────────────────────────────────────────────────────
  const handleCallEnd = () => {
    // Stop all tracks
    localStreamRef.current?.getTracks().forEach((track) => track.stop());

    // Close peer connection
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    // Stop recording if active
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }

    // Clear video elements
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setIsCallActive(false);
    setRemoteConnected(false);
    setIsConnecting(false);
  };

  const handleEndCall = () => {
    const socket = getSocket();
    socket?.emit(SOCKET_EVENTS.WEBRTC_CALL_END, { roomId });
    handleCallEnd();
  };

  // ─── Toggle mute ──────────────────────────────────────────────────────────
  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // ─── Toggle camera ────────────────────────────────────────────────────────
  const handleToggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  // ─── Start recording ──────────────────────────────────────────────────────
  const handleStartRecording = () => {
    if (!localStreamRef.current) return;

    recordedChunksRef.current = [];

    const mediaRecorder = new MediaRecorder(localStreamRef.current, {
      mimeType: "video/webm;codecs=vp9,opus",
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      // Create downloadable blob
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `coderoom-interview-${roomId}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start(1000); // collect chunks every 1 second
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  };

  // ─── Stop recording ───────────────────────────────────────────────────────
  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      handleCallEnd();
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-[#161b22]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#30363d] flex items-center justify-between">
        <span className="text-xs text-[#8b949e] font-medium">Video Call</span>
        {remoteConnected && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-[#3fb950] rounded-full" />
            <span className="text-xs text-[#3fb950]">Connected</span>
          </div>
        )}
      </div>

      {/* Videos */}
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
        {/* Remote video */}
        <div className="flex-1 bg-[#0d1117] rounded-lg overflow-hidden relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!remoteConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-[#21262d] rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">👤</span>
                </div>
                <p className="text-xs text-[#484f58]">
                  {isConnecting ? "Connecting..." : "Waiting for other person"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Local video */}
        <div className="h-28 bg-[#0d1117] rounded-lg overflow-hidden relative">
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

      {/* Controls */}
      <div className="p-3 border-t border-[#30363d] space-y-2">
        {/* Call controls */}
        <div className="flex items-center justify-center gap-2">
          {!isCallActive ? (
            <button
              onClick={handleStartCall}
              disabled={isConnecting}
              className="flex-1 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-xs py-2 rounded-lg transition-colors font-medium"
            >
              {isConnecting ? "Connecting..." : "📞 Start Call"}
            </button>
          ) : (
            <>
              {/* Mute */}
              <button
                onClick={handleToggleMute}
                className={`p-2 rounded-lg text-xs transition-colors ${
                  isMuted
                    ? "bg-[#da3633] text-white"
                    : "bg-[#21262d] text-[#8b949e] hover:text-white"
                }`}
              >
                {isMuted ? "🔇" : "🎤"}
              </button>

              {/* Camera */}
              <button
                onClick={handleToggleCamera}
                className={`p-2 rounded-lg text-xs transition-colors ${
                  isCameraOff
                    ? "bg-[#da3633] text-white"
                    : "bg-[#21262d] text-[#8b949e] hover:text-white"
                }`}
              >
                {isCameraOff ? "📵" : "📷"}
              </button>

              {/* End call */}
              <button
                onClick={handleEndCall}
                className="flex-1 bg-[#da3633] hover:bg-[#f85149] text-white text-xs py-2 rounded-lg transition-colors font-medium"
              >
                📵 End Call
              </button>
            </>
          )}
        </div>

        {/* Recording controls */}
        {isCallActive && (
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`w-full text-xs py-1.5 rounded-lg transition-colors font-medium flex items-center justify-center gap-1.5 ${
              isRecording
                ? "bg-[#da3633] hover:bg-[#f85149] text-white"
                : "bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white border border-[#30363d]"
            }`}
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

export default VideoPanel;
