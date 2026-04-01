import { ReactNode } from "react";

interface IPhoneMockupProps {
  children: ReactNode;
  width?: number;
}

/**
 * Realistic iPhone frame wrapper for card previews.
 * Renders a device bezel with Dynamic Island, status bar, and home indicator.
 */
export function IPhoneMockup({ children, width = 320 }: IPhoneMockupProps) {
  const bezel = 12;
  const outerWidth = width + bezel * 2;
  const screenRadius = 38;
  const outerRadius = 44;

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
      {/* Side buttons (volume + power) */}
      <div
        style={{
          position: "absolute",
          left: "-2px",
          top: "100px",
          width: "3px",
          height: "28px",
          background: "#2a2a2a",
          borderRadius: "2px 0 0 2px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "-2px",
          top: "140px",
          width: "3px",
          height: "50px",
          background: "#2a2a2a",
          borderRadius: "2px 0 0 2px",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "-2px",
          top: "120px",
          width: "3px",
          height: "60px",
          background: "#2a2a2a",
          borderRadius: "0 2px 2px 0",
        }}
      />

      {/* Screen area */}
      <div
        className="relative overflow-hidden"
        style={{
          borderRadius: `${screenRadius}px`,
          background: "#000",
          width: `${width}px`,
        }}
      >
        {/* Status bar */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: "10px 24px 0",
            height: "44px",
            background: "#000",
          }}
        >
          <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600, fontFamily: "-apple-system, sans-serif" }}>
            9:41
          </span>

          {/* Dynamic Island */}
          <div
            style={{
              width: "90px",
              height: "24px",
              background: "#000",
              borderRadius: "20px",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: `${bezel + 10}px`,
              zIndex: 10,
            }}
          />

          <div className="flex items-center gap-1">
            {/* Signal */}
            <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
              <rect x="0" y="7" width="3" height="4" rx="0.5" fill="#fff" />
              <rect x="4" y="5" width="3" height="6" rx="0.5" fill="#fff" />
              <rect x="8" y="2" width="3" height="9" rx="0.5" fill="#fff" />
              <rect x="12" y="0" width="3" height="11" rx="0.5" fill="#fff" />
            </svg>
            {/* WiFi */}
            <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
              <path d="M7 10.5a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" fill="#fff" />
              <path d="M4 7.5a4.24 4.24 0 016 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M1.5 5a7.07 7.07 0 0111 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {/* Battery */}
            <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
              <rect x="0.5" y="0.5" width="20" height="10" rx="2" stroke="#fff" strokeOpacity="0.35" />
              <rect x="1.5" y="1.5" width="18" height="8" rx="1" fill="#fff" />
              <path d="M22 4v3a1 1 0 001-1V5a1 1 0 00-1-1z" fill="#fff" fillOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Wallet header */}
        <div style={{ padding: "6px 18px 10px", background: "#000" }}>
          <p style={{ color: "#fff", fontSize: "11px", fontWeight: 500, opacity: 0.5, fontFamily: "-apple-system, sans-serif" }}>
            Wallet
          </p>
        </div>

        {/* Card content */}
        <div style={{ padding: "0 16px 20px", background: "#000" }}>
          {children}
        </div>

        {/* Home indicator */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: "8px",
            background: "#000",
          }}
        >
          <div
            style={{
              width: "120px",
              height: "4px",
              borderRadius: "2px",
              background: "rgba(255,255,255,0.25)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
