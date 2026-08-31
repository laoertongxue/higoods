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
    watch: {
      ignored: ['**/output/**', '**/test-results/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes('/src/data/fcs/process-craft-dict.ts')) return 'process-craft-dict'
          if (id.includes('/src/data/fcs/post-finishing-domain.ts')) return 'post-finishing-execution-domain'
          if (id.includes('/src/data/tech-pack-process-route.ts')) return 'tech-pack-process-route'
          if (id.includes('/src/data/pcs-tech-pack-version-log-repository.ts')) return 'pcs-tech-pack-version-log-repository'
          if (id.includes('/src/data/pcs-tech-pack-review-notification-repository.ts')) {
            return 'pcs-tech-pack-review-notification-repository'
          }
          if (id.includes('/src/data/pcs-technical-data-version-bootstrap.ts')) {
            return 'pcs-tech-pack-bootstrap'
          }
          if (id.includes('/src/data/pcs-engineering-bom-snapshot-source.ts')) {
            return 'pcs-engineering-bom-snapshot-source'
          }
        },
      },
    },
  },
})
