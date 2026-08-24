import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  build: {
    // The deployed bundle is the only copy of this code most people will ever
    // open, and without maps it is one minified line. These are projects whose
    // whole argument is that the work should be readable, so they ship the maps
    // that make it readable in a browser as well as on GitHub.
    sourcemap: true,
    // The site's own JavaScript is small; three.js and its ecosystem are not.
    // Splitting them out means a repeat visitor who reads an updated paragraph
    // does not re-download the renderer to do it.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('@react-three')) return 'r3f'
          if (id.includes('@supabase')) return 'supabase'
          return undefined
        },
      },
    },
  },
})
