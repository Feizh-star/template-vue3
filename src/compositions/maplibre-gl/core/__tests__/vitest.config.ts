import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('../../../../', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    threads: false,
    include: ['src/compositions/maplibre-gl/core/__tests__/*.spec.ts'],
  },
})
