import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { menusBySystem } from '../src/data/app-shell-config.ts'
import { listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import { listPrepProcessOrders } from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  getPrintWorkOrderById,
  getPrintWorkOrderByTaskId,
  getPrintWorkOrderSummary,
  listPrintExecutionNodeRecords,
  listPrintingDashboardBuckets,
  listPrintWorkOrders,
} from '../src/data/fcs/printing-task-domain.ts'
import {
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  getDyeWorkOrderSummary,
  listDyeReportRows,
  listDyeWorkOrders,
} from '../src/data/fcs/dyeing-task-domain.ts'
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

function flattenMenuTitles(system: keyof typeof menusBySystem): string[] {
  return (menusBySystem[system] || []).flatMap((group) =>
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
const routesSource = read('src/router/routes-fcs.ts')
const pdaHandoverSource = read('src/pages/pda-handover.ts')
const docsSource = read('docs/fcs-process-work-order-unification.md')
const appShellSource = read('src/data/app-shell-config.ts')
const truthSourceAuditMarkdown = read('docs/fcs-truth-source-audit.md')
const truthSourceAuditJson = read('docs/fcs-truth-source-audit.json')
const preparationTimingSource = read('src/data/fcs/production-preparation-timing.ts')
const fcsRouteRenderersSource = read('src/router/route-renderers-fcs.ts')
const sharedRouteRenderersSource = read('src/router/route-renderers.ts')
const fcsHandlersSource = read('src/main-handlers/fcs-handlers.ts')
const stockSourceBoundaryFiles = [
  'src/data/fcs/dyeing-task-domain.ts',
  'src/data/fcs/printing-task-domain.ts',
  'src/data/fcs/mobile-execution-task-index.ts',
  'src/data/fcs/process-warehouse-linkage-service.ts',
  'src/data/fcs/process-execution-writeback.ts',
  'src/data/fcs/pda-handover-events.ts',
  'src/pages/pda-handover.ts',
  'src/pages/pda-handover-detail.ts',
]

const fcsMenuTitles = flattenMenuTitles('fcs')
;[truthSourceAuditMarkdown, truthSourceAuditJson].forEach((source, index) => {
  const label = index === 0 ? '真源审计 Markdown' : '真源审计 JSON'
  ;['process-dye-requirements', 'process-print-requirements']
    .forEach((token) => assertNotIncludes(source, token, label))
  ;['src/pages/process-dye-orders.ts', 'src/pages/process-print-orders.ts']
    .forEach((token) => assertIncludes(source, token, label))
})
;[
  'src/pages/process-dye-requirements.ts',
  'src/pages/process-print-requirements.ts',
  'src/pages/process-order-create-bridge.ts',
].forEach((relativePath) => assert(!fs.existsSync(path.join(ROOT, relativePath)), `${relativePath} 必须删除`))
assert(fcsMenuTitles.includes('染色加工单'), 'FCS 菜单必须保留染色加工单')
assert(fcsMenuTitles.includes('印花加工单'), 'FCS 菜单必须保留印花加工单')
assert('/fcs/process/dye-orders' in routes.exactRoutes, '染色加工单路由必须保留')
assert('/fcs/process/print-orders' in routes.exactRoutes, '印花加工单路由必须保留')
;[fcsRouteRenderersSource, sharedRouteRenderersSource].forEach((source, index) => {
  const label = index === 0 ? 'FCS route renderer' : '共享 route renderer'
  ;['process-dye-requirements', 'process-print-requirements', 'renderProcessDyeRequirementsPage', 'renderProcessPrintRequirementsPage']
    .forEach((token) => assertNotIncludes(source, token, label))
  ;['renderProcessDyeOrdersPage', 'renderProcessPrintOrdersPage']
    .forEach((token) => assertIncludes(source, token, label))
})
;[
  'process-dye-requirements',
  'process-print-requirements',
  'handleProcessDyeRequirementsEvent',
  'handleProcessPrintRequirementsEvent',
  'isProcessDyeRequirementsDialogOpen',
  'isProcessPrintRequirementsDialogOpen',
].forEach((token) => assertNotIncludes(fcsHandlersSource, token, 'FCS handler'))
;['handleProcessDyeOrdersEvent', 'handleProcessPrintOrdersEvent']
  .forEach((token) => assertIncludes(fcsHandlersSource, token, 'FCS handler'))
;['/fcs/process/dye-requirements', '/fcs/process/print-requirements']
  .forEach((token) => assertNotIncludes(preparationTimingSource, token, '生产准备产出链接'))
;['/fcs/process/dye-orders', '/fcs/process/print-orders']
  .forEach((token) => assertIncludes(preparationTimingSource, token, '生产准备产出链接'))

assertIncludes(domainSource, 'export interface ProcessWorkOrder', '统一加工单领域')
assertIncludes(domainSource, "export type ProcessWorkOrderSourceType = 'PRODUCTION_ORDER' | 'STOCK'", '统一加工单来源类型')
assertNotIncludes(domainSource, 'sourceDemandIds', '统一加工单领域')
assertIncludes(domainSource, "processType: 'PRINT'", '印花统一加工单')
assertIncludes(domainSource, "processType: 'DYE'", '染色统一加工单')
assertIncludes(domainSource, 'listProcessWorkOrders', '统一加工单领域')
assertIncludes(adapterSource, 'listProcessWorkOrders', '平台加工单 adapter')
assertIncludes(adapterSource, 'mapUnifiedWorkOrderToPrepOrder', '平台加工单 adapter')
for (const file of stockSourceBoundaryFiles) {
  const source = read(file)
  ;["sourceProductionOrderId || ''", "productionOrderId: ''", "productionOrderNo: ''", "sourceDemandId: ''", "sourceDemandNo: ''"].forEach((token) => {
    assertNotIncludes(source, token, `${file} 备货来源边界`)
  })
}
assertIncludes(pdaHandoverSource, 'getPdaHandoverSourceDisplay(head)', 'PDA 交出页来源展示')
assertIncludes(pdaHandoverSource, 'renderHandoverSourceField(head)', 'PDA 交出页来源字段')
assertIncludes(read('src/pages/pda-handover-detail.ts'), 'renderPdaHandoverSourceIdentity(head)', 'PDA 交出详情来源字段')

const printWorkOrders = listPrintWorkOrders()
const dyeWorkOrders = listDyeWorkOrders()
const unifiedPrintOrders = listProcessWorkOrders('PRINT')
const unifiedDyeOrders = listProcessWorkOrders('DYE')
const platformPrintOrders = listPrepProcessOrders('PRINT')
const platformDyeOrders = listPrepProcessOrders('DYE')

const EXPECTED_PRINT_CANONICAL_IDENTITIES: Array<[string, string]> = [
  ['PWO-PRINT-001', 'PH-20260328-001'],
  ['PWO-PRINT-002', 'PH-20260328-002'],
  ['PWO-PRINT-003', 'PH-20260328-003'],
  ['PWO-PRINT-004', 'PH-20260328-004'],
  ['PWO-PRINT-005', 'PH-20260328-005'],
  ['PWO-PRINT-006', 'PH-20260328-006'],
  ['PWO-PRINT-007', 'PH-20260328-007'],
  ['PWO-PRINT-008', 'PH-20260329-008'],
  ['PWO-PRINT-009', 'PH-20260329-009'],
  ['PWO-PRINT-010', 'PH-20260329-010'],
  ['PWO-PRINT-011', 'PH-20260329-011'],
  ['PWO-PRINT-012', 'PH-20260329-012'],
]

const EXPECTED_DYE_CANONICAL_IDENTITIES: Array<[string, string]> = [
  ['DWO-001', 'DY-20260328-001'],
  ['DWO-002', 'DY-20260328-002'],
  ['DWO-003', 'DY-20260328-003'],
  ['DWO-004', 'DY-20260328-004'],
  ['DWO-005', 'DY-20260328-005'],
  ['DWO-006', 'DY-20260328-006'],
  ['DWO-007', 'DY-20260328-007'],
  ['DWO-008', 'DY-20260328-008'],
  ['DWO-009', 'DY-20260328-009'],
  ['DWO-010', 'DY-20260328-010'],
  ['DWO-011', 'DY-20260328-011'],
  ['DWO-012', 'DY-20260329-012'],
  ['DWO-013', 'DY-20260329-013'],
  ['DYE-WATER-PO-202603-081', 'RSJG-WATER-202603081'],
  ['DYE-COMBINED-DEMO-001', 'RSJG-202607-901'],
  ['DYE-COMBINED-DEMO-002', 'RSJG-202607-902'],
]

function sortIdentities(identities: Array<[string, string]>): Array<[string, string]> {
  return [...identities].sort(([leftId, leftNo], [rightId, rightNo]) =>
    leftId.localeCompare(rightId) || leftNo.localeCompare(rightNo),
  )
}

function assertWorkOrderIdentity(
  platformOrders: Array<{ workOrderId?: string; orderNo: string }>,
  factoryOrders: Array<{ workOrderId: string; orderNo: string }>,
): void {
  const platformIdentities = platformOrders.map((order) => [order.workOrderId || '', order.orderNo] as [string, string])
  const factoryIdentities = factoryOrders.map((order) => [order.workOrderId, order.orderNo] as [string, string])
  const platformIds = new Set(platformIdentities.map(([workOrderId]) => workOrderId))
  const factoryIds = new Set(factoryIdentities.map(([workOrderId]) => workOrderId))
  const platformNos = platformIdentities.map(([, orderNo]) => orderNo)
  const factoryNos = factoryIdentities.map(([, orderNo]) => orderNo)

  assert.equal(platformIds.size, platformIdentities.length, '工厂端只能使用平台加工单 ID 和加工单号')
  assert.equal(factoryIds.size, factoryIdentities.length, '工厂端只能使用平台加工单 ID 和加工单号')
  assert.equal(new Set(platformNos).size, platformNos.length, '工厂端只能使用平台加工单 ID 和加工单号')
  assert.equal(new Set(factoryNos).size, factoryNos.length, '工厂端只能使用平台加工单 ID 和加工单号')
  factoryIdentities.forEach(([workOrderId]) => {
    assert(platformIds.has(workOrderId), '工厂端只能使用平台加工单 ID 和加工单号')
  })
  assert.deepEqual(
    sortIdentities(platformIdentities),
    sortIdentities(factoryIdentities),
    '工厂端只能使用平台加工单 ID 和加工单号',
  )
}

function assertCanonicalIdentity(
  platformOrders: Array<{ workOrderId?: string; orderNo: string }>,
  unifiedOrders: Array<{ workOrderId: string; workOrderNo: string }>,
  factoryOrders: Array<{ workOrderId: string; orderNo: string; taskId: string }>,
  getById: (workOrderId: string) => { workOrderId: string; orderNo: string; taskId: string } | undefined,
  getByTaskId: (taskId: string) => { workOrderId: string; orderNo: string; taskId: string } | undefined,
): void {
  const canonicalOrders = factoryOrders.map(({ workOrderId }) => {
    const canonical = getById(workOrderId)
    assert(canonical, `${workOrderId} 缺少 canonical 加工单`)
    return canonical
  })
  const canonicalIdentities = canonicalOrders.map(({ workOrderId, orderNo }) => [workOrderId, orderNo] as [string, string])
  const taskIds = factoryOrders.map((order) => order.taskId)
  const registeredPdaTaskIds = new Set(listPdaGenericProcessTasks().map((task) => task.taskId))
  assert.equal(new Set(canonicalIdentities.map(([workOrderId]) => workOrderId)).size, canonicalIdentities.length, 'canonical 加工单 ID 必须一对一')
  assert.equal(new Set(canonicalIdentities.map(([, orderNo]) => orderNo)).size, canonicalIdentities.length, 'canonical 加工单号必须一对一')
  assert.equal(factoryOrders.length, canonicalOrders.length, '公开加工单集合不得扩展 canonical 集合')
  assert.equal(new Set(taskIds).size, taskIds.length, '公开加工单与 PDA 任务必须一对一绑定')
  taskIds.forEach((taskId) => assert(registeredPdaTaskIds.has(taskId), `${taskId} 未注册为 PDA 任务`))
  assert.deepEqual(
    sortIdentities(unifiedOrders.map((order) => [order.workOrderId, order.workOrderNo])),
    sortIdentities(canonicalIdentities),
    '工厂端只能使用平台加工单 ID 和加工单号',
  )
  assert.deepEqual(
    sortIdentities(platformOrders.map((order) => [order.workOrderId || '', order.orderNo])),
    sortIdentities(canonicalIdentities),
    '工厂端只能使用平台加工单 ID 和加工单号',
  )
  assert.deepEqual(
    sortIdentities(factoryOrders.map((order) => [order.workOrderId, order.orderNo])),
    sortIdentities(canonicalIdentities),
    '公开加工单集合不得改写或扩展 canonical 加工单身份',
  )
  factoryOrders.forEach((order) => {
    const pdaBound = getByTaskId(order.taskId)
    assert.deepEqual(
      pdaBound && [pdaBound.workOrderId, pdaBound.orderNo],
      [order.workOrderId, order.orderNo],
      'PDA 任务必须反查原平台加工单 ID 和加工单号',
    )
  })
}

assertWorkOrderIdentity(
  platformPrintOrders,
  printWorkOrders.map((order) => ({ workOrderId: order.printOrderId, orderNo: order.printOrderNo })),
)
assertCanonicalIdentity(
  platformPrintOrders,
  unifiedPrintOrders,
  printWorkOrders.map((order) => ({ workOrderId: order.printOrderId, orderNo: order.printOrderNo, taskId: order.taskId })),
  (workOrderId) => {
    const order = getPrintWorkOrderById(workOrderId)
    return order && { workOrderId: order.printOrderId, orderNo: order.printOrderNo, taskId: order.taskId }
  },
  (taskId) => {
    const order = getPrintWorkOrderByTaskId(taskId)
    return order && { workOrderId: order.printOrderId, orderNo: order.printOrderNo, taskId: order.taskId }
  },
)
assertCanonicalIdentity(
  platformDyeOrders,
  unifiedDyeOrders,
  dyeWorkOrders.map((order) => ({ workOrderId: order.dyeOrderId, orderNo: order.dyeOrderNo, taskId: order.taskId })),
  (workOrderId) => {
    const order = getDyeWorkOrderById(workOrderId)
    return order && { workOrderId: order.dyeOrderId, orderNo: order.dyeOrderNo, taskId: order.taskId }
  },
  (taskId) => {
    const order = getDyeWorkOrderByTaskId(taskId)
    return order && { workOrderId: order.dyeOrderId, orderNo: order.dyeOrderNo, taskId: order.taskId }
  },
)
assert.deepEqual(
  sortIdentities(printWorkOrders.map((order) => {
    const canonical = getPrintWorkOrderById(order.printOrderId)
    assert(canonical, `${order.printOrderId} 缺少 canonical 印花加工单`)
    return [canonical.printOrderId, canonical.printOrderNo]
  })),
  sortIdentities(EXPECTED_PRINT_CANONICAL_IDENTITIES),
  '印花 canonical getter 必须返回 raw store 的既有加工单身份',
)
assert.deepEqual(
  sortIdentities(dyeWorkOrders.map((order) => {
    const canonical = getDyeWorkOrderById(order.dyeOrderId)
    assert(canonical, `${order.dyeOrderId} 缺少 canonical 染色加工单`)
    return [canonical.dyeOrderId, canonical.dyeOrderNo]
  })),
  sortIdentities(EXPECTED_DYE_CANONICAL_IDENTITIES),
  '染色 canonical getter 必须返回 raw store 的既有加工单身份',
)
assertWorkOrderIdentity(
  platformDyeOrders,
  dyeWorkOrders.map((order) => ({ workOrderId: order.dyeOrderId, orderNo: order.dyeOrderNo })),
)

const dyeingTasks = listPdaGenericProcessTasks().filter((task) => task.mockProcessKey === 'DYEING')
;[
  ['DYE-COMBINED-DEMO-001', 'RSJG-202607-901'],
  ['DYE-COMBINED-DEMO-002', 'RSJG-202607-902'],
].forEach(([workOrderId, workOrderNo]) => {
  const platformOrder = platformDyeOrders.find((order) => order.workOrderId === workOrderId)
  const factoryOrder = unifiedDyeOrders.find((order) => order.workOrderId === workOrderId)
  const canonicalOrder = getDyeWorkOrderById(workOrderId)
  assert(platformOrder, `${workOrderNo} 缺少平台端加工单`)
  assert(factoryOrder, `${workOrderNo} 缺少工厂端加工单`)
  assert(canonicalOrder, `${workOrderNo} 缺少 canonical 染色加工单`)
  assert.deepEqual(
    [platformOrder.workOrderId, platformOrder.orderNo],
    [factoryOrder.workOrderId, factoryOrder.workOrderNo],
    `${workOrderNo} 平台端与工厂端必须共用加工单 ID/编号`,
  )
  assert.deepEqual(
    [canonicalOrder.dyeOrderId, canonicalOrder.dyeOrderNo],
    [workOrderId, workOrderNo],
    `${workOrderNo} canonical 染色加工单身份不得改号`,
  )
  const pdaTask = dyeingTasks.find((task) => task.taskId === canonicalOrder.taskId)
  assert(pdaTask, `${workOrderNo} 缺少对应 PDA 染色任务`)
  const pdaCanonicalOrder = getDyeWorkOrderByTaskId(pdaTask.taskId)
  assert.deepEqual(
    [pdaCanonicalOrder?.dyeOrderId, pdaCanonicalOrder?.dyeOrderNo],
    [workOrderId, workOrderNo],
    `${workOrderNo} PDA 必须反查到同一平台加工单 ID/编号`,
  )
})

const printingTasks = listPdaGenericProcessTasks().filter((task) => task.mockProcessKey === 'PRINTING')
const transferringPrintOrder = printWorkOrders.find((order) => order.sourceType === 'PRODUCTION_ORDER')
const transferringPrintTask = printingTasks.find((task) => task.taskId === transferringPrintOrder?.taskId)
assert(transferringPrintOrder, '缺少生产单来源印花加工单')
assert(transferringPrintTask, `${transferringPrintOrder.taskId} 未注册为 PDA 任务`)
assert(transferringPrintOrder.sourceProductionOrderId, `${transferringPrintOrder.taskId} 来源生产单必须唯一`)
assert.deepEqual(
  [transferringPrintTask.productionOrderId, transferringPrintTask.productionOrderNo],
  [transferringPrintOrder.sourceProductionOrderId, transferringPrintOrder.sourceProductionOrderNo],
  'PDA task 的 productionOrderId/no 必须与加工单 source production order 成对一致',
)

const publicPrintingTasks = printWorkOrders.map((order) => {
  const task = printingTasks.find((item) => item.taskId === order.taskId)
  assert(task, `${order.taskId} 未注册为印花 PDA 任务`)
  return task
})
assert.equal(new Set(publicPrintingTasks.map((task) => task.taskNo)).size, publicPrintingTasks.length, '印花 PDA taskNo 不得跨任务复用')
assert.equal(new Set(publicPrintingTasks.map((task) => task.taskQrValue)).size, publicPrintingTasks.length, '印花 PDA 二维码身份不得跨任务复用')
const auditLogIds = publicPrintingTasks.flatMap((task) => task.auditLogs.map((log) => log.id))
assert.equal(new Set(auditLogIds).size, auditLogIds.length, '印花 PDA 任务审计日志 ID 不得跨任务复用')
const printNodeRecords = printWorkOrders.flatMap((order) => listPrintExecutionNodeRecords(order.printOrderId))
assert.equal(
  new Set(printNodeRecords.map((record) => record.nodeRecordId)).size,
  printNodeRecords.length,
  '印花执行节点 ID 不得跨任务复用',
)
printNodeRecords.forEach((record) => {
  const order = printWorkOrders.find((item) => item.printOrderId === record.printOrderId)
  assert.equal(record.taskId, order?.taskId, '印花执行节点必须绑定当前加工单的独立任务身份')
})

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

const printSummary = getPrintWorkOrderSummary()
const printCompletedCount = printWorkOrders.filter((order) => ['FULL_HANDOVER', 'COMPLETED'].includes(order.status)).length
const printRejectedCount = printWorkOrders.filter((order) => ['HANDOVER_DIFFERENCE', 'REJECTED'].includes(order.status)).length
assert.equal(printSummary.fullHandoverCount, printCompletedCount, '印花终态列表数量必须与汇总一致')
assert.equal(printSummary.handoverDifferenceCount, printRejectedCount, '印花驳回列表数量必须与汇总一致')
assert(
  (listPrintingDashboardBuckets().find((bucket) => bucket.key === 'abnormal')?.count || 0) >= printRejectedCount,
  '印花看板必须统计已驳回加工单',
)

const dyeSummary = getDyeWorkOrderSummary()
const dyeCompletedCount = dyeWorkOrders.filter((order) => ['FULL_HANDOVER', 'COMPLETED'].includes(order.status)).length
const dyeRejectedCount = dyeWorkOrders.filter((order) => ['HANDOVER_DIFFERENCE', 'REJECTED'].includes(order.status)).length
assert.equal(dyeSummary.fullHandoverCount, dyeCompletedCount, '染色终态列表数量必须与汇总一致')
assert.equal(dyeSummary.handoverDifferenceCount, dyeRejectedCount, '染色驳回列表数量必须与汇总一致')
listDyeReportRows()
  .filter((row) => dyeWorkOrders.some((order) => order.dyeOrderId === row.dyeOrderId && order.status === 'COMPLETED'))
  .forEach((row) => assert(row.finishedAt, `${row.dyeOrderNo} 已完成但染色报表缺少完成时间`))

;[...unifiedPrintOrders, ...unifiedDyeOrders].forEach((order) => {
  if (order.sourceType === 'PRODUCTION_ORDER') {
    assert(Boolean(order.sourceProductionOrderId), `${order.workOrderNo} 生产单来源必须有唯一 sourceProductionOrderId`)
    assert(Boolean(order.sourceProductionOrderNo), `${order.workOrderNo} 生产单来源必须保留生产单号`)
    assert(Boolean(order.productionOrderOrderedAt), `${order.workOrderNo} 生产单来源必须保留下单时间`)
    assert(!order.stockMaterialId, `${order.workOrderNo} 生产单来源不得携带 stockMaterialId`)
  } else {
    assert.equal(order.sourceType, 'STOCK', `${order.workOrderNo} 来源类型只能是生产单或备货`)
    assert(Boolean(order.stockMaterialId && order.stockMaterialName), `${order.workOrderNo} 备货来源必须保留物料快照`)
    assert(!order.sourceProductionOrderId, `${order.workOrderNo} 备货来源不得伪造生产单`)
  }
  if (order.factoryId) {
    assert(Boolean(order.factoryName && order.factoryName !== '待分配工厂'), `${order.workOrderNo} 已分配工厂但缺少工厂名称`)
  } else {
    assert.equal(order.factoryName, '待分配工厂', `${order.workOrderNo} 未分配工厂必须明确展示待分配工厂`)
  }
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
;['renderDyeWorkOrderOverlay', "renderSecondaryButton('查看'", "renderPrimaryButton('编辑'", "renderSecondaryButton('日志'", "renderSecondaryButton('打印流程卡'"]
  .forEach((token) => assertIncludes(pfosDyeSource, token, '工厂端染色列表内操作'))
assertNotIncludes(pfosDyeSource, 'buildDyeingWorkOrderDetailLink(order.dyeOrderId)', '工厂端染色列表')
assertNotIncludes(pfosPrintSource, '/fcs/pda/exec', '工厂端印花加工单列表')
assertNotIncludes(pfosDyeSource, '/fcs/pda/exec', '工厂端染色加工单列表')
assertNotIncludes(pfosPrintSource, '/fcs/pda/handover', '工厂端印花加工单列表')
assertNotIncludes(pfosDyeSource, '/fcs/pda/handover', '工厂端染色加工单列表')

;[
  '基本信息',
  '花型与调色',
  '打印转印',
  '交出记录',
  '收货确认',
  '执行进度',
  '异常与结算',
  '打开移动端执行页',
  '打开移动端交出页',
].forEach((token) => assertIncludes(printDetailSource, token, '印花 Web 详情页'))

assertIncludes(routesSource, '^\\/fcs\\/craft\\/printing\\/work-orders\\/([^/]+)$', '印花 Web 详情路由')
assertIncludes(routesSource, '^\\/fcs\\/craft\\/dyeing\\/work-orders\\/([^/]+)$', '染色 Web 详情路由')
assert(routes.dynamicRoutes.some((route) => String(route.pattern).includes('printing\\/work-orders')), '印花动态详情路由不可达')
assert(routes.dynamicRoutes.some((route) => String(route.pattern).includes('dyeing\\/work-orders')), '染色动态详情路由不可达')
assertIncludes(routesSource, '`/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeURIComponent(decodeURIComponent(match[1]))}`', '染色旧详情路由必须兼容跳转到列表查看弹窗')
assertIncludes(routesSource, "renderRouteRedirect('/fcs/craft/printing/work-orders?tab=progress'", '印花进度兼容跳转')
assertIncludes(routesSource, "renderRouteRedirect('/fcs/craft/dyeing/work-orders?tab=formula'", '染色配方兼容跳转')

const menuTitles = flattenMenuTitles('pfos')
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
