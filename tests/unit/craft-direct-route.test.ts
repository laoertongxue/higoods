import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { isIsolatedCraftReadEntry } from '../../src/main-infrastructure/craft-read-entry.ts'
import { listEnabledSpecialCraftOperationDefinitions, buildSpecialCraftTaskOrdersPath, buildSpecialCraftOperationSlug } from '../../src/data/fcs/special-craft-operations.ts'

function resolver(importFailure?: Error) {
  const source = readFileSync(new URL('../../src/router/routes.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('routes.ts', source, ts.ScriptTarget.Latest, true)
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'resolvePage')!
  const code = ts.transpileModule(fn.getText(ast).replace('export ', '').replaceAll('import(', 'loadModule('), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const calls: unknown[] = []
  const ownerImports: string[] = []
  const dependencies = {
    isIsolatedCraftReadEntry, normalizePathname: (path: string) => path.split(/[?#]/)[0], exactBaseRoutes: {},
    loadModule: async (path: string) => {
      if (path.includes('source-document-detail')) return { resolveTimingSourceDetail: () => null }
      ownerImports.push(path)
      assert.ok(['./route-renderers-fcs', '../pages/process-factory/special-craft/task-orders'].includes(path), path)
      if (importFailure) throw importFailure
      return { renderSpecialCraftTaskOrdersPage: (slug: string) => { calls.push(['list', slug]);return 'existing-list' }, renderSpecialCraftWorkOrderDetailPage: (slug: string, id: string) => { calls.push(['detail', slug, id]);return 'existing-detail' } }
    },
    getRoutesByPathname: async () => { calls.push('original-registry');return {} },
    resolveFromRegistry: async () => 'registry-result',
  }
  const execute = new Function('dependencies', 'pathname', `with(dependencies){${code};return resolvePage(pathname)}`)
  return { calls, ownerImports, run: (path: string) => execute(dependencies, path) }
}

test('all 16 canonical craft list/detail routes reuse their original renderer without the broad registry', async () => {
  const session = resolver()
  for (const operation of listEnabledSpecialCraftOperationDefinitions()) {
    const base = buildSpecialCraftTaskOrdersPath(operation), slug = buildSpecialCraftOperationSlug(operation)
    assert.equal(await session.run(base + '?factoryId=wrong'), 'existing-list')
    assert.deepEqual(session.calls.pop(), ['list', slug])
    assert.deepEqual(session.ownerImports.splice(0), ['../pages/process-factory/special-craft/task-orders'], 'LIST must load its existing owner directly')
    assert.equal(await session.run(base + '/ORDER%2F001'), 'existing-detail')
    assert.deepEqual(session.calls.pop(), ['detail', slug, 'ORDER/001'])
    assert.deepEqual(session.ownerImports.splice(0), ['./route-renderers-fcs'], 'DETAIL retains the original wrapper')
  }
  assert.deepEqual(session.calls, [])
})

test('unknown craft and adjacent routes preserve the original registry behavior', async () => {
  for (const path of ['/fcs/process-factory/special-craft/unknown/work-orders', '/fcs/process-factory/special-craft/aux-op-dalan/work-orders/X/nested', '/fcs/process-factory/special-craft/auxiliary/wait-process-warehouse', '/fcs/craft/wool/machines']) {
    const session = resolver()
    assert.equal(await session.run(path), 'registry-result')
    assert.deepEqual(session.calls, ['original-registry'])
  }
})

test('list owner import failure propagates to the existing main error boundary', async () => {
  const failure = new Error('actual page import failed')
  const session = resolver(failure)
  await assert.rejects(session.run('/fcs/process-factory/special-craft/aux-op-heat-transfer/work-orders'), error => error === failure)
  assert.deepEqual(session.ownerImports, ['../pages/process-factory/special-craft/task-orders'])
  assert.deepEqual(session.calls, [])
})
