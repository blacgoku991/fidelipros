import { ReactNode } from "react";

interface IPhoneMockupProps {
  children: ReactNode;
  width?: number;
  /** Fixed screen height (default 580). Content scrolls if it overflows. */
  screenHeight?: number;
}

/**
 * Realistic iPhone frame wrapper with FIXED dimensions.
 * The device never resizes — content adapts to fit inside.
 * Includes a Wallet header, stacked background cards, and home indicator.
 */
export function IPhoneMockup({ children, width = 320, screenHeight = 560 }: IPhoneMockupProps) {
  const bezel = 12;
  const outerWidth = width + bezel * 2;
  const screenRadius = 38;
  const outerRadius = 44;

  // Heights for fixed layout
  const statusBarH = 44;
  const walletHeaderH = 36;
  const homeBarH = 28;
  const contentH = screenHeight - statusBarH - walletHeaderH - homeBarH;

  return (
    <div
      className="relative mx-auto"
      style={{
        width: `${outerWidth}px`,
        background: "#1a1a1a",
        borderRadius: `${outerRadius}px`,
        padding: `${bezel}px`,
        boxShadow:
          "0 30px 60px -12px rgba(0,0,0,0.4), 0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
      }}
    >
      {/* Side buttons */}
      <div style={{ position: "absolute", left: "-2px", top: "100px", width: "3px", height: "28px", background: "#2a2a2a", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: "-2px", top: "140px", width: "3px", height: "50px", background: "#2a2a2a", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", right: "-2px", top: "120px", width: "3px", height: "60px", background: "#2a2a2a", borderRadius: "0 2px 2px 0" }} />

      {/* Screen area — FIXED height */}
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
          style={{ padding: "10px 24px 0", height: `${statusBarH}px`, background: "#000" }}
        >
          <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600, fontFamily: "-apple-system, sans-serif" }}>
            9:41
          </span>
          {/* Dynamic Island */}
          <div style={{ width: "90px", height: "24px", background: "#000", borderRadius: "20px", position: "absolute", left: "50%", transform: "translateX(-50%)", top: `${bezel + 10}px`, zIndex: 10 }} />
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

        {/* Wallet header */}
        <div style={{ height: `${walletHeaderH}px`, padding: "6px 18px 0", background: "#000", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "#fff", fontSize: "17px", fontWeight: 700, fontFamily: "-apple-system, sans-serif", letterSpacing: "-0.02em" }}>
            Wallet
          </p>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        {/* Card stack area — FIXED height, content scrolls if needed */}
        <div
          style={{
            height: `${contentH}px`,
            padding: "0 16px",
            background: "#000",
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Stacked background cards (decorative) */}
          <div style={{ position: "relative", marginBottom: "8px", height: "20px", flexShrink: 0 }}>
            {/* Card 2 (furthest back) */}
            <div style={{
              position: "absolute", left: "12px", right: "12px", top: "0",
              height: "18px", borderRadius: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
            }} />
            {/* Card 1 (behind main) */}
            <div style={{
              position: "absolute", left: "6px", right: "6px", top: "6px",
              height: "18px", borderRadius: "10px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.08)",
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
