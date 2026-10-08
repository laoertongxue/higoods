import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function fixtureBundle() {
  return {
    'assets/production-timeliness-test.js': { type: 'chunk', fileName: 'assets/production-timeliness-test.js', modules: { '/workspace/src/pages/production-fulfillment/index.ts': {} }, imports: ['assets/shared-test.js'], dynamicImports: [] },
    'assets/pda-exec-detail-test.js': { type: 'chunk', fileName: 'assets/pda-exec-detail-test.js', modules: { '/workspace/src/pages/pda-exec-detail.ts': {} }, imports: ['assets/shared-test.js', 'assets/detail-data-test.js'], dynamicImports: ['assets/unrelated-lazy-test.js'] },
    'assets/pda-handlers-test.js': { type: 'chunk', fileName: 'assets/pda-handlers-test.js', modules: { '/workspace/src/main-handlers/pda-handlers.ts': {} }, imports: ['assets/shared-test.js', 'assets/handler-data-test.js'], dynamicImports: ['assets/unrelated-lazy-test.js'] },
    'assets/real-qr-test.js': { type: 'chunk', fileName: 'assets/real-qr-test.js', modules: { '/workspace/src/components/real-qr.ts': {} }, imports: [], dynamicImports: [] },
    'assets/pcs-record-runtime-test.js': { type: 'chunk', fileName: 'assets/pcs-record-runtime-test.js', modules: { '/workspace/src/data/pcs-record-runtime.ts': {} }, imports: [], dynamicImports: ['assets/pcs-record-bootstrap-test.js'] },
    'assets/pcs-record-bootstrap-test.js': { type: 'chunk', fileName: 'assets/pcs-record-bootstrap-test.js', modules: { '/workspace/src/data/pcs-record-bootstrap.ts': {} }, imports: [], dynamicImports: [] },
    'assets/shared-test.js': { type: 'chunk', fileName: 'assets/shared-test.js', modules: {}, imports: ['assets/pda-handlers-test.js'], dynamicImports: [] },
    'assets/detail-data-test.js': { type: 'chunk', fileName: 'assets/detail-data-test.js', modules: {}, imports: [], dynamicImports: [] },
    'assets/handler-data-test.js': { type: 'chunk', fileName: 'assets/handler-data-test.js', modules: {}, imports: [], dynamicImports: [] },
    'assets/unrelated-lazy-test.js': { type: 'chunk', fileName: 'assets/unrelated-lazy-test.js', modules: {}, imports: [], dynamicImports: [] },
  }
}

function actualPlugins(dependencies: Record<string, unknown> = {}) {
  const source = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('vite.config.ts', source, ts.ScriptTarget.Latest, true)
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node)
    && ['routeStaticChunks', 'preloadProductionTimelinessRoute', 'compressedPreviewAssets'].includes(node.name?.text || ''))
  const javascript = ts.transpileModule(declarations.map(node => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return new Function('dependencies', `with (dependencies) { ${javascript}; return { preload: preloadProductionTimelinessRoute(), compression: compressedPreviewAssets() }; }`)(dependencies)
}

function navigationLinks(script: string, pathname: string) {
  const links: Array<{ rel?: string; href?: string }> = []
  new Function('location', 'document', script)(
    { pathname },
    { createElement: (tag: string) => { assert.equal(tag, 'link', 'preload must not execute a script/module'); return {} }, head: { appendChild: (link: { rel?: string; href?: string }) => { links.push(link) } } },
  )
  for (const link of links) assert.equal(link.rel, 'modulepreload')
  return links.map(link => link.href)
}

test('same-navigation sewing preload discovers actual bundle entries and static closure without evaluating modules', () => {
  const bundle = fixtureBundle()
  const plugin = actualPlugins().preload
  const output = plugin.transformIndexHtml.handler('', { bundle })
  assert.equal(output.length, 1)
  const script = output[0].children
  const sewingFiles = [
    '/assets/pda-exec-detail-test.js', '/assets/pda-handlers-test.js', '/assets/shared-test.js',
    '/assets/detail-data-test.js', '/assets/handler-data-test.js',
    '/assets/real-qr-test.js', '/assets/pcs-record-runtime-test.js', '/assets/pcs-record-bootstrap-test.js',
  ].sort()
  for (const path of ['/fcs/pda/exec/TASK-SEW-000513-F090-3', '/fcs/pda/exec/TASK-SEW-another', '/fcs/pda/exec/TASKGEN-202603-0007-002__ORDER', '/fcs/pda/exec/TASKGEN-202603-0015-002__ORDER']) {
    assert.deepEqual(navigationLinks(script, path).sort(), sewingFiles, path)
  }
  for (const path of ['/fcs/pda/exec', '/fcs/pda/exec/TASK-PRINT-000714', '/fcs/pda/exec/TASK-SEW-000513-F090-3/nested', '/pcs/products/styles', '/pms/product-purchase-orders']) {
    assert.deepEqual(navigationLinks(script, path), [], path)
  }
  assert.deepEqual(navigationLinks(script, '/dds/supply-chain/production-fulfillment/production-orders').sort(), [
    '/assets/production-timeliness-test.js', '/assets/shared-test.js', '/assets/pda-handlers-test.js', '/assets/handler-data-test.js',
  ].sort(), 'DDS retains its original static closure')
  assert.equal(script.includes('import('), false)
  assert.equal(script.includes('unrelated-lazy-test'), false)
  delete (bundle as Partial<typeof bundle>)['assets/production-timeliness-test.js']
  assert.deepEqual(navigationLinks(plugin.transformIndexHtml.handler('', { bundle })[0].children, '/fcs/pda/exec/TASK-SEW-000513-F090-3').sort(), sewingFiles, 'PDA matching cannot depend on the DDS chunk being present')
})

test('preview compression includes the same sewing static chunks and retains existing assets without broad lazy-route output', () => {
  const written: string[] = []
  const plugin = actualPlugins({
    resolve: (...parts: string[]) => parts.join('/'),
    readFileSync: () => Buffer.from('same published module bytes'),
    writeFileSync: (path: string, bytes: Buffer) => { assert.ok(bytes.length > 0); written.push(path) },
    brotliCompressSync: (source: Buffer) => source,
    gzipSync: (source: Buffer) => source,
    constants: { BROTLI_PARAM_QUALITY: 1 },
  }).compression
  const bundle = {
    ...fixtureBundle(),
    'assets/index-test.js': { type: 'chunk', fileName: 'assets/index-test.js', modules: {}, imports: [], isEntry: true },
    'assets/page-test.css': { type: 'asset', fileName: 'assets/page-test.css' },
  }
  plugin.writeBundle({ dir: 'dist' }, bundle)
  for (const file of ['pda-exec-detail-test.js', 'pda-handlers-test.js', 'shared-test.js', 'detail-data-test.js', 'handler-data-test.js', 'real-qr-test.js', 'pcs-record-runtime-test.js', 'pcs-record-bootstrap-test.js', 'production-timeliness-test.js', 'index-test.js', 'page-test.css']) {
    assert.ok(written.includes(`dist/assets/${file}.br`), file)
    assert.ok(written.includes(`dist/assets/${file}.gz`), file)
  }
  assert.equal(written.some(path => path.includes('unrelated-lazy-test')), false)
})
