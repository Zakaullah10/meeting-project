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

// ─────────────────────────────────────────────────────────────────────────────
//  Audio Processing Pipeline (Web Audio API)
//
//  VOICE MODE (default):
//    mic → highpass(80Hz) → lowpass(8kHz) → noiseGate → compressor → out
//    • Cuts bass rumble below 80Hz
//    • Cuts hiss above 8kHz
//    • Noise gate: silences mic when RMS drops below threshold (background quiet)
//    • Compressor: evens out volume
//
//  MUSIC MODE:
//    mic → highpass(40Hz) → lowpass(20kHz) → compressor → out
//    • Very gentle high-pass only (removes sub-bass hum)
//    • Full frequency range so music sounds natural
//    • No noise gate (music plays continuously, gate would cut it)
//    • Lighter compression
// ─────────────────────────────────────────────────────────────────────────────
const buildAudioPipeline = (rawStream, musicMode = false) => {
  const ac = new AudioContext();
  const source = ac.createMediaStreamSource(rawStream);
  const destination = ac.createMediaStreamDestination();

  // 1. High-pass — remove rumble
  const highpass = ac.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = musicMode ? 40 : 80;

  // 2. Low-pass — remove hiss
  const lowpass = ac.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = musicMode ? 20000 : 8000;

  // 3. Compressor
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

  // 4. Noise Gate (voice mode only)
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

      for (let i = 0; i < input.length; i++) {
        output[i] = gateOpen ? input[i] : 0;
      }
    };
  }

  // Wire chain
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

// Merge processed audio + original video
const mergeStreams = (videoStream, processedAudioStream) => {
  const merged = new MediaStream();
  videoStream.getVideoTracks().forEach((t) => merged.addTrack(t));
  processedAudioStream.getAudioTracks().forEach((t) => merged.addTrack(t));
  return merged;
};

// ─── Remote Media Tile ────────────────────────────────────────────────────────
const RemoteMediaTile = React.memo(({ user }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("connecting");
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    user._onStream = (remoteStream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        videoRef.current
          .play()
          .catch((e) => console.warn("[VIDEO] autoplay blocked:", e.message));
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
  }, [user]);

  return (
    <div style={styles.tile}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ ...styles.video, display: hasVideo ? "block" : "none" }}
      />
      {!hasVideo && (
        <div style={styles.avatarPlaceholder}>
          <span style={styles.avatarIcon}>👤</span>
        </div>
      )}
      <div style={styles.tileLabel}>
        <span>{user.name || "User"}</span>
        <span style={{ marginLeft: 8, fontSize: 12 }}>
          {status === "connecting"
            ? "⏳"
            : status === "connected"
              ? "✅"
              : "❌"}
        </span>
      </div>
    </div>
  );
});

// ─── Room ─────────────────────────────────────────────────────────────────────
export const Room = () => {
  const { id } = useParams();

  const [users, setUsers] = useState([]);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [musicMode, setMusicMode] = useState(false);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);

  const screenStreamRef = useRef(null);
  const rawStreamRef = useRef(null); // original mic+cam from browser
  const streamRef = useRef(null); // processed stream (sent to peers)
  const pipelineRef = useRef(null); // current audio pipeline
  const localVideoRef = useRef(null);
  const peersRef = useRef([]);

  const toggleScreenShare = async () => {
    try {
      // START SCREEN SHARE
      if (!screenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        screenStreamRef.current = screenStream;

        // Replace video track in all peers
        peersRef.current.forEach(({ peer }) => {
          const sender = peer._pc
            ?.getSenders()
            ?.find((s) => s.track?.kind === "video");

          if (sender) sender.replaceTrack(screenTrack);
        });

        // Show screen locally
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // When user stops sharing manually
        screenTrack.onended = () => {
          stopScreenShare();
        };

        setScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = () => {
    const cameraTrack = rawStreamRef.current?.getVideoTracks()[0];

    // Replace back camera video
    peersRef.current.forEach(({ peer }) => {
      const sender = peer._pc
        ?.getSenders()
        ?.find((s) => s.track?.kind === "video");

      if (sender && cameraTrack) {
        sender.replaceTrack(cameraTrack);
      }
    });

    // Restore local video
    if (localVideoRef.current && rawStreamRef.current) {
      localVideoRef.current.srcObject = rawStreamRef.current;
    }

    // Stop screen stream
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    setScreenSharing(false);
  };

  // ── Rebuild audio pipeline + update peers ─────────────────────────────────
  const applyAudioPipeline = useCallback((rawStream, isMusicMode) => {
    // Tear down previous pipeline
    if (pipelineRef.current) {
      pipelineRef.current.destroy();
      pipelineRef.current = null;
    }

    const pipeline = buildAudioPipeline(rawStream, isMusicMode);
    pipelineRef.current = pipeline;

    const merged = mergeStreams(rawStream, pipeline.processedStream);
    streamRef.current = merged;

    console.log(
      `[AUDIO] ${isMusicMode ? "🎵 Music" : "🎙️ Voice"} mode applied`,
    );
    return merged;
  }, []);

  // ── Make Peer ─────────────────────────────────────────────────────────────
  const makePeer = useCallback((targetId, initiator, incomingSignal = null) => {
    if (peersRef.current.find((p) => p.peerID === targetId)) {
      console.warn(`[PEER] Already exists: ${targetId}`);
      return null;
    }

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
    peer.on("stream", (remoteStream) => {
      if (userEntry._onStream) userEntry._onStream(remoteStream);
      else userEntry._pendingStream = remoteStream;
    });
    peer.on("connect", () => {
      if (userEntry._setStatus) userEntry._setStatus("connected");
    });
    peer.on("close", () => {
      if (userEntry._setStatus) userEntry._setStatus("failed");
    });
    peer.on("error", (err) => {
      console.error(`[PEER] ❌ ${targetId}:`, err.message);
      if (userEntry._setStatus) userEntry._setStatus("failed");
    });

    if (!initiator && incomingSignal) peer.signal(incomingSignal);
    return { peer, userEntry };
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;

    const init = async () => {
      // Step 1: Get raw mic + camera
      try {
        const raw = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true, // browser handles echo
            noiseSuppression: false, // we do this with Web Audio
            autoGainControl: false, // we use compressor instead
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
        applyAudioPipeline(raw, false); // voice mode by default

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = raw; // raw is fine for self-preview
          localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error("🚫 Media:", err.name);
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
            setError("Camera unavailable — audio only mode.");
          } else {
            audioRaw.getTracks().forEach((t) => t.stop());
            return;
          }
        } catch (ae) {
          setError(
            `Mic/Camera blocked (${ae.name}). Allow karo aur reload karo.`,
          );
          streamRef.current = null;
        }
      }

      if (disposed) return;

      // Step 2: Socket events
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-signal");
      socket.off("answer-signal");
      socket.off("user-left");

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
          try {
            item.peer.destroy();
          } catch {}
        }
        peersRef.current = peersRef.current.filter((p) => p.peerID !== uid);
        setUsers((prev) => prev.filter((u) => u.id !== uid));
      });

      // Step 3: Join
      setUsers([{ id: socket.id || "self", name: "You", isSelf: true }]);
      setReady(true);
      const doJoin = () => socket.emit("join-room", id);
      socket.connected ? doJoin() : socket.once("connect", doJoin);
    };

    init();

    return () => {
      disposed = true;
      peersRef.current.forEach(({ peer }) => {
        try {
          peer.destroy();
        } catch {}
      });
      peersRef.current = [];
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-signal");
      socket.off("answer-signal");
      socket.off("user-left");
      pipelineRef.current?.destroy();
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id, makePeer, applyAudioPipeline]);

  // ── Music Mode toggle ─────────────────────────────────────────────────────
  const toggleMusicMode = useCallback(() => {
    const raw = rawStreamRef.current;
    if (!raw) return;

    const next = !musicMode;
    setMusicMode(next);

    const newProcessed = applyAudioPipeline(raw, next);
    const newAudioTrack = newProcessed.getAudioTracks()[0];

    // Hot-swap audio track in all active peer connections (no renegotiation needed)
    if (newAudioTrack) {
      peersRef.current.forEach(({ peer }) => {
        try {
          const senders = peer._pc?.getSenders?.() || [];
          const audioSender = senders.find((s) => s.track?.kind === "audio");
          if (audioSender) {
            audioSender.replaceTrack(newAudioTrack);
            console.log(`[PEER] 🔄 Audio → ${next ? "Music" : "Voice"} mode`);
          }
        } catch (e) {
          console.warn("[PEER] replaceTrack:", e.message);
        }
      });
    }
  }, [musicMode, applyAudioPipeline]);

  // ── Mic / Cam toggles ─────────────────────────────────────────────────────
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
    if (localVideoRef.current)
      localVideoRef.current.style.display = !camOn ? "block" : "none";
  };

  const leaveRoom = () => {
    pipelineRef.current?.destroy();
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    window.location.href = "/";
  };

  const remoteUsers = users.filter((u) => !u.isSelf);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📹 Room: {id}</h2>
        <span
          style={{
            ...styles.badge,
            background: musicMode ? "#553c9a" : "#2c5282",
          }}
        >
          {musicMode ? "🎵 Music Mode" : "🎙️ Voice Mode"}
        </span>
        <span style={styles.count}>
          👥 {users.length} participant{users.length !== 1 ? "s" : ""}
        </span>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.hint}>
        {musicMode
          ? "🎵 Music mode: full frequency range, gentle compression — background music will come through clearly."
          : "🎙️ Voice mode: noise gate + filtering active — background noise suppressed automatically."}
      </div>

      {/* Video Grid */}
      <div style={styles.grid}>
        <div style={styles.tile}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              ...styles.video,
              display: camOn ? "block" : "none",
              transform: "scaleX(-1)",
            }}
          />
          {!camOn && (
            <div style={styles.avatarPlaceholder}>
              <span style={styles.avatarIcon}>🙋</span>
            </div>
          )}
          <div style={styles.tileLabel}>
            <span>You</span>
            <span style={{ marginLeft: 8 }}>
              {micOn ? "🎙️" : "🔇"} {camOn ? "📹" : "📷"}
            </span>
          </div>
        </div>

        {remoteUsers.map((user) => (
          <RemoteMediaTile key={user.id} user={user} />
        ))}
      </div>

      {ready && remoteUsers.length === 0 && (
        <p style={styles.waiting}>
          ⏳ Waiting for others... Share the room link!
        </p>
      )}

      {/* Controls */}
      <div style={styles.controls}>
        <button
          onClick={toggleMic}
          style={{ ...styles.btn, background: micOn ? "#276749" : "#c53030" }}
        >
          {micOn ? "🎙️ Mute" : "🔇 Unmute"}
        </button>

        <button
          onClick={toggleCam}
          style={{ ...styles.btn, background: camOn ? "#276749" : "#c53030" }}
        >
          {camOn ? "📹 Cam Off" : "📷 Cam On"}
        </button>

        {/* Music / Voice mode switcher */}
        <button
          onClick={toggleMusicMode}
          style={{
            ...styles.btn,
            background: musicMode ? "#553c9a" : "#2c5282",
            border: `2px solid ${musicMode ? "#b794f4" : "#63b3ed"}`,
          }}
        >
          {musicMode ? "🎵 Music Mode ON" : "🎙️ Voice Mode ON"}
        </button>

        <button
          onClick={toggleScreenShare}
          style={{
            ...styles.btn,
            background: screenSharing ? "#d69e2e" : "#2b6cb0",
          }}
        >
          {screenSharing ? "🛑 Stop Share" : "📺 Share Screen"}
        </button>

        <button
          onClick={leaveRoom}
          style={{ ...styles.btn, background: "#4a5568" }}
        >
          🚪 Leave
        </button>
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  container: {
    fontFamily: "'Segoe UI', sans-serif",
    background: "#0f0f0f",
    minHeight: "100vh",
    color: "#fff",
    padding: "20px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  title: { margin: 0, fontSize: 20, color: "#e2e8f0" },
  badge: {
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
  },
  count: { fontSize: 14, color: "#a0aec0" },
  hint: {
    background: "#1a202c",
    border: "1px solid #2d3748",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    color: "#90cdf4",
    marginBottom: 16,
  },
  error: {
    background: "#742a2a",
    color: "#feb2b2",
    padding: "10px 16px",
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
    marginBottom: 20,
  },
  tile: {
    position: "relative",
    background: "#1a1a2e",
    borderRadius: 12,
    overflow: "hidden",
    aspectRatio: "16/9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #2d3748",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: 12,
  },
  avatarPlaceholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    background: "#1a1a2e",
  },
  avatarIcon: { fontSize: 52 },
  tileLabel: {
    position: "absolute",
    bottom: 8,
    left: 10,
    background: "rgba(0,0,0,0.6)",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 13,
    display: "flex",
    alignItems: "center",
  },
  waiting: {
    textAlign: "center",
    color: "#718096",
    fontSize: 14,
    marginBottom: 20,
  },
  controls: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  btn: {
    padding: "10px 20px",
    borderRadius: 8,
    border: "2px solid transparent",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
