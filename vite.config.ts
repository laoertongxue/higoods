import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

function ensureStaticPlaceholderAsset(root: string): void {
  const source = resolve(root, 'public/placeholder.svg')
  const target = resolve(root, 'dist-manifest/placeholder.svg')

  if (!existsSync(source) || existsSync(target)) {
    return
  }

  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(source, target)
}

function ensureStaticPlaceholderPlugin(): Plugin {
  return {
    name: 'ensure-static-placeholder-asset',
    configResolved(config) {
      ensureStaticPlaceholderAsset(config.root)
    },
    configureServer(server) {
      ensureStaticPlaceholderAsset(server.config.root)
    },
    buildStart() {
      ensureStaticPlaceholderAsset(process.cwd())
    },
  }
}

export default defineConfig({
  plugins: [ensureStaticPlaceholderPlugin()],
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes('/src/data/fcs/pda-handover-events.ts')) return 'pda-handover-events'
          if (id.includes('/src/data/fcs/post-finishing-domain.ts')) return 'post-finishing-execution-domain'
          if (id.includes('/src/data/pcs-technical-data-version-repository.ts')) {
            return 'pcs-technical-data-version-repository'
          }
          if (id.includes('/src/data/pcs-technical-data-version-bootstrap.ts')) {
            return 'pcs-tech-pack-bootstrap'
          }
          if (id.includes('/src/data/pcs-engineering-bom-snapshot-source.ts')) {
            return 'pcs-engineering-bom-snapshot-source'
          }
          if (id.includes('/src/data/pcs-engineering-bom-snapshot-validation.ts')) {
            return 'pcs-engineering-bom-snapshot-validation'
          }
          if (id.includes('/src/data/pcs-engineering-bom-material-resolver.ts')) {
            return 'pcs-engineering-bom-material-resolver'
          }
          if (id.includes('/src/data/pcs-material-archive-repository.ts')) {
            return 'pcs-material-archive-repository'
          }
        },
      },
    },
  },
})
