import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import { listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import { listPrepProcessOrders } from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { routes } from '../src/router/routes-fcs.ts'

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, label: string): void {
  assert(source.includes(token), `${label} 缺少：${token}`)
}

function assertNotIncludes(source: string, token: string, label: string): void {
  assert(!source.includes(token), `${label} 不应包含：${token}`)
}

function flattenPfosMenuTitles(): string[] {
  return (menusBySystem.pfos || []).flatMap((group) =>
    group.items.flatMap((item) => [item.title, ...(item.children || []).map((child) => child.title)]),
  )
}

const domainSource = read('src/data/fcs/process-work-order-domain.ts')
const adapterSource = read('src/data/fcs/page-adapters/process-prep-pages-adapter.ts')
const platformPrintSource = read('src/pages/process-print-orders.ts')
const platformDyeSource = read('src/pages/process-dye-orders.ts')
const pfosPrintSource = read('src/pages/process-factory/printing/work-orders.ts')
const pfosDyeSource = read('src/pages/process-factory/dyeing/work-orders.ts')
const printDetailSource = read('src/pages/process-factory/printing/work-order-detail.ts')
const dyeDetailSource = read('src/pages/process-factory/dyeing/work-order-detail.ts')
const routesSource = read('src/router/routes-fcs.ts')
const docsSource = read('docs/fcs-process-work-order-unification.md')
const appShellSource = read('src/data/app-shell-config.ts')

assertIncludes(domainSource, 'export interface ProcessWorkOrder', '统一加工单领域')
assertIncludes(domainSource, "processType: 'PRINT'", '印花统一加工单')
assertIncludes(domainSource, "processType: 'DYE'", '染色统一加工单')
assertIncludes(domainSource, 'listProcessWorkOrders', '统一加工单领域')
assertIncludes(adapterSource, 'listProcessWorkOrders', '平台加工单 adapter')
assertIncludes(adapterSource, 'mapUnifiedWorkOrderToPrepOrder', '平台加工单 adapter')

const printWorkOrders = listPrintWorkOrders()
const dyeWorkOrders = listDyeWorkOrders()
const unifiedPrintOrders = listProcessWorkOrders('PRINT')
const unifiedDyeOrders = listProcessWorkOrders('DYE')
const platformPrintOrders = listPrepProcessOrders('PRINT')
const platformDyeOrders = listPrepProcessOrders('DYE')

assert(unifiedPrintOrders.length >= 3, 'PRINT 至少需要 3 条统一加工单')
assert(unifiedDyeOrders.length >= 3, 'DYE 至少需要 3 条统一加工单')
assert.deepEqual(
  unifiedPrintOrders.map((order) => order.workOrderId).sort(),
  printWorkOrders.map((order) => order.printOrderId).sort(),
  '印花平台与工厂端必须使用同一批加工单 ID',
)
assert.deepEqual(
  unifiedDyeOrders.map((order) => order.workOrderId).sort(),
  dyeWorkOrders.map((order) => order.dyeOrderId).sort(),
  '染色平台与工厂端必须使用同一批加工单 ID',
)
assert.deepEqual(
  platformPrintOrders.map((order) => order.orderNo).sort(),
  printWorkOrders.map((order) => order.printOrderNo).sort(),
  '平台印花加工单号必须等于工厂端印花加工单号',
)
assert.deepEqual(
  platformDyeOrders.map((order) => order.orderNo).sort(),
  dyeWorkOrders.map((order) => order.dyeOrderNo).sort(),
  '平台染色加工单号必须等于工厂端染色加工单号',
)

;[
  '等打印',
  '打印中',
  '转印中',
  '待送货',
  '待审核',
  '已完成',
  '已驳回',
].forEach((label) => {
  assert(unifiedPrintOrders.some((order) => order.statusLabel === label), `印花状态覆盖缺少：${label}`)
})

;[
  '待样衣',
  '待原料',
  '打样中',
  '待排缸',
  '染色中',
  '烘干中',
  '待送货',
  '待审核',
  '已完成',
  '已驳回',
].forEach((label) => {
  assert(unifiedDyeOrders.some((order) => order.statusLabel === label), `染色状态覆盖缺少：${label}`)
})

;[...unifiedPrintOrders, ...unifiedDyeOrders].forEach((order) => {
  assert(order.sourceDemandIds.length > 0, `${order.workOrderNo} 缺少来源需求单`)
  assert(order.productionOrderIds.length > 0, `${order.workOrderNo} 缺少生产单`)
  assert(Boolean(order.factoryId && order.factoryName), `${order.workOrderNo} 缺少工厂`)
  assert(Boolean(order.materialSku && order.materialName), `${order.workOrderNo} 缺少面料`)
  assert(order.plannedQty > 0 && Boolean(order.plannedUnit), `${order.workOrderNo} 计划加工数量缺少单位`)
  assert(Boolean(order.taskId && order.taskNo), `${order.workOrderNo} 缺少移动端执行任务`)
  const beforeDeliveryStatuses = [
    'WAIT_ARTWORK',
    'WAIT_COLOR_TEST',
    'COLOR_TEST_DONE',
    'WAIT_PRINT',
    'PRINTING',
    'PRINT_DONE',
    'WAIT_TRANSFER',
    'TRANSFERRING',
    'TRANSFER_DONE',
    'WAIT_SAMPLE',
    'WAIT_MATERIAL',
    'SAMPLE_TESTING',
    'SAMPLE_DONE',
    'MATERIAL_READY',
    'WAIT_VAT_PLAN',
    'VAT_PLANNED',
    'DYEING',
    'DEHYDRATING',
    'DRYING',
    'SETTING',
    'ROLLING',
    'PACKING',
  ]
  if (!beforeDeliveryStatuses.includes(String(order.status))) {
    assert(order.handoverRecords.length > 0 || Boolean(order.handoverOrderId), `${order.workOrderNo} 缺少交出记录串联`)
  }
  if (['RECEIVER_WRITTEN_BACK', 'WAIT_REVIEW', 'REVIEWING', 'COMPLETED', 'REJECTED'].includes(String(order.status))) {
    assert(order.reviewRecords.length > 0, `${order.workOrderNo} 缺少审核记录串联`)
  }
})

assertIncludes(platformPrintSource, "appStore.navigate(`/fcs/craft/printing/work-orders/${encodeURIComponent(workOrderId)}`)", '平台印花详情入口')
assertIncludes(platformDyeSource, "appStore.navigate(`/fcs/craft/dyeing/work-orders/${encodeURIComponent(workOrderId)}`)", '平台染色详情入口')
assertNotIncludes(platformPrintSource, '/fcs/pda/exec', '平台印花列表')
assertNotIncludes(platformDyeSource, '/fcs/pda/exec', '平台染色列表')
assertNotIncludes(platformPrintSource, '/fcs/pda/handover', '平台印花列表')
assertNotIncludes(platformDyeSource, '/fcs/pda/handover', '平台染色列表')

assertIncludes(pfosPrintSource, 'buildPrintingWorkOrderDetailLink(order.printOrderId)', '工厂端印花详情入口')
assertIncludes(pfosDyeSource, 'buildDyeingWorkOrderDetailLink(order.dyeOrderId)', '工厂端染色详情入口')
assertNotIncludes(pfosPrintSource, '/fcs/pda/exec', '工厂端印花加工单列表')
assertNotIncludes(pfosDyeSource, '/fcs/pda/exec', '工厂端染色加工单列表')
assertNotIncludes(pfosPrintSource, '/fcs/pda/handover', '工厂端印花加工单列表')
assertNotIncludes(pfosDyeSource, '/fcs/pda/handover', '工厂端染色加工单列表')

;[
  '基本信息',
  '花型与调色',
  '打印转印',
  '送货交出',
  '审核记录',
  '执行进度',
  '异常与结算',
  '打开移动端执行页',
  '打开移动端交出页',
].forEach((token) => assertIncludes(printDetailSource, token, '印花 Web 详情页'))

;[
  '基本信息',
  '打样备料',
  '染缸执行',
  '染色配方',
  '送货交出',
  '审核记录',
  '染色统计',
  '异常与结算',
  '打开移动端执行页',
  '打开移动端交出页',
].forEach((token) => assertIncludes(dyeDetailSource, token, '染色 Web 详情页'))

assertIncludes(routesSource, '^\\/fcs\\/craft\\/printing\\/work-orders\\/([^/]+)$', '印花 Web 详情路由')
assertIncludes(routesSource, '^\\/fcs\\/craft\\/dyeing\\/work-orders\\/([^/]+)$', '染色 Web 详情路由')
assert(routes.dynamicRoutes.some((route) => String(route.pattern).includes('printing\\/work-orders')), '印花动态详情路由不可达')
assert(routes.dynamicRoutes.some((route) => String(route.pattern).includes('dyeing\\/work-orders')), '染色动态详情路由不可达')
assertIncludes(routesSource, "renderRouteRedirect('/fcs/craft/printing/work-orders?tab=review'", '印花审核兼容跳转')
assertIncludes(routesSource, "renderRouteRedirect('/fcs/craft/printing/work-orders?tab=progress'", '印花进度兼容跳转')
assertIncludes(routesSource, "renderRouteRedirect('/fcs/craft/dyeing/work-orders?tab=formula'", '染色配方兼容跳转')

const menuTitles = flattenPfosMenuTitles()
assert(menuTitles.includes('印花加工单'), 'PFOS 菜单缺少印花加工单')
assert(menuTitles.includes('染色加工单'), 'PFOS 菜单缺少染色加工单')
assert(menuTitles.includes('染色统计'), 'PFOS 菜单缺少染色统计')
;['染料单', '染色配方', '印花审核', '印花进度'].forEach((title) => {
  assert(!menuTitles.includes(title), `PFOS 菜单不得保留独立主单入口：${title}`)
})
assertNotIncludes(appShellSource, "title: '染料单'", 'app-shell 菜单')

assertIncludes(docsSource, '生产需求单 -> 生产单 -> 工艺路线与任务拆解 -> 印花加工单 / 染色加工单', '统一流程文档')
assertIncludes(docsSource, '工厂生产协同系统平台视图 / 工艺工厂运营系统 Web 视图 / 工厂端移动应用执行视图 -> 交出回写 -> 审核 -> 完成', '统一流程文档')

console.log('[check-process-work-order-unification] PASS')
console.table({
  印花统一加工单: unifiedPrintOrders.length,
  染色统一加工单: unifiedDyeOrders.length,
  平台印花加工单: platformPrintOrders.length,
  平台染色加工单: platformDyeOrders.length,
})
