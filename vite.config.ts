import { copyFileSync, existsSync, mkdirSync, createReadStream, statSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
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

// Discover this route's modules during HTML parsing, rather than after the shell
// has downloaded and executed. This happens inside the measured navigation;
// no module is fetched on other routes and no data is rendered before it is ready.
function preloadProductionTimelinessRoute(): Plugin {
  return {
    name: 'preload-production-timeliness-route',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const bundle = context.bundle
        if (!bundle) return
        const entry = Object.values(bundle).find(item => item.type === 'chunk'
          && Object.keys(item.modules).some(id => id.endsWith('/src/pages/production-fulfillment/index.ts')))
        if (!entry || entry.type !== 'chunk') return
        const files = new Set<string>()
        const visit = (file: string): void => {
          if (files.has(file)) return
          const chunk = bundle[file]
          if (!chunk || chunk.type !== 'chunk') return
          files.add(file)
          chunk.imports.forEach(visit)
        }
        visit(entry.fileName)
        return [{ tag: 'script', injectTo: 'head-prepend', children:
          `if(/^\\/dds\\/supply-chain\\/production-fulfillment(?:\\/|$)/.test(location.pathname)){${JSON.stringify([...files])}.forEach(function(file){var link=document.createElement('link');link.rel='modulepreload';link.href='/'+file;document.head.appendChild(link)})}` }]
      },
    },
  }
}

// Preview's default middleware recompresses large chunks on every cold request.
// Emit the same bytes ahead of time; neither data nor module evaluation is skipped.
function compressedPreviewAssets(): Plugin {
  return {
    name: 'compressed-preview-assets',
    writeBundle(options, bundle) {
      if (!options.dir) return
      for (const item of Object.values(bundle)) {
        const selected = item.type === 'chunk'
          ? item.fileName.includes('/production-timeliness-') || item.fileName.includes('/production-source-shared-') || item.fileName.includes('/app-shared-') || item.isEntry
          : item.fileName.endsWith('.css')
        if (!selected) continue
        const path = resolve(options.dir, item.fileName)
        const source = readFileSync(path)
        writeFileSync(`${path}.br`, brotliCompressSync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }))
        writeFileSync(`${path}.gz`, gzipSync(source))
      }
    },
    configurePreviewServer(server) {
      const directory = resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url || '').split('?')[0]
        if (!['GET', 'HEAD'].includes(request.method || '') || !/^\/assets\/[\w.-]+\.(js|css)$/.test(pathname)) return next()
        const encoding = /\bbr\b/.test(request.headers['accept-encoding'] || '') ? 'br' : /\bgzip\b/.test(request.headers['accept-encoding'] || '') ? 'gz' : ''
        if (!encoding) return next()
        const path = resolve(directory, `.${pathname}.${encoding}`)
        if (!existsSync(path)) return next()
        response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript')
        response.setHeader('Content-Encoding', encoding === 'gz' ? 'gzip' : 'br')
        response.setHeader('Content-Length', statSync(path).size)
        response.setHeader('Vary', 'Accept-Encoding')
        response.setHeader('Cache-Control', 'no-cache')
        if (request.method === 'HEAD') response.end()
        else createReadStream(path).pipe(response)
      })
    },
  }
}

export default defineConfig({
  plugins: [ensureStaticPlaceholderPlugin(), preloadProductionTimelinessRoute(), compressedPreviewAssets()],
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
        manualChunks(id, { getModuleInfo, getModuleIds }) {
          // Group the actual static dependency closure of the requested DDS module.
          // Keeping its 30+ small shared chunks separate serializes cold HTTP/1.1 fetches.
          const ids = [...getModuleIds()]
          const collectStaticModules = (entry: string | undefined): Set<string> => {
            const modules = new Set<string>()
            const visit = (moduleId: string): void => {
              if (modules.has(moduleId)) return
              modules.add(moduleId)
              getModuleInfo(moduleId)?.importedIds.forEach(visit)
            }
            if (entry) visit(entry)
            return modules
          }
          const ddsModules = collectStaticModules(ids.find(moduleId => moduleId.endsWith('/src/pages/production-fulfillment/index.ts')))
          const shellModules = collectStaticModules(ids.find(moduleId => moduleId.endsWith('/src/main.ts')))
          // Other lazy routes use these shared controls too. They must not import
          // the complete DDS feature just to render a button or a standard list.
          const sharedUiModules = new Set<string>()
          for (const file of ['list-page', 'list-table', 'pagination', 'list-table-model', 'button']) {
            for (const moduleId of collectStaticModules(ids.find(value => value.endsWith(`/src/components/ui/${file}.ts`)))) {
              sharedUiModules.add(moduleId)
            }
          }
          if (ddsModules.has(id) && !id.endsWith('.css')) {
            // Shared shell dependencies must never pull the DDS page into other routes.
            if (shellModules.has(id) || sharedUiModules.has(id)) return 'app-shared'
            // Existing PCS/FCS routes reuse source records, not DDS views and its initialization.
            return id.includes('/src/pages/production-fulfillment/') ? 'production-timeliness' : 'production-source-shared'
          }

          if (id.includes('/src/data/fcs/process-craft-dict.ts')) return 'process-craft-dict'
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
