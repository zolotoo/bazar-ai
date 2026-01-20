import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api-v1': {
        target: 'https://instagram-scraper-20251.p.rapidapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-v1/, ''),
        secure: true,
      },
    },
  },
})
