import React, { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import { useParams } from "react-router-dom";

const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

const socket = io("https://meeting-project-be-production.up.railway.app", {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
});

const buildAudioPipeline = (rawStream, musicMode = false) => {
  const ac = new AudioContext();
  const source = ac.createMediaStreamSource(rawStream);
  const destination = ac.createMediaStreamDestination();

  const highpass = ac.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = musicMode ? 40 : 80;

  const lowpass = ac.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = musicMode ? 20000 : 8000;

  const compressor = ac.createDynamicsCompressor();
  if (musicMode) {
    compressor.threshold.value = -24;
    compressor.knee.value = 10;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
  } else {
    compressor.threshold.value = -30;
    compressor.knee.value = 5;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.1;
  }

  let noiseGateNode = null;
  if (!musicMode) {
    const bufferSize = 2048;
    noiseGateNode = ac.createScriptProcessor(bufferSize, 1, 1);
    const GATE_THRESHOLD = 0.008;
    const HOLD_FRAMES = 15;
    let holdCount = 0;
    let gateOpen = true;
    noiseGateNode.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);
      if (rms > GATE_THRESHOLD) {
        holdCount = HOLD_FRAMES;
        gateOpen = true;
      } else if (holdCount > 0) {
        holdCount--;
      } else {
        gateOpen = false;
      }
      for (let i = 0; i < input.length; i++)
        output[i] = gateOpen ? input[i] : 0;
    };
  }

  source.connect(highpass);
  highpass.connect(lowpass);
  if (noiseGateNode) {
    lowpass.connect(noiseGateNode);
    noiseGateNode.connect(compressor);
  } else {
    lowpass.connect(compressor);
  }
  compressor.connect(destination);

  return {
    audioContext: ac,
    processedStream: destination.stream,
    destroy: () => {
      try {
        source.disconnect();
        highpass.disconnect();
        lowpass.disconnect();
        noiseGateNode?.disconnect();
        compressor.disconnect();
        destination.disconnect();
        ac.close();
      } catch {}
    },
  };
};

const mergeStreams = (videoStream, processedAudioStream) => {
  const merged = new MediaStream();
  videoStream.getVideoTracks().forEach((t) => merged.addTrack(t));
  processedAudioStream.getAudioTracks().forEach((t) => merged.addTrack(t));
  return merged;
};

// ── Screen Share Tile ─────────────────────────────────────────────────────────
// Har user ki alag screen share tile
const ScreenShareTile = React.memo(({ stream, userName, isLocal, onStop }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gray-900 border border-white/10 flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      {/* Badge: kaun share kar raha hai */}
      <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1.5">
        <ScreenIcon className="w-3.5 h-3.5" />
        {isLocal ? "Aap present kar rahe hain" : `${userName} present kar raha/rahi hai`}
      </div>
      {/* Local screen share band karne ka button */}
      {isLocal && onStop && (
        <button
          onClick={onStop}
          className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1 rounded-full transition-all"
        >
          Stop
        </button>
      )}
    </div>
  );
});

// ── Participant Tile (sidebar card) ──────────────────────────────────────────
const ParticipantTile = React.memo(
  ({ user, isLocal, camOn, micOn, videoRef: externalRef }) => {
    const internalRef = useRef(null);
    const videoRef = externalRef || internalRef;
    const [hasVideo, setHasVideo] = useState(isLocal ? camOn : false);
    const [status, setStatus] = useState("connecting");

    useEffect(() => {
      if (isLocal) {
        setHasVideo(camOn);
        return;
      }
      user._onStream = (remoteStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch(() => {});
        }
        const vt = remoteStream.getVideoTracks();
        setHasVideo(vt.length > 0 && vt[0].enabled);
        setStatus("connected");
      };
      user._setStatus = (s) => setStatus(s);
      if (user._pendingStream) {
        user._onStream(user._pendingStream);
        user._pendingStream = null;
      }
      return () => {
        user._onStream = null;
        user._setStatus = null;
      };
    }, [user, isLocal, camOn, videoRef]);

    const initials = (user.name || "U").slice(0, 2).toUpperCase();
    const colors = [
      "bg-teal-600",
      "bg-blue-600",
      "bg-violet-600",
      "bg-rose-600",
      "bg-amber-600",
    ];
    const color = colors[(user.id?.charCodeAt(0) || 0) % colors.length];

    return (
      <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video flex items-center justify-center border border-white/10 group hover:border-blue-500/50 transition-all duration-200">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{ transform: isLocal ? "scaleX(-1)" : "none" }}
          className={`absolute inset-0 w-full h-full object-cover ${hasVideo ? "block" : "hidden"}`}
        />
        {!hasVideo && (
          <div
            className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white font-bold text-lg`}
          >
            {initials}
          </div>
        )}
        {/* Name + mic bar */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent">
          <span className="text-white text-xs font-medium truncate">
            {isLocal ? "Aap" : user.name || "User"}
          </span>
          <div className="flex items-center gap-1">
            {isLocal ? (
              micOn ? (
                <MicIcon className="w-3 h-3 text-white" />
              ) : (
                <MicOffIcon className="w-3 h-3 text-red-400" />
              )
            ) : status !== "connected" ? (
              <span className="text-yellow-400 text-xs">⏳</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
);

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const MicIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0012 6.32V20h-3v2h8v-2h-3v-2.68A7 7 0 0019 11h-2z" />
  </svg>
);
const MicOffIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
  </svg>
);
const CamIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
  </svg>
);
const CamOffIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M21 6.5l-4 4V7a1 1 0 00-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 00-1 1v10a1 1 0 001 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
  </svg>
);
const ScreenIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h7v2H9v2h6v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z" />
  </svg>
);
const LeaveIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 00-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z" />
  </svg>
);
const MusicIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
  </svg>
);

// ── Room ──────────────────────────────────────────────────────────────────────
export const Room = () => {
  const { id } = useParams();

  const [users, setUsers] = useState([]);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [musicMode, setMusicMode] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  // LOCAL screen share state
  const [screenSharing, setScreenSharing] = useState(false);
  const [localScreenStream, setLocalScreenStream] = useState(null);

  // REMOTE screen shares — { peerId, stream, userName }[]
  const [remoteScreens, setRemoteScreens] = useState([]);

  const rawStreamRef = useRef(null);
  const streamRef = useRef(null);
  const pipelineRef = useRef(null);
  const localVideoRef = useRef(null);
  const localScreenStreamRef = useRef(null);
  const peersRef = useRef([]);

  // ── Local Screen Share ──────────────────────────────────────────────────────
  const toggleScreenShare = async () => {
    try {
      if (!screenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenTrack = stream.getVideoTracks()[0];
        localScreenStreamRef.current = stream;
        setLocalScreenStream(stream);

        // Har peer ko screen track bhejo
        peersRef.current.forEach(({ peer }) => {
          stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        });

        screenTrack.onended = () => stopScreenShare();
        setScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const stopScreenShare = () => {
    peersRef.current.forEach(({ peer }) => {
      const senders = peer._pc?.getSenders() || [];
      senders.forEach((sender) => {
        if (
          sender.track?.kind === "video" &&
          sender.track?.label?.includes("screen")
        )
          sender.replaceTrack(null);
      });
    });
    localScreenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localScreenStreamRef.current = null;
    setLocalScreenStream(null);
    setScreenSharing(false);
  };

  // ── Audio Pipeline ──────────────────────────────────────────────────────────
  const applyAudioPipeline = useCallback((rawStream, isMusicMode) => {
    if (pipelineRef.current) {
      pipelineRef.current.destroy();
      pipelineRef.current = null;
    }
    const pipeline = buildAudioPipeline(rawStream, isMusicMode);
    pipelineRef.current = pipeline;
    const merged = mergeStreams(rawStream, pipeline.processedStream);
    streamRef.current = merged;
    return merged;
  }, []);

  // ── Peer Creation ───────────────────────────────────────────────────────────
  const makePeer = useCallback((targetId, initiator, incomingSignal = null) => {
    if (peersRef.current.find((p) => p.peerID === targetId)) return null;
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: streamRef.current || undefined,
      config: ICE_CONFIG,
    });
    const userEntry = {
      id: targetId,
      name: "User",
      isSelf: false,
      _onStream: null,
      _setStatus: null,
      _pendingStream: null,
    };

    peer.on("signal", (signal) => {
      if (initiator)
        socket.emit("sending-signal", { userId: targetId, signal });
      else socket.emit("returning-signal", { signal, to: targetId });
    });

    // Remote stream receive: camera vs screen share alag karo
    peer.on("stream", (remoteStream) => {
      const videoTracks = remoteStream.getVideoTracks();
      const isScreenShare =
        videoTracks.length > 0 &&
        (videoTracks[0].label?.toLowerCase().includes("screen") ||
          videoTracks[0].label?.toLowerCase().includes("display") ||
          videoTracks[0].label?.toLowerCase().includes("window") ||
          remoteStream.getAudioTracks().length === 0); // screen share mein aksar audio nahi hota

      if (isScreenShare) {
        // Remote screen share add karo
        setRemoteScreens((prev) => {
          // Agar pehle se hai to replace karo
          const exists = prev.find((s) => s.peerId === targetId);
          if (exists) {
            return prev.map((s) =>
              s.peerId === targetId
                ? { ...s, stream: remoteStream }
                : s
            );
          }
          return [
            ...prev,
            {
              peerId: targetId,
              stream: remoteStream,
              userName: userEntry.name || "User",
            },
          ];
        });
      } else {
        // Normal camera stream
        if (userEntry._onStream) userEntry._onStream(remoteStream);
        else userEntry._pendingStream = remoteStream;
      }
    });

    peer.on("connect", () => {
      if (userEntry._setStatus) userEntry._setStatus("connected");
    });
    peer.on("close", () => {
      if (userEntry._setStatus) userEntry._setStatus("failed");
      // User ke jaane par uski screen share remove karo
      setRemoteScreens((prev) => prev.filter((s) => s.peerId !== targetId));
    });
    peer.on("error", () => {
      if (userEntry._setStatus) userEntry._setStatus("failed");
    });

    if (!initiator && incomingSignal) peer.signal(incomingSignal);
    return { peer, userEntry };
  }, []);

  // ── Init: media + socket ────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    const init = async () => {
      try {
        const raw = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
          },
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        });
        if (disposed) {
          raw.getTracks().forEach((t) => t.stop());
          return;
        }
        rawStreamRef.current = raw;
        setMicOn(true);
        setCamOn(true);
        applyAudioPipeline(raw, false);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = raw;
          localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        try {
          const audioRaw = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: false,
              autoGainControl: false,
            },
            video: false,
          });
          if (!disposed) {
            rawStreamRef.current = audioRaw;
            applyAudioPipeline(audioRaw, false);
            setMicOn(true);
            setError("Camera unavailable — audio only.");
          } else {
            audioRaw.getTracks().forEach((t) => t.stop());
            return;
          }
        } catch (ae) {
          setError(
            `Mic/Camera blocked (${ae.name}). Please allow access and reload.`
          );
          streamRef.current = null;
        }
      }
      if (disposed) return;

      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-signal");
      socket.off("answer-signal");
      socket.off("user-left");
      socket.off("screen-share-stopped");

      socket.on("all-users", (ids) => {
        ids.forEach((uid) => {
          const result = makePeer(uid, true);
          if (!result) return;
          peersRef.current.push({ peerID: uid, ...result });
          setUsers((prev) => [...prev, result.userEntry]);
        });
      });

      socket.on("user-joined", (uid) => console.log("➕ Joined:", uid));

      socket.on("receiving-signal", ({ signal, from }) => {
        const existing = peersRef.current.find((p) => p.peerID === from);
        if (existing) {
          existing.peer.signal(signal);
          return;
        }
        const result = makePeer(from, false, signal);
        if (!result) return;
        peersRef.current.push({ peerID: from, ...result });
        setUsers((prev) => [...prev, result.userEntry]);
      });

      socket.on("answer-signal", ({ signal, from }) => {
        const item = peersRef.current.find((p) => p.peerID === from);
        if (item) item.peer.signal(signal);
      });

      socket.on("user-left", (uid) => {
        const item = peersRef.current.find((p) => p.peerID === uid);
        if (item) {
          try { item.peer.destroy(); } catch {}
        }
        peersRef.current = peersRef.current.filter((p) => p.peerID !== uid);
        setUsers((prev) => prev.filter((u) => u.id !== uid));
        // Us user ki screen share bhi remove karo
        setRemoteScreens((prev) => prev.filter((s) => s.peerId !== uid));
      });

      // Optional: server se screen-share-stopped signal
      socket.on("screen-share-stopped", (uid) => {
        setRemoteScreens((prev) => prev.filter((s) => s.peerId !== uid));
      });

      setUsers([{ id: socket.id || "self", name: "Aap", isSelf: true }]);
      setReady(true);
      const doJoin = () => socket.emit("join-room", id);
      socket.connected ? doJoin() : socket.once("connect", doJoin);
    };

    init();
    return () => {
      disposed = true;
      peersRef.current.forEach(({ peer }) => {
        try { peer.destroy(); } catch {}
      });
      peersRef.current = [];
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-signal");
      socket.off("answer-signal");
      socket.off("user-left");
      socket.off("screen-share-stopped");
      pipelineRef.current?.destroy();
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id, makePeer, applyAudioPipeline]);

  // ── Music Mode Toggle ───────────────────────────────────────────────────────
  const toggleMusicMode = useCallback(() => {
    const raw = rawStreamRef.current;
    if (!raw) return;
    const next = !musicMode;
    setMusicMode(next);
    const newProcessed = applyAudioPipeline(raw, next);
    const newAudioTrack = newProcessed.getAudioTracks()[0];
    if (newAudioTrack) {
      peersRef.current.forEach(({ peer }) => {
        try {
          const senders = peer._pc?.getSenders?.() || [];
          const audioSender = senders.find((s) => s.track?.kind === "audio");
          if (audioSender) audioSender.replaceTrack(newAudioTrack);
        } catch (e) {}
      });
    }
  }, [musicMode, applyAudioPipeline]);

  const toggleMic = () => {
    const track = rawStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !micOn;
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    const track = rawStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !camOn;
    setCamOn(!camOn);
  };

  const leaveRoom = () => {
    pipelineRef.current?.destroy();
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    localScreenStreamRef.current?.getTracks().forEach((t) => t.stop());
    window.location.href = "/";
  };

  const remoteUsers = users.filter((u) => !u.isSelf);

  // Koi bhi screen share active hai?
  const anyScreenActive =
    screenSharing || remoteScreens.length > 0;

  // Screen shares ki total count (local + remote)
  const totalScreens =
    (screenSharing ? 1 : 0) + remoteScreens.length;

  return (
    <div
      className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden"
      style={{ fontFamily: "'Google Sans', 'Roboto', sans-serif" }}
    >
      {/* ── Top Bar ── */}
      <header className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <CamIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white text-sm">Velo Meet</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded-md">
            {id}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium px-3 py-1 rounded-full ${
              musicMode
                ? "bg-violet-900/60 text-violet-300 border border-violet-700"
                : "bg-blue-900/60 text-blue-300 border border-blue-700"
            }`}
          >
            {musicMode ? "🎵 Music" : "🎙️ Voice"}
          </span>
          {anyScreenActive && (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-yellow-900/60 text-yellow-300 border border-yellow-700">
              🖥️ {totalScreens} Screen{totalScreens > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
            👥 {users.length}
          </span>
        </div>
      </header>

      {/* ── Error bar ── */}
      {error && (
        <div className="mx-4 mt-3 bg-red-900/50 border border-red-700 text-red-300 text-sm px-4 py-2 rounded-lg shrink-0">
          ⚠️ {error}
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-y-auto p-3 gap-3">

          {/* ── Screen Share Section: Har screen alag tile mein ── */}
          {anyScreenActive && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2 px-1">
                🖥️ Screen Shares ({totalScreens})
              </p>
              <div
                className={`grid gap-3 ${
                  totalScreens === 1
                    ? "grid-cols-1"
                    : totalScreens === 2
                    ? "grid-cols-2"
                    : "grid-cols-2 xl:grid-cols-3"
                }`}
              >
                {/* Apni local screen share */}
                {screenSharing && localScreenStream && (
                  <ScreenShareTile
                    stream={localScreenStream}
                    userName="Aap"
                    isLocal={true}
                    onStop={stopScreenShare}
                  />
                )}
                {/* Remote users ki screen shares — har ek alag tile */}
                {remoteScreens.map((s) => (
                  <ScreenShareTile
                    key={s.peerId}
                    stream={s.stream}
                    userName={s.userName}
                    isLocal={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Participants Grid ── */}
          <div>
            {anyScreenActive && (
              <p className="text-xs text-gray-500 font-medium mb-2 px-1">
                👥 Participants
              </p>
            )}
            <div
              className={`grid gap-3 content-start ${
                users.length <= 1
                  ? "grid-cols-1"
                  : users.length === 2
                  ? "grid-cols-1 md:grid-cols-2"
                  : users.length <= 4
                  ? "grid-cols-2"
                  : "grid-cols-2 md:grid-cols-3"
              }`}
            >
              {/* Local tile */}
              <ParticipantTile
                user={{ id: "self", name: "Aap" }}
                isLocal
                camOn={camOn}
                micOn={micOn}
                videoRef={localVideoRef}
              />
              {/* Remote tiles — har user ka alag tile */}
              {remoteUsers.map((user) => (
                <ParticipantTile key={user.id} user={user} isLocal={false} />
              ))}
            </div>
          </div>

          {/* Waiting message */}
          {ready && remoteUsers.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  ⏳ Doosron ka intezaar hai...
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  Room code share karein invite karne ke liye
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Control Bar ── */}
      <div className="shrink-0 bg-gray-900 border-t border-white/10 px-6 py-4 flex items-center justify-center gap-3 flex-wrap">
        {/* Mic */}
        <button
          onClick={toggleMic}
          title={micOn ? "Mute" : "Unmute"}
          className={`flex flex-col items-center gap-1 p-3 rounded-full transition-all duration-200 ${
            micOn
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          {micOn ? (
            <MicIcon className="w-5 h-5" />
          ) : (
            <MicOffIcon className="w-5 h-5" />
          )}
        </button>

        {/* Cam */}
        <button
          onClick={toggleCam}
          title={camOn ? "Camera band karo" : "Camera chalu karo"}
          className={`flex flex-col items-center gap-1 p-3 rounded-full transition-all duration-200 ${
            camOn
              ? "bg-gray-700 hover:bg-gray-600 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          {camOn ? (
            <CamIcon className="w-5 h-5" />
          ) : (
            <CamOffIcon className="w-5 h-5" />
          )}
        </button>

        {/* Screen share */}
        <button
          onClick={toggleScreenShare}
          title={screenSharing ? "Sharing band karo" : "Screen share karo"}
          className={`flex items-center gap-2 px-4 py-3 rounded-full font-medium text-sm transition-all duration-200 ${
            screenSharing
              ? "bg-yellow-500 hover:bg-yellow-600 text-black"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
        >
          <ScreenIcon className="w-5 h-5" />
          <span className="hidden sm:inline">
            {screenSharing ? "Stop" : "Present"}
          </span>
        </button>

        {/* Music / Voice mode */}
        <button
          onClick={toggleMusicMode}
          title={musicMode ? "Voice Mode" : "Music Mode"}
          className={`flex items-center gap-2 px-4 py-3 rounded-full font-medium text-sm transition-all duration-200 ${
            musicMode
              ? "bg-violet-700 hover:bg-violet-600 text-white border border-violet-500"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }`}
        >
          <MusicIcon className="w-5 h-5" />
          <span className="hidden sm:inline">
            {musicMode ? "Music" : "Voice"}
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-white/20" />

        {/* Leave */}
        <button
          onClick={leaveRoom}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all duration-200"
        >
          <LeaveIcon className="w-5 h-5" />
          <span>Leave</span>
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
};