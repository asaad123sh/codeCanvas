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
    host: true,
    watch: {
      // The smoke test writes generated projects into .smoke/ — never let that
      // reload the dev server mid-session.
      ignored: ['**/.smoke/**', '**/dist/**'],
    },
  },
});