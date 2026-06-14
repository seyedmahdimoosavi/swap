import { defineConfig } from 'vite';
import path from "path";
import react from '@vitejs/plugin-react';

// Dev server runs on 8080 to match the original server.js
export default defineConfig({
  plugins: [react()],
  server: { port: 8080, host: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
