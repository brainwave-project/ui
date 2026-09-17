import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Proxy all /api/* calls to Kong in dev — avoids CORS entirely
    proxy: {
      // Eval Lab API (make evals-lab) — NOT behind Kong, no JWT. Must be listed
      // before '/api': Vite matches proxy keys in declaration order.
      '/api/eval': {
        target:       process.env['VITE_EVAL_API_URL'] ?? 'http://localhost:3005',
        changeOrigin: true,
        secure:       false,
      },
      '/api': {
        target:      process.env['VITE_API_URL'] ?? 'http://localhost:8000',
        changeOrigin: true,
        secure:       false,
      },
    },
  },
});
