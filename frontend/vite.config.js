import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Forward /api calls to the Express backend during development.
    proxy: { '/api': 'http://localhost:3001' },
    // Allow importing ../backend/mock/plan.json so there is only one mock file.
    fs: { allow: ['..'] },
  },
})
