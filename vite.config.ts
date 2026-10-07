import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /<repo>/, so production builds use that base; dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Ai-Native-Trading-Platform/' : '/',
  plugins: [react(), tailwindcss()],
}))
