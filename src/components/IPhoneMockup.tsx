import { ReactNode } from "react";

interface IPhoneMockupProps {
  children: ReactNode;
  width?: number;
  /** Optional notification rendered under the dynamic island */
  notification?: ReactNode;
}

/**
 * Realistic iPhone 15 Pro Max frame — FIXED dimensions.
 * Tall, thin, premium proportions matching real device (6.7" screen).
 * Includes Wallet header, stacked cards, and home indicator.
 */
export function IPhoneMockup({ children, width = 320, notification }: IPhoneMockupProps) {
  const bezel = 10;
  const outerWidth = width + bezel * 2;
  const screenRadius = 42;
  const outerRadius = 48;
  // Fixed aspect ratio matching iPhone Pro Max (~19.5:9)
  const screenHeight = Math.round(width * 2.16);

  const statusBarH = 48;
  const walletHeaderH = 38;
  const homeBarH = 28;
  const notifH = notification ? 56 : 0;
  const contentH = screenHeight - statusBarH - walletHeaderH - homeBarH - notifH;

  return (
    <div
      className="relative mx-auto flex-shrink-0"
      style={{
        width: `${outerWidth}px`,
        height: `${screenHeight + bezel * 2}px`,
        background: "linear-gradient(145deg, #2a2a2a, #1a1a1a, #111)",
        borderRadius: `${outerRadius}px`,
        padding: `${bezel}px`,
        boxShadow:
          "0 40px 80px -16px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.3)",
        userSelect: "none",
      }}
    >
      {/* Titanium frame edge highlights */}
      <div style={{ position: "absolute", inset: 0, borderRadius: `${outerRadius}px`, border: "1px solid rgba(255,255,255,0.06)", pointerEvents: "none" }} />

      {/* Side buttons */}
      <div style={{ position: "absolute", left: "-2.5px", top: "80px", width: "3px", height: "24px", background: "linear-gradient(180deg, #3a3a3a, #2a2a2a)", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: "-2.5px", top: "120px", width: "3px", height: "44px", background: "linear-gradient(180deg, #3a3a3a, #2a2a2a)", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: "-2.5px", top: "172px", width: "3px", height: "44px", background: "linear-gradient(180deg, #3a3a3a, #2a2a2a)", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", right: "-2.5px", top: "130px", width: "3px", height: "56px", background: "linear-gradient(180deg, #3a3a3a, #2a2a2a)", borderRadius: "0 2px 2px 0" }} />

      {/* Screen — FIXED size */}
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: `${screenRadius}px`,
          background: "#000",
          width: `${width}px`,
          height: `${screenHeight}px`,
        }}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 26px 0", height: `${statusBarH}px`, background: "#000" }}
        >
          <span style={{ color: "#fff", fontSize: "14px", fontWeight: 600, fontFamily: "-apple-system, 'SF Pro Display', sans-serif" }}>
            9:41
          </span>
          {/* Dynamic Island */}
          <div style={{
            width: "100px", height: "28px",
            background: "#000",
            borderRadius: "20px",
            position: "absolute",
            left: "50%", transform: "translateX(-50%)",
            top: `${bezel + 12}px`,
            zIndex: 10,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
          }} />
          <div className="flex items-center gap-1">
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
              <rect x="0" y="7" width="3" height="4" rx="0.5" fill="#fff" />
              <rect x="4" y="5" width="3" height="6" rx="0.5" fill="#fff" />
              <rect x="8" y="2" width="3" height="9" rx="0.5" fill="#fff" />
              <rect x="12" y="0" width="3" height="11" rx="0.5" fill="#fff" />
            </svg>
            <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
              <path d="M7 10.5a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" fill="#fff" />
              <path d="M4 7.5a4.24 4.24 0 016 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M1.5 5a7.07 7.07 0 0111 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
              <rect x="0.5" y="0.5" width="20" height="10" rx="2" stroke="#fff" strokeOpacity="0.35" />
              <rect x="1.5" y="1.5" width="18" height="8" rx="1" fill="#fff" />
              <path d="M22 4v3a1 1 0 001-1V5a1 1 0 00-1-1z" fill="#fff" fillOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* iOS notification (under dynamic island) */}
        {notification && (
          <div style={{ height: `${notifH}px`, padding: "4px 14px 0", background: "#000" }}>
            {notification}
          </div>
        )}

        {/* Wallet header */}
        <div style={{
          height: `${walletHeaderH}px`,
          padding: "8px 20px 0",
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <p style={{
            color: "#fff", fontSize: "18px", fontWeight: 700,
            fontFamily: "-apple-system, 'SF Pro Display', sans-serif",
            letterSpacing: "-0.02em",
          }}>
            Wallet
          </p>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        {/* Card stack area — FIXED height */}
        <div
          style={{
            height: `${contentH}px`,
            padding: "0 14px",
            background: "#000",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Stacked background cards (decorative) */}
          <div style={{ position: "relative", marginBottom: "6px", height: "20px", flexShrink: 0 }}>
            <div style={{
              position: "absolute", left: "14px", right: "14px", top: "0",
              height: "16px", borderRadius: "10px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.05)",
            }} />
            <div style={{
              position: "absolute", left: "7px", right: "7px", top: "6px",
              height: "16px", borderRadius: "10px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.07)",
            }} />
          </div>

          {/* Main card content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
            {children}
          </div>
        </div>

        {/* Home indicator */}
        <div style={{ height: `${homeBarH}px`, display: "flex", justifyContent: "center", alignItems: "center", background: "#000" }}>
          <div style={{ width: "120px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.25)" }} />
        </div>
      </div>
    </div>
  );
}
