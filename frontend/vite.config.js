import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API runs on :4000; proxying keeps it same-origin.
    proxy: { "/api": "http://localhost:4000" },
  },
  build: {
    outDir: "dist",
    sourcemap: false, // never ship source maps to production
  },
});
