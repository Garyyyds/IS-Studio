import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist/public',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // data/ holds the server-side storage cache, which the server rewrites on
      // every GET /api/data. Watching it makes each page load trigger the next.
      // Anchored to the project root on purpose: a "**/data/**" glob also
      // matches src/data/, so edits there were silently never picked up and the
      // browser kept importing a stale module.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: [
                (file: string) => {
                  const normalized = path.resolve(file).toLowerCase();
                  const dataDir = path.resolve(__dirname, 'data').toLowerCase();
                  return normalized === dataDir || normalized.startsWith(dataDir + path.sep);
                },
              ],
            },
    },
  };
});
