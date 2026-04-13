import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    origin: 'http://localhost:5175',
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8123",
        changeOrigin: true,
      },
      "/outputs": {
        target: "http://127.0.0.1:8123",
        changeOrigin: true,
      },
      "/tongyi-agent": {
        target: "http://127.0.0.1:8123",
        changeOrigin: true,
      },
      "/meeting-viewer": {
        target: "http://127.0.0.1:8123",
        changeOrigin: true,
      },
    },
  },
});
