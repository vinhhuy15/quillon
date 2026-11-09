import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri expects a fixed port and no clearing of its logs.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  optimizeDeps: {
    include: [
      'mathjax-full/js/mathjax.js',
      'mathjax-full/js/input/tex.js',
      'mathjax-full/js/output/svg.js',
      'mathjax-full/js/adaptors/liteAdaptor.js',
      'mathjax-full/js/handlers/html.js',
      'mathjax-full/js/input/tex/AllPackages.js',
      'mathjax-full/js/core/MathItem.js',
      'mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js',
    ],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
});
