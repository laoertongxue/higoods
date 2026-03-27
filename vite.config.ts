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
    normalized.includes('/src/router/routes.ts')
    || normalized.includes('/src/components/shell.ts')
    || normalized.includes('/src/main.ts')
  ) {
    return 'app-shell'
  }

  if (
    normalized.includes('/src/pages/process-factory/cutting/')
    || normalized.includes('/src/data/fcs/cutting/')
    || normalized.includes('/src/domain/fcs-cutting-runtime/')
    || normalized.includes('/src/domain/fcs-cutting-piece-truth/')
    || normalized.includes('/src/domain/cutting-core/')
    || normalized.includes('/src/domain/cutting-warehouse-writeback/')
    || normalized.includes('/src/domain/cutting-platform/')
    || normalized.includes('/src/pages/production')
    || normalized.includes('/src/pages/progress-')
    || normalized.includes('/src/pages/settlement')
    || normalized.includes('/src/pages/process-factory/')
    || normalized.includes('/src/pages/pda-')
    || normalized.includes('/src/data/fcs/pda-')
    || normalized.includes('/src/domain/cutting-pda-writeback/')
  ) {
    return 'cutting-domain-pages'
  }

  if (normalized.includes('/src/pages/pcs-')) return 'pcs-pages'

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
