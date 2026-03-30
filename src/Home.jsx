import React, { useState, useEffect } from "react";
import { v4 as uuidV4 } from "uuid";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0a0a0f;
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
  }

  .home {
    min-height: 100vh;
    background: #0a0a0f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 2rem;
  }

  /* Ambient orbs */
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    animation: drift 8s ease-in-out infinite alternate;
  }
  .orb-1 {
    width: 420px; height: 420px;
    background: radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%);
    top: -100px; left: -80px;
    animation-delay: 0s;
  }
  .orb-2 {
    width: 360px; height: 360px;
    background: radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 70%);
    bottom: -80px; right: -60px;
    animation-delay: -3s;
  }
  .orb-3 {
    width: 260px; height: 260px;
    background: radial-gradient(circle, rgba(244,114,182,0.12) 0%, transparent 70%);
    top: 40%; left: 55%;
    animation-delay: -5s;
  }

  @keyframes drift {
    from { transform: translate(0, 0) scale(1); }
    to   { transform: translate(30px, 20px) scale(1.08); }
  }

  /* Grid overlay */
  .grid-overlay {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }

  /* Card */
  .card {
    position: relative;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 28px;
    padding: 56px 52px 48px;
    width: 100%;
    max-width: 460px;
    backdrop-filter: blur(24px);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 24px 64px rgba(0,0,0,0.5),
      0 0 80px rgba(99,102,241,0.06);
    animation: fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) forwards;
    opacity: 0;
    transform: translateY(24px);
  }

  @keyframes fadeUp {
    to { opacity: 1; transform: translateY(0); }
  }

  /* Logo mark */
  .logo-mark {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 40px;
  }

  .logo-icon {
    width: 38px; height: 38px;
    background: linear-gradient(135deg, #6366f1, #14b8a6);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(99,102,241,0.4);
  }

  .logo-icon svg {
    width: 18px; height: 18px;
    fill: white;
  }

  .logo-text {
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    font-size: 15px;
    color: rgba(255,255,255,0.55);
    letter-spacing: 0.03em;
  }

  /* Heading */
  .heading {
    font-family: 'DM Serif Display', serif;
    font-size: 2.6rem;
    line-height: 1.1;
    color: #fff;
    margin-bottom: 14px;
    letter-spacing: -0.02em;
  }

  .heading em {
    font-style: italic;
    background: linear-gradient(90deg, #818cf8, #34d399);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .sub {
    font-size: 15px;
    color: rgba(255,255,255,0.38);
    line-height: 1.6;
    font-weight: 300;
    margin-bottom: 44px;
  }

  /* Input + Button row */
  .input-row {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 28px;
  }

  .input-wrap {
    position: relative;
  }

  .input-wrap svg {
    position: absolute;
    left: 16px; top: 50%;
    transform: translateY(-50%);
    width: 16px; height: 16px;
    color: rgba(255,255,255,0.25);
    pointer-events: none;
  }

  .room-input {
    width: 100%;
    padding: 14px 16px 14px 44px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px;
    color: #fff;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
    letter-spacing: 0.01em;
  }

  .room-input::placeholder { color: rgba(255,255,255,0.2); }

  .room-input:focus {
    border-color: rgba(99,102,241,0.5);
    background: rgba(255,255,255,0.07);
  }

  /* Buttons */
  .btn-primary {
    width: 100%;
    padding: 15px 24px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    letter-spacing: 0.01em;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    position: relative;
    overflow: hidden;
    transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
    box-shadow: 0 4px 20px rgba(99,102,241,0.35);
  }

  .btn-primary::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(99,102,241,0.45); }
  .btn-primary:hover::after { opacity: 1; }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary.loading { opacity: 0.7; pointer-events: none; }

  .btn-secondary {
    width: 100%;
    padding: 14px 24px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px;
    color: rgba(255,255,255,0.65);
    font-size: 14px;
    font-weight: 400;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    letter-spacing: 0.01em;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }

  .btn-secondary:hover {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.88);
    border-color: rgba(255,255,255,0.14);
  }

  /* Divider */
  .divider {
    display: flex; align-items: center; gap: 12px;
    margin: 4px 0;
  }
  .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
  .divider-text { font-size: 12px; color: rgba(255,255,255,0.2); letter-spacing: 0.05em; }

  /* Features row */
  .features {
    display: flex;
    gap: 20px;
    margin-top: 32px;
    padding-top: 28px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .feature {
    display: flex; align-items: center; gap: 7px;
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.01em;
  }

  .feature svg { width: 13px; height: 13px; opacity: 0.6; }

  /* Spinner */
  .spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Pulse dot */
  .live-dot {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 11px;
    color: #34d399;
    letter-spacing: 0.04em;
    font-weight: 500;
    margin-bottom: 20px;
  }
  .live-dot-circle {
    width: 7px; height: 7px;
    background: #34d399;
    border-radius: 50%;
    animation: pulse-dot 1.8s ease-in-out infinite;
    box-shadow: 0 0 6px #34d399;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.7); }
  }
`;

export const Home = () => {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const createRoom = () => {
    setLoading(true);
    setTimeout(() => {
      const id = uuidV4();
      window.location.href = `/room/${id}`;
    }, 500);
  };

  const joinRoom = () => {
    const code = roomCode.trim();
    if (!code) return;
    window.location.href = `/room/${code}`;
  };

  return (
    <>
      <style>{style}</style>
      <div className="home">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="grid-overlay" />

        <div className="card">
          {/* Logo */}
          <div className="logo-mark">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            </div>
            <span className="logo-text">Velo Meet</span>
          </div>

          {/* Live indicator */}
          <div className="live-dot">
            <span className="live-dot-circle" />
            Ready to connect
          </div>

          {/* Heading */}
          <h1 className="heading">Meet, <em>instantly.</em></h1>
          <p className="sub">Start a free video call or join with a room code — no sign‑up needed.</p>

          {/* Actions */}
          <div className="input-row">
            <button
              className={`btn-primary ${loading ? "loading" : ""}`}
              onClick={createRoom}
            >
              {loading ? (
                <><span className="spinner" /> Creating room…</>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  New Meeting
                </>
              )}
            </button>

            <div className="divider">
              <span className="divider-line" />
              <span className="divider-text">OR</span>
              <span className="divider-line" />
            </div>

            <div className="input-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 015.656 0l.002.002A4 4 0 0114.828 20.484l-1.1-1.1"/></svg>
              <input
                className="room-input"
                placeholder="Enter room code…"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && joinRoom()}
              />
            </div>

            <button className="btn-secondary" onClick={joinRoom}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
              Join Room
            </button>
          </div>

          {/* Feature chips */}
          <div className="features">
            <div className="feature">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              End-to-end encrypted
            </div>
            <div className="feature">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Low latency
            </div>
            <div className="feature">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3M5 12a7 7 0 1114 0 7 7 0 01-14 0z"/></svg>
              No sign-up
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;