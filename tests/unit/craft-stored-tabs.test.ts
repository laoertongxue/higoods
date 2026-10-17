import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { menusBySystem, systems } from '../../src/data/app-shell-config.ts'

const source = readFileSync(new URL('../../src/state/store.ts', import.meta.url), 'utf8')
const ast = ts.createSourceFile('store.ts', source, ts.ScriptTarget.Latest, true)
const names = ['createEmptyTabs', 'getStoredTabs', 'migratePcsTabs', 'pruneRemovedFcsTabs', 'pruneRemovedPfosTabs', 'isRemovedCuttingGroupTab', 'isUnknownCuttingTabPath', 'migrateLegacyDispatchExceptionsTabs', 'migrateCuttingTabs', 'migrateFcsTabTitles', 'isPfosPath', 'migrateCraftTabsToPfos', 'getCurrentSystemId', 'flattenMenus', 'normalizePathname', 'findMenuItemByPath', 'pruneProductionTimingTabs']
const statements = ast.statements.filter(node => ts.isFunctionDeclaration(node)
  ? names.includes(node.name?.text || '')
  : ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && /^(TABS_STORAGE_KEY|.*TAB.*|.*DISPATCH.*|.*PROGRESS.*|PFOS_ROUTE_PREFIXES)$/.test(declaration.name.text)))
assert.equal(statements.filter(ts.isFunctionDeclaration).length, names.length)
const code = ts.transpileModule(statements.map(node => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
function restore(value: unknown) {
  let raw = JSON.stringify(value)
  const read = new Function('menusBySystem', 'systems', 'browserLocalStorage', 'readBrowserStorageItem', 'writeBrowserStorageItem', `${code}; return getStoredTabs`)(menusBySystem, systems, {}, () => raw, (_storage: unknown, _key: string, value: string) => { raw = value })
  return { result: read(), stored: () => JSON.parse(raw) }
}
const prefix = '/fcs/process-factory/special-craft/'
const live = `${prefix}aux-op-seam-embroidery/work-orders`
const stale = { key: 'discarded-craft', title: '过期工艺页签', href: `${prefix}retired-operation/work-orders?status=all`, closable: true }
const tab = (href: string, key: string, title: string) => ({ href, key, title, closable: true })

test('discarded craft list preferences are removed from both historical owners and persisted without business writes', () => {
  for (const owner of ['fcs', 'pfos']) {
    const input = { [owner]: { systemId: owner, activeKey: stale.key, tabs: [stale, tab(live, 'old-live-key', '过期标题')] } }
    const before = structuredClone(input), { result, stored } = restore(input)
    assert.deepEqual(input, before)
    assert.equal(result.pfos.tabs.length, 1)
    assert.equal(result.pfos.tabs[0].title, '缝边绣加工单')
    assert.equal(result.pfos.tabs[0].href, live)
    assert.equal(result.pfos.activeKey, result.pfos.tabs[0].key)
    assert.deepEqual(stored(), result)
    assert.ok(!JSON.stringify(result).includes(stale.title))
    assert.ok(!JSON.stringify(result).includes('retired-operation'))
  }
})

test('valid craft tabs use the published menu title; unrelated and dynamic detail preferences remain intact', () => {
  const detail = tab(`${live}/ORDER-001`, 'detail', '详情')
  const other = tab('/fcs/craft/dyeing/work-orders', 'dye', '染色加工单')
  const { result } = restore({ pfos: { systemId: 'pfos', activeKey: 'detail', tabs: [tab(live, 'wrong-key', '过期标题'), detail, other] }, pcs: { systemId: 'pcs', activeKey: 'styles', tabs: [tab('/pcs/products/styles', 'styles', '款式档案')] } })
  assert.equal(result.pfos.tabs[0].title, '缝边绣加工单')
  assert.deepEqual(result.pfos.tabs[1], detail)
  assert.equal(result.pfos.activeKey, 'detail')
  assert.equal(result.pfos.tabs[2].href, other.href)
  assert.equal(result.pcs.tabs[0].href, '/pcs/products/styles')
})
