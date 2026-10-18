import { copyFileSync, existsSync, mkdirSync, createReadStream, statSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'
import type { OutputBundle } from 'rollup'
import { defineConfig, type Plugin } from 'vite'

// These bounded groups share the same observable initialization dependency set.
// Keep storage hydration, source resolvers and business owners in their original
// dependency order. The full emitted-graph check also covers every lazy entry;
// do not collect a new dependency closure into a group here.
const craftStartupChunkGroups: Record<string, readonly string[]> = {
  'wool-craft-shared': [
    '/src/pages/process-factory/wool/craft-actions.ts',
    '/src/pages/process-factory/wool/shared.ts',
    '/src/pages/process-factory/wool/stage-display.ts',
  ],
  'generated-fei-tickets': [
    '/src/data/fcs/cutting/generated-fei-tickets.ts',
    '/src/data/fcs/cutting/material-ledger.ts',
    '/src/data/fcs/cutting/material-prep-cut-order-read.ts',
    '/src/data/fcs/cutting/material-prep-seed-identities.ts',
    '/src/data/fcs/cutting/order-progress.ts',
    '/src/data/fcs/cutting/qr-codes.ts',
    '/src/data/fcs/cutting/qr-payload.ts',
    '/src/data/fcs/cutting/spreading-differences.ts',
    '/src/pages/process-factory/cutting/cutting-table-resource.ts',
    '/src/pages/process-factory/cutting/marker-spreading-model.ts',
  ],
  'craft-order-list': [
    '/src/data/pcs-material-sku-identity.ts',
    '/src/pages/process-factory/special-craft/order-display.ts',
    '/src/pages/process-factory/special-craft/task-orders.ts',
  ],
  'pcs-record-core': [
    '/src/data/fcs/post-finishing-records.ts',
    '/src/data/pcs-engineering-bom-storage.ts',
    '/src/data/pcs-record-codec.ts',
    '/src/data/pcs-record-db.ts',
    '/src/data/pcs-record-position.ts',
    '/src/data/pcs-record-runtime.ts',
    '/src/data/pcs-record-static-versions.ts',
  ],
  'post-finishing-full-flow': [
    '/src/data/fcs/kol-goto-special-flow.ts',
    '/src/data/fcs/post-finishing-current-read-model.ts',
    '/src/data/fcs/post-finishing-document-numbering.ts',
    '/src/data/fcs/post-finishing-full-flow.ts',
    '/src/data/fcs/post-finishing-operation-log.ts',
    '/src/data/fcs/post-finishing-qc-reference.ts',
    '/src/data/fcs/post-finishing-return-source-adapter.ts',
    '/src/data/fcs/post-finishing-return-source-fact-bridge.ts',
    '/src/data/fcs/ppic-daily-return.ts',
  ],
  'runtime-process-tasks': [
    '/src/data/fcs/cutting/cutting-task-routing.ts',
    '/src/data/fcs/cutting/generated-cut-orders.ts',
    '/src/data/fcs/cutting/special-craft-release-demo-tasks.ts',
    '/src/data/fcs/factory-receiving-wool.ts',
    '/src/data/fcs/process-order-receiving-target.ts',
    '/src/data/fcs/process-tasks.ts',
    '/src/data/fcs/process-types.ts',
    '/src/data/fcs/production-artifact-generation.ts',
    '/src/data/fcs/production-material-bom.ts',
    '/src/data/fcs/runtime-process-tasks.ts',
    '/src/data/fcs/sewing-delivery-receipt-facts.ts',
    '/src/data/fcs/special-craft-source-task-registry.ts',
    '/src/data/fcs/task-detail-rows.ts',
    '/src/data/fcs/task-generation-boundaries.ts',
    '/src/data/fcs/task-handover-domain.ts',
    '/src/data/fcs/task-qr.ts',
    '/src/data/fcs/wool-domain/commands.ts',
    '/src/data/fcs/wool-domain/craft-flow.ts',
    '/src/data/fcs/wool-domain/machine-associations.ts',
    '/src/data/fcs/wool-domain/mobile.ts',
    '/src/data/fcs/wool-domain/mock-data.ts',
    '/src/data/fcs/wool-domain/mock-receiving.ts',
    '/src/data/fcs/wool-domain/piece-source.ts',
    '/src/data/fcs/wool-domain/queries.ts',
    '/src/data/fcs/wool-domain/stage-correction.ts',
    '/src/data/fcs/wool-domain/stage-facts.ts',
    '/src/data/fcs/wool-domain/stage-rules.ts',
    '/src/data/fcs/wool-domain/store.ts',
    '/src/data/fcs/wool-domain/tech-pack-source.ts',
    '/src/data/fcs/wool-domain/types.ts',
    '/src/data/fcs/wool-domain/warehouse-ledger.ts',
  ],
  'production-orders': [
    '/src/data/fcs/cutting/replacement-fabric-demo.ts',
    '/src/data/fcs/kol-goto-tech-pack-fixtures.ts',
    '/src/data/fcs/production-frozen-snapshot.ts',
    '/src/data/fcs/production-order-demo-tech-packs.json',
    '/src/data/fcs/production-order-tech-pack-runtime.ts',
    '/src/data/fcs/production-orders.ts',
  ],
  'craft-image-storage': [
    '/src/data/fcs/cutting/whole-bag-handover-read-contract.ts',
    '/src/data/pms/idb-storage.ts',
    '/src/data/pms/runtime.ts',
    '/src/utils/static-image-thumbnail.ts',
    '/src/utils/static-image-thumbnails.json',
  ],
  'craft-display-support': [
    '/src/components/ui/process-order-list-presentation.ts',
    '/src/data/fcs/cutting/cutting-event-scope.ts',
    '/src/data/fcs/cutting/cutting-record-identity.ts',
    '/src/data/fcs/cutting/cutting-record-repository.ts',
    '/src/data/fcs/cutting/cutting-runtime-chronology.ts',
    '/src/data/fcs/cutting/cutting-runtime-event-ledger.ts',
    '/src/data/fcs/cutting/mixed-transfer-bag-ticket.ts',
    '/src/data/fcs/cutting/part-ticket-records.ts',
    '/src/data/fcs/cutting/storage/fei-tickets-storage.ts',
    '/src/data/fcs/dispatch-acceptance-sla.ts',
    '/src/data/fcs/factory-types.ts',
    '/src/data/fcs/fcs-route-links.ts',
    '/src/data/fcs/merged-production-task.ts',
    '/src/data/fcs/print-service.ts',
    '/src/data/fcs/production-context-records.ts',
    '/src/data/fcs/production-created-process-source-types.ts',
    '/src/data/fcs/production-material-image-assets.ts',
    '/src/data/fcs/runtime-task-read-bridge.ts',
    '/src/data/fcs/sewing-delivery-sla.ts',
    '/src/data/fcs/sewing-return-calendar.ts',
    '/src/data/fcs/store-domain-pda.ts',
    '/src/data/fcs/task-fulfillment-policy.ts',
    '/src/data/fcs/third-party-factory-rating.ts',
    '/src/data/fcs/third-party-factory-trial-assessment.ts',
    '/src/data/pcs-sample-cost-optional-cleanup.ts',
    '/src/data/pcs-sample-cost-review-pricing.ts',
  ],
  'pda-handover-events': [
    '/src/data/fcs/cutting/material-prep-record-read.ts',
    '/src/data/fcs/factory-internal-warehouse.ts',
    '/src/data/fcs/factory-receiving-warehouse.ts',
    '/src/data/fcs/material-request-drafts.ts',
    '/src/data/fcs/pda-handover-events.ts',
    '/src/data/fcs/pda-handover-handout-registry.ts',
    '/src/data/fcs/pda-task-mock-factory.ts',
    '/src/data/fcs/pda-task-scenario-matrix.ts',
    '/src/data/fcs/process-order-input-transfer-fixtures.ts',
    '/src/data/fcs/process-work-order-source-labels.ts',
    '/src/data/fcs/warehouse-material-execution.ts',
    '/src/data/fcs/water-soluble-output-demos.ts',
    '/src/data/fcs/water-soluble-pda-actor.ts',
    '/src/data/fcs/water-soluble-task-domain.ts',
    '/src/data/fcs/wool-domain/craft-warehouse.ts',
  ],
}

function craftStartupChunkName(id: string): string | undefined {
  if (id.includes('\0') || /\.css(?:$|\?)/.test(id)) return undefined
  for (const [name, sources] of Object.entries(craftStartupChunkGroups)) {
    if (sources.some(source => id.endsWith(source))) return name
  }
  return undefined
}

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

function routeStaticChunks(bundle: OutputBundle, sources: string[]): string[] {
  const files = new Set<string>()
  const visit = (file: string): void => {
    if (files.has(file)) return
    const chunk = bundle[file]
    if (!chunk || chunk.type !== 'chunk') return
    files.add(file)
    chunk.imports.forEach(visit)
  }
  for (const source of sources) {
    const entry = Object.values(bundle).find(item => item.type === 'chunk'
      && Object.keys(item.modules).some(id => id.endsWith(source)))
    if (entry?.type === 'chunk') visit(entry.fileName)
  }
  return [...files]
}

// Discover these routes' modules during HTML parsing, rather than after the shell
// has downloaded and executed. This happens inside the measured navigation;
// preload only fetches/compiles modules. Existing route hydration still gates
// evaluation and operative DOM; no module is fetched on other routes.
function preloadProductionTimelinessRoute(): Plugin {
  return {
    name: 'preload-production-timeliness-route',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const bundle = context.bundle
        if (!bundle) return
        const files = routeStaticChunks(bundle, ['/src/pages/production-fulfillment/index.ts'])
        const sewingFiles = routeStaticChunks(bundle, [
          '/src/pages/pda-exec-detail.ts', '/src/main-handlers/pda-handlers.ts',
          '/src/components/real-qr.ts', '/src/data/pcs-record-runtime.ts', '/src/data/pcs-record-bootstrap.ts',
        ])
        if (!files.length && !sewingFiles.length) return
        return [{ tag: 'script', injectTo: 'head-prepend', children:
          `if(/^\\/dds\\/supply-chain\\/production-fulfillment(?:\\/|$)/.test(location.pathname)){${JSON.stringify(files)}.forEach(function(file){var link=document.createElement('link');link.rel='modulepreload';link.href='/'+file;document.head.appendChild(link)})}else if(/^\\/fcs\\/pda\\/exec\\/(?:TASK-SEW-|TASKGEN-)[^/]+$/.test(location.pathname)){${JSON.stringify(sewingFiles)}.forEach(function(file){var link=document.createElement('link');link.rel='modulepreload';link.href='/'+file;document.head.appendChild(link)})}` }]
      },
    },
  }
}

// PCS archive pages have a published, read-only baseline. Discover their exact
// route module and baseline during navigation instead of waiting for the shell
// and route registry to finish first. This performs no storage reads or writes.
function preloadPcsArchiveRoute(): Plugin {
  return {
    name: 'preload-pcs-archive-route',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const bundle = context.bundle
        if (!bundle) return
        const routes = [
          ['/pcs/products/channel-products', '/src/pages/pcs-channel-products.ts'],
          ['/pcs/products/styles', '/src/pages/pcs-product-archives.ts'],
          ['/pcs/products/specifications', '/src/pages/pcs-product-archives.ts'],
          ['/pcs/materials/', '/src/pages/pcs-material-archives.ts'],
          ['/pcs/channels/stores', '/src/pages/pcs-channel-stores.ts'],
          ['/pcs/settings/config-workspace', '/src/pages/pcs-config-workspace.ts'],
        ]
        const filesFor = (source: string): string[] => {
          const entry = Object.values(bundle).find(item => item.type === 'chunk' && Object.keys(item.modules).some(id => id.endsWith(source)))
          if (!entry || entry.type !== 'chunk') return []
          const files = new Set<string>()
          const visit = (file: string): void => {
            if (files.has(file)) return
            const chunk = bundle[file]
            if (!chunk || chunk.type !== 'chunk') return
            files.add(file); chunk.imports.forEach(visit)
          }
          visit(entry.fileName)
          return [...files]
        }
        const baseline = filesFor('/src/data/pcs-record-bootstrap.ts')
        const mapping = routes.map(([path, source]) => [path, [...new Set([...filesFor(source), ...baseline])]])
        const baselineData = Object.values(bundle).find(item => item.type === 'asset' && /pcs-record-baseline-.*\.json$/.test(item.fileName))?.fileName
        return [{ tag: 'script', injectTo: 'head-prepend', children:
          `for(var route of ${JSON.stringify(mapping)}){if(location.pathname.startsWith(route[0])){route[1].forEach(function(file){var link=document.createElement('link');link.rel='modulepreload';link.href='/'+file;document.head.appendChild(link)});var data=${JSON.stringify(baselineData || '')};if(data){var link=document.createElement('link');link.rel='preload';link.as='fetch';link.crossOrigin='anonymous';link.href='/'+data;document.head.appendChild(link)}break}}` }]
      },
    },
  }
}

function preloadStaticFirstScreenRoutes(): Plugin {
  return {
    name: 'preload-static-first-screen-routes',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        if (!context.bundle) return
        // These are actual read-initialization dependencies, otherwise discovered
        // only after production/part-ticket restoration has finished. Fetch them
        // during navigation; the existing initializer still evaluates/restores in order.
        const returnReadInitialization = [
          '/src/data/pms/idb-storage.ts',
          '/src/data/fcs/cutting/part-ticket-records.ts',
          '/src/data/fcs/cutting/cutting-event-repository.ts',
          '/src/data/fcs/cutting/generated-cut-release.ts',
        ]
        // These entry points are dynamically discovered by the existing PCS/FCS
        // restoration sequence. Preload their static closure without evaluating
        // them: hydration, permissions and rendering keep their original order.
        const craftReadInitialization = [
          '/src/data/pms/idb-storage.ts',
          '/src/data/pcs-record-runtime.ts',
          '/src/data/pcs-record-bootstrap.ts',
          '/src/data/fcs/design-revision-pcs-storage.ts',
          '/src/data/fcs/wool-domain/store.ts',
          '/src/data/fcs/production-context-records.ts',
          '/src/data/fcs/cutting/part-ticket-records.ts',
        ]
        const craftRouteRegistry = ['/src/router/route-renderers-fcs.ts']
        const craftOperation = '(?:aux-op-(?:embroidery|strip|pleating|dalan|heat-transfer|direct-print|seam-embroidery|button-loop|covered-button-making|flower-making|gathering|hotfix-rhinestone)|spc-op-(?:template-process|laser-pocket|pattern-machine-sewing|elastic-fixed-length-cutting))'
        const craftPath = '^/fcs/process-factory/special-craft/' + craftOperation + '/work-orders'
        const craftImages = [
          '/thumbnails/materials/pcs-reviewed/hood-grey.webp', '/thumbnails/materials/pcs-reviewed/polo-white.webp',
          '/thumbnails/materials/pcs-reviewed/tee-navy.webp', '/thumbnails/materials/pcs-reviewed/shorts-navy.webp',
          '/thumbnails/materials/pcs-reviewed/dress-red-print.webp', '/thumbnails/materials/pcs-reviewed/jogger-black.webp',
          '/thumbnails/cardigan-sample.webp', '/thumbnails/production-confirmation-demo/grey-zip-hoodie.webp',
        ]
        // Lists need their actual first-screen images, not all other crafts' images.
        // These are fetch hints only; the page keeps all image elements and sources.
        const craftListImages = {
          'aux-op-dalan': ['/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'aux-op-strip': ['/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'aux-op-heat-transfer': ['/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'aux-op-direct-print': ['/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'aux-op-covered-button-making': ['/thumbnails/materials/accessory-elastic-band.webp', '/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'aux-op-embroidery': ['/thumbnails/materials/pcs-reviewed/dress-red-print.webp'],
          'aux-op-pleating': ['/thumbnails/materials/pcs-reviewed/jogger-black.webp'],
          'aux-op-seam-embroidery': ['/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'aux-op-button-loop': ['/thumbnails/materials/pcs-reviewed/polo-white.webp'],
          'aux-op-flower-making': ['/thumbnails/materials/pcs-reviewed/jogger-black.webp'],
          'aux-op-gathering': ['/thumbnails/materials/pcs-reviewed/tee-red.webp'],
          'aux-op-hotfix-rhinestone': ['/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'spc-op-template-process': ['/thumbnails/materials/pcs-reviewed/shorts-navy.webp'],
          'spc-op-laser-pocket': ['/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'spc-op-pattern-machine-sewing': ['/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
          'spc-op-elastic-fixed-length-cutting': ['/thumbnails/materials/accessory-elastic-band.webp', '/thumbnails/materials/pcs-reviewed/hood-grey.webp'],
        }
        const woolImages = ['/thumbnails/cardigan-sample.webp']
        const priorityOwners = [
          ['/src/data/pms/idb-storage.ts', 3],
          ['/src/data/fcs/factory-internal-warehouse.ts', 2],
          ['/src/data/fcs/runtime-process-tasks.ts', 2],
          ['/src/data/fcs/cutting/transfer-bag-operations.ts', 2],
          ['/src/data/fcs/cutting/generated-fei-tickets.ts', 2],
        ] as const
        const modulePriorities: Record<string, number> = {}
        for (const [source, rank] of priorityOwners) {
          const owner = routeStaticChunks(context.bundle, [source])[0]
          if (owner) modulePriorities[owner] = Math.max(modulePriorities[owner] || 0, rank)
        }
        const baselineData = Object.values(context.bundle).find(item => item.type === 'asset' && /pcs-record-baseline-.*\.json$/.test(item.fileName))?.fileName || ''
        const entries = [
          ['/fcs/process-factory/special-craft/', routeStaticChunks(context.bundle, [
            '/src/pages/process-factory/special-craft/task-orders.ts', ...craftReadInitialization,
          ]), [], craftPath + '/?$', baselineData, true, craftListImages],
          ['/fcs/process-factory/special-craft/', routeStaticChunks(context.bundle, [
            '/src/pages/process-factory/special-craft/work-order-detail.ts', ...craftReadInitialization, ...craftRouteRegistry,
          ]), craftImages, craftPath + '/[^/]+/?$', baselineData],
          ['/fcs/craft/wool/', routeStaticChunks(context.bundle, [
            '/src/pages/process-factory/wool/stage-orders.ts', ...craftReadInitialization,
          ]), woolImages, '^/fcs/craft/wool/(?:knitting-orders|linking-orders)/?$', baselineData],
          ['/fcs/craft/wool/', routeStaticChunks(context.bundle, [
            '/src/pages/process-factory/wool/stage-order-detail.ts', ...craftReadInitialization,
          ]), woolImages, '^/fcs/craft/wool/(?:knitting-orders|linking-orders)/[^/]+/?$', baselineData],
          ['/fcs/craft/wool/pending-receipts', routeStaticChunks(context.bundle, [
            '/src/pages/process-factory/wool/pending-receipts.ts', ...craftReadInitialization,
          ]), woolImages, '^/fcs/(?:craft|pda)/wool/pending-receipts/?$', baselineData],
          ['/fcs/sewing-outsourcing/daily-return-report', routeStaticChunks(context.bundle, [
            '/src/pages/sewing-outsourcing/daily-return-report.ts',
            ...returnReadInitialization,
          ]), ['/thumbnails/materials/pcs-reviewed/shirt-black.webp', '/thumbnails/materials/pcs-reviewed/jacket-black.webp', '/thumbnails/materials/pcs-reviewed/tee-black.webp']],
          ['/fcs/sewing-outsourcing/daily-return-summary', routeStaticChunks(context.bundle, [
            '/src/pages/sewing-outsourcing/daily-return-summary.ts',
            ...returnReadInitialization,
          ]), []],
          ['/fcs/sewing-outsourcing/returns', routeStaticChunks(context.bundle, [
            '/src/pages/sewing-outsourcing/returns.ts',
            ...returnReadInitialization,
          ]), []],
          ['/fcs/progress/production-orders', routeStaticChunks(context.bundle, [
            '/src/pages/production-order-progress-tracking.ts',
            ...returnReadInitialization,
          ]), []],
          ['/fcs/contracts/print', routeStaticChunks(context.bundle, [
            '/src/pages/production-contract-print.ts',
            ...returnReadInitialization,
          ]), ['/fcs/contracts/template/production-contract-master-1.webp', '/fcs/contracts/template/production-contract-master-2.webp']],
          ['/fcs/craft/post-finishing/wait-process-warehouse', routeStaticChunks(context.bundle, [
            '/src/pages/process-factory/post-finishing/warehouse.ts',
            ...returnReadInitialization,
          ]), []],
          ['/fcs/pda/post-finishing/return-confirm', routeStaticChunks(context.bundle, [
            '/src/pages/pda-post-finishing-flow.ts',
            '/src/main-handlers/pda-handlers.ts',
            ...returnReadInitialization,
          ]), ['/thumbnails/materials/pcs-reviewed/jacket-black.webp', '/thumbnails/materials/pcs-reviewed/jacket-white.webp',
            '/thumbnails/materials/pcs-reviewed/jacket-blue.webp', '/thumbnails/materials/pcs-reviewed/jacket-khaki.webp', '/thumbnails/materials/pcs-reviewed/jacket-wine.webp']],
          ['/fcs/pda/exec/', routeStaticChunks(context.bundle, [
            '/src/pages/pda-exec-detail.ts',
            ...returnReadInitialization,
          ]), [], true],
          ['/fcs/pda/auth/login', routeStaticChunks(context.bundle, ['/src/pages/pda-login.ts']), []],
          ['/pms/purchase-suggestions', routeStaticChunks(context.bundle, ['/src/pages/pms/purchase-suggestions.ts']), [
            '/thumbnails/tshirt-sample.webp', '/thumbnails/pants-sample.webp',
            '/thumbnails/production-confirmation-demo/grey-zip-hoodie.webp', '/thumbnails/jacket-sample.webp',
          ]],
          ['/pcs/products/styles', [], ['/thumbnails/materials/pcs-reviewed/tee-black.webp', '/thumbnails/materials/pcs-reviewed/shirt-black.webp']],
          ['/pcs/products/specifications', [], ['/thumbnails/materials/pcs-reviewed/tee-black.webp', '/thumbnails/materials/pcs-reviewed/shirt-black.webp']],
        ]
        return [{ tag: 'script', injectTo: 'head-prepend', children:
          `var modulePriorities=${JSON.stringify(modulePriorities)};for(var entry of ${JSON.stringify(entries)}){var genericExec=entry[3]===true&&new RegExp('^/fcs/pda/exec/[^/]+$').test(location.pathname)&&!location.pathname.startsWith('/fcs/pda/exec/PF-POST-')&&!/(?:[:]|%3A)(?:KNITTING|LINKING)$/i.test(location.pathname);var craftRead=typeof entry[3]==='string'&&new RegExp(entry[3]).test(location.pathname);if((entry[3]===undefined&&location.pathname===entry[0])||genericExec||craftRead){var preloadData=function(){if(entry[4]){var link=document.createElement('link');link.rel='preload';link.as='fetch';link.crossOrigin='anonymous';if(entry[5])link.fetchPriority='high';link.href='/'+entry[4];document.head.appendChild(link)}};if(entry[5])preloadData();var returnRead=entry[0].startsWith('/fcs/')&&entry[0]!=='/fcs/pda/auth/login';var modules=returnRead?entry[1].slice().sort(function(a,b){var rank=function(file){return modulePriorities[file]||(file.includes('/idb-storage-')?3:/(?:factory-internal-warehouse|runtime-process-tasks|transfer-bag-operations|generated-fei-tickets)-/.test(file)?2:1)};return rank(b)-rank(a)}):entry[1];modules.forEach(function(file){var link=document.createElement('link');link.rel='modulepreload';if(returnRead&&(modulePriorities[file]||file.includes('/idb-storage-')||/(?:factory-internal-warehouse|runtime-process-tasks|transfer-bag-operations|generated-fei-tickets)-/.test(file)))link.fetchPriority='high';link.href='/'+file;document.head.appendChild(link)});(entry[6]?entry[6][location.pathname.split('/')[4]]||[]:entry[2]).forEach(function(src){var link=document.createElement('link');link.rel='preload';link.as='image';if(returnRead)link.fetchPriority='high';link.href=src;document.head.appendChild(link)});if(!entry[5])preloadData();break}}` }]
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
      const sewingFiles = new Set(routeStaticChunks(bundle, [
        '/src/pages/pda-exec-detail.ts', '/src/main-handlers/pda-handlers.ts',
        '/src/components/real-qr.ts', '/src/data/pcs-record-runtime.ts', '/src/data/pcs-record-bootstrap.ts',
      ]))
      const dailyReadFiles = new Set(routeStaticChunks(bundle, [
        '/src/pages/sewing-outsourcing/daily-return-report.ts',
        '/src/pages/progress-board.ts',
        '/src/data/pms/idb-storage.ts',
        '/src/data/fcs/cutting/part-ticket-records.ts',
        '/src/data/fcs/cutting/cutting-event-repository.ts',
        '/src/data/fcs/cutting/generated-cut-release.ts',
      ]))
      const craftFiles = new Set(routeStaticChunks(bundle, [
        '/src/pages/process-factory/special-craft/task-orders.ts',
        '/src/data/pms/idb-storage.ts', '/src/data/pcs-record-bootstrap.ts',
        '/src/data/fcs/design-revision-pcs-storage.ts', '/src/data/fcs/wool-domain/store.ts',
        '/src/data/fcs/production-context-records.ts', '/src/data/fcs/cutting/part-ticket-records.ts',
      ]))
      for (const item of Object.values(bundle)) {
        const critical = craftFiles.has(item.fileName) || dailyReadFiles.has(item.fileName) || /^(?:pcs-record-baseline-|printing-task-domain-|index-|app-shared-|factory-internal-warehouse-|runtime-process-tasks-|transfer-bag-operations-|generated-fei-tickets-|ppic-|daily-return-|cut-piece-release-)/.test(item.fileName.split('/').at(-1) || '')
        const selected = item.type === 'chunk'
          ? critical || sewingFiles.has(item.fileName) || item.fileName.includes('/production-timeliness-') || item.fileName.includes('/production-source-shared-') || item.fileName.includes('/app-shared-') || item.fileName.includes('/pcs-record-bootstrap-') || item.fileName.includes('/pcs-archive-shared-') || item.isEntry
          : item.fileName.endsWith('.css') || /pcs-record-baseline-.*\.json$/.test(item.fileName)
        if (!selected) continue
        const path = resolve(options.dir, item.fileName)
        const source = readFileSync(path)
        writeFileSync(`${path}.br`, brotliCompressSync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: critical ? 11 : 5 } }))
        writeFileSync(`${path}.gz`, gzipSync(source))
      }
    },
    configurePreviewServer(server) {
      const directory = resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url || '').split('?')[0]
        if (!['GET', 'HEAD'].includes(request.method || '') || !/^\/assets\/[\w.-]+\.(js|css|json)$/.test(pathname)) return next()
        const encoding = /\bbr\b/.test(request.headers['accept-encoding'] || '') ? 'br' : /\bgzip\b/.test(request.headers['accept-encoding'] || '') ? 'gz' : ''
        if (!encoding) return next()
        const path = resolve(directory, `.${pathname}.${encoding}`)
        if (!existsSync(path)) return next()
        response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.json') ? 'application/json' : 'text/javascript')
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
  plugins: [ensureStaticPlaceholderPlugin(), preloadProductionTimelinessRoute(), preloadPcsArchiveRoute(), preloadStaticFirstScreenRoutes(), compressedPreviewAssets()],
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/output/**', '**/test-results/**', '**/docs/**'],
    },
  },
  build: {
    chunkSizeWarningLimit: 550,
    modulePreload: {
      resolveDependencies(filename, dependencies, context) {
        // The FCS route registry and TMF demo seed only need production source
        // data after a concrete production page/action has been selected. Keep
        // the 700KB gzip production-source chunk out of the route-registry and
        // five TMF first-screen preloads; its owning import still loads it on use.
        if (
          filename.includes('routes-fcs')
          || filename.includes('tmf-base-demo')
          || context.hostId.includes('tmf-material-purchases')
        ) {
          return dependencies.filter(file => !file.includes('/production-source-shared-'))
        }
        return dependencies
      },
    },
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id, { getModuleInfo, getModuleIds }) {
          const craftChunk = craftStartupChunkName(id)
          if (craftChunk) return craftChunk
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
          const pcsArchiveModules = new Set<string>()
          for (const page of ['pcs-product-archives', 'pcs-material-archives', 'pcs-channel-products', 'pcs-channel-stores', 'pcs-config-workspace']) {
            for (const moduleId of collectStaticModules(ids.find(value => value.endsWith(`/src/pages/${page}.ts`)))) pcsArchiveModules.add(moduleId)
          }
          // Other lazy routes use these shared controls too. They must not import
          // the complete DDS feature just to render a button or a standard list.
          const sharedUiModules = new Set<string>()
          for (const file of ['list-page', 'list-table', 'pagination', 'list-table-model', 'button']) {
            for (const moduleId of collectStaticModules(ids.find(value => value.endsWith(`/src/components/ui/${file}.ts`)))) {
              sharedUiModules.add(moduleId)
            }
          }
          // TMF cold routes use only these small product/domain contracts. They are also
          // referenced by DDS, but must not inherit the complete 700KB gzip production
          // source chunk merely to validate a webbing route or read a factory identity.
          const tmfDomainModules = [
            '/src/data/fcs/webbing-production-demands.ts',
            '/src/data/fcs/webbing-specifications.ts',
            '/src/data/tech-pack-process-route.ts',
            '/src/data/fcs/central-craft-factories.ts',
            '/src/data/fcs/tmf-product-policy.ts',
            '/src/data/fcs/tmf-source-readers.ts',
            '/src/data/process-craft-dict.ts',
            '/src/data/pcs-tmf-material-reference-seeds.ts',
          ]
          if (tmfDomainModules.some(modulePath => id.includes(modulePath))) return 'tmf-domain-shared'
          if (ddsModules.has(id) && !id.endsWith('.css')) {
            // Shared shell dependencies must never pull the DDS page into other routes.
            if (shellModules.has(id) || sharedUiModules.has(id)) return 'app-shared'
            // PCS reads master records, not the unrelated production execution
            // domains that DDS happens to share. Keep the actual static closure
            // together without making archive entry parse those execution pages.
            if (pcsArchiveModules.has(id)) return 'pcs-archive-shared'
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
