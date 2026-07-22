import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'Notie',
        short_name: 'Notie',
        description: 'A quiet place for the writing that takes time.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f2efe8',
        theme_color: '#3d6b63',
        icons: [
          {
            src: '/notie-mark.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/notie-mark.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    watch: {
      // Windows file locks (Chrome downloads / AV) crash chokidar with EBUSY.
      usePolling: true,
      interval: 1000,
      ignored: [
        '**/public/**/*.crdownload',
        '**/*.crdownload',
        '**/public/**/*.{jpg,jpeg,png,gif,webp}',
      ],
    },
  },
});
