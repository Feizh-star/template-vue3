import { defineConfig } from 'vitest/config'

// Keep layer/resource tests independent of the application's Vite plugins.
export default defineConfig({
  test: {
    environment: 'jsdom',
    threads: false,
    include: [
      'src/libs/ColorfulMapImage/__tests__/*.spec.ts',
      'src/libs/ColorfulMapImageExport/__tests__/*.spec.ts',
    ],
  },
})
