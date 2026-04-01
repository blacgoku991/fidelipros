import { ReactNode } from "react";

interface SamsungMockupProps {
  children: ReactNode;
  width?: number;
}

/**
 * Realistic Samsung Galaxy S24 Ultra frame for Google Wallet previews.
 * FIXED dimensions — content adapts to fit inside.
 * Thinner bezels, squared-off titanium frame, edge display.
 */
export function SamsungMockup({ children, width = 320 }: SamsungMockupProps) {
  const bezel = 8;
  const outerWidth = width + bezel * 2;
  const screenRadius = 28;
  const outerRadius = 32;
  // Samsung Ultra aspect ratio (~19.3:9, slightly shorter than iPhone)
  const screenHeight = Math.round(width * 2.1);

  return (
    <div
      className="relative mx-auto flex-shrink-0"
      style={{
        width: `${outerWidth}px`,
        height: `${screenHeight + bezel * 2}px`,
        background: "linear-gradient(145deg, #1e1e1e, #111, #0a0a0a)",
        borderRadius: `${outerRadius}px`,
        padding: `${bezel}px`,
        boxShadow:
          "0 40px 80px -16px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        userSelect: "none",
      }}
    >
      {/* Frame edge */}
      <div style={{ position: "absolute", inset: 0, borderRadius: `${outerRadius}px`, border: "1px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />

      {/* Side buttons */}
      <div style={{ position: "absolute", right: "-2.5px", top: "90px", width: "3px", height: "50px", background: "linear-gradient(180deg, #333, #222)", borderRadius: "0 2px 2px 0" }} />
      <div style={{ position: "absolute", left: "-2.5px", top: "110px", width: "3px", height: "32px", background: "linear-gradient(180deg, #333, #222)", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: "-2.5px", top: "150px", width: "3px", height: "32px", background: "linear-gradient(180deg, #333, #222)", borderRadius: "2px 0 0 2px" }} />

      {/* Screen — FIXED */}
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: `${screenRadius}px`,
          background: "#000",
          width: `${width}px`,
          height: `${screenHeight}px`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: "10px 20px 0", height: "38px", background: "#000" }}
        >
          <span style={{ color: "#fff", fontSize: "12px", fontWeight: 500, fontFamily: "'Roboto', 'Google Sans', sans-serif" }}>
            9:41
          </span>
          {/* Punch-hole camera */}
          <div style={{
            width: "10px", height: "10px",
            background: "#1a1a1a",
            borderRadius: "50%",
            border: "1.5px solid #333",
            position: "absolute",
            left: "50%", transform: "translateX(-50%)",
            top: `${bezel + 10}px`,
            zIndex: 10,
          }} />
          <div className="flex items-center gap-1.5">
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <rect x="0" y="7" width="2" height="3" rx="0.5" fill="#fff" />
              <rect x="3" y="5" width="2" height="5" rx="0.5" fill="#fff" />
              <rect x="6" y="2.5" width="2" height="7.5" rx="0.5" fill="#fff" />
              <rect x="9" y="0" width="2" height="10" rx="0.5" fill="#fff" />
            </svg>
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
              <rect x="0.5" y="0.5" width="16" height="9" rx="2" stroke="#fff" strokeOpacity="0.35" />
              <rect x="1.5" y="1.5" width="14" height="7" rx="1" fill="#4ade80" />
              <path d="M18 3.5v3a1 1 0 001-1v-1a1 1 0 00-1-1z" fill="#fff" fillOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Google Wallet header */}
        <div
          className="flex-shrink-0"
          style={{
            padding: "10px 18px 10px",
            background: "#000",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21.5 12c0 5.247-4.253 9.5-9.5 9.5S2.5 17.247 2.5 12 6.753 2.5 12 2.5s9.5 4.253 9.5 9.5z" fill="#4285F4" />
            <path d="M12 7v5l4.25 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p style={{ color: "#fff", fontSize: "14px", fontWeight: 500, fontFamily: "'Roboto', 'Google Sans', sans-serif" }}>
            Google Wallet
          </p>
        </div>

        {/* Card content — fills remaining space */}
        <div style={{ flex: 1, padding: "0 14px", background: "#000", overflow: "hidden" }}>
          {children}
        </div>

        {/* Android nav bar */}
        <div
          className="flex-shrink-0"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "32px",
            paddingBottom: "12px",
            paddingTop: "8px",
            background: "#000",
          }}
        >
          <div style={{ width: "14px", height: "14px", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: "2px" }} />
          <div style={{ width: "36px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.3)" }} />
          <div style={{ width: "0", height: "0", borderLeft: "7px solid rgba(255,255,255,0.25)", borderTop: "6px solid transparent", borderBottom: "6px solid transparent" }} />
        </div>
      </div>
    </div>
  );
}
