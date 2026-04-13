import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

// Módulos de Node.js que deben quedar externos en el proceso principal.
// googleapis los usa todos internamente — deben ser external o Vite
// intenta bundlearlos y agota la memoria (~4 GB de tipos).
const NODE_BUILTINS = [
  'electron',
  'better-sqlite3',
  'googleapis',
  // Node.js built-ins
  'path', 'fs', 'os', 'crypto', 'url', 'http', 'https',
  'http2', 'net', 'tls', 'zlib', 'stream', 'events',
  'buffer', 'util', 'assert', 'querystring', 'string_decoder',
  'child_process', 'worker_threads',
  // googleapis
  'google-auth-library', 'gaxios', 'gcp-metadata', 'google-p12-pem',
  // whatsapp-web.js y sus dependencias nativas
  'whatsapp-web.js',
  'puppeteer',
  'ws',
  'bufferutil',
  'utf-8-validate',
  'node-cron',
]

export default defineConfig({
  plugins: [
    react(),

    electron([
      {
        // ── Proceso principal ────────────────────────────────────────────
        entry: 'src/main/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: 'dist/main',
            sourcemap: true,
            minify: false,
            rollupOptions: {
              external: NODE_BUILTINS,
            },
          },
        },
      },
      {
        // ── Preload ──────────────────────────────────────────────────────
        entry: 'src/preload/preload.ts',
        onstart(options) {
          options.reload()
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

  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },

  server: {
    port: 5173,
  },
})
