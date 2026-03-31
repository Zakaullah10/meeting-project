import React, { useState } from "react";
import { v4 as uuidV4 } from "uuid";
import { useGoogleLogin } from "@react-oauth/google";

export const Home = () => {
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const createRoom = () => {
    setLoading(true);
    setTimeout(() => {
      const id = uuidV4();
      window.loatcion.href = `/room/${id}`;
    }, 500);
  };

  const joinRoom = () => {
    const code = roomCode.trim();
    if (!code) return;
    window.location.href = `/room/${code}`;
  };

  return (
    <div style={{ fontFamily: "'Google Sans', 'Roboto', sans-serif" }} className="min-h-screen bg-white flex flex-col">

      {/* Top Nav */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {/* Hamburger */}
          <button className="p-2 rounded-full hover:bg-gray-100 transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#5f6368">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>
          {/* Google Meet logo */}
          <div className="flex items-center gap-2">
            <svg width="40" height="28" viewBox="0 0 40 28" fill="none">
              <rect width="40" height="28" rx="4" fill="white"/>
              <path d="M25 10.5V7.5C25 6.672 24.328 6 23.5 6H6.5C5.672 6 5 6.672 5 7.5V20.5C5 21.328 5.672 22 6.5 22H23.5C24.328 22 25 21.328 25 20.5V17.5L35 22V6L25 10.5Z" fill="#00897B"/>
            </svg>
            <span className="text-gray-700 text-xl font-medium tracking-tight">Meet</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 mr-2 hidden sm:block">13:44 · Tue 31 Mar</span>
          <button className="p-2 rounded-full hover:bg-gray-100 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368"><path d="M6 5c1.1 0 2-.9 2-2S7.1 1 6 1 4 1.9 4 3s.9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-10c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-10c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          </button>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-teal-700 flex items-center justify-center text-white text-sm font-medium ml-1 cursor-pointer">Z</div>
        </div>
      </header>

      {/* Sidebar + Main */}
      <div className="flex flex-1">

        {/* Left Sidebar */}
        <aside className="hidden md:flex flex-col pt-2 w-64">
          <nav className="flex flex-col gap-1 px-3">
            <button className="flex items-center gap-4 px-4 py-3 rounded-full bg-blue-50 text-blue-700 font-medium text-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1a73e8"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
              Meetings
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="max-w-2xl w-full text-center">

            {/* Heading */}
            <h1 className="text-5xl font-normal text-gray-800 mb-4 leading-tight">
              Video calls and meetings<br />for everyone
            </h1>
            <p className="text-gray-500 text-lg mb-10">
              Connect, collaborate and celebrate from anywhere with<br />
              <span className="font-medium text-gray-600">Velo Meet</span>
            </p>

            {/* Action Row */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              {/* New Meeting Button */}
              <button
                onClick={createRoom}
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium text-sm transition shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating…
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                    New meeting
                  </>
                )}
              </button>

              {/* Room Code Input */}
              <div className="flex items-center border border-gray-300 rounded-full overflow-hidden bg-white shadow-sm">
                <div className="pl-4 text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#9aa0a6"><path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H4V8h16v11zm0-13H4V5h16v1z"/></svg>
                </div>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  placeholder="Enter a code or link"
                  className="px-3 py-3 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none w-52"
                />
              </div>

              {/* Join Button */}
              <button
                onClick={joinRoom}
                disabled={!roomCode.trim()}
                className="px-5 py-3 text-sm font-medium rounded-full transition text-blue-600 hover:bg-blue-50 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Join
              </button>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap');
      `}</style>
    </div>
  );
};