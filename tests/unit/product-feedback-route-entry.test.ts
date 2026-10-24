import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function entryHarness(options: { ownReadFails?: boolean } = {}) {
  const source = readFileSync('src/main.ts', 'utf8')
  const file = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true)
  const fn = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'renderCurrentPageContent')
  assert.ok(fn)
  const code = ts.transpileModule(fn.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('import(', 'importForTest(')
  const calls: string[] = []
  const dependencies = {
    authorizedCostCleanupError: null,
    previousRenderedPagePathname: '',
    normalizePathname: (path: string) => path.split(/[?#]/)[0],
    isQualityInventoryEntry: () => false,
    isIsolatedCraftReadEntry: () => false,
    startPmsInitialization: () => { calls.push('procurement') },
    preparePageRouteEntry: async () => { calls.push('production'); throw Object.assign(new Error('Unrelated production read failed'), { code: 'PRODUCTION_CONTEXT_RECOVERY' }) },
    resolvePage: async (path: string) => { calls.push(`page:${path}`); return options.ownReadFails ? '<div role="alert">评论资料读取失败</div>' : '<h1>商品反馈</h1>' },
    importForTest: async () => ({ renderPcsStorageError: () => '<div role="alert">生产资料读取失败</div>' }),
    URLSearchParams,
    Image: class { src = ''; decode() { return Promise.resolve() } },
  }
  const run = new Function(...Object.keys(dependencies), `${code}; return renderCurrentPageContent`)(...Object.values(dependencies)) as (path: string) => Promise<string>
  return { calls, run }
}

test('feedback routes render their own records when unrelated production reads fail', async () => {
  for (const path of ['/pcs/product-feedback', ...['collection', 'batches', 'comments', 'products', 'analysis', 'issues', 'topics', 'topics/feedback-topic-1', 'topics/experiences', 'topics/experiences/feedback-experience-1'].map(page => `/pcs/product-feedback/${page}?storeId=ST-FB-001#list`)]) {
    const { run, calls } = entryHarness()
    assert.equal(await run(path), '<h1>商品反馈</h1>')
    assert.deepEqual(calls, [`page:${path}`])
  }
})
test('feedback keeps its own read failure visible and does not turn failure into empty data', async () => {
  const { run, calls } = entryHarness({ ownReadFails: true })
  assert.equal(await run('/pcs/product-feedback/comments'), '<div role="alert">评论资料读取失败</div>')
  assert.deepEqual(calls, ['page:/pcs/product-feedback/comments'])
})
test('other PCS routes retain their production preparation and real failure handling', async () => {
  const { run, calls } = entryHarness()
  assert.equal(await run('/pcs/production-preparation/color'), '<div role="alert">生产资料读取失败</div>')
  assert.ok(calls.includes('production'))
  assert.ok(!calls.some(call => call.startsWith('page:')))
})
