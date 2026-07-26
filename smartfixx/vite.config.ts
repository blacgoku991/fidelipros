import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    target: "es2020",
    rollupOptions: {
      // Le découpage manuel ne vaut que pour le bundle client : au build SSR ces
      // paquets sont externes, et Rollup refuse de les placer dans un chunk.
      output: isSsrBuild
        ? {}
        : {
            manualChunks: {
              three: ["three"],
              r3f: ["@react-three/fiber", "@react-three/drei", "@react-three/postprocessing"],
              motion: ["framer-motion"],
            },
          },
    },
  },
}));
