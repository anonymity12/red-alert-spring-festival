import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "./client",
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 6100,
    proxy: {
      "/socket.io": {
        target: "http://localhost:6101",
        ws: true,
      },
    },
  },
});
