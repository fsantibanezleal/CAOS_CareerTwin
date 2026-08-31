import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const apiPort = process.env.CAREERTWIN_API_PORT ?? '8000'
const webPort = Number(process.env.CAREERTWIN_WEB_PORT ?? '5173')

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/zrender') || id.includes('node_modules/echarts')) return 'charts'
          if (id.includes('node_modules/graphology') || id.includes('node_modules/sigma') || id.includes('node_modules/@react-sigma')) return 'graph'
          if (id.includes('node_modules/@xyflow')) return 'flow'
          if (id.includes('node_modules/@tanstack')) return 'query'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
  server: {
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
      '/metrics': `http://127.0.0.1:${apiPort}`,
    },
  },
  preview: { port: 4173, strictPort: true },
})
