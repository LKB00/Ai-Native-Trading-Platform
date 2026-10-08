import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages serves the site from /<repo>/, so production builds use that base, read from the repository name when Actions builds it (a rename can't break it); dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'Trad-ai'}/` : '/',
  plugins: [react(), tailwindcss()],
}))
