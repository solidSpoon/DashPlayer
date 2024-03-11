import { defineConfig } from 'vite';
import path from "path";
import react from '@vitejs/plugin-react'
// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // https://github.com/electron/forge/issues/3398
    sourcemap: true,
    rollupOptions: {
      external: [
        'better-sqlite3',
      ]
    }
  },
  plugins: [react()]
});
