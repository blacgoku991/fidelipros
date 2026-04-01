import { ReactNode } from "react";

interface SamsungMockupProps {
  children: ReactNode;
  width?: number;
}

/**
 * Realistic Samsung Galaxy frame wrapper for Google Wallet previews.
 * Renders a device bezel with punch-hole camera, status bar, and nav bar.
 */
export function SamsungMockup({ children, width = 320 }: SamsungMockupProps) {
  const bezel = 10;
  const outerWidth = width + bezel * 2;
  const screenRadius = 32;
  const outerRadius = 36;

  return (
    <div
      className="relative mx-auto"
      style={{
        width: `${outerWidth}px`,
        background: "#111111",
        borderRadius: `${outerRadius}px`,
        padding: `${bezel}px`,
        boxShadow:
          "0 30px 60px -12px rgba(0,0,0,0.35), 0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      {/* Side buttons */}
      <div
        style={{
          position: "absolute",
          right: "-2px",
          top: "90px",
          width: "3px",
          height: "50px",
          background: "#222",
          borderRadius: "0 2px 2px 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "-2px",
          top: "110px",
          width: "3px",
          height: "35px",
          background: "#222",
          borderRadius: "2px 0 0 2px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "-2px",
          top: "155px",
          width: "3px",
          height: "35px",
          background: "#222",
          borderRadius: "2px 0 0 2px",
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
            padding: "8px 20px 0",
            height: "36px",
            background: "#000",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: "12px",
              fontWeight: 500,
              fontFamily: "'Roboto', 'Google Sans', sans-serif",
            }}
          >
            9:41
          </span>

          {/* Punch-hole camera */}
          <div
            style={{
              width: "10px",
              height: "10px",
              background: "#1a1a1a",
              borderRadius: "50%",
              border: "1.5px solid #333",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: `${bezel + 10}px`,
              zIndex: 10,
            }}
          />

          <div className="flex items-center gap-1.5">
            {/* Signal */}
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <rect x="0" y="7" width="2" height="3" rx="0.5" fill="#fff" />
              <rect x="3" y="5" width="2" height="5" rx="0.5" fill="#fff" />
              <rect x="6" y="2.5" width="2" height="7.5" rx="0.5" fill="#fff" />
              <rect x="9" y="0" width="2" height="10" rx="0.5" fill="#fff" />
            </svg>
            {/* Battery */}
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
              <rect x="0.5" y="0.5" width="16" height="9" rx="2" stroke="#fff" strokeOpacity="0.35" />
              <rect x="1.5" y="1.5" width="14" height="7" rx="1" fill="#4ade80" />
              <path d="M18 3.5v3a1 1 0 001-1v-1a1 1 0 00-1-1z" fill="#fff" fillOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Google Wallet header */}
        <div
          style={{
            padding: "8px 18px 10px",
            background: "#000",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M21.5 12c0 5.247-4.253 9.5-9.5 9.5S2.5 17.247 2.5 12 6.753 2.5 12 2.5s9.5 4.253 9.5 9.5z" fill="#4285F4" />
            <path d="M12 7v5l4.25 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p
            style={{
              color: "#fff",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "'Roboto', 'Google Sans', sans-serif",
            }}
          >
            Google Wallet
          </p>
        </div>

        {/* Card content */}
        <div style={{ padding: "0 14px 16px", background: "#000" }}>
          {children}
        </div>

        {/* Android nav bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "32px",
            paddingBottom: "10px",
            paddingTop: "4px",
            background: "#000",
          }}
        >
          <div style={{ width: "16px", height: "16px", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "2px" }} />
          <div style={{ width: "32px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.3)" }} />
          <div style={{ width: "0", height: "0", borderLeft: "8px solid rgba(255,255,255,0.3)", borderTop: "7px solid transparent", borderBottom: "7px solid transparent" }} />
        </div>
      </div>
    </div>
  );
}
