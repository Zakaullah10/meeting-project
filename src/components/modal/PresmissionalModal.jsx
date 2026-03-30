// ─── Permission Modal Icons ───────────────────────────────────────────────────
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const BrowserMicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
  </svg>
);
const BrowserCamIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>
);
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);
// ─── Permission Denied Modal ──────────────────────────────────────────────────
export const PermissionModal = ({ type, onClose, onRetry }) => {
  const isMic = type === "mic";

  const handleRetry = async () => {
    try {
      const constraints = isMic
        ? { audio: true }
        : { video: true };
      await navigator.mediaDevices.getUserMedia(constraints);
      onRetry();
    } catch {
      // still blocked — modal stays open
    }
  };

  return (
    <div className="perm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="perm-modal">
        <div className="perm-modal-header">
          <div className={`perm-icon-wrap ${isMic ? "mic" : "cam"}`}>
            {isMic ? <BrowserMicIcon /> : <BrowserCamIcon />}
            <div className="perm-icon-badge">!</div>
          </div>
          <button className="perm-close-btn" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="perm-modal-body">
          <div className="perm-title">
            {isMic ? "Microphone Access Blocked" : "Camera Access Blocked"}
          </div>
          <div className="perm-desc">
            MeetSpace needs access to your <strong>{isMic ? "microphone" : "camera"}</strong> to connect
            you with others in this meeting. Your browser has blocked this permission.
          </div>

          <div className="perm-steps">
            <div className="perm-step">
              <div className="perm-step-num">1</div>
              <div className="perm-step-text">
                Click the <span className="perm-step-icon">🔒 Lock</span> icon in your browser's address bar
              </div>
            </div>
            <div className="perm-step">
              <div className="perm-step-num">2</div>
              <div className="perm-step-text">
                Find <strong style={{color:"#c7d2fe"}}>{isMic ? "Microphone" : "Camera"}</strong> and change it from <em style={{color:"#f87171"}}>Blocked</em> to <em style={{color:"#34d399"}}>Allow</em>
              </div>
            </div>
            <div className="perm-step">
              <div className="perm-step-num">3</div>
              <div className="perm-step-text">
                Reload the page or click <strong style={{color:"#c7d2fe"}}>Request Again</strong> below
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
            Permissions reset after you update them in the browser.
          </div>
        </div>
      </div>
    </div>
  );
};