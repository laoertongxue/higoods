import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const listPageSource = readSource('src/pages/pcs-work-items.ts')
const detailPageSource = readSource('src/pages/pcs-work-item-detail.ts')

assert.ok(!listPageSource.includes('新增工作项'), '工作项库列表页不应再出现新增工作项入口')
assert.ok(!listPageSource.includes('新增自定义工作项'), '工作项库列表页不应再出现自定义工作项入口')
assert.ok(!listPageSource.includes('编辑工作项'), '工作项库列表页不应再出现编辑工作项入口')
assert.ok(!listPageSource.includes('复制工作项'), '工作项库列表页不应再出现复制工作项入口')
assert.ok(!listPageSource.includes('停用工作项'), '工作项库列表页不应再出现停用工作项入口')
assert.ok(!listPageSource.includes('启用工作项'), '工作项库列表页不应再出现启用工作项入口')

assert.ok(!detailPageSource.includes('编辑工作项'), '工作项详情页不应再出现编辑工作项按钮')
assert.ok(detailPageSource.includes('标准只读'), '工作项详情页应明确标记为标准只读')

const rendererSource = readSource('src/router/route-renderers.ts')
const routesSource = readSource('src/router/routes-pcs.ts')

assert.ok(!rendererSource.includes('renderPcsWorkItemCreatePage'), '路由渲染层不应再保留工作项新建页 renderer')
assert.ok(!rendererSource.includes('renderPcsWorkItemEditPage'), '路由渲染层不应再保留工作项编辑页 renderer')
assert.ok(!routesSource.includes('/pcs/work-items/new'), 'PCS 路由不应再保留工作项新建路由')
assert.ok(!routesSource.includes('/pcs/work-items/([^/]+)/edit'), 'PCS 路由不应再保留工作项编辑路由')
assert.ok(!existsSync(new URL('../src/pages/pcs-work-item-editor.ts', import.meta.url)), '工作项编辑页文件应已删除')

console.log('pcs-work-item-library-readonly.spec.ts PASS')
