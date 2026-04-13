import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const workItemSource = readSource('src/data/pcs-work-items.ts')
const routeRendererSource = readSource('src/router/route-renderers.ts')
const routesSource = readSource('src/router/routes-pcs.ts')

;[
  'createPcsWorkItem',
  'updatePcsWorkItem',
  'copyPcsWorkItem',
  'togglePcsWorkItemStatus',
].forEach((token) => {
  assert.ok(!workItemSource.includes(token), `工作项数据层不应再导出：${token}`)
})

assert.ok(!routeRendererSource.includes('renderPcsWorkItemCreatePage'), '不应再存在工作项新建 renderer')
assert.ok(!routeRendererSource.includes('renderPcsWorkItemEditPage'), '不应再存在工作项编辑 renderer')
assert.ok(!routesSource.includes('/pcs/work-items/new'), '不应再存在工作项新建路由')
assert.ok(!routesSource.includes('/pcs/work-items/([^/]+)/edit'), '不应再存在工作项编辑路由')
assert.ok(!existsSync(new URL('../src/pages/pcs-work-item-editor.ts', import.meta.url)), '工作项编辑页文件应已删除')

console.log('check-pcs-work-item-readonly.ts PASS')
