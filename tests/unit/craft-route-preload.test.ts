import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { buildSpecialCraftTaskOrdersPath, listEnabledSpecialCraftOperationDefinitions } from '../../src/data/fcs/special-craft-operations.ts'

const initialization = [
  '/src/data/pms/idb-storage.ts',
  '/src/data/pcs-record-runtime.ts',
  '/src/data/pcs-record-bootstrap.ts',
  '/src/data/fcs/design-revision-pcs-storage.ts',
  '/src/data/fcs/wool-domain/store.ts',
  '/src/data/fcs/production-context-records.ts',
  '/src/data/fcs/cutting/part-ticket-records.ts',
]
const registry = ['/src/router/route-renderers-fcs.ts']
const pages = {
  craftList: '/src/pages/process-factory/special-craft/task-orders.ts',
  craftDetail: '/src/pages/process-factory/special-craft/work-order-detail.ts',
  woolList: '/src/pages/process-factory/wool/stage-orders.ts',
  woolDetail: '/src/pages/process-factory/wool/stage-order-detail.ts',
  woolReceiving: '/src/pages/process-factory/wool/pending-receipts.ts',
}
const originalRoutes = [
  ['/fcs/sewing-outsourcing/daily-return-report', '/src/pages/sewing-outsourcing/daily-return-report.ts'],
  ['/fcs/sewing-outsourcing/daily-return-summary', '/src/pages/sewing-outsourcing/daily-return-summary.ts'],
  ['/fcs/sewing-outsourcing/returns', '/src/pages/sewing-outsourcing/returns.ts'],
  ['/fcs/progress/production-orders', '/src/pages/production-order-progress-tracking.ts'],
  ['/fcs/contracts/print', '/src/pages/production-contract-print.ts'],
  ['/fcs/craft/post-finishing/wait-process-warehouse', '/src/pages/process-factory/post-finishing/warehouse.ts'],
  ['/fcs/pda/post-finishing/return-confirm', '/src/pages/pda-post-finishing-flow.ts'],
  ['/fcs/pda/exec/TASK-PRINT-001', '/src/pages/pda-exec-detail.ts'],
  ['/fcs/pda/auth/login', '/src/pages/pda-login.ts'],
  ['/pms/purchase-suggestions', '/src/pages/pms/purchase-suggestions.ts'],
]
const sources = [...new Set([...initialization, ...registry, ...Object.values(pages), ...originalRoutes.map(([, source]) => source),
  '/src/data/pms/idb-storage.ts', '/src/data/fcs/cutting/cutting-event-repository.ts',
  '/src/data/fcs/cutting/generated-cut-release.ts', '/src/main-handlers/pda-handlers.ts'])]
const fileFor = (source: string) => `assets/fixture-${sources.indexOf(source)}.js`

function fixtureBundle() {
  const bundle: Record<string, unknown> = Object.fromEntries(sources.map(source => [fileFor(source), {
    type: 'chunk', fileName: fileFor(source), modules: { [`/workspace${source}`]: {} },
    imports: ['assets/shared.js'], dynamicImports: ['assets/unrelated-lazy.js'],
  }]))
  bundle['assets/shared.js'] = { type: 'chunk', fileName: 'assets/shared.js', modules: {}, imports: ['assets/cycle.js'], dynamicImports: [] }
  bundle['assets/cycle.js'] = { type: 'chunk', fileName: 'assets/cycle.js', modules: {}, imports: ['assets/shared.js'], dynamicImports: [] }
  bundle['assets/unrelated-lazy.js'] = { type: 'chunk', fileName: 'assets/unrelated-lazy.js', modules: {}, imports: [], dynamicImports: [] }
  bundle['assets/pcs-record-baseline-fixture.json'] = { type: 'asset', fileName: 'assets/pcs-record-baseline-fixture.json', source: '{}' }
  return bundle
}

function preloadScript(bundle = fixtureBundle()): string {
  const source = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('vite.config.ts', source, ts.ScriptTarget.Latest, true)
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    && ['routeStaticChunks', 'preloadStaticFirstScreenRoutes'].includes(node.name?.text || ''))
  const javascript = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const plugin = new Function(`${javascript}; return preloadStaticFirstScreenRoutes()` )()
  return plugin.transformIndexHtml.handler('', { bundle }).map((entry: { children: string }) => entry.children).join('\n')
}

type Link = { rel?: string; href?: string; as?: string; crossOrigin?: string; fetchPriority?: string }
function navigationLinks(pathname: string, script = preloadScript()): Link[] {
  const links: Link[] = []
  const context: Record<string, unknown> = {
    location: { pathname },
    document: {
      createElement: (tag: string) => { assert.equal(tag, 'link', 'navigation may only create fetch/compile links'); return {} },
      head: { appendChild: (link: Link) => links.push(link) },
    },
  }
  for (const name of ['localStorage', 'sessionStorage', 'indexedDB', 'caches', 'fetch']) {
    Object.defineProperty(context, name, { get: () => { throw new Error(`preload must not access ${name}`) } })
  }
  runInNewContext(script, context, { timeout: 1000, importModuleDynamically: () => { throw new Error('preload must not evaluate modules') } })
  return links
}

function expectedModules(page: string, includeRegistry = false): string[] {
  return [...initialization, ...(includeRegistry ? registry : []), page].map(source => `/${fileFor(source)}`)
    .concat('/assets/shared.js', '/assets/cycle.js').sort()
}

test('all 16 canonical craft list/detail routes discover their own page and restoration static closure', () => {
  const operations = listEnabledSpecialCraftOperationDefinitions()
  assert.equal(operations.length, 16, 'the bounded route allowlist must track all enabled operations')
  for (const operation of operations) {
    const path = buildSpecialCraftTaskOrdersPath(operation)
    for (const [suffix, page] of [['', pages.craftList], ['/ORDER%2F001', pages.craftDetail]]) {
      for (const trailing of ['', '/']) {
        const links = navigationLinks(`${path}${suffix}${trailing}`)
        assert.deepEqual(links.filter(link => link.rel === 'modulepreload').map(link => link.href).sort(), expectedModules(page, Boolean(suffix)), path + suffix + trailing)
        assert.deepEqual(links.filter(link => link.as === 'fetch'), [{ rel: 'preload', as: 'fetch', crossOrigin: 'anonymous', ...(!suffix ? { fetchPriority: 'high' } : {}), href: '/assets/pcs-record-baseline-fixture.json' }])
      }
    }
  }
})

test('wool knitting/linking list/detail and both pending-receipt entrances preload only their selected page closure', () => {
  for (const stage of ['knitting-orders', 'linking-orders']) {
    for (const [suffix, page] of [['', pages.woolList], ['/WOOL-001', pages.woolDetail]]) {
      const links = navigationLinks(`/fcs/craft/wool/${stage}${suffix}`)
      assert.deepEqual(links.filter(link => link.rel === 'modulepreload').map(link => link.href).sort(), expectedModules(page))
      assert.equal(links.filter(link => link.as === 'fetch').length, 1)
    }
  }
  for (const path of ['/fcs/craft/wool/pending-receipts', '/fcs/pda/wool/pending-receipts']) {
    assert.deepEqual(navigationLinks(path).filter(link => link.rel === 'modulepreload').map(link => link.href).sort(), expectedModules(pages.woolReceiving))
  }
})

test('unknown, nested, print and adjacent routes do not acquire craft/wool preloads', () => {
  for (const path of [
    '/fcs/process-factory/special-craft/unknown/work-orders',
    '/fcs/process-factory/special-craft/aux-op-dalan/work-orders/ORDER/nested',
    '/fcs/process-factory/special-craft/aux-op-dalan',
    '/fcs/craft/wool/knitting-orders/ORDER/handover-print',
    '/fcs/craft/wool/linking-orders/ORDER/nested', '/fcs/craft/wool/pending-receipts/ORDER',
    '/fcs/craft/wool/machines', '/fcs/craft/wool/wait-process-warehouse',
    '/fcs/pda/exec/WOOL:KNITTING', '/fcs/pda/exec/WOOL%3ALINKING',
    '/fcs/pda/exec/PF-POST-001', '/fcs/craft/dyeing/work-orders', '/unrelated',
  ]) assert.deepEqual(navigationLinks(path), [], path)
})

test('craft images are bounded existing thumbnails plus tee-navy and preloading cannot evaluate or touch storage', () => {
  const script = preloadScript()
  const images = navigationLinks('/fcs/process-factory/special-craft/aux-op-dalan/work-orders', script)
    .filter(link => link.as === 'image').map(link => link.href)
  assert.deepEqual(images.slice().sort(), [
    '/thumbnails/materials/pcs-reviewed/hood-grey.webp', '/thumbnails/materials/pcs-reviewed/polo-white.webp',
    '/thumbnails/materials/pcs-reviewed/tee-navy.webp', '/thumbnails/materials/pcs-reviewed/shorts-navy.webp',
    '/thumbnails/materials/pcs-reviewed/dress-red-print.webp', '/thumbnails/materials/pcs-reviewed/jogger-black.webp',
    '/thumbnails/cardigan-sample.webp', '/thumbnails/production-confirmation-demo/grey-zip-hoodie.webp',
  ].sort())
  for (const image of images) assert.ok(existsSync(new URL(`../../public${image}`, import.meta.url)), image)
  assert.equal(script.includes('import('), false)
  assert.equal(script.includes('unrelated-lazy.js'), false, 'only static dependency closure is preloaded')
  assert.equal(new Set(navigationLinks('/fcs/process-factory/special-craft/aux-op-dalan/work-orders').map(link => link.href)).size,
    navigationLinks('/fcs/process-factory/special-craft/aux-op-dalan/work-orders').length, 'static cycles cannot duplicate fetches')
})

test('baseline absence emits no invalid fetch and unrelated existing route rules are preserved', () => {
  const bundle = fixtureBundle()
  delete bundle['assets/pcs-record-baseline-fixture.json']
  assert.equal(navigationLinks('/fcs/craft/wool/knitting-orders', preloadScript(bundle)).some(link => link.as === 'fetch'), false)
  for (const [path, source] of originalRoutes) {
    const links = navigationLinks(path)
    assert.ok(links.some(link => link.href === `/${fileFor(source)}`), path)
    assert.equal(links.some(link => link.as === 'fetch'), false, path)
    assert.equal(links.some(link => link.href === `/${fileFor(pages.craftList)}`), false, path)
  }
  for (const path of ['/pcs/products/styles', '/pcs/products/specifications']) {
    assert.deepEqual(navigationLinks(path).map(link => link.href), [
      '/thumbnails/materials/pcs-reviewed/tee-black.webp', '/thumbnails/materials/pcs-reviewed/shirt-black.webp',
    ])
  }
})

test('removing a list-only registry seed still follows a real owner static dependency', () => {
  const bundle = fixtureBundle()
  const owner = bundle[fileFor(pages.craftList)] as { imports: string[] }
  owner.imports.push(fileFor(registry[0]))
  const links = navigationLinks('/fcs/process-factory/special-craft/aux-op-heat-transfer/work-orders', preloadScript(bundle))
  assert.deepEqual(links.filter(link => link.rel === 'modulepreload').map(link => link.href).sort(), expectedModules(pages.craftList, true))
})

test('required craft list baseline is discovered first at high priority, with other entrances retaining their link order', () => {
  for (const operation of listEnabledSpecialCraftOperationDefinitions()) {
    const path = buildSpecialCraftTaskOrdersPath(operation)
    for (const trailing of ['', '/']) {
      const links = navigationLinks(path + trailing)
      assert.deepEqual(links[0], { rel: 'preload', as: 'fetch', crossOrigin: 'anonymous', fetchPriority: 'high', href: '/assets/pcs-record-baseline-fixture.json' }, path + trailing)
      assert.equal(links.filter(link => link.as === 'fetch').length, 1, 'baseline must not be duplicated')
    }
    const detail = navigationLinks(path + '/ORDER%2F001')
    assert.equal(detail[0].rel, 'modulepreload')
    assert.deepEqual(detail.at(-1), { rel: 'preload', as: 'fetch', crossOrigin: 'anonymous', href: '/assets/pcs-record-baseline-fixture.json' })
  }
  for (const path of ['/fcs/craft/wool/knitting-orders', '/fcs/craft/wool/linking-orders/WOOL-001', '/fcs/craft/wool/pending-receipts', '/fcs/pda/wool/pending-receipts']) {
    const links = navigationLinks(path)
    assert.equal(links[0].rel, 'modulepreload', path)
    assert.deepEqual(links.at(-1), { rel: 'preload', as: 'fetch', crossOrigin: 'anonymous', href: '/assets/pcs-record-baseline-fixture.json' }, path)
  }
  const bundle = fixtureBundle()
  delete bundle['assets/pcs-record-baseline-fixture.json']
  const links = navigationLinks('/fcs/process-factory/special-craft/aux-op-dalan/work-orders', preloadScript(bundle))
  assert.equal(links.some(link => link.as === 'fetch'), false)
  assert.deepEqual(links.filter(link => link.rel === 'modulepreload').map(link => link.href).sort(), expectedModules(pages.craftList))
})
