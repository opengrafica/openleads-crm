import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { placesApiPlugin } from './server/placesSearch.js'
import { whatsappApiPlugin } from './server/whatsappApi.js'

export default defineConfig({
  plugins: [react(), tailwindcss(), placesApiPlugin(), whatsappApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ['@whiskeysockets/baileys'],
  },
})
