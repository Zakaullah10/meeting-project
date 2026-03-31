import React, { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import { useParams } from "react-router-dom";

const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  ],
};

const socket = io("https://meeting-project-be-production.up.railway.app", {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
});

// ── Audio Pipeline ────────────────────────────────────────────────────────────
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
    compressor.threshold.value = -24; compressor.knee.value = 10;
    compressor.ratio.value = 3; compressor.attack.value = 0.003; compressor.release.value = 0.25;
  } else {
    compressor.threshold.value = -30; compressor.knee.value = 5;
    compressor.ratio.value = 6; compressor.attack.value = 0.001; compressor.release.value = 0.1;
  }
  let noiseGateNode = null;
  if (!musicMode) {
    noiseGateNode = ac.createScriptProcessor(2048, 1, 1);
    const GATE_THRESHOLD = 0.008; const HOLD_FRAMES = 15;
    let holdCount = 0; let gateOpen = true;
    noiseGateNode.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      const rms = Math.sqrt(sum / input.length);
      if (rms > GATE_THRESHOLD) { holdCount = HOLD_FRAMES; gateOpen = true; }
      else if (holdCount > 0) { holdCount--; }
      else { gateOpen = false; }
      for (let i = 0; i < input.length; i++) output[i] = gateOpen ? input[i] : 0;
    };
  }
  source.connect(highpass); highpass.connect(lowpass);
  if (noiseGateNode) { lowpass.connect(noiseGateNode); noiseGateNode.connect(compressor); }
  else { lowpass.connect(compressor); }
  compressor.connect(destination);
  return {
    audioContext: ac, processedStream: destination.stream,
    destroy: () => {
      try {
        source.disconnect(); highpass.disconnect(); lowpass.disconnect();
        noiseGateNode?.disconnect(); compressor.disconnect(); destination.disconnect(); ac.close();
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

// ── Icons ─────────────────────────────────────────────────────────────────────
const MicIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0012 6.32V20h-3v2h8v-2h-3v-2.68A7 7 0 0019 11h-2z"/></svg>
);
const MicOffIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>
);
const CamIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"/></svg>
);
const CamOffIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M21 6.5l-4 4V7a1 1 0 00-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 00-1 1v10a1 1 0 001 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>
);
const ScreenIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h7v2H9v2h6v-2h-2v-2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/></svg>
);
const LeaveIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 00-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"/></svg>
);
const MusicIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/></svg>
);

// ── Self Video Tile ───────────────────────────────────────────────────────────
// Each instance creates its own <video> and attaches rawStream directly.
// This avoids the single-ref conflict when the tile appears in both grid & sidebar.
const SelfTile = ({ rawStreamRef, camOn, micOn, compact = false }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const raw = rawStreamRef.current;
    if (raw && videoRef.current) {
      videoRef.current.srcObject = raw;
      videoRef.current.play().catch(() => {});
    }
  }, [rawStreamRef]);

  const avatarSize = compact ? "w-10 h-10 text-sm" : "w-14 h-14 text-lg";

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-800 border border-white/10 flex items-center justify-center aspect-video">
      <video
        ref={videoRef}
        autoPlay playsInline muted
        style={{ transform: "scaleX(-1)" }}
        className={`absolute inset-0 w-full h-full object-cover ${camOn ? "block" : "hidden"}`}
      />
      {!camOn && (
        <div className={`${avatarSize} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold`}>
          You
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-white text-xs font-medium">You</span>
        {!micOn && <MicOffIcon className="w-3 h-3 text-red-400" />}
      </div>
    </div>
  );
};

// ── Remote Video Tile ─────────────────────────────────────────────────────────
// Stores stream on userEntry.stream so remounts (grid ↔ sidebar) can reattach.
const RemoteTile = React.memo(({ user, compact = false }) => {
  const videoRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [connected, setConnected] = useState(false);

  const attachStream = useCallback((stream) => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
    const vt = stream.getVideoTracks();
    setHasVideo(vt.length > 0 && vt[0].enabled);
    setConnected(true);
  }, []);

  useEffect(() => {
    // Reattach if stream already arrived
    if (user.stream) attachStream(user.stream);

    // Listen for future stream
    user._onStream = (stream) => {
      user.stream = stream;
      attachStream(stream);
    };
    user._setStatus = (s) => { if (s === "connected") setConnected(true); };

    return () => {
      user._onStream = null;
      user._setStatus = null;
    };
  }, [user, attachStream]);

  const colors = ["bg-teal-600", "bg-blue-600", "bg-violet-600", "bg-rose-600", "bg-amber-600"];
  const color = colors[(user.id?.charCodeAt(0) || 0) % colors.length];
  const initials = (user.name || "U").slice(0, 2).toUpperCase();
  const avatarSize = compact ? "w-10 h-10 text-sm" : "w-14 h-14 text-lg";

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-800 border border-white/10 flex items-center justify-center aspect-video hover:border-blue-500/40 transition-colors">
      <video
        ref={videoRef}
        autoPlay playsInline
        className={`absolute inset-0 w-full h-full object-cover ${hasVideo ? "block" : "hidden"}`}
      />
      {!hasVideo && (
        <div className={`${avatarSize} rounded-full ${color} flex items-center justify-center text-white font-bold`}>
          {initials}
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent">
        <span className="text-white text-xs font-medium truncate">{user.name || "User"}</span>
        {!connected && <span className="text-yellow-400 text-xs">⏳</span>}
      </div>
    </div>
  );
});

// ── Control Button ────────────────────────────────────────────────────────────
const CtrlBtn = ({ children, onClick, title, danger = false }) => (
  <button onClick={onClick} title={title}
    className={`p-3 rounded-full transition-all duration-200 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600"} text-white`}>
    {children}
  </button>
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
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);

  const rawStreamRef = useRef(null);
  const streamRef = useRef(null);
  const pipelineRef = useRef(null);
  const screenVideoRef = useRef(null);
  const peersRef = useRef([]);
  const screenStreamRef = useRef(null);

  // ── Screen Share ───────────────────────────────────────────────────────────
  const stopScreenShare = useCallback(() => {
    peersRef.current.forEach(({ peer }) => {
      const senders = peer._pc?.getSenders() || [];
      senders.forEach((sender) => {
        if (sender.track?.kind === "video" && sender.track.label.includes("screen"))
          sender.replaceTrack(null);
      });
    });
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    try {
      if (!screenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = stream.getVideoTracks()[0];
        screenStreamRef.current = stream;
        setScreenStream(stream);
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
  }, [screenSharing, stopScreenShare]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(() => {});
    }
  }, [screenStream]);

  // ── Audio Pipeline ─────────────────────────────────────────────────────────
  const applyAudioPipeline = useCallback((rawStream, isMusicMode) => {
    if (pipelineRef.current) { pipelineRef.current.destroy(); pipelineRef.current = null; }
    const pipeline = buildAudioPipeline(rawStream, isMusicMode);
    pipelineRef.current = pipeline;
    const merged = mergeStreams(rawStream, pipeline.processedStream);
    streamRef.current = merged;
    return merged;
  }, []);

  // ── Make Peer ──────────────────────────────────────────────────────────────
  const makePeer = useCallback((targetId, initiator, incomingSignal = null) => {
    if (peersRef.current.find((p) => p.peerID === targetId)) return null;
    const peer = new Peer({
      initiator, trickle: true,
      stream: streamRef.current || undefined,
      config: ICE_CONFIG,
    });

    const userEntry = {
      id: targetId,
      name: "User",
      isSelf: false,
      stream: null,      // ← persisted stream so remounted tiles can reattach
      _onStream: null,
      _setStatus: null,
    };

    peer.on("signal", (signal) => {
      if (initiator) socket.emit("sending-signal", { userId: targetId, signal });
      else socket.emit("returning-signal", { signal, to: targetId });
    });
    peer.on("stream", (remoteStream) => {
      userEntry.stream = remoteStream;                // save always
      if (userEntry._onStream) userEntry._onStream(remoteStream);
    });
    peer.on("connect", () => { if (userEntry._setStatus) userEntry._setStatus("connected"); });
    peer.on("close",   () => { if (userEntry._setStatus) userEntry._setStatus("failed"); });
    peer.on("error",   () => { if (userEntry._setStatus) userEntry._setStatus("failed"); });
    if (!initiator && incomingSignal) peer.signal(incomingSignal);
    return { peer, userEntry };
  }, []);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    const init = async () => {
      try {
        const raw = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false, sampleRate: 48000 },
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });
        if (disposed) { raw.getTracks().forEach((t) => t.stop()); return; }
        rawStreamRef.current = raw;
        setMicOn(true); setCamOn(true);
        applyAudioPipeline(raw, false);
      } catch (err) {
        try {
          const audioRaw = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
            video: false,
          });
          if (!disposed) {
            rawStreamRef.current = audioRaw;
            applyAudioPipeline(audioRaw, false);
            setMicOn(true);
            setError("Camera unavailable — audio only.");
          } else { audioRaw.getTracks().forEach((t) => t.stop()); return; }
        } catch (ae) {
          setError(`Mic/Camera blocked (${ae.name}). Allow access and reload.`);
          streamRef.current = null;
        }
      }
      if (disposed) return;

      socket.off("all-users"); socket.off("user-joined");
      socket.off("receiving-signal"); socket.off("answer-signal"); socket.off("user-left");

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
        if (existing) { existing.peer.signal(signal); return; }
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
        if (item) { try { item.peer.destroy(); } catch {} }
        peersRef.current = peersRef.current.filter((p) => p.peerID !== uid);
        setUsers((prev) => prev.filter((u) => u.id !== uid));
      });

      setUsers([{ id: socket.id || "self", name: "You", isSelf: true }]);
      setReady(true);
      const doJoin = () => socket.emit("join-room", id);
      socket.connected ? doJoin() : socket.once("connect", doJoin);
    };

    init();
    return () => {
      disposed = true;
      peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch {} });
      peersRef.current = [];
      socket.off("all-users"); socket.off("user-joined");
      socket.off("receiving-signal"); socket.off("answer-signal"); socket.off("user-left");
      pipelineRef.current?.destroy();
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [id, makePeer, applyAudioPipeline]);

  // ── Music Mode ─────────────────────────────────────────────────────────────
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
        } catch {}
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
    window.location.href = "/";
  };

  const remoteUsers = users.filter((u) => !u.isSelf);
  const isScreenMode = screenSharing && !!screenStream;
  const totalTiles = remoteUsers.length + 1;
  const gridCols = totalTiles === 1 ? "grid-cols-1" : totalTiles === 2 ? "grid-cols-2" : totalTiles <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden"
      style={{ fontFamily: "'Google Sans', 'Roboto', sans-serif" }}>

      {/* ── Top Bar ── */}
      <header className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center">
              <CamIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Velo Meet</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded-md truncate max-w-xs">{id}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${musicMode ? "bg-violet-900/60 text-violet-300 border border-violet-700" : "bg-blue-900/60 text-blue-300 border border-blue-700"}`}>
            {musicMode ? "🎵 Music" : "🎙️ Voice"}
          </span>
          <span className="text-xs text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
            👥 {users.length}
          </span>
        </div>
      </header>

      {error && (
        <div className="mx-4 mt-3 bg-red-900/50 border border-red-700 text-red-300 text-sm px-4 py-2 rounded-lg shrink-0">
          ⚠️ {error}
        </div>
      )}

      {/* ── Main Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {isScreenMode ? (
          /* ── Screen Share Layout ── */
          <>
            {/* Screen — main area left */}
            <div className="flex-1 p-3 overflow-hidden">
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                <video
                  ref={screenVideoRef}
                  autoPlay playsInline muted
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1.5">
                  <ScreenIcon className="w-3.5 h-3.5" />
                  You are presenting
                </div>
              </div>
            </div>

            {/* Participants strip — right sidebar */}
            <aside className="w-52 shrink-0 flex flex-col gap-2 p-3 bg-gray-900/80 border-l border-white/10 overflow-y-auto">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Participants</p>

              {/* Self tile — own instance of SelfTile with own video element */}
              <SelfTile rawStreamRef={rawStreamRef} camOn={camOn} micOn={micOn} compact />

              {/* Remote users — each RemoteTile re-registers _onStream & reattaches user.stream */}
              {remoteUsers.map((user) => (
                <RemoteTile key={user.id} user={user} compact />
              ))}

              {remoteUsers.length === 0 && (
                <p className="text-center text-gray-600 text-xs py-4">No others yet</p>
              )}
            </aside>
          </>
        ) : (
          /* ── Normal Grid Layout ── */
          <div className="flex-1 p-3 relative">
            <div className={`h-full grid gap-3 ${gridCols}`}>
              <SelfTile rawStreamRef={rawStreamRef} camOn={camOn} micOn={micOn} />
              {remoteUsers.map((user) => (
                <RemoteTile key={user.id} user={user} />
              ))}
            </div>
            {ready && remoteUsers.length === 0 && (
              <div className="absolute inset-0 flex items-end justify-center pb-10 pointer-events-none">
                <div className="text-center">
                  <p className="text-gray-500 text-sm">⏳ Waiting for others to join...</p>
                  <p className="text-gray-600 text-xs mt-1">Share the room code to invite</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Control Bar ── */}
      <div className="shrink-0 bg-gray-900 border-t border-white/10 px-6 py-4 flex items-center justify-center gap-3 flex-wrap">
        <CtrlBtn onClick={toggleMic} title={micOn ? "Mute" : "Unmute"} danger={!micOn}>
          {micOn ? <MicIcon className="w-5 h-5" /> : <MicOffIcon className="w-5 h-5" />}
        </CtrlBtn>

        <CtrlBtn onClick={toggleCam} title={camOn ? "Cam off" : "Cam on"} danger={!camOn}>
          {camOn ? <CamIcon className="w-5 h-5" /> : <CamOffIcon className="w-5 h-5" />}
        </CtrlBtn>

        <button onClick={toggleScreenShare}
          className={`flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 ${screenSharing ? "bg-yellow-500 hover:bg-yellow-600 text-black" : "bg-gray-700 hover:bg-gray-600 text-white"}`}>
          <ScreenIcon className="w-5 h-5" />
          <span className="hidden sm:inline">{screenSharing ? "Stop" : "Present"}</span>
        </button>

        <button onClick={toggleMusicMode}
          className={`flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium transition-all duration-200 ${musicMode ? "bg-violet-700 hover:bg-violet-600 text-white border border-violet-500" : "bg-gray-700 hover:bg-gray-600 text-white"}`}>
          <MusicIcon className="w-5 h-5" />
          <span className="hidden sm:inline">{musicMode ? "Music" : "Voice"}</span>
        </button>

        <div className="w-px h-8 bg-white/20" />

        <button onClick={leaveRoom}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all">
          <LeaveIcon className="w-5 h-5" />
          <span>Leave</span>
        </button>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&display=swap');`}</style>
    </div>
  );
};