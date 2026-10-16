import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { cpSync } from 'node:fs'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'compendium-content',
    writeBundle(options) {
      cpSync(resolve(import.meta.dirname, 'content'), resolve(options.dir!, 'content'), { recursive: true })
    },
  }],
})
