/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    pool: 'threads',
    // Rendering-heavy tests can exceed the 5 s default when all files run in parallel
    // (seen locally and likely on slower CI runners).
    testTimeout: 20000,
  },
})
