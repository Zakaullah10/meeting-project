// import React, { useEffect, useRef, useState, useCallback } from "react";
// import io from "socket.io-client";
// import Peer from "simple-peer";
// import { useParams } from "react-router-dom";

// const ICE_CONFIG = {
//   iceServers: [
//     { urls: "stun:stun.l.google.com:19302" },
//     { urls: "stun:stun1.l.google.com:19302" },
//     {
//       urls: "turn:openrelay.metered.ca:80",
//       username: "openrelayproject",
//       credential: "openrelayproject",
//     },
//     {
//       urls: "turn:openrelay.metered.ca:443",
//       username: "openrelayproject",
//       credential: "openrelayproject",
//     },
//   ],
// };

// // Module-level socket — ek baar banta hai
// const socket = io("https://meeting-project-be-production.up.railway.app", {
//   transports: ["websocket", "polling"],
//   reconnectionAttempts: 5,
// });

// // ─── Remote Audio Tile ────────────────────────────────────────────────────────
// const RemoteAudioTile = React.memo(({ user }) => {
//   const audioRef = useRef(null);
//   const [status, setStatus] = useState("connecting");

//   useEffect(() => {
//     user._onStream = (remoteStream) => {
//       if (audioRef.current) {
//         audioRef.current.srcObject = remoteStream;
//         audioRef.current.play().catch((e) => {
//           console.warn("[AUDIO] autoplay blocked:", e.message);
//         });
//       }
//       setStatus("connected");
//     };
//     user._setStatus = (s) => setStatus(s);

//     // Agar stream pehle aa gayi thi tile mount hone se pehle
//     if (user._pendingStream) {
//       user._onStream(user._pendingStream);
//       user._pendingStream = null;
//     }

//     return () => {
//       user._onStream = null;
//       user._setStatus = null;
//     };
//   }, [user]);

//   return (
//     <div>
//       <audio ref={audioRef} autoPlay playsInline />
//       <p>
//         {user.name || "User"} —{" "}
//         {status === "connecting"
//           ? "⏳ Connecting..."
//           : status === "connected"
//           ? "✅ Connected"
//           : "❌ Failed"}
//       </p>
//     </div>
//   );
// });

// // ─── Room ─────────────────────────────────────────────────────────────────────
// export const Room = () => {
//   const { id } = useParams();

//   const [users, setUsers] = useState([]);
//   const [micOn, setMicOn] = useState(false);
//   const [error, setError] = useState(null);
//   const [ready, setReady] = useState(false);

//   const streamRef = useRef(null);
//   const peersRef  = useRef([]); // [{ peerID, peer, userEntry }]

//   // ── Peer banana ───────────────────────────────────────────────────────────
//   const makePeer = useCallback((targetId, initiator, incomingSignal = null) => {
//     // Duplicate check
//     if (peersRef.current.find(p => p.peerID === targetId)) {
//       console.warn(`[PEER] Already exists for ${targetId}`);
//       return null;
//     }

//     const liveStream = streamRef.current;
//     console.log(
//       `[PEER] ${initiator ? "→ INIT" : "← ANSWER"} ${targetId}`,
//       "| tracks:",
//       liveStream?.getTracks().map(t => `${t.kind}(${t.readyState})`).join(", ") || "NONE"
//     );

//     const peer = new Peer({
//       initiator,
//       trickle: true,
//       stream: liveStream || undefined,
//       config: ICE_CONFIG,
//     });

//     const userEntry = {
//       id: targetId,
//       name: "User",
//       isSelf: false,
//       _onStream: null,
//       _setStatus: null,
//       _pendingStream: null,
//     };

//     peer.on("signal", (signal) => {
//       if (initiator) {
//         socket.emit("sending-signal", { userId: targetId, signal });
//       } else {
//         socket.emit("returning-signal", { signal, to: targetId });
//       }
//     });

//     peer.on("stream", (remoteStream) => {
//       console.log(
//         `[PEER] ✅ Stream from ${targetId}:`,
//         remoteStream.getTracks().map(t => `${t.kind}(${t.readyState})`)
//       );
//       if (userEntry._onStream) {
//         userEntry._onStream(remoteStream);
//       } else {
//         userEntry._pendingStream = remoteStream;
//       }
//     });

//     peer.on("connect", () => {
//       console.log(`[PEER] ✅ Connected ${targetId}`);
//       if (userEntry._setStatus) userEntry._setStatus("connected");
//     });

//     peer.on("close", () => {
//       if (userEntry._setStatus) userEntry._setStatus("failed");
//     });

//     peer.on("error", (err) => {
//       console.error(`[PEER] ❌ ${targetId}:`, err.message);
//       if (userEntry._setStatus) userEntry._setStatus("failed");
//     });

//     // ✅ FIX: Answerer ko signal dena zaroori hai
//     if (!initiator && incomingSignal) {
//       peer.signal(incomingSignal);
//     }

//     return { peer, userEntry };
//   }, []);

//   // ── Main init ─────────────────────────────────────────────────────────────
//   useEffect(() => {
//     let disposed = false;

//     const init = async () => {
//       // ── Step 1: PEHLE mic lo, PHIR join karo ──────────────────────────────
//       // ✅ FIX: Race condition — stream ready hone ke baad hi join karo
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           audio: true,
//           video: false,
//         });
//         if (disposed) { stream.getTracks().forEach(t => t.stop()); return; }

//         streamRef.current = stream;
//         setMicOn(true);
//         console.log("✅ Mic:", stream.getAudioTracks()[0].label);
//       } catch (err) {
//         console.error("🚫 Mic error:", err.name);
//         setError(`Microphone blocked (${err.name}). Allow karo aur reload karo.`);
//         try {
//           const ac = new AudioContext();
//           const dst = ac.createMediaStreamDestination();
//           streamRef.current = dst.stream;
//         } catch {
//           streamRef.current = null;
//         }
//       }

//       if (disposed) return;

//       // ── Step 2: Socket events ─────────────────────────────────────────────
//       socket.off("all-users");
//       socket.off("user-joined");
//       socket.off("receiving-signal");
//       socket.off("answer-signal");
//       socket.off("user-left");

//       // Pehle se room mein hain — hum unhe call karte hain (initiator: true)
//       socket.on("all-users", (ids) => {
//         console.log("👥 Existing:", ids);
//         ids.forEach((uid) => {
//           const result = makePeer(uid, true);
//           if (!result) return;
//           const { peer, userEntry } = result;
//           peersRef.current.push({ peerID: uid, peer, userEntry });
//           setUsers(prev => [...prev, userEntry]);
//         });
//       });

//       // ✅ FIX: user-joined pe kuch mat karo — woh "receiving-signal" bhejega
//       // Agar hum yahan bhi makePeer karein toh dono initiator ban jaate hain
//       socket.on("user-joined", (uid) => {
//         console.log("➕ Joined (waiting for their offer):", uid);
//       });

//       // Naya user ne offer bheja — hum answer karte hain (initiator: false)
//       socket.on("receiving-signal", ({ signal, from }) => {
//         console.log("📡 Offer from:", from);
//         const existing = peersRef.current.find(p => p.peerID === from);
//         if (existing) {
//           existing.peer.signal(signal);
//           return;
//         }
//         const result = makePeer(from, false, signal);
//         if (!result) return;
//         const { peer, userEntry } = result;
//         peersRef.current.push({ peerID: from, peer, userEntry });
//         setUsers(prev => [...prev, userEntry]);
//       });

//       // Hamare offer ka answer
//       socket.on("answer-signal", ({ signal, from }) => {
//         console.log("📩 Answer from:", from);
//         const item = peersRef.current.find(p => p.peerID === from);
//         if (item) item.peer.signal(signal);
//         else console.warn(`[SOCKET] No peer for answer from ${from}`);
//       });

//       socket.on("user-left", (uid) => {
//         console.log("❌ Left:", uid);
//         const item = peersRef.current.find(p => p.peerID === uid);
//         if (item) { try { item.peer.destroy(); } catch {} }
//         peersRef.current = peersRef.current.filter(p => p.peerID !== uid);
//         setUsers(prev => prev.filter(u => u.id !== uid));
//       });

//       // ── Step 3: Ab join karo ─────────────────────────────────────────────
//       setUsers([{ id: socket.id || "self", name: "You", isSelf: true }]);
//       setReady(true);

//       const doJoin = () => {
//         console.log("🔗 join-room:", id, "socket:", socket.id);
//         socket.emit("join-room", id);
//       };
//       socket.connected ? doJoin() : socket.once("connect", doJoin);
//     };

//     init();

//     return () => {
//       disposed = true;
//       peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch {} });
//       peersRef.current = [];
//       socket.off("all-users");
//       socket.off("user-joined");
//       socket.off("receiving-signal");
//       socket.off("answer-signal");
//       socket.off("user-left");
//       streamRef.current?.getTracks().forEach(t => t.stop());
//     };
//   }, [id, makePeer]);

//   // ── Mic toggle ────────────────────────────────────────────────────────────
//   const toggleMic = () => {
//     const track = streamRef.current?.getAudioTracks()[0];
//     if (!track) return;
//     const next = !micOn;
//     track.enabled = next;
//     setMicOn(next);
//   };

//   const leaveRoom = () => {
//     streamRef.current?.getTracks().forEach(t => t.stop());
//     window.location.href = "/";
//   };

//   const remoteUsers = users.filter(u => !u.isSelf);

//   return (
//     <div>
//       <h2>Room: {id}</h2>
//       <p>Participants: {users.length}</p>

//       {error && <p style={{ color: "red" }}>{error}</p>}

//       <p>You — {micOn ? "🎙️ Mic ON" : "🔇 Mic OFF"}</p>

//       {remoteUsers.length === 0 && ready && (
//         <p>Koi nahi aaya abhi. Link share karo!</p>
//       )}

//       {remoteUsers.map(user => (
//         <RemoteAudioTile key={user.id} user={user} />
//       ))}

//       <div style={{ marginTop: 16 }}>
//         <button onClick={toggleMic}>{micOn ? "🔇 Mute" : "🎙️ Unmute"}</button>
//         {"  "}
//         <button onClick={leaveRoom}>🚪 Leave</button>
//       </div>
//     </div>
//   );
// };
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

// Module-level socket — ek baar banta hai
const socket = io("https://meeting-project-be-production.up.railway.app", {
  transports: ["websocket", "polling"],
  reconnectionAttempts: 5,
});

// ─── Remote Media Tile (Audio + Video) ───────────────────────────────────────
const RemoteMediaTile = React.memo(({ user }) => {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("connecting");
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    user._onStream = (remoteStream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
        videoRef.current.play().catch((e) => {
          console.warn("[VIDEO] autoplay blocked:", e.message);
        });
      }
      const videoTracks = remoteStream.getVideoTracks();
      setHasVideo(videoTracks.length > 0 && videoTracks[0].enabled);
      setStatus("connected");
    };
    user._setStatus = (s) => setStatus(s);

    // Agar stream pehle aa gayi thi tile mount hone se pehle
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
        style={{
          ...styles.video,
          display: hasVideo ? "block" : "none",
        }}
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
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const streamRef   = useRef(null);
  const localVideoRef = useRef(null); // local camera preview
  const peersRef    = useRef([]); // [{ peerID, peer, userEntry }]

  // ── Peer banana ───────────────────────────────────────────────────────────
  const makePeer = useCallback((targetId, initiator, incomingSignal = null) => {
    if (peersRef.current.find(p => p.peerID === targetId)) {
      console.warn(`[PEER] Already exists for ${targetId}`);
      return null;
    }

    const liveStream = streamRef.current;
    console.log(
      `[PEER] ${initiator ? "→ INIT" : "← ANSWER"} ${targetId}`,
      "| tracks:",
      liveStream?.getTracks().map(t => `${t.kind}(${t.readyState})`).join(", ") || "NONE"
    );

    const peer = new Peer({
      initiator,
      trickle: true,
      stream: liveStream || undefined,
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
      if (initiator) {
        socket.emit("sending-signal", { userId: targetId, signal });
      } else {
        socket.emit("returning-signal", { signal, to: targetId });
      }
    });

    peer.on("stream", (remoteStream) => {
      console.log(
        `[PEER] ✅ Stream from ${targetId}:`,
        remoteStream.getTracks().map(t => `${t.kind}(${t.readyState})`)
      );
      if (userEntry._onStream) {
        userEntry._onStream(remoteStream);
      } else {
        userEntry._pendingStream = remoteStream;
      }
    });

    peer.on("connect", () => {
      console.log(`[PEER] ✅ Connected ${targetId}`);
      if (userEntry._setStatus) userEntry._setStatus("connected");
    });

    peer.on("close", () => {
      if (userEntry._setStatus) userEntry._setStatus("failed");
    });

    peer.on("error", (err) => {
      console.error(`[PEER] ❌ ${targetId}:`, err.message);
      if (userEntry._setStatus) userEntry._setStatus("failed");
    });

    if (!initiator && incomingSignal) {
      peer.signal(incomingSignal);
    }

    return { peer, userEntry };
  }, []);

  // ── Main init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;

    const init = async () => {
      // ── Step 1: Mic + Camera lena ─────────────────────────────────────────
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        });
        if (disposed) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        setMicOn(true);
        setCamOn(true);

        // Local video preview
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        console.log(
          "✅ Tracks:",
          stream.getTracks().map(t => `${t.kind}(${t.label})`).join(", ")
        );
      } catch (err) {
        console.error("🚫 Media error:", err.name);

        // Fallback: try audio only
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          if (!disposed) {
            streamRef.current = audioStream;
            setMicOn(true);
            setError("Camera not available — audio only mode.");
            console.log("⚠️ Audio-only fallback");
          } else {
            audioStream.getTracks().forEach(t => t.stop());
            return;
          }
        } catch (audioErr) {
          setError(`Mic/Camera blocked (${audioErr.name}). Allow karo aur reload karo.`);
          try {
            const ac = new AudioContext();
            const dst = ac.createMediaStreamDestination();
            streamRef.current = dst.stream;
          } catch {
            streamRef.current = null;
          }
        }
      }

      if (disposed) return;

      // ── Step 2: Socket events ─────────────────────────────────────────────
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-signal");
      socket.off("answer-signal");
      socket.off("user-left");

      socket.on("all-users", (ids) => {
        console.log("👥 Existing:", ids);
        ids.forEach((uid) => {
          const result = makePeer(uid, true);
          if (!result) return;
          const { peer, userEntry } = result;
          peersRef.current.push({ peerID: uid, peer, userEntry });
          setUsers(prev => [...prev, userEntry]);
        });
      });

      socket.on("user-joined", (uid) => {
        console.log("➕ Joined (waiting for their offer):", uid);
      });

      socket.on("receiving-signal", ({ signal, from }) => {
        console.log("📡 Offer from:", from);
        const existing = peersRef.current.find(p => p.peerID === from);
        if (existing) {
          existing.peer.signal(signal);
          return;
        }
        const result = makePeer(from, false, signal);
        if (!result) return;
        const { peer, userEntry } = result;
        peersRef.current.push({ peerID: from, peer, userEntry });
        setUsers(prev => [...prev, userEntry]);
      });

      socket.on("answer-signal", ({ signal, from }) => {
        console.log("📩 Answer from:", from);
        const item = peersRef.current.find(p => p.peerID === from);
        if (item) item.peer.signal(signal);
        else console.warn(`[SOCKET] No peer for answer from ${from}`);
      });

      socket.on("user-left", (uid) => {
        console.log("❌ Left:", uid);
        const item = peersRef.current.find(p => p.peerID === uid);
        if (item) { try { item.peer.destroy(); } catch {} }
        peersRef.current = peersRef.current.filter(p => p.peerID !== uid);
        setUsers(prev => prev.filter(u => u.id !== uid));
      });

      // ── Step 3: Join ─────────────────────────────────────────────────────
      setUsers([{ id: socket.id || "self", name: "You", isSelf: true }]);
      setReady(true);

      const doJoin = () => {
        console.log("🔗 join-room:", id, "socket:", socket.id);
        socket.emit("join-room", id);
      };
      socket.connected ? doJoin() : socket.once("connect", doJoin);
    };

    init();

    return () => {
      disposed = true;
      peersRef.current.forEach(({ peer }) => { try { peer.destroy(); } catch {} });
      peersRef.current = [];
      socket.off("all-users");
      socket.off("user-joined");
      socket.off("receiving-signal");
      socket.off("answer-signal");
      socket.off("user-left");
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [id, makePeer]);

  // ── Mic toggle ────────────────────────────────────────────────────────────
  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    const next = !micOn;
    track.enabled = next;
    setMicOn(next);
  };

  // ── Camera toggle ─────────────────────────────────────────────────────────
  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !camOn;
    track.enabled = next;
    setCamOn(next);

    // Update local video preview visibility
    if (localVideoRef.current) {
      localVideoRef.current.style.display = next ? "block" : "none";
    }
  };

  const leaveRoom = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    window.location.href = "/";
  };

  const remoteUsers = users.filter(u => !u.isSelf);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📹 Room: {id}</h2>
        <span style={styles.count}>👥 {users.length} participant{users.length !== 1 ? "s" : ""}</span>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {/* Video Grid */}
      <div style={styles.grid}>

        {/* Local tile */}
        <div style={styles.tile}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted // muted to avoid echo
            style={{
              ...styles.video,
              display: camOn ? "block" : "none",
              transform: "scaleX(-1)", // mirror effect
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

        {/* Remote tiles */}
        {remoteUsers.map(user => (
          <RemoteMediaTile key={user.id} user={user} />
        ))}
      </div>

      {ready && remoteUsers.length === 0 && (
        <p style={styles.waiting}>⏳ Waiting for others... Share the room link!</p>
      )}

      {/* Controls */}
      <div style={styles.controls}>
        <button onClick={toggleMic} style={{
          ...styles.btn,
          background: micOn ? "#1db954" : "#e53e3e",
        }}>
          {micOn ? "🎙️ Mute" : "🔇 Unmute"}
        </button>

        <button onClick={toggleCam} style={{
          ...styles.btn,
          background: camOn ? "#1db954" : "#e53e3e",
        }}>
          {camOn ? "📹 Cam Off" : "📷 Cam On"}
        </button>

        <button onClick={leaveRoom} style={{
          ...styles.btn,
          background: "#718096",
        }}>
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
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 20,
    color: "#e2e8f0",
  },
  count: {
    fontSize: 14,
    color: "#a0aec0",
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
  avatarIcon: {
    fontSize: 52,
  },
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
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  btn: {
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.2s",
  },
};