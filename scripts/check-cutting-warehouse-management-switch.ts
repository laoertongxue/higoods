import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import { routes } from '../src/router/routes-fcs.ts'
import {
  renderCraftCuttingWarehouseManagementWaitHandoverPage,
  renderCraftCuttingWarehouseManagementWaitProcessPage,
} from '../src/pages/process-factory/cutting/warehouse-hub.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function repoPath(relativePath: string): string {
  return path.resolve(repoRoot, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(repoPath(relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function assertOrdered(source: string, first: string, second: string, message: string): void {
  assert(source.indexOf(first) >= 0, `缺少顺序检查起点：${first}`)
  assert(source.indexOf(second) >= 0, `缺少顺序检查终点：${second}`)
  assert(source.indexOf(first) < source.indexOf(second), message)
}

function token(...parts: string[]): string {
  return parts.join('')
}

const cuttingGroup = menusBySystem.pfos.find((group) => group.title === '裁床厂管理')
assert(cuttingGroup, 'PFOS 缺少裁床厂管理菜单组')

assert.deepEqual(
  cuttingGroup.items.map((item) => item.title),
  ['裁床总览', '裁前准备', '铺布执行', '裁后处理', '裁床仓库管理'],
  '裁床厂管理一级菜单顺序不正确',
)

const warehouseItem = cuttingGroup.items.find((item) => item.title === '裁床仓库管理')
assert(warehouseItem, 'PFOS 缺少裁床仓库管理一级菜单')
assert.deepEqual(
  warehouseItem.children?.map((child) => child.title),
  ['裁床待加工仓', '裁床待交出仓', '交出单', '裁床样衣仓'],
  '裁床仓库管理 children 必须为裁床待加工仓 / 裁床待交出仓 / 交出单 / 裁床样衣仓',
)
assert.deepEqual(
  warehouseItem.children?.map((child) => child.href),
  [
    '/fcs/craft/cutting/warehouse-management/wait-process',
    '/fcs/craft/cutting/warehouse-management/wait-handover',
    '/fcs/craft/cutting/handover-orders',
    '/fcs/craft/cutting/warehouse-management/sample-warehouse',
  ],
  '裁床仓库管理 children href 不正确',
)
assert(!cuttingGroup.items.some((item) => item.title === '裁片仓交接'), '旧裁片仓交接 item 不应继续存在')

const nonWarehouseChildren = cuttingGroup.items
  .filter((item) => item.key !== 'pfos-cutting-warehouse-management')
  .flatMap((item) => item.children ?? [])
;['裁床仓', '特殊工艺发料', '特殊工艺回仓', '裁片交出', '裁片仓'].forEach((title) => {
  assert(!nonWarehouseChildren.some((child) => child.title === title), `旧分散入口仍留在原菜单组：${title}`)
})

const exactRoutes = routes.exactRoutes
assert(exactRoutes['/fcs/craft/cutting/warehouse-management/wait-process'], '缺少裁床待加工仓 route')
assert(exactRoutes['/fcs/craft/cutting/warehouse-management/wait-handover'], '缺少裁床待交出仓 route')
assert(exactRoutes['/fcs/craft/cutting/handover-orders'], '缺少交出单 route')
assert(exactRoutes['/fcs/craft/cutting/warehouse-management/sample-warehouse'], '缺少样衣仓兼容 route')

const routesSource = read('src/router/routes-fcs.ts')
assertIncludes(routesSource, "renderRouteRedirect('/fcs/craft/cutting/sample-warehouse', '正在跳转到裁床样衣仓')", '样衣仓兼容路由必须跳转裁床样衣仓')

assert(fs.existsSync(repoPath('src/pages/process-factory/cutting/warehouse-hub.ts')), '缺少 warehouse-hub.ts')
assert(!fs.existsSync(repoPath('src/pages/process-factory/cutting/warehouse-management.ts')), '不得复活旧 warehouse-management.ts')
assert(!fs.existsSync(repoPath('src/pages/process-factory/cutting/warehouse-management.helpers.ts')), '不得复活旧 warehouse-management.helpers.ts')

const waitProcessHtml = renderCraftCuttingWarehouseManagementWaitProcessPage()
;['库存明细', '待领料', '中转仓领料', '扫码入仓', '加工领料', '回收入仓', '库区库位'].forEach((item) =>
  assertIncludes(waitProcessHtml, item, `裁床待加工仓缺少仓库页签或动作：${item}`),
)
;['待交出仓裁片库存', '回写差异', '新增交出记录'].forEach((item) =>
  assertNotIncludes(waitProcessHtml, item, `裁床待加工仓不得承接待交出仓内容：${item}`),
)

const waitHandoverHtml = renderCraftCuttingWarehouseManagementWaitHandoverPage()
;[
  '库存明细',
  '待入仓',
  '入仓记录',
  '分拣装袋',
  '交出记录',
  '回写差异',
  '特殊工艺回仓',
  '库区库位',
  '待交出仓裁片库存',
  '菲票 / 来源',
  '数量账',
  '袋码 / 库位',
  '查看流水',
  '扫码入仓',
  '二次分拣',
  '重新装袋',
  '新增交出记录',
  'data-wait-handover-action="open-inbound"',
  'data-wait-handover-action="open-sorting"',
  'data-wait-handover-action="open-rebag"',
  'data-wait-handover-action="open-handover"',
].forEach((item) => assertIncludes(waitHandoverHtml, item, `裁床待交出仓缺少仓库页签或动作：${item}`))
assertOrdered(
  waitHandoverHtml,
  'data-nav="/fcs/craft/cutting/warehouse-management/wait-handover"',
  'data-nav="/fcs/craft/cutting/warehouse-management/wait-handover?tab=pending-inbound"',
  '裁床待交出仓默认入口必须先展示库存明细',
)
;['裁后工作台', '待交出仓配料', '进入裁片仓', '进入裁片交出', '裁床交出仓'].forEach((item) =>
  assertNotIncludes(waitHandoverHtml, item, `裁床待交出仓不得出现旧定位：${item}`),
)

const hubSource = read('src/pages/process-factory/cutting/warehouse-hub.ts')
;[
  'type WaitHandoverTabKey',
  'renderWaitHandoverTabs',
  'renderWaitHandoverInventoryTable',
  'renderWaitHandoverEventTable',
  'buildWaitHandoverFallbackInventoryRecords',
  'renderWarehouseFlowButton',
  'renderWarehouseLocationToolbar',
  'renderCuttingPageHeader',
  'renderCompactKpiCard',
  'handleCraftCuttingWaitHandoverEvent',
  'appendWaitHandoverInboundEvent',
  'appendWaitHandoverSortingEvent',
  'appendWaitHandoverRebagEvent',
  'appendWaitHandoverHandoverRecordEvent',
  "source: 'WEB'",
].forEach((item) => assertIncludes(hubSource, item, `hub 页缺少待交出仓仓库化能力：${item}`))
;['renderFactoryWarehouseStandardTabs', 'FactoryWarehouseStandardTab', "key: 'workbench'", "label: '裁后工作台'"].forEach((item) =>
  assertNotIncludes(hubSource, item, `待交出仓不应继续使用旧标准入口结构：${item}`),
)

const pdaWaitHandoverSource = read('src/pages/pda-warehouse-wait-handover.ts')
;['裁床待交出仓', '扫码入仓', '二次分拣', '重新装袋', '新增交出记录'].forEach((item) =>
  assertIncludes(pdaWaitHandoverSource, item, `PDA 裁床待交出仓缺少动作：${item}`),
)
assertIncludes(pdaWaitHandoverSource, 'buildWaitHandoverRuntimeProjection', 'PDA 裁床待交出仓必须读取同一事实账投影')
;['cutting-wh-sort', 'cutting-wh-rebag', '请扫描待交出仓裁片配料任务码'].forEach((item) =>
  assertNotIncludes(pdaWaitHandoverSource, item, `PDA 裁床待交出仓不得保留提示式假操作：${item}`),
)
assertNotIncludes(pdaWaitHandoverSource, '裁床交出仓', 'PDA 不应显示旧名称“裁床交出仓”')

const waitHandoverRuntimeSource = read('src/pages/process-factory/cutting/wait-handover-runtime.ts')
;[
  'appendWaitHandoverInboundEvent',
  'appendWaitHandoverSortingEvent',
  'appendWaitHandoverRebagEvent',
  'appendWaitHandoverHandoverRecordEvent',
  'buildWaitHandoverRuntimeProjection',
  'listWaitHandoverRuntimeEvents',
].forEach((item) => assertIncludes(waitHandoverRuntimeSource, item, `缺少 Web/PDA 同账共享能力：${item}`))

;[
  'src/pages/process-factory/cutting/fabric-warehouse-model.ts',
  'src/pages/process-factory/cutting/fabric-warehouse-projection.ts',
  'src/pages/process-factory/cutting/cut-piece-warehouse-model.ts',
  'src/pages/process-factory/cutting/cut-piece-warehouse-projection.ts',
  'src/pages/process-factory/cutting/sample-warehouse.ts',
  'src/pages/process-factory/cutting/warehouse-hub.ts',
].forEach((file) => {
  assert(fs.existsSync(repoPath(file)), `相关仓库原型文件必须继续存在：${file}`)
})

const scopeSource = [
  read('src/data/app-shell-config.ts'),
  read('src/router/routes-fcs.ts'),
  read('src/router/route-renderers-fcs.ts'),
  hubSource,
  pdaWaitHandoverSource,
].join('\n')
;[
  token('库存', '三态'),
  token('可用', '库存'),
  token('占用', '库存'),
  token('在途', '库存'),
  token('A', 'PI'),
  token('i', '18n'),
  token('use', 'Translation'),
  token('e', 'charts'),
  token('re', 'charts'),
  token('chart', '.js'),
].forEach((item) => assertNotIncludes(scopeSource, item, `本 step 不得引入越界能力：${item}`))

console.log('[check-cutting-warehouse-management-switch] 裁床仓库管理切换与待交出仓仓库化通过')
