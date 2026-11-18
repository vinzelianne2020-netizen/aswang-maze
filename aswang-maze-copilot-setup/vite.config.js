import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname, "AswangMaze/wwwroot"),
  base: "/dist/",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: resolve(import.meta.dirname, "AswangMaze/wwwroot/game-test.html")
    }
  }
});
