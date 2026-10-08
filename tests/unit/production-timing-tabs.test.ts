import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { menusBySystem, systems } from '../../src/data/app-shell-config.ts'

const source = readFileSync(new URL('../../src/state/store.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('store.ts', source, ts.ScriptTarget.Latest, true)
const names = ['flattenMenus', 'normalizePathname', 'getCurrentSystemId', 'findMenuItemByPath', 'pruneProductionTimingTabs']
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text || ''))
assert.equal(functions.length, names.length)
const javascript = ts.transpileModule(functions.map(node => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const actual = new Function('menusBySystem', 'systems', 'isPfosPath', `${javascript}; return { findMenuItemByPath, pruneProductionTimingTabs }`)(menusBySystem, systems, (path: string) => path.startsWith('/pfos/'))
const base = '/dds/supply-chain/production-fulfillment'

test('MIGRATE-001: direct production/pending detail paths have their own active tab identity; discarded tasks/examples/team details are absent', () => {
  for (const [path, title] of [['orders/PO-202610-0086', '生产单 · PO-202610-0086'], ['pending-purchases/DEMAND-240776', '采购待关联 · DEMAND-240776'], ['pending-purchases', '采购待关联']]) {
    const item = actual.findMenuItemByPath(`${base}/${path}`)
    assert.equal(item.title, title)
    assert.equal(item.href, `${base}/${path}`)
  }
  for (const path of ['tasks', 'tasks/DEM-202603-0001', 'examples', 'fulfillment', 'teams/legacy-factory']) assert.equal(actual.findMenuItemByPath(`${base}/${path}`), null, path)
})

test('MIGRATE-001: stored DDS tabs prune discarded addresses, retain unrelated tabs and correct the live production title without touching input', () => {
  const sourceTabs = {
    dds: { systemId: 'dds', activeKey: 'old-demand', tabs: [
      { key: 'old-demand', title: '任务 · DEM', href: `${base}/tasks/DEM`, closable: true },
      { key: 'old-example', title: '旧示例', href: `${base}/examples`, closable: true },
      { key: 'production-fulfillment-orders-PO-202610-0086', title: '旧称', href: `${base}/orders/PO-202610-0086`, closable: true },
      { key: 'dds-other', title: '数据看板', href: '/dds/analytics/dashboard', closable: true },
    ] },
    pcs: { systemId: 'pcs', activeKey: 'pcs-style', tabs: [{ key: 'pcs-style', title: '款式', href: '/pcs/products/styles', closable: true }] },
  }
  const before = structuredClone(sourceTabs)
  const result = actual.pruneProductionTimingTabs(sourceTabs)
  assert.deepEqual(sourceTabs, before)
  assert.equal(result.dds.tabs.length, 2)
  assert.equal(result.dds.tabs[0].title, '生产单 · PO-202610-0086')
  assert.equal(result.dds.activeKey, result.dds.tabs[0].key)
  assert.deepEqual(result.dds.tabs[1], before.dds.tabs[3])
  assert.equal(result.pcs, sourceTabs.pcs)
})
