import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import {
  buildSpecialCraftWaitHandoverWarehousePath,
  buildSpecialCraftWaitProcessWarehousePath,
  listEnabledSpecialCraftOperationDefinitions,
} from '../src/data/fcs/special-craft-operations.ts'
import { getPrintingWarehouseView } from '../src/data/fcs/printing-warehouse-view.ts'
import { getDyeingWarehouseView } from '../src/data/fcs/dyeing-warehouse-view.ts'
import {
  renderCraftPrintingWaitHandoverWarehousePage,
  renderCraftPrintingWaitProcessWarehousePage,
} from '../src/pages/process-factory/printing/warehouse.ts'
import {
  renderCraftDyeingWaitHandoverWarehousePage,
  renderCraftDyeingWaitProcessWarehousePage,
} from '../src/pages/process-factory/dyeing/warehouse.ts'
import {
  renderSpecialCraftWaitHandoverWarehousePage,
  renderSpecialCraftWaitProcessWarehousePage,
} from '../src/pages/process-factory/special-craft/warehouse.ts'
import { routes } from '../src/router/routes-fcs.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function token(...parts: string[]): string {
  return parts.join('')
}

function flattenMenuItems(groups: typeof menusBySystem.pfos) {
  return groups.flatMap((group) => group.items)
}

function childTitles(menuTitle: string): string[] {
  const item = flattenMenuItems(menusBySystem.pfos).find((entry) => entry.title === menuTitle)
  assert(item, `缺少 PFOS 菜单：${menuTitle}`)
  return item.children?.map((child) => child.title) || []
}

function childHrefs(menuTitle: string): string[] {
  const item = flattenMenuItems(menusBySystem.pfos).find((entry) => entry.title === menuTitle)
  assert(item, `缺少 PFOS 菜单：${menuTitle}`)
  return item.children?.map((child) => child.href || '') || []
}

const appShellSource = read('src/data/app-shell-config.ts')
const routesSource = read('src/router/routes-fcs.ts')
const renderersSource = read('src/router/route-renderers-fcs.ts')
const specialOpsSource = read('src/data/fcs/special-craft-operations.ts')
const printingWarehouseSource = read('src/pages/process-factory/printing/warehouse.ts')
const dyeingWarehouseSource = read('src/pages/process-factory/dyeing/warehouse.ts')
const specialWarehouseSource = read('src/pages/process-factory/special-craft/warehouse.ts')
const specialSharedSource = read('src/pages/process-factory/special-craft/shared.ts')
const printingAdapterSource = read('src/data/fcs/printing-warehouse-view.ts')
const dyeingAdapterSource = read('src/data/fcs/dyeing-warehouse-view.ts')
const taskPrintSource = read('src/data/fcs/task-print-cards.ts') + read('src/pages/print/task-delivery-card.ts')

assertIncludes(taskPrintSource, 'buildTaskDeliveryCardPrintDocByRecordId', '缺少任务交货卡 builder')
assertIncludes(read('src/data/fcs/fcs-route-links.ts'), 'buildTaskDeliveryCardPrintLink', '缺少任务交货卡 link builder')
assertIncludes(routesSource, '/fcs/print/task-delivery-card', '缺少任务交货卡预览路由')

assert.deepEqual(childTitles('印花管理'), ['印花加工单', '印花待加工仓', '印花待交出仓', '印花审核', '印花进度', '印花统计', '印花大屏'], '印花厂管理菜单顺序不正确')
assert.deepEqual(childHrefs('印花管理'), [
  '/fcs/craft/printing/work-orders',
  '/fcs/craft/printing/wait-process-warehouse',
  '/fcs/craft/printing/wait-handover-warehouse',
  '/fcs/craft/printing/pending-review',
  '/fcs/craft/printing/progress',
  '/fcs/craft/printing/statistics',
  '/fcs/craft/printing/dashboards',
], '印花厂管理菜单 href 不正确')

assert.deepEqual(childTitles('染厂管理'), ['染色加工单', '染色待加工仓', '染色待交出仓', '染料单', '染色报表'], '染厂管理菜单顺序不正确')
assert.deepEqual(childHrefs('染厂管理'), [
  '/fcs/craft/dyeing/work-orders',
  '/fcs/craft/dyeing/wait-process-warehouse',
  '/fcs/craft/dyeing/wait-handover-warehouse',
  '/fcs/craft/dyeing/dye-orders',
  '/fcs/craft/dyeing/reports',
], '染厂管理菜单 href 不正确')

const forbiddenWarehouseMenuText = token('仓库', '管理')
const operations = listEnabledSpecialCraftOperationDefinitions()
operations.forEach((operation) => {
  const titles = childTitles(operation.operationName)
  const waitProcessPath = buildSpecialCraftWaitProcessWarehousePath(operation)
  const waitHandoverPath = buildSpecialCraftWaitHandoverWarehousePath(operation)
  assert.deepEqual(
    titles,
    [`${operation.operationName}任务单`, `${operation.operationName}待加工仓`, `${operation.operationName}待交出仓`, `${operation.operationName}统计`],
    `${operation.operationName} 特殊工艺菜单 children 不正确`,
  )
  assert(!titles.some((title) => title.includes(forbiddenWarehouseMenuText)), `${operation.operationName} 菜单仍出现旧仓库口径`)
  assert(routes.exactRoutes[waitProcessPath], `${operation.operationName} 缺少待加工仓路由`)
  assert(routes.exactRoutes[waitHandoverPath], `${operation.operationName} 缺少待交出仓路由`)
})

assertIncludes(routesSource, '/fcs/craft/printing/wait-process-warehouse', '印花 wait-process route 缺失')
assertIncludes(routesSource, '/fcs/craft/printing/wait-handover-warehouse', '印花 wait-handover route 缺失')
assertIncludes(routesSource, '/fcs/craft/printing/warehouse', '印花旧仓库 route 缺失')
assertIncludes(routesSource, '/fcs/craft/printing/warehouse-management', '印花旧仓库管理 route 缺失')
assertIncludes(routesSource, "renderRouteRedirect('/fcs/craft/printing/wait-process-warehouse', '正在跳转到印花待加工仓')", '印花旧仓库 route 必须重定向')
assertIncludes(routesSource, '/fcs/craft/dyeing/wait-process-warehouse', '染色 wait-process route 缺失')
assertIncludes(routesSource, '/fcs/craft/dyeing/wait-handover-warehouse', '染色 wait-handover route 缺失')
assertIncludes(routesSource, '/fcs/craft/dyeing/warehouse', '染色旧仓库 route 缺失')
assertIncludes(routesSource, '/fcs/craft/dyeing/warehouse-management', '染色旧仓库管理 route 缺失')
assertIncludes(routesSource, "renderRouteRedirect('/fcs/craft/dyeing/wait-process-warehouse', '正在跳转到染色待加工仓')", '染色旧仓库 route 必须重定向')
assertIncludes(routesSource, 'renderRouteRedirect(buildSpecialCraftWaitProcessWarehousePath(operation)', '特殊工艺旧 warehouse route 未重定向')
assertIncludes(routesSource, '正在跳转到${operation.operationName}待加工仓', '特殊工艺旧 warehouse route 缺少提示文案')

;[
  'renderCraftPrintingWaitProcessWarehousePage',
  'renderCraftPrintingWaitHandoverWarehousePage',
  'renderCraftDyeingWaitProcessWarehousePage',
  'renderCraftDyeingWaitHandoverWarehousePage',
  'renderSpecialCraftWaitProcessWarehousePage',
  'renderSpecialCraftWaitHandoverWarehousePage',
].forEach((name) => assertIncludes(renderersSource, name, `缺少 renderer：${name}`))

const printingWaitProcessHtml = renderCraftPrintingWaitProcessWarehousePage()
const printingWaitHandoverHtml = renderCraftPrintingWaitHandoverWarehousePage()
const dyeingWaitProcessHtml = renderCraftDyeingWaitProcessWarehousePage()
const dyeingWaitHandoverHtml = renderCraftDyeingWaitHandoverWarehousePage()
const sampleOperation = operations[0]
assert(sampleOperation, '缺少特殊工艺样例')
const specialWaitProcessHtml = renderSpecialCraftWaitProcessWarehousePage(sampleOperation.operationId)
const specialWaitHandoverHtml = renderSpecialCraftWaitHandoverWarehousePage(sampleOperation.operationId)

assertIncludes(printingWaitProcessHtml, '印花待加工仓', '印花待加工仓页标题缺失')
assertIncludes(printingWaitProcessHtml, '待加工仓', '印花待加工仓页缺少主区块')
assertIncludes(printingWaitProcessHtml, '入库记录', '印花待加工仓页缺少入库记录')
assertIncludes(printingWaitProcessHtml, '库区库位', '印花待加工仓页缺少库区库位')
assertIncludes(printingWaitProcessHtml, '盘点', '印花待加工仓页缺少盘点')
assertNotIncludes(printingWaitProcessHtml, '打印任务交货卡', '印花待加工仓页不得出现任务交货卡按钮')
assertIncludes(printingWaitHandoverHtml, '印花待交出仓', '印花待交出仓页标题缺失')
assertIncludes(printingWaitHandoverHtml, '出库记录', '印花待交出仓页缺少出库记录')
assertIncludes(printingWarehouseSource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '印花出库记录必须按 handoverRecordId 打印任务交货卡')

assertIncludes(dyeingWaitProcessHtml, '染色待加工仓', '染色待加工仓页标题缺失')
assertIncludes(dyeingWaitProcessHtml, '待加工仓', '染色待加工仓页缺少主区块')
assertIncludes(dyeingWaitProcessHtml, '入库记录', '染色待加工仓页缺少入库记录')
assertIncludes(dyeingWaitProcessHtml, '库区库位', '染色待加工仓页缺少库区库位')
assertIncludes(dyeingWaitProcessHtml, '盘点', '染色待加工仓页缺少盘点')
assertNotIncludes(dyeingWaitProcessHtml, '打印任务交货卡', '染色待加工仓页不得出现任务交货卡按钮')
assertIncludes(dyeingWaitHandoverHtml, '染色待交出仓', '染色待交出仓页标题缺失')
assertIncludes(dyeingWaitHandoverHtml, '出库记录', '染色待交出仓页缺少出库记录')
assertIncludes(dyeingWarehouseSource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '染色出库记录必须按 handoverRecordId 打印任务交货卡')

assertIncludes(specialWaitProcessHtml, `${sampleOperation.operationName}待加工仓`, '特殊工艺待加工仓页标题缺失')
assertIncludes(specialWaitProcessHtml, '入库记录', '特殊工艺待加工仓页缺少入库记录')
assertNotIncludes(specialWaitProcessHtml, '打印任务交货卡', '特殊工艺待加工仓页不得出现任务交货卡按钮')
assertIncludes(specialWaitHandoverHtml, `${sampleOperation.operationName}待交出仓`, '特殊工艺待交出仓页标题缺失')
assertIncludes(specialWaitHandoverHtml, '出库记录', '特殊工艺待交出仓页缺少出库记录')
assertIncludes(specialWarehouseSource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '特殊工艺出库记录必须按 handoverRecordId 打印任务交货卡')

assertIncludes(specialSharedSource, "'wait-process'", '特殊工艺子导航缺少待加工仓 key')
assertIncludes(specialSharedSource, "'wait-handover'", '特殊工艺子导航缺少待交出仓 key')
assertNotIncludes(specialSharedSource, forbiddenWarehouseMenuText, '特殊工艺子导航不得继续展示旧仓库口径')
assertIncludes(specialWarehouseSource + specialSharedSource, 'resolveSpecialCraftFactoryContextGuard', '拆分后特殊工艺仓库页必须保留工厂可见性拦截')
assertIncludes(specialWarehouseSource + specialSharedSource, '当前工厂无该特殊工艺入口', '拆分后特殊工艺仓库页必须保留无权限空态')

const printingView = getPrintingWarehouseView()
const dyeingView = getDyeingWarehouseView()
assert(printingView.factoryIds.length > 0, '印花仓库视图缺少工厂集合')
assert(dyeingView.factoryIds.length > 0, '染色仓库视图缺少工厂集合')
;[
  'listFactoryInternalWarehouses',
  'listFactoryWaitProcessStockItems',
  'listFactoryWaitHandoverStockItems',
  'listFactoryWarehouseInboundRecords',
  'listFactoryWarehouseOutboundRecords',
  'listFactoryWarehouseStocktakeOrders',
  'listFactoryWarehouseNodeRows',
].forEach((name) => {
  assertIncludes(printingAdapterSource + dyeingAdapterSource, name, `印花/染色仓库视图必须复用工厂内部仓底座：${name}`)
})

;['printWarehouses', 'dyeWarehouses', 'specialCraftWarehouses'].forEach((name) => {
  assertNotIncludes(printingAdapterSource + dyeingAdapterSource + specialWarehouseSource, name, `不得新造第二套库存模型：${name}`)
})

const combinedScope = appShellSource + routesSource + renderersSource + printingWarehouseSource + dyeingWarehouseSource + specialWarehouseSource + specialOpsSource
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
].forEach((name) => {
  assertNotIncludes(combinedScope, name, `本 step 不得引入越界能力：${name}`)
})

console.log('[check-process-factory-warehouse-menu-consolidation] PFOS 仓库菜单收口通过')
