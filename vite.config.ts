import { defineConfig } from 'vite'

function normalizeId(id: string): string {
  return id.replace(/\\/g, '/')
}

function resolveManualChunk(id: string): string | undefined {
  const normalized = normalizeId(id)

  if (normalized.includes('/node_modules/')) {
    if (normalized.includes('/lucide')) return 'vendor-lucide'
    return 'vendor'
  }

  if (
    normalized.includes('/src/components/shell.ts')
    || normalized.includes('/src/main.ts')
  ) {
    return 'app-shell'
  }

  if (normalized.includes('/src/router/routes.ts')) {
    return 'app-routes'
  }
  if (normalized.includes('/src/router/routes-fcs.ts')) {
    return 'app-routes-fcs'
  }
  if (normalized.includes('/src/router/routes-pcs.ts')) {
    return 'app-routes-pcs'
  }
  if (normalized.includes('/src/router/routes-pda.ts')) {
    return 'app-routes-pda'
  }

  return undefined
}

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 3200,
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
})
