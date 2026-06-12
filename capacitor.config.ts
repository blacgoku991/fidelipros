import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.a602f3ee5c8a40258469788fb1c1e4c8",
  appName: "FidéliPro Driver",
  webDir: "dist",
  server: {
    url: "https://a602f3ee-5c8a-4025-8469-788fb1c1e4c8.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  plugins: {
    BackgroundGeolocation: {
      // plugin reads its config at runtime via addWatcher options
    },
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
