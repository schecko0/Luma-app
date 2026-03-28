import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  // ── Sin "root" custom ────────────────────────────────────────────────────
  // index.html está en la raíz del proyecto (patrón estándar de vite-plugin-electron).
  // Así todos los outDir relativos se resuelven desde la raíz y Electron
  // encuentra dist/main/main.js exactamente donde lo espera package.json.

  plugins: [
    react(),

    electron([
      {
        // ── Proceso principal ────────────────────────────────────────────
        entry: 'src/main/main.ts',
        onstart(options) {
          options.startup() // vite-plugin-electron lanza Electron aquí
        },
        vite: {
          build: {
            outDir: 'dist/main',
            sourcemap: true,
            minify: false,
            rollupOptions: {
              external: ['better-sqlite3', 'electron', 'path', 'fs', 'os', 'crypto'],
            },
          },
        },
      },
      {
        // ── Preload ──────────────────────────────────────────────────────
        entry: 'src/preload/preload.ts',
        onstart(options) {
          options.reload() // recarga el renderer cuando el preload cambia
        },
        vite: {
          build: {
            outDir: 'dist/preload',
            sourcemap: true,
            minify: false,
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),

    renderer(),
  ],

  resolve: {
    alias: {
      '@':     path.resolve(__dirname, 'src/renderer/src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@db':   path.resolve(__dirname, 'src/database'),
    },
  },

  // El build del renderer va a dist/renderer
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },

  server: {
    port: 5173,
  },
})
