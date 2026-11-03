import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative, so the same build works on GitHub Pages
// (served from /<repo>/) and locally.
export default defineConfig({
  base: './',
  plugins: [react()],
  // The project folder name contains a colon ("Apps:Websites"), which Vite's dev-server
  // path check misreads as outside the project. Dev-only; does not affect the build.
  server: { fs: { strict: false } },
})
