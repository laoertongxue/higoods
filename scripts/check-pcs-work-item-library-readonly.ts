import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  listPcsWorkItemLibraryMetas,
} from '../src/data/pcs-work-item-library-meta.ts'
import {
  listPcsWorkItemRuntimeCarrierDefinitions,
} from '../src/data/pcs-work-item-runtime-carrier.ts'

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const workItemSource = readSource('src/data/pcs-work-items.ts')
const listPageSource = readSource('src/pages/pcs-work-items.ts')
const detailPageSource = readSource('src/pages/pcs-work-item-detail.ts')
const handlersSource = readSource('src/main-handlers/pcs-handlers.ts')
const routeRendererSource = readSource('src/router/route-renderers.ts')
const routesSource = readSource('src/router/routes-pcs.ts')

const removedTokens = [
  'CUSTOM_STORAGE_KEY',
  'loadCustomWorkItemStore',
  'persistCustomWorkItemStore',
  'listCustomDefinitions',
  'buildCustomConfig',
  'nextCustomWorkItemId',
  'nextCustomWorkItemCode',
  'buildCustomFieldGroups',
  'PcsWorkItemEditorData',
  'CreateCustomWorkItemInput',
  'createPcsWorkItem',
  'updatePcsWorkItem',
  'copyPcsWorkItem',
  'togglePcsWorkItemStatus',
]

removedTokens.forEach((token) => {
  assert.ok(!workItemSource.includes(token), `工作项数据层不应再保留旧能力：${token}`)
})

assert.ok(!listPageSource.includes('新增自定义工作项'), '工作项库页面不应再出现新增自定义工作项')
assert.ok(!listPageSource.includes('data-pcs-work-library-action="go-create"'), '工作项库页面不应再出现新增入口')
assert.ok(!listPageSource.includes('data-pcs-work-library-action="go-edit"'), '工作项库页面不应再出现编辑入口')
assert.ok(!listPageSource.includes('data-pcs-work-library-action="copy"'), '工作项库页面不应再出现复制入口')
assert.ok(
  !listPageSource.includes('data-pcs-work-library-action="open-toggle-dialog"'),
  '工作项库页面不应再出现启停入口',
)
assert.ok(!detailPageSource.includes('编辑工作项'), '工作项详情页不应再出现编辑工作项按钮')

assert.ok(!handlersSource.includes('handlePcsWorkItemEditorEvent'), '主事件处理器不应再引用工作项编辑页事件')
assert.ok(
  !handlersSource.includes('isPcsWorkItemEditorDialogOpen'),
  '主事件处理器不应再引用工作项编辑页弹窗状态',
)
assert.ok(!routeRendererSource.includes('renderPcsWorkItemCreatePage'), '路由渲染层不应再保留工作项新建 renderer')
assert.ok(!routeRendererSource.includes('renderPcsWorkItemEditPage'), '路由渲染层不应再保留工作项编辑 renderer')
assert.ok(!routesSource.includes('/pcs/work-items/new'), 'PCS 路由不应再保留工作项新建路由')
assert.ok(!routesSource.includes('/pcs/work-items/([^/]+)/edit'), 'PCS 路由不应再保留工作项编辑路由')
assert.ok(!existsSync(new URL('../src/pages/pcs-work-item-editor.ts', import.meta.url)), '工作项编辑页文件应已删除')

assert.ok(listPageSource.includes('标准只读'), '工作项库页面源码应展示标准只读标记')
assert.ok(detailPageSource.includes('标准只读'), '工作项详情页源码应展示标准只读标记')
assert.ok(detailPageSource.includes('运行时承载'), '工作项详情页源码应展示运行时承载元数据')

const metas = listPcsWorkItemLibraryMetas()
const carriers = listPcsWorkItemRuntimeCarrierDefinitions()
assert.equal(metas.length, 21, '工作项目录元数据必须覆盖 21 个正式工作项')
assert.equal(carriers.length, 21, '运行时承载配置必须覆盖 21 个正式工作项')

const metaIds = new Set(metas.map((item) => item.workItemId))
assert.equal(metaIds.size, 21, '工作项目录元数据 workItemId 不得重复')
const carrierCodes = new Set(carriers.map((item) => item.workItemTypeCode))
assert.equal(carrierCodes.size, 21, '运行时承载配置 workItemTypeCode 不得重复')

const summaryByMode = carriers.reduce<Record<string, number>>((acc, item) => {
  acc[item.runtimeCarrierMode] = (acc[item.runtimeCarrierMode] || 0) + 1
  return acc
}, {})

console.log(`check-pcs-work-item-library-readonly.ts PASS (${repoRoot})`)
console.log(`运行时承载统计：${JSON.stringify(summaryByMode, null, 2)}`)
