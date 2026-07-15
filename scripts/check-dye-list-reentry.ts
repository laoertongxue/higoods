import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { resetStandardListEntryTransientStateOnRouteEntry } from '../src/components/ui/list-table-model.ts'

const preferences = {
  order: ['status', 'workOrderNo'],
  visibleKeys: ['status'],
  frozenKeys: ['workOrderNo'],
  pageSize: 20,
}
const listState = {
  currentPage: 3,
  sort: { key: 'status', direction: 'desc' as const },
  preferences,
}

resetStandardListEntryTransientStateOnRouteEntry(listState, true)
assert.equal(listState.currentPage, 3, '页面根节点仍挂载时，外壳重绘不得重置当前页')
assert.deepEqual(listState.sort, { key: 'status', direction: 'desc' }, '页面根节点仍挂载时，外壳重绘不得重置排序')

resetStandardListEntryTransientStateOnRouteEntry(listState, false)
assert.equal(listState.currentPage, 1, '重新进入标准列表必须回到第 1 页')
assert.equal(listState.sort, null, '重新进入标准列表必须恢复未排序')
assert.strictEqual(listState.preferences, preferences, '重新进入不得替换列显示、顺序、冻结和每页条数偏好')
assert.equal(listState.preferences.pageSize, 20, '重新进入不得重置每页条数')

for (const path of [
  'src/pages/process-factory/dyeing/combined-dyeing.ts',
  'src/pages/process-factory/dyeing/work-orders.ts',
]) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  assert.match(source, /export function renderCraft[^\n]+Page\(\): string \{\s+resetStandardListEntryTransientStateOnRouteEntry\(state, Boolean\(rootElement\(\)\)\)/, `${path} 的真实路由 renderer 必须按页面根节点是否已挂载判断重新进入`)
  const refreshSource = /function refreshWorkspace\(\): void \{([\s\S]*?)\n\}/.exec(source)?.[1] || ''
  assert(!refreshSource.includes('resetStandardListEntryTransientStateOnRouteEntry'), `${path} 的局部 refresh 不得重置页码或排序`)
}

console.log('dye list reentry state check passed')
