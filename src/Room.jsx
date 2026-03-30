import React, { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import { useParams } from "react-router-dom";

// ─── Icons ────────────────────────────────────────────────────────────────────
const MicOnIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
  </svg>
);
const MicOffIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8" />
  </svg>
);
const CamOnIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);
const CamOffIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const ScreenShareIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
    <polyline points="8 9 12 5 16 9" />
    <line x1="12" y1="5" x2="12" y2="14" />
  </svg>
);
const StopShareIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const LeaveIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="20"
    height="20"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const BrowserMicIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
  </svg>
);
const BrowserCamIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);
const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="16"
    height="16"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="14"
    height="14"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0c10; --surface: rgba(255,255,255,0.04); --surface-hover: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.08); --text: #e8eaf0; --text-muted: #6b7280;
    --accent: #6366f1; --accent-glow: rgba(99,102,241,0.35); --danger: #ef4444;
    --danger-glow: rgba(239,68,68,0.35); --success: #10b981; --success-glow: rgba(16,185,129,0.3);
  }
  body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
  .room-wrapper { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; position: relative; }
  .room-wrapper::before { content: ''; position: fixed; top: -200px; left: -200px; width: 600px; height: 600px; background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%); border-radius: 50%; pointer-events: none; animation: driftA 18s ease-in-out infinite alternate; }
  .room-wrapper::after { content: ''; position: fixed; bottom: -200px; right: -200px; width: 500px; height: 500px; background: radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%); border-radius: 50%; pointer-events: none; animation: driftB 22s ease-in-out infinite alternate; }
  @keyframes driftA { to { transform: translate(60px, 80px); } }
  @keyframes driftB { to { transform: translate(-60px, -60px); } }
  .room-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid var(--border); background: rgba(10,12,16,0.8); backdrop-filter: blur(20px); position: relative; z-index: 10; flex-shrink: 0; }
  .room-logo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; letter-spacing: -0.3px; }
  .room-logo-dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 8px var(--success-glow); animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:0.6; transform: scale(0.8); } }
  .room-id { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text-muted); background: var(--surface); border: 1px solid var(--border); padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; }
  .room-participants { font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
  .room-participants span { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; padding: 3px 10px; font-size: 12px; font-weight: 500; color: var(--text); }
  .presenting-badge { display: flex; align-items: center; gap: 6px; position: absolute; top: 14px; left: 50%; transform: translateX(-50%); background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; font-size: 12px; font-weight: 500; padding: 5px 14px; border-radius: 20px; animation: fadeIn 0.3s ease; }
  .presenting-dot { width: 6px; height: 6px; background: var(--danger); border-radius: 50%; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes fadeIn { from { opacity:0; transform: translateX(-50%) translateY(-6px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
  .video-area { flex: 1; display: flex; overflow: hidden; padding: 20px; gap: 16px; position: relative; z-index: 1; }
  .video-grid { display: grid; width: 100%; gap: 12px; align-content: center; justify-items: center; }
  .video-grid.count-1 { grid-template-columns: 1fr; max-width: 760px; margin: 0 auto; }
  .video-grid.count-2 { grid-template-columns: 1fr 1fr; }
  .video-grid.count-3, .video-grid.count-4 { grid-template-columns: 1fr 1fr; }
  .video-grid.count-5, .video-grid.count-6 { grid-template-columns: repeat(3, 1fr); }
  .screenshare-layout { display: flex; gap: 12px; width: 100%; height: 100%; }
  .screenshare-main { flex: 1; border-radius: 16px; overflow: hidden; position: relative; background: #000; border: 1px solid var(--border); }
  .screenshare-main video { width: 100%; height: 100%; object-fit: contain; }
  .screenshare-sidebar { width: 220px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
  .video-tile { position: relative; width: 100%; border-radius: 16px; overflow: hidden; background: #0d0f14; border: 1px solid var(--border); aspect-ratio: 16/9; animation: tileIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
  @keyframes tileIn { from { opacity:0; transform: scale(0.92); } to { opacity:1; transform: scale(1); } }
  .video-tile:hover { border-color: rgba(255,255,255,0.15); }
  .video-tile video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .video-tile-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%); padding: 10px 12px; display: flex; align-items: flex-end; justify-content: space-between; pointer-events: none; }
  .video-tile-name { font-size: 12px; font-weight: 500; color: #fff; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); padding: 3px 9px; border-radius: 20px; }
  .video-avatar { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1d26, #0f111a); }
  .avatar-circle { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 600; color: #fff; box-shadow: 0 0 30px var(--accent-glow); }
  .controls-bar { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 24px; background: rgba(10,12,16,0.85); backdrop-filter: blur(20px); border-top: 1px solid var(--border); flex-shrink: 0; position: relative; z-index: 10; }
  .ctrl-btn { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 12px 20px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; transition: all 0.18s ease; font-size: 11px; font-weight: 500; font-family: 'DM Sans', sans-serif; letter-spacing: 0.3px; min-width: 72px; }
  .ctrl-btn:hover { background: var(--surface-hover); transform: translateY(-1px); }
  .ctrl-btn.muted { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
  .ctrl-btn.sharing { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.3); color: #fbbf24; }
  .ctrl-btn.leave { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.25); color: #f87171; margin-left: 16px; }
  .ctrl-btn.leave:hover { background: var(--danger); color: #fff; border-color: var(--danger); box-shadow: 0 0 24px var(--danger-glow); }
  .ctrl-btn.blocked { opacity: 0.85; }
  .ctrl-divider { width: 1px; height: 48px; background: var(--border); margin: 0 6px; }
  .sidebar-tile { border-radius: 12px; overflow: hidden; position: relative; background: #0d0f14; border: 1px solid var(--border); aspect-ratio: 16/9; flex-shrink: 0; }
  .sidebar-tile video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sidebar-tile-name { position: absolute; bottom: 6px; left: 8px; font-size: 11px; font-weight: 500; color: #fff; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); padding: 2px 7px; border-radius: 10px; }
  .perm-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(5,6,10,0.75); backdrop-filter: blur(12px); }
  .perm-modal { width: 420px; background: #12141c; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.6); animation: modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes modalIn { from { opacity:0; transform: scale(0.9) translateY(16px); } to { opacity:1; transform: scale(1) translateY(0); } }
  .perm-modal-header { padding: 28px 28px 0; display: flex; align-items: flex-start; justify-content: space-between; }
  .perm-icon-wrap { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; position: relative; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25); color: #f87171; }
  .perm-icon-badge { position: absolute; bottom: -4px; right: -4px; width: 18px; height: 18px; background: var(--danger); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; border: 2px solid #12141c; }
  .perm-close-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
  .perm-modal-body { padding: 20px 28px 28px; }
  .perm-title { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
  .perm-desc { font-size: 13.5px; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }
  .perm-desc strong { color: #a5b4fc; font-weight: 500; }
  .perm-steps { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
  .perm-step { display: flex; align-items: center; gap: 12px; }
  .perm-step-num { width: 24px; height: 24px; border-radius: 8px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .perm-step-text { font-size: 13px; color: var(--text); line-height: 1.45; }
  .perm-step-icon { display: inline-flex; align-items: center; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 1px 6px; margin: 0 2px; font-size: 11px; color: var(--text-muted); }
  .perm-actions { display: flex; gap: 10px; }
  .perm-btn-retry { flex: 1; padding: 12px; border-radius: 12px; background: var(--accent); border: none; color: #fff; font-size: 13.5px; font-weight: 600; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.18s; display: flex; align-items: center; justify-content: center; gap: 7px; }
  .perm-btn-retry:hover { background: #4f52d9; transform: translateY(-1px); }
  .perm-btn-dismiss { padding: 12px 18px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; cursor: pointer; }
  .perm-footer-note { margin-top: 14px; text-align: center; font-size: 11.5px; color: var(--text-muted); }

  .debug-overlay {
    position: fixed; bottom: 90px; left: 16px; z-index: 999;
    background: rgba(0,0,0,0.88); border: 1px solid rgba(99,102,241,0.35);
    border-radius: 10px; padding: 10px 14px; font-family: 'DM Mono', monospace;
    font-size: 11px; color: #a5b4fc; line-height: 2; min-width: 280px; pointer-events: none;
  }
  .debug-overlay .ok   { color: #34d399; }
  .debug-overlay .err  { color: #f87171; }
  .debug-overlay .warn { color: #fbbf24; }
`;

// ─── Permission Modal ─────────────────────────────────────────────────────────
const PermissionModal = ({ type, onClose, onRetry }) => {
  const isMic = type === "mic";
  const handleRetry = async () => {
    try {
      await navigator.mediaDevices.getUserMedia(
        isMic ? { audio: true } : { video: true },
      );
      onRetry();
    } catch {}
  };
  return (
    <div
      className="perm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="perm-modal">
        <div className="perm-modal-header">
          <div className="perm-icon-wrap">
            {isMic ? <BrowserMicIcon /> : <BrowserCamIcon />}
            <div className="perm-icon-badge">!</div>
          </div>
          <button className="perm-close-btn" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="perm-modal-body">
          <div className="perm-title">
            {isMic ? "Microphone" : "Camera"} Access Blocked
          </div>
          <div className="perm-desc">
            MeetSpace needs your{" "}
            <strong>{isMic ? "microphone" : "camera"}</strong> to connect you
            with others.
          </div>
          <div className="perm-steps">
            <div className="perm-step">
              <div className="perm-step-num">1</div>
              <div className="perm-step-text">
                Click <span className="perm-step-icon">🔒 Lock</span> in address
                bar
              </div>
            </div>
            <div className="perm-step">
              <div className="perm-step-num">2</div>
              <div className="perm-step-text">
                Change{" "}
                <strong style={{ color: "#c7d2fe" }}>
                  {isMic ? "Microphone" : "Camera"}
                </strong>{" "}
                to <em style={{ color: "#34d399" }}>Allow</em>
              </div>
            </div>
            <div className="perm-step">
              <div className="perm-step-num">3</div>
              <div className="perm-step-text">
                Click{" "}
                <strong style={{ color: "#c7d2fe" }}>Request Again</strong>{" "}
                below
              </div>
            </div>
          </div>
          <div className="perm-actions">
            <button className="perm-btn-retry" onClick={handleRetry}>
              Request Again <ArrowRightIcon />
            </button>
            <button className="perm-btn-dismiss" onClick={onClose}>
              Dismiss
            </button>
          </div>
          <div className="perm-footer-note">
            Reload the page after updating browser permissions.
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Room Component ──────────────────────────────────────────────────────
export const Room = () => {
  const { id } = useParams();

  const [stream, setStream] = useState(null);
  const [users, setUsers] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [camBlocked, setCamBlocked] = useState(false);
  const [permModal, setPermModal] = useState(null);

  // ─── Refs ────────────────────────────────────────────────────────────────
  const gridVideoRef = useRef(null);
  const sidebarVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const streamRef = useRef(null);
  const pendingScreenRef = useRef(null);
  const pendingCamRef = useRef(null);

  const peersRef = useRef([]);
  const canvasStreamRef = useRef(null);
  const socketRef = useRef(null);

  // ── Debug ─────────────────────────────────────────────────────────────────
  const [dbg, setDbg] = useState({
    gridEl: "—",
    sidebarEl: "—",
    screenEl: "—",
    camTrack: "—",
    sharing: false,
  });
  const upd = useCallback((o) => setDbg((p) => ({ ...p, ...o })), []);

  const logEl = (el, label) => {
    if (!el) return "NO ELEMENT";
    const src = el.srcObject;
    if (!src) return "NO SRCOBJECT";
    const t = src.getVideoTracks()[0];
    return `${src.id.slice(0, 8)}… track:${t?.readyState ?? "none"}`;
  };

  useEffect(() => {
  socketRef.current = io("http://localhost:8000", {
    transports: ["websocket"],
  });

  return () => {
    socketRef.current.disconnect();
  };
}, []);

  useEffect(() => {
    if (screenSharing) {
      if (screenVideoRef.current && pendingScreenRef.current) {
        screenVideoRef.current.srcObject = pendingScreenRef.current;
        console.log(
          "[EFFECT-ON] screenVideoRef assigned",
          screenVideoRef.current.srcObject?.id,
        );
      }
      if (sidebarVideoRef.current && pendingCamRef.current) {
        sidebarVideoRef.current.srcObject = pendingCamRef.current;
        console.log(
          "[EFFECT-ON] sidebarVideoRef assigned",
          sidebarVideoRef.current.srcObject?.id,
        );
      }
      upd({
        screenEl: logEl(screenVideoRef.current, "screen"),
        sidebarEl: logEl(sidebarVideoRef.current, "sidebar"),
        sharing: true,
        camTrack: streamRef.current?.getVideoTracks()[0]?.readyState ?? "—",
      });
    }
  }, [screenSharing]); // eslint-disable-line

  useEffect(() => {
    if (!screenSharing && streamRef.current && gridVideoRef.current) {
      gridVideoRef.current.srcObject = streamRef.current;
      console.log(
        "[EFFECT-OFF] gridVideoRef restored",
        gridVideoRef.current.srcObject?.id,
      );
      upd({
        gridEl: logEl(gridVideoRef.current, "grid"),
        screenEl: "—",
        sidebarEl: "—",
        sharing: false,
        camTrack: streamRef.current?.getVideoTracks()[0]?.readyState ?? "—",
      });
    }
  }, [screenSharing]); // eslint-disable-line

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = styles;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  // ─────────────────────────────────────────────────────────
  // ✅ Helper: Empty stream (for blocked cam/mic)
  const createEmptyStream = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();

    const fakeAudio = dst.stream.getAudioTracks()[0];
    fakeAudio.enabled = false;

    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const fakeVideo = canvas.captureStream().getVideoTracks()[0];
    fakeVideo.enabled = false;

    return new MediaStream([fakeAudio, fakeVideo]);
  };

  // ─────────────────────────────────────────────────────────
  // ✅ Setup all socket listeners (single place)
  const setupSocketListeners = (stream) => {
    // 🔥 Existing users
    socket.on("all-users", (users) => {
      console.log("👥 Existing users:", users);

      users.forEach((userId) => {
        const vr = React.createRef();

        addUser({
          id: userId,
          name: "User",
          videoRef: vr,
          videoOn: true,
          isSelf: false,
        });

        const peer = createPeer(userId, stream, vr);

        if (!peersRef.current.find((p) => p.peerID === userId)) {
          peersRef.current.push({ peerID: userId, peer });
        }
      });
    });

    // 🔥 New user joined
    socket.on("user-joined", (userId) => {
      console.log("➕ New user:", userId);

      const vr = React.createRef();

      addUser({
        id: userId,
        name: "User",
        videoRef: vr,
        videoOn: true,
        isSelf: false,
      });

      const peer = createPeer(userId, stream, vr);

      if (!peersRef.current.find((p) => p.peerID === userId)) {
        peersRef.current.push({ peerID: userId, peer });
      }
    });

    // 🔥 Receiving offer
    socket.on("receiving-signal", (data) => {
      console.log("📡 Receiving signal from:", data.from);

      const vr = React.createRef();

      addUser({
        id: data.from,
        name: "User",
        videoRef: vr,
        videoOn: true,
        isSelf: false,
      });

      const peer = addPeer(data.signal, data.from, stream, vr);

      peersRef.current.push({
        peerID: data.from,
        peer,
      });
    });

    // 🔥 Receiving answer
    socket.on("answer-signal", ({ signal, from }) => {
      console.log("📩 Answer from:", from);

      const item = peersRef.current.find((p) => p.peerID === from);
      if (item) item.peer.signal(signal);
    });

    // 🔥 User left
    socket.on("user-left", (userId) => {
      console.log("❌ User left:", userId);

      const p = peersRef.current.find((x) => x.peerID === userId);
      if (p) p.peer.destroy();

      peersRef.current = peersRef.current.filter((x) => x.peerID !== userId);

      setUsers((prev) => prev.filter((u) => u.id !== userId));
    });
  };

  // ─────────────────────────────────────────────────────────
  // ✅ WebRTC peer creation (IMPORTANT: STUN added)
  function createPeer(userId, stream, videoRef) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    });

    peer.on("signal", (signal) => {
      socket.emit("sending-signal", { userId, signal });
    });

    peer.on("stream", (remoteStream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
      }
    });

    return peer;
  }

  function addPeer(incomingSignal, callerId, stream, videoRef) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    });

    peer.on("signal", (signal) => {
      socket.emit("returning-signal", { signal, to: callerId });
    });

    peer.on("stream", (remoteStream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream;
      }
    });

    peer.signal(incomingSignal);

    return peer;
  }

  // ─────────────────────────────────────────────────────────
  // ✅ MAIN useEffect (FINAL VERSION)
  useEffect(() => {
    const init = async () => {
      try {
        // ✅ Try real camera + mic
        const s = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        console.log("✅ Camera + Mic OK");

        setStream(s);
        streamRef.current = s;
        pendingCamRef.current = s;

        if (gridVideoRef.current) {
          gridVideoRef.current.srcObject = s;
        }

        addUser({
          id: socket.id,
          name: "You",
          videoRef: gridVideoRef,
          videoOn: true,
          isSelf: true,
        });

        socket.on("connect", () => {
          socket.emit("join-room", id);
        });
        setupSocketListeners(s);
      } catch (err) {
        // ❌ Camera/mic blocked → fallback
        console.warn("⚠️ Using empty stream");

        const emptyStream = createEmptyStream();

        setStream(emptyStream);
        streamRef.current = emptyStream;
        pendingCamRef.current = emptyStream;

        addUser({
          id: socket.id,
          name: "You",
          videoRef: gridVideoRef,
          videoOn: false,
          isSelf: true,
        });

        socket.on("connect", () => {
          socket.emit("join-room", id);
        });
        setupSocketListeners(emptyStream);
      }
    };

    init();

    return () => {
      peersRef.current.forEach((p) => p.peer.destroy());
      socket.off();
    };
  }, [id]);

  const checkIndividualPermissions = async () => {
    let micOk = false,
      camOk = false,
      micS = null,
      camS = null;
    try {
      micS = await navigator.mediaDevices.getUserMedia({ audio: true });
      micOk = true;
    } catch {}
    try {
      camS = await navigator.mediaDevices.getUserMedia({ video: true });
      camOk = true;
    } catch {}
    setMicBlocked(!micOk);
    setCamBlocked(!camOk);
    setMicOn(micOk);
    setVideoOn(camOk);
    const tracks = [];
    if (micS) micS.getAudioTracks().forEach((t) => tracks.push(t));
    if (camS) camS.getVideoTracks().forEach((t) => tracks.push(t));
    if (tracks.length) {
      const combined = new MediaStream(tracks);
      setStream(combined);
      streamRef.current = combined;
      pendingCamRef.current = combined;
      if (gridVideoRef.current) gridVideoRef.current.srcObject = combined;
    }
    addUser({
      id: socket.id,
      name: "You",
      videoRef: gridVideoRef,
      videoOn: camOk,
      isSelf: true,
    });
    socket.on("connect", () => {
      socket.emit("join-room", id);
    });
  };

  const toggleMic = () => {
    if (micBlocked) {
      setPermModal("mic");
      return;
    }
    const s = streamRef.current;
    if (!s) return;
    const t = s.getAudioTracks()[0];
    if (t) t.enabled = !micOn;
    setMicOn((v) => !v);
  };
  const toggleVideo = () => {
    if (camBlocked) {
      setPermModal("cam");
      return;
    }
    const s = streamRef.current;
    if (!s) return;
    const t = s.getVideoTracks()[0];
    if (t) t.enabled = !videoOn;
    setVideoOn((v) => !v);
    setUsers((prev) =>
      prev.map((u) => (u.isSelf ? { ...u, videoOn: !videoOn } : u)),
    );
  };

  const handlePermissionGranted = async () => {
    setPermModal(null);
    await checkIndividualPermissions();
  };

  // ── Screen Share Start ────────────────────────────────────────────────────
  const startScreenShare = async () => {
    const camStream = streamRef.current;
    if (!camStream) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Offscreen canvas: screen + PiP camera
      const offCam = document.createElement("video");
      offCam.srcObject = camStream;
      offCam.muted = true;
      await offCam.play();

      const offScr = document.createElement("video");
      offScr.srcObject = screenStream;
      offScr.muted = true;
      await offScr.play();

      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      let animId;
      const draw = () => {
        ctx.drawImage(offScr, 0, 0, 1280, 720);
        ctx.drawImage(offCam, 940, 530, 320, 180);
        animId = requestAnimationFrame(draw);
      };
      draw();

      const canvasStream = canvas.captureStream(30);
      canvasStreamRef.current = {
        canvasStream,
        animId,
        screenStream,
        offCam,
        offScr,
      };

      // Peers ko canvas stream send karo
      peersRef.current.forEach(({ peer }) => {
        const sender = peer._pc
          ?.getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(canvasStream.getVideoTracks()[0]);
      });

      // Streams pending refs mein store karo
      // useEffect inhe DOM mount ke baad assign karega
      pendingScreenRef.current = screenStream;
      pendingCamRef.current = camStream;

      console.log("[SCREENSHARE START] pendingScreenRef set:", screenStream.id);
      console.log("[SCREENSHARE START] pendingCamRef set:", camStream.id);

      screenStream.getVideoTracks()[0].onended = stopScreenShare;

      // Yeh trigger karega useEffect jo DOM mount ke baad streams assign karega
      setScreenSharing(true);
    } catch (err) {
      console.error("[SCREENSHARE] getDisplayMedia failed:", err);
    }
  };

  // ── Screen Share Stop ─────────────────────────────────────────────────────
  const stopScreenShare = () => {
    console.log("[SCREENSHARE STOP]");
    const ref = canvasStreamRef.current;
    if (ref?.animId) cancelAnimationFrame(ref.animId);
    if (ref?.screenStream)
      ref.screenStream.getTracks().forEach((t) => t.stop());
    if (ref?.offCam) {
      ref.offCam.srcObject = null;
    }
    if (ref?.offScr) {
      ref.offScr.srcObject = null;
    }
    canvasStreamRef.current = null;
    pendingScreenRef.current = null;

    const camStream = streamRef.current;
    if (camStream) {
      peersRef.current.forEach(({ peer }) => {
        const sender = peer._pc
          ?.getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(camStream.getVideoTracks()[0]);
      });
    }

    // useEffect will restore grid camera after state change
    setScreenSharing(false);
  };

  const addUser = (user) => {
    setUsers((prev) => {
      if (prev.find((u) => u.id === user.id)) return prev;
      return [...prev, user];
    });
  };

  const count = users.length;
  const gridClass = `video-grid count-${Math.min(count, 6)}`;

  return (
    <div className="room-wrapper">
      {permModal && (
        <PermissionModal
          type={permModal}
          onClose={() => setPermModal(null)}
          onRetry={handlePermissionGranted}
        />
      )}

      <div className="debug-overlay">
        <div>
          Grid video:{" "}
          <span className={dbg.camTrack === "live" ? "ok" : "err"}>
            {dbg.gridEl}
          </span>
        </div>
        <div>
          Sidebar vid:{" "}
          <span className={dbg.camTrack === "live" ? "ok" : "err"}>
            {dbg.sidebarEl}
          </span>
        </div>
        <div>
          Screen vid: <span className="warn">{dbg.screenEl}</span>
        </div>
        <div>
          Cam track:{" "}
          <span className={dbg.camTrack === "live" ? "ok" : "err"}>
            {dbg.camTrack}
          </span>
        </div>
        <div>
          Sharing:{" "}
          <span className={dbg.sharing ? "ok" : "warn"}>
            {dbg.sharing ? "YES" : "NO"}
          </span>
        </div>
        <div>
          videoOn:{" "}
          <span className={videoOn ? "ok" : "err"}>{String(videoOn)}</span>
        </div>
      </div>

      {/* Header */}
      <header className="room-header">
        <div className="room-logo">
          <div className="room-logo-dot" />
          MeetSpace
        </div>
        {screenSharing && (
          <div className="presenting-badge">
            <div className="presenting-dot" />
            You are presenting
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="room-id">{id || "room-xyz"}</div>
          <div className="room-participants">
            <span>
              {count} {count === 1 ? "participant" : "participants"}
            </span>
          </div>
        </div>
      </header>

      {/* Video Area */}
      <div className="video-area">
        {/* Screen Share Layout — sirf jab sharing ho, tab render hoga (tab refs bhi mount honge) */}
        {screenSharing && (
          <div className="screenshare-layout">
            <div className="screenshare-main">
              {/* ref callback: jaise hi yeh element mount ho, stream assign karo */}
              <video
                ref={(el) => {
                  screenVideoRef.current = el;
                  if (el && pendingScreenRef.current && !el.srcObject) {
                    el.srcObject = pendingScreenRef.current;
                    console.log(
                      "[REF CALLBACK] screenVideoRef assigned:",
                      el.srcObject?.id,
                    );
                  }
                }}
                autoPlay
                muted
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div className="screenshare-sidebar">
              <div className="sidebar-tile">
                {/* ref callback: jaise hi sidebar mount ho, camera stream assign karo */}
                <video
                  ref={(el) => {
                    sidebarVideoRef.current = el;
                    if (el && pendingCamRef.current && !el.srcObject) {
                      el.srcObject = pendingCamRef.current;
                      console.log(
                        "[REF CALLBACK] sidebarVideoRef assigned:",
                        el.srcObject?.id,
                      );
                    }
                  }}
                  autoPlay
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: videoOn ? "block" : "none",
                  }}
                />
                {!videoOn && (
                  <div className="video-avatar">
                    <div className="avatar-circle">Y</div>
                  </div>
                )}
                <div className="sidebar-tile-name">You</div>
              </div>
            </div>
          </div>
        )}

        {/* Normal Grid Layout */}
        {!screenSharing && (
          <div className={gridClass}>
            <div className="video-tile">
              <video
                ref={(el) => {
                  gridVideoRef.current = el;
                  if (el && streamRef.current && !el.srcObject) {
                    el.srcObject = streamRef.current;
                    console.log(
                      "[REF CALLBACK] gridVideoRef assigned:",
                      el.srcObject?.id,
                    );
                  }
                }}
                autoPlay
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: videoOn ? "block" : "none",
                }}
              />
              {!videoOn && (
                <div className="video-avatar">
                  <div className="avatar-circle">Y</div>
                </div>
              )}
              <div className="video-tile-overlay">
                <span className="video-tile-name">You</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="controls-bar">
        <button
          className={`ctrl-btn ${!micOn || micBlocked ? "muted" : ""} ${micBlocked ? "blocked" : ""}`}
          onClick={toggleMic}
        >
          {micOn && !micBlocked ? <MicOnIcon /> : <MicOffIcon />}
          {micBlocked ? "Blocked" : micOn ? "Mute" : "Unmute"}
        </button>
        <button
          className={`ctrl-btn ${!videoOn || camBlocked ? "muted" : ""} ${camBlocked ? "blocked" : ""}`}
          onClick={toggleVideo}
        >
          {videoOn && !camBlocked ? <CamOnIcon /> : <CamOffIcon />}
          {camBlocked ? "Blocked" : videoOn ? "Camera" : "Cam Off"}
        </button>
        <div className="ctrl-divider" />
        <button
          className={`ctrl-btn ${screenSharing ? "sharing" : ""}`}
          onClick={screenSharing ? stopScreenShare : startScreenShare}
        >
          {screenSharing ? <StopShareIcon /> : <ScreenShareIcon />}
          {screenSharing ? "Stop Share" : "Share"}
        </button>
        <div className="ctrl-divider" />
        <button
          className="ctrl-btn leave"
          onClick={() => (window.location.href = "/")}
        >
          <LeaveIcon />
          Leave
        </button>
      </div>
    </div>
  );
};
