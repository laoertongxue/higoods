import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
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

function preferTypeScriptSourcePlugin(): Plugin {
  let root = process.cwd()

  return {
    name: 'prefer-typescript-source',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.') || extname(source)) return null

      const cleanImporter = importer.split('?')[0]
      const importerPath = cleanImporter.startsWith('/src/')
        ? resolve(root, cleanImporter.slice(1))
        : cleanImporter
      const absoluteBase = resolve(dirname(importerPath), source)
      const tsCandidate = `${absoluteBase}.ts`
      const tsxCandidate = `${absoluteBase}.tsx`

      if (existsSync(tsCandidate)) return tsCandidate
      if (existsSync(tsxCandidate)) return tsxCandidate
      return null
    },
  }
}

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
  plugins: [preferTypeScriptSourcePlugin(), ensureStaticPlaceholderPlugin()],
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
  },
  server: {
    port: 5173,
    strictPort: true,
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
