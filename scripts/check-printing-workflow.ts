import fs from 'node:fs'
import path from 'node:path'
import {
  createPrintWorkOrderFromStock,
  getPrintExecutionNodeRecord,
  getPrintOrderHandoverHead,
  getPrintOrderHandoverRecords,
  getPrintOrderHandoverSummary,
  getPrintReviewRecordByOrderId,
  getPrintWorkOrderByTaskId,
  getPrintWorkOrderStatusLabel,
  hasDirectTransferToReviewTransition,
  listPrintMachineOptions,
  listPrintWorkOrders,
} from '../src/data/fcs/printing-task-domain.ts'
import { getMobileExecutionTaskById } from '../src/data/fcs/mobile-execution-task-index.ts'
import { submitPrintHandover } from '../src/data/fcs/process-execution-writeback.ts'
import { applyPrintWarehouseLinkageAfterAction } from '../src/data/fcs/process-warehouse-linkage-service.ts'
import { getProcessWarehouseRecordById, listProcessHandoverRecords } from '../src/data/fcs/process-warehouse-domain.ts'
import {
  getPdaHandoverRecordsByHead,
  getPdaHandoverSourceDisplay,
  ensureHandoverOrderForStartedTask,
  listHandoverOrdersByTaskId,
} from '../src/data/fcs/pda-handover-events.ts'
import {
  buildFactoryPendingWaitHandoverStockItem,
  buildFactoryWaitHandoverStockItemFromOutboundRecord,
  buildOutboundRecordFromHandoverRecord,
  listFactoryInternalWarehouseFactoryOptions,
  listFactoryInternalWarehouses,
  listFactoryWaitHandoverStockItems,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import { listProcessWorkOrderStockMaterials } from '../src/data/fcs/process-work-order-stock.ts'
import { buildTaskRouteCardPrintDoc } from '../src/data/fcs/task-print-cards.ts'
import { getProcessWorkOrderById } from '../src/data/fcs/process-work-order-domain.ts'
import {
  assertProcessQuantityDimensions,
  groupProcessWorkOrderPlannedQuantities,
} from '../src/data/fcs/process-statistics-domain.ts'
import {
  confirmSupplementAndGenerateProcessWorkOrders,
  listSupplementRecords,
} from '../src/pages/process-factory/cutting/supplement-management.ts'
import { renderProcessPrintOrdersPage } from '../src/pages/process-print-orders.ts'
import { renderCraftPrintingWorkOrdersPage } from '../src/pages/process-factory/printing/work-orders.ts'
import { renderCraftPrintingWorkOrderDetailPage } from '../src/pages/process-factory/printing/work-order-detail.ts'
import { renderPdaHandoverDetailPage } from '../src/pages/pda-handover-detail.ts'

function fail(message: string): never {
  throw new Error(`[check-printing-workflow] ${message}`)
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message)
}

const pageFiles = [
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/printing/warehouse.ts',
  'src/pages/process-factory/printing/progress.ts',
  'src/pages/process-factory/printing/pending-review.ts',
  'src/pages/process-factory/printing/statistics.ts',
  'src/pages/process-factory/printing/dashboards.ts',
]

const pageSources = pageFiles.map((file) => ({ file, source: readFile(file) }))
const appShellSource = readFile('src/data/app-shell-config.ts')
const workOrdersPageSource = readFile('src/pages/process-factory/printing/work-orders.ts')
const workOrderDetailPageSource = readFile('src/pages/process-factory/printing/work-order-detail.ts')
const processWorkOrderDomainSource = readFile('src/data/fcs/process-work-order-domain.ts')
const taskPrintCardsSource = readFile('src/data/fcs/task-print-cards.ts')
const processPrepAdapterSource = readFile('src/data/fcs/page-adapters/process-prep-pages-adapter.ts')
const printingEventsSource = readFile('src/pages/process-factory/printing/events.ts')
const platformOrdersPageSource = readFile('src/pages/process-print-orders.ts')
const warehousePageSource = readFile('src/pages/process-factory/printing/warehouse.ts')
const routesSource = readFile('src/router/routes-fcs.ts')
const oldTemplateToken = ['renderProcessFactory', 'Scaf', 'foldPage'].join('')
const oldPrintTerms = [
  ['印花', 'PDA'].join(''),
  ['印花 ', 'PDA'].join(''),
  ['Printing', ' PDA'].join(''),
  ['PDA', '印花'].join(''),
]

pageSources.forEach(({ file, source }) => {
  assert(!source.includes(oldTemplateToken), `${file} 仍在引用旧页面模板`)
  assert(!source.includes('骨' + '架页'), `${file} 仍含旧页面描述`)
  assert(!source.includes('仅展' + '示'), `${file} 仍含旧页面描述`)
  assert(!source.includes('敬请' + '期待'), `${file} 仍含旧页面描述`)
  oldPrintTerms.forEach((term) => {
    assert(!source.includes(term), `${file} 出现禁用文案：${term}`)
  })
})

const taskDetailSource = readFile('src/pages/pda-exec-detail.ts')
assert(workOrdersPageSource.includes('打印任务流转卡'), '印花加工单页缺少打印任务流转卡入口')
assert(
  workOrdersPageSource.includes("buildTaskRouteCardPrintLink('PRINTING_WORK_ORDER', order.printOrderId)"),
  '印花加工单页打印任务流转卡必须使用 PRINTING_WORK_ORDER + printOrderId',
)
assert(!workOrdersPageSource.includes('打印任务交货卡'), '印花加工单页不得提前增加打印任务交货卡入口')
assert(appShellSource.includes('印花待加工仓'), '印花厂管理菜单缺少印花待加工仓')
assert(appShellSource.includes('印花待交出仓'), '印花厂管理菜单缺少印花待交出仓')
assert(warehousePageSource.includes('renderCraftPrintingWaitHandoverWarehousePage'), '印花缺少待交出仓页面')
assert(warehousePageSource.includes('出库记录'), '印花待交出仓页缺少出库记录')
assert(warehousePageSource.includes('打印任务交货卡'), '印花待交出仓出库记录缺少打印任务交货卡')
assert(warehousePageSource.includes('buildTaskDeliveryCardPrintLink(item.handoverRecordId)'), '印花任务交货卡必须按 handoverRecordId 打印')
assert(
  routesSource.includes("renderRouteRedirect('/fcs/craft/printing/wait-process-warehouse', '正在跳转到印花待加工仓')"),
  '印花旧仓库入口必须重定向到印花待加工仓',
)
assert(taskDetailSource.includes('印花任务'), '任务详情页缺少印花任务区块')
assert(taskDetailSource.includes('打印机编号'), '任务详情页缺少打印机编号字段')
assert(taskDetailSource.includes('原料使用'), '任务详情页缺少原料使用字段')
assert(taskDetailSource.includes('实际完成'), '任务详情页缺少实际完成字段')
assert(taskDetailSource.includes('待送货'), '任务详情页缺少待送货状态')
oldPrintTerms.forEach((term) => {
  assert(!taskDetailSource.includes(term), `任务详情页出现禁用文案：${term}`)
})

const statisticsSource = readFile('src/pages/process-factory/printing/statistics.ts')
assert(statisticsSource.includes('打印机编号'), '统计页缺少打印机编号')
assert(statisticsSource.includes('打印速度'), '统计页缺少打印速度')
assert(statisticsSource.includes('待送货'), '统计页缺少待送货指标')
assert(statisticsSource.includes('待回写'), '统计页缺少待回写指标')
assert(statisticsSource.includes('待审核'), '统计页缺少待审核指标')
assert(!statisticsSource.includes('需求单印花数量'), '统计页不得保留需求单印花数量口径')
assert(statisticsSource.includes('加工计划数量'), '统计页必须展示真实加工计划数量口径')
assert(statisticsSource.includes('plannedQuantityGroups'), '统计页必须按作用对象和单位展示加工计划数量')
assert(!statisticsSource.includes('plannedPrintFabricMeters'), '统计页不得将不同作用对象和单位汇总为固定米数')

const plannedQuantityGroups = groupProcessWorkOrderPlannedQuantities([
  { objectType: '面料', plannedUnit: '米', plannedQty: 120 },
  { objectType: '裁片', plannedUnit: '片', plannedQty: 80 },
  { objectType: '成衣', plannedUnit: '件', plannedQty: 30 },
])
assert(
  JSON.stringify(plannedQuantityGroups) === JSON.stringify([
    { objectType: '面料', plannedUnit: '米', plannedQty: 120 },
    { objectType: '裁片', plannedUnit: '片', plannedQty: 80 },
    { objectType: '成衣', plannedUnit: '件', plannedQty: 30 },
  ]),
  '加工计划数量必须按面料/裁片/成衣及其单位分组，禁止跨对象或跨单位相加',
)
const sameObjectDifferentUnitGroups = groupProcessWorkOrderPlannedQuantities([
  { objectType: '面料', plannedUnit: '米', plannedQty: 120 },
  { objectType: '面料', plannedUnit: 'Yard', plannedQty: 100 },
])
assert(sameObjectDifferentUnitGroups.length === 2, '同一对象的不同单位必须分组，禁止相加')
let blankQuantityGroupError = ''
try {
  groupProcessWorkOrderPlannedQuantities([{ objectType: '', plannedUnit: '', plannedQty: 1 }])
} catch (error) {
  blankQuantityGroupError = error instanceof Error ? error.message : String(error)
}
assert(blankQuantityGroupError.includes('对象') && blankQuantityGroupError.includes('单位'), '空对象或单位必须拒绝并提供可追踪错误信息')
let blankFactoryMetricError = ''
try {
  assertProcessQuantityDimensions('', '', '工厂统计')
} catch (error) {
  blankFactoryMetricError = error instanceof Error ? error.message : String(error)
}
assert(blankFactoryMetricError.includes('工厂统计') && blankFactoryMetricError.includes('对象') && blankFactoryMetricError.includes('单位'), '工厂统计必须复用严格对象和单位校验')

const dashboardSource = readFile('src/pages/process-factory/printing/dashboards.ts')
assert(dashboardSource.includes('待送货'), '大屏缺少待送货模块')
assert(dashboardSource.includes('待回写'), '大屏缺少待回写模块')
assert(dashboardSource.includes('待审核'), '大屏缺少待审核模块')
assert(!dashboardSource.includes('需求单印花数量'), '大屏不得保留需求单印花数量口径')
assert(dashboardSource.includes('加工计划数量'), '大屏必须展示真实加工计划数量口径')

assert(!workOrderDetailPageSource.includes('需求单印花数量'), '印花加工单详情不得保留需求单印花数量口径')
assert(workOrderDetailPageSource.includes('加工计划数量'), '印花加工单详情必须展示真实加工计划数量口径')

const reviewSource = readFile('src/pages/process-factory/printing/pending-review.ts')
assert(reviewSource.includes('接收方'), '审核页缺少接收方字段')
assert(reviewSource.includes('审核通过'), '审核页缺少审核通过入口')
assert(reviewSource.includes('审核驳回'), '审核页缺少审核驳回入口')

const progressSource = readFile('src/pages/process-factory/printing/progress.ts')
assert(progressSource.includes('待送货'), '进度页缺少待送货节点')
assert(progressSource.includes('接收方回写'), '进度页缺少接收方回写节点')
assert(progressSource.includes('审核'), '进度页缺少审核节点')

const { listPdaGenericProcessTasks, registerPdaGenericProcessTask } = await import(`../src/data/fcs/pda-task-${'mo'}${'ck'}-factory.ts`)
const orders = listPrintWorkOrders()
const tasks = listPdaGenericProcessTasks()
assert(orders.length > 0, '未生成印花加工单数据')
assert(orders.some((order) => getPrintWorkOrderStatusLabel(order.status) === '待送货'), '印花状态缺少待送货')
assert(!hasDirectTransferToReviewTransition(), '仍存在转印完成直达审核的链路')

const supplementSeed = listSupplementRecords().find((record) =>
  record.draft.sourceType === 'cut-order'
  && record.draft.materialDemands.some((item) => item.printRequired && item.dyeRequired),
)
assert(supplementSeed, '缺少真实印染补料场景')
const supplementDraft = structuredClone(supplementSeed.draft)
supplementDraft.confirmationIdentity = 'task9-print-source-display'
const supplementResult = confirmSupplementAndGenerateProcessWorkOrders(supplementDraft, '任务9来源检查')
assert(supplementResult.ok, '真实补料确认必须成功')
if (!supplementResult.ok) fail(supplementResult.message)
const supplementPrintRef = supplementResult.record.processWorkOrderRefs.find((item) => item.processType === 'PRINT')
assert(supplementPrintRef, '真实补料必须生成印花加工单')
const productionPrintOrder = listPrintWorkOrders().find((order) => order.sourceType === 'PRODUCTION_ORDER')
assert(productionPrintOrder, '缺少生产单来源印花加工单')
const supplementPlatformHtml = renderProcessPrintOrdersPage({ sourceType: 'CUT_PIECE_SUPPLEMENT', selectedWorkOrderId: supplementPrintRef.workOrderId })
assert(supplementPlatformHtml.includes(supplementPrintRef.workOrderNo), '平台印花页未展示真实补料加工单')
assert(!supplementPlatformHtml.includes(productionPrintOrder.printOrderNo), '平台印花来源筛选混入生产单来源')
const supplementFactoryHtml = renderCraftPrintingWorkOrdersPage({ sourceType: 'CUT_PIECE_SUPPLEMENT' })
assert(supplementFactoryHtml.includes(supplementPrintRef.workOrderNo), '工厂印花列表未展示真实补料加工单')
assert(!supplementFactoryHtml.includes(productionPrintOrder.printOrderNo), '工厂印花来源筛选混入生产单来源')
const supplementPrintDetail = renderCraftPrintingWorkOrderDetailPage(supplementPrintRef.workOrderId)
const supplementPrintOrder = getProcessWorkOrderById(supplementPrintRef.workOrderId)
assert(supplementPrintOrder, '未找到真实补料印花加工单')
for (const expected of [
  '裁片补料生成',
  supplementResult.record.recordNo,
  supplementDraft.sourceNo,
  supplementDraft.productionOrderNo,
  supplementPrintOrder.sourceSnapshot.techPackVersionLabel,
]) {
  assert(Boolean(expected) && supplementPrintDetail.includes(String(expected)), `真实补料印花详情缺少：${expected || '空值'}`)
  assert(Boolean(expected) && supplementPlatformHtml.includes(String(expected)), `平台补料印花详情缺少：${expected || '空值'}`)
}
assert(supplementPlatformHtml.includes(`物料编码：</span>${supplementPrintOrder.materialSku}`), '平台补料印花详情必须展示冻结物料编码')
assert(supplementPlatformHtml.includes(`物料名称：</span>${supplementPrintOrder.materialName}`), '平台补料印花详情必须展示冻结物料名称')
assert(supplementPlatformHtml.includes(`BOM 行标识：</span>${supplementPrintOrder.sourceSnapshot.bomItemId}`), '平台补料印花详情必须将 BOM 行标识独立展示')
const supplementRouteCard = buildTaskRouteCardPrintDoc({ sourceType: 'PRINTING_WORK_ORDER', sourceId: supplementPrintRef.workOrderId })
assert(supplementRouteCard.summaryRows.some((row) => row.label === '加工单来源' && row.value === '裁片补料生成'), '补料印花流转卡来源错误')
assert(supplementRouteCard.summaryRows.some((row) => row.label === '补料单' && row.value === supplementResult.record.recordNo), '补料印花流转卡缺少补料单')
const supplementPrintTask = listPdaGenericProcessTasks().find((task) => task.taskId === supplementPrintOrder.taskId)
assert(supplementPrintTask, '补料印花加工单缺少 PDA 任务')
registerPdaGenericProcessTask({ ...supplementPrintTask, status: 'IN_PROGRESS', startedAt: '2026-07-23 09:00:00' })
const supplementHandover = ensureHandoverOrderForStartedTask(supplementPrintTask.taskId)
const supplementPdaHtml = renderPdaHandoverDetailPage(supplementHandover.handoverOrderId)
assert(supplementPdaHtml.includes('裁片补料生成'), '补料印花 PDA 缺少统一来源标签')
assert(supplementPdaHtml.includes('补料单'), '补料印花 PDA 缺少对象标签')
assert(supplementPdaHtml.includes(supplementResult.record.recordNo), '补料印花 PDA 缺少补料单号')

const productionPlatformHtml = renderProcessPrintOrdersPage({ sourceType: 'PRODUCTION_ORDER' })
const productionFactoryHtml = renderCraftPrintingWorkOrdersPage({ sourceType: 'PRODUCTION_ORDER' })
assert(productionPlatformHtml.includes(productionPrintOrder.printOrderNo) && productionFactoryHtml.includes(productionPrintOrder.printOrderNo), '生产单来源印花筛选未命中真实加工单')
assert(!productionPlatformHtml.includes(supplementPrintRef.workOrderNo) && !productionFactoryHtml.includes(supplementPrintRef.workOrderNo), '生产单来源印花筛选混入补料加工单')

const runtimeDyeLockTerms = [
  ['前置染色', '未完成'].join(''),
  ['前置染色', '加工单'].join(''),
  ['染色完成后', '自动解锁印花'].join(''),
  ['解锁', '印花'].join(''),
]
for (const disallowed of runtimeDyeLockTerms) {
  assert(![workOrdersPageSource, workOrderDetailPageSource, taskPrintCardsSource, processPrepAdapterSource].some((source) => source.includes(disallowed)), `印花展示层不得包含运行时锁定逻辑：${disallowed}`)
}

const migratedStockOrders = orders.filter((order) => order.sourceType === 'STOCK')
const waitHandoverStockItems = listFactoryWaitHandoverStockItems()
const expectedStockHandoverCounts = new Map<string, { heads: number; records: number; warehouseItems: number }>([
  ['PH-20260328-007', { heads: 1, records: 1, warehouseItems: 2 }],
  ['PH-20260329-008', { heads: 1, records: 1, warehouseItems: 2 }],
  ['PH-20260329-009', { heads: 0, records: 0, warehouseItems: 0 }],
  ['PH-20260329-010', { heads: 1, records: 1, warehouseItems: 1 }],
  ['PH-20260329-011', { heads: 0, records: 0, warehouseItems: 0 }],
  ['PH-20260329-012', { heads: 0, records: 0, warehouseItems: 0 }],
])
assert(migratedStockOrders.length === 6, `旧印花备货 Mock 应迁移 6 条，实际 ${migratedStockOrders.length} 条`)
migratedStockOrders.forEach((order) => {
  const sourceLabel = `${order.printOrderNo} 旧备货来源`
  assert(Boolean(order.stockMaterialId), `${sourceLabel}加工单缺少 stockMaterialId`)
  assert(Boolean(order.stockMaterialName), `${sourceLabel}加工单缺少 stockMaterialName`)
  assert(order.sourceProductionOrderId === undefined, `${sourceLabel}加工单仍携带伪生产单 ID`)
  assert(order.sourceProductionOrderNo === undefined, `${sourceLabel}加工单仍携带伪生产单号`)
  assert(order.productionOrderOrderedAt === undefined, `${sourceLabel}加工单仍携带伪生产单下单时间`)
  assert(order.productionOrderIds.length === 0, `${sourceLabel}加工单仍携带伪生产单集合`)

  const task = tasks.find((item) => item.taskId === order.taskId)
  assert(task?.sourceType === 'STOCK', `${sourceLabel} PDA 任务来源必须为 STOCK`)
  assert(task?.stockMaterialId === order.stockMaterialId, `${sourceLabel} PDA 任务 stockMaterialId 不一致`)
  assert(task?.stockMaterialName === order.stockMaterialName, `${sourceLabel} PDA 任务 stockMaterialName 不一致`)
  assert(task?.productionOrderId === undefined, `${sourceLabel} PDA 任务仍携带伪生产单 ID`)
  assert(task?.productionOrderNo === undefined, `${sourceLabel} PDA 任务仍携带伪生产单号`)
  assert(task?.sourceProductionOrderId === undefined, `${sourceLabel} PDA 任务仍携带伪来源生产单 ID`)

  const mobileTask = getMobileExecutionTaskById(order.taskId)
  assert(mobileTask?.sourceType === 'STOCK', `${sourceLabel}移动索引来源必须为 STOCK`)
  assert(mobileTask?.stockMaterialId === order.stockMaterialId, `${sourceLabel}移动索引 stockMaterialId 不一致`)
  assert(mobileTask?.stockMaterialName === order.stockMaterialName, `${sourceLabel}移动索引 stockMaterialName 不一致`)
  assert(mobileTask?.productionOrderId === undefined, `${sourceLabel}移动索引仍携带伪生产单 ID`)
  assert(mobileTask?.productionOrderNo === undefined, `${sourceLabel}移动索引仍携带伪生产单号`)

  const heads = listHandoverOrdersByTaskId(order.taskId)
  const expectedHandover = expectedStockHandoverCounts.get(order.printOrderNo)
  assert(Boolean(expectedHandover), `${sourceLabel}缺少交出事实数量预期`)
  assert(heads.length === expectedHandover!.heads, `${sourceLabel}交出单数量应为 ${expectedHandover!.heads}，实际 ${heads.length}`)
  const records = heads.flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId))
  assert(records.length === expectedHandover!.records, `${sourceLabel}交出记录数量应为 ${expectedHandover!.records}，实际 ${records.length}`)
  heads.forEach((head) => {
    assert(head.sourceType === 'STOCK', `${sourceLabel}交出单来源必须为 STOCK`)
    assert(head.stockMaterialId === order.stockMaterialId, `${sourceLabel}交出单 stockMaterialId 不一致`)
    assert(head.stockMaterialName === order.stockMaterialName, `${sourceLabel}交出单 stockMaterialName 不一致`)
    assert(head.productionOrderId === undefined, `${sourceLabel}交出单仍携带伪生产单 ID`)
    assert(head.productionOrderNo === undefined, `${sourceLabel}交出单仍携带伪生产单号`)
    getPdaHandoverRecordsByHead(head.handoverId).forEach((record) => {
      assert(record.sourceType === 'STOCK', `${sourceLabel}交出记录来源必须为 STOCK`)
      assert(record.stockMaterialId === order.stockMaterialId, `${sourceLabel}交出记录 stockMaterialId 不一致`)
      assert(record.stockMaterialName === order.stockMaterialName, `${sourceLabel}交出记录 stockMaterialName 不一致`)
      assert(record.productionOrderId === undefined, `${sourceLabel}交出记录仍携带伪生产单 ID`)
      assert(record.productionOrderNo === undefined, `${sourceLabel}交出记录仍携带伪生产单号`)
    })
  })

  const warehouseItems = waitHandoverStockItems.filter((item) => item.taskId === order.taskId)
  assert(
    warehouseItems.length === expectedHandover!.warehouseItems,
    `${sourceLabel}待交出仓条目数量应为 ${expectedHandover!.warehouseItems}，实际 ${warehouseItems.length}`,
  )
  warehouseItems.forEach((item) => {
    assert(item.sourceType === 'STOCK', `${sourceLabel}待交出仓来源必须为 STOCK`)
    assert(item.stockMaterialId === order.stockMaterialId, `${sourceLabel}待交出仓 stockMaterialId 不一致`)
    assert(item.stockMaterialName === order.stockMaterialName, `${sourceLabel}待交出仓 stockMaterialName 不一致`)
    assert(item.productionOrderId === undefined, `${sourceLabel}待交出仓仍携带伪生产单 ID`)
    assert(item.productionOrderNo === undefined, `${sourceLabel}待交出仓仍携带伪生产单号`)
  })
})

const seedSourceSnapshot = JSON.stringify({
  tasks: migratedStockOrders.map((order) => listPdaGenericProcessTasks().find((task) => task.taskId === order.taskId)),
  heads: migratedStockOrders.flatMap((order) => listHandoverOrdersByTaskId(order.taskId)),
  records: migratedStockOrders.flatMap((order) =>
    listHandoverOrdersByTaskId(order.taskId).flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId)),
  ),
})
listPrintWorkOrders()
assert(
  JSON.stringify({
    tasks: migratedStockOrders.map((order) => listPdaGenericProcessTasks().find((task) => task.taskId === order.taskId)),
    heads: migratedStockOrders.flatMap((order) => listHandoverOrdersByTaskId(order.taskId)),
    records: migratedStockOrders.flatMap((order) =>
      listHandoverOrdersByTaskId(order.taskId).flatMap((head) => getPdaHandoverRecordsByHead(head.handoverId)),
    ),
  }) === seedSourceSnapshot,
  '印花加工单列表查询不得修改 PDA 任务、交出单或交出记录',
)

const builderFactory = listFactoryInternalWarehouseFactoryOptions().find((factory) =>
  listFactoryInternalWarehouses().some((warehouse) => warehouse.factoryId === factory.id && warehouse.warehouseKind === 'WAIT_HANDOVER'),
)
const builderWarehouse = builderFactory
  ? listFactoryInternalWarehouses().find((warehouse) => warehouse.factoryId === builderFactory.id && warehouse.warehouseKind === 'WAIT_HANDOVER')
  : undefined
assert(Boolean(builderFactory && builderWarehouse), '缺少厂内待交出仓 builder 检查所需工厂和仓库')

const stockBuilderOrder = migratedStockOrders.find((order) => order.printOrderNo === 'PH-20260328-007')!
const stockRouteCard = buildTaskRouteCardPrintDoc({ sourceType: 'PRINTING_WORK_ORDER', sourceId: stockBuilderOrder.printOrderId })
assert(stockRouteCard.summaryRows.some((row) => row.label === '加工单来源' && row.value === '备货手动创建'), '备货印花任务流转卡必须展示统一来源标签')
assert(!stockRouteCard.summaryRows.some((row) => row.label === '所属生产单'), '备货印花任务流转卡不得展示空生产单')
const stockBuilderHead = listHandoverOrdersByTaskId(stockBuilderOrder.taskId)[0]!
const stockBuilderRecord = getPdaHandoverRecordsByHead(stockBuilderHead.handoverId)[0]!
const stockOutbound = buildOutboundRecordFromHandoverRecord(stockBuilderHead, stockBuilderRecord, builderFactory!, builderWarehouse!)
const stockOutboundItem = buildFactoryWaitHandoverStockItemFromOutboundRecord(stockOutbound)
const stockPendingItem = buildFactoryPendingWaitHandoverStockItem(
  { ...stockBuilderHead, qtyExpectedTotal: stockBuilderHead.qtyExpectedTotal + 1, submittedQtyTotal: 0 },
  builderFactory!,
  builderWarehouse!,
)
;[stockOutboundItem, stockPendingItem].forEach((item) => {
  assert(item?.sourceType === 'STOCK', '备货来源厂内待交出仓 builder 必须输出 STOCK')
  assert(item?.stockMaterialId === stockBuilderOrder.stockMaterialId, '备货来源厂内待交出仓 builder 未保留 stockMaterialId')
  assert(item?.stockMaterialName === stockBuilderOrder.stockMaterialName, '备货来源厂内待交出仓 builder 未保留 stockMaterialName')
  assert(item?.productionOrderId === undefined, '备货来源厂内待交出仓 builder 不得输出生产单 ID')
  assert(item?.productionOrderNo === undefined, '备货来源厂内待交出仓 builder 不得输出生产单号')
})

const productionBuilderOrder = orders.find((order) => order.printOrderNo === 'PH-20260328-006')!
const productionBuilderHead = listHandoverOrdersByTaskId(productionBuilderOrder.taskId)
  .find((head) => head.productionOrderId === productionBuilderOrder.sourceProductionOrderId)!
const productionBuilderRecord = getPdaHandoverRecordsByHead(productionBuilderHead.handoverId)[0]!
const productionOutbound = buildOutboundRecordFromHandoverRecord(
  productionBuilderHead,
  {
    ...productionBuilderRecord,
    productionOrderId: 'STALE-RECORD-PRODUCTION-ORDER-ID',
    productionOrderNo: 'STALE-RECORD-PRODUCTION-ORDER-NO',
  },
  builderFactory!,
  builderWarehouse!,
)
const productionOutboundItem = buildFactoryWaitHandoverStockItemFromOutboundRecord(productionOutbound)
const productionPendingItem = buildFactoryPendingWaitHandoverStockItem(
  { ...productionBuilderHead, qtyExpectedTotal: productionBuilderHead.qtyExpectedTotal + 1, submittedQtyTotal: 0 },
  builderFactory!,
  builderWarehouse!,
)
;[productionOutboundItem, productionPendingItem].forEach((item) => {
  assert(item?.sourceType === 'PRODUCTION_ORDER', '生产来源厂内待交出仓 builder 必须输出 PRODUCTION_ORDER')
  assert(item?.productionOrderId === productionBuilderOrder.sourceProductionOrderId, '生产来源厂内待交出仓 builder 未保留真实生产单 ID')
  assert(item?.productionOrderNo === productionBuilderOrder.sourceProductionOrderNo, '生产来源厂内待交出仓 builder 未保留真实生产单号')
  assert(item?.productionOrderId !== item?.taskId, '生产来源厂内待交出仓 builder 不得把任务 ID 当生产单 ID')
  assert(item?.stockMaterialId === undefined, '生产来源厂内待交出仓 builder 不得输出 stockMaterialId')
  assert(item?.stockMaterialName === undefined, '生产来源厂内待交出仓 builder 不得输出 stockMaterialName')
})

orders
  .filter((order) => order.sourceType === 'PRODUCTION_ORDER')
  .forEach((order) => {
    waitHandoverStockItems
      .filter((item) => item.taskId === order.taskId)
      .forEach((item) => {
        assert(item.sourceType === 'PRODUCTION_ORDER', `${order.printOrderNo} 生产来源待交出仓类型不一致`)
        assert(item.productionOrderId !== item.taskId, `${order.printOrderNo} 待交出仓不得把任务 ID 当生产单 ID`)
        if (item.productionOrderId) {
          assert(item.productionOrderId === order.sourceProductionOrderId, `${order.printOrderNo} 待交出仓未保留真实生产单 ID`)
          assert(item.productionOrderNo === order.sourceProductionOrderNo, `${order.printOrderNo} 待交出仓未保留真实生产单号`)
        }
        assert(item.stockMaterialId === undefined, `${order.printOrderNo} 生产来源待交出仓不得携带 stockMaterialId`)
        assert(item.stockMaterialName === undefined, `${order.printOrderNo} 生产来源待交出仓不得携带 stockMaterialName`)
      })
  })

const completedWarehouseSeed = waitHandoverStockItems.find((item) => item.taskId === 'TASK-PRINT-COMPLETE-SEED-001')
assert(Boolean(completedWarehouseSeed), '缺少印花完成态待交出仓 Mock')
assert(completedWarehouseSeed?.sourceType === 'PRODUCTION_ORDER', '印花完成态待交出仓 Mock 必须为生产单来源')
assert(completedWarehouseSeed?.productionOrderId === 'PO-20260330-PRINT-001', '印花完成态待交出仓 Mock 未保留真实生产单 ID')
assert(completedWarehouseSeed?.productionOrderNo === 'PO-20260330-PRINT-001', '印花完成态待交出仓 Mock 未保留真实生产单号')
assert(completedWarehouseSeed?.productionOrderId !== completedWarehouseSeed?.taskId, '印花完成态待交出仓 Mock 不得把任务 ID 当生产单 ID')

const realStock = listProcessWorkOrderStockMaterials({ processCode: 'PRINT' })[0]!
const stockCreated = createPrintWorkOrderFromStock({
  stockMaterialId: realStock.stockMaterialId,
  stockMaterialName: realStock.stockMaterialName,
  materialSku: realStock.materialSku,
  factoryId: realStock.factoryId,
  plannedQty: 60,
  qtyUnit: realStock.qtyUnit,
  plannedFinishAt: '2026-07-31 18:00',
  processName: '数码印花',
})
assert(stockCreated.ok && stockCreated.order, '备货必须可以直接创建印花加工单')
assert(stockCreated.order.sourceType === 'STOCK', '备货印花加工单来源必须是 STOCK')
assert(stockCreated.order.stockMaterialId === realStock.stockMaterialId, '备货印花加工单必须保留 stockMaterialId')
assert(!stockCreated.order.sourceProductionOrderId, '备货印花加工单不得伪造生产单')
const stockPlatformHtml = renderProcessPrintOrdersPage({ sourceType: 'STOCK', selectedWorkOrderId: stockCreated.order.printOrderId })
const stockFactoryHtml = renderCraftPrintingWorkOrdersPage({ sourceType: 'STOCK' })
assert(stockPlatformHtml.includes(stockCreated.order.printOrderNo) && stockFactoryHtml.includes(stockCreated.order.printOrderNo), '备货来源印花筛选未命中真实加工单')
assert(!stockPlatformHtml.includes(supplementPrintRef.workOrderNo) && !stockFactoryHtml.includes(supplementPrintRef.workOrderNo), '备货来源印花筛选混入补料加工单')
assert(stockPlatformHtml.includes('备货手动创建') && !stockPlatformHtml.includes('所属生产单：</span>-'), '平台备货印花详情不得展示空生产单')
const stockTask = listPdaGenericProcessTasks().find((task) => task.taskId === stockCreated.order!.taskId)
assert(stockTask?.sourceType === 'STOCK', '备货印花 PDA 任务来源必须是 STOCK')
assert(stockTask?.stockMaterialId === realStock.stockMaterialId, '备货印花 PDA 任务必须保留 stockMaterialId')
assert(stockTask?.stockMaterialName === realStock.stockMaterialName, '备货印花 PDA 任务必须保留 stockMaterialName')
assert(stockTask?.productionOrderId === undefined, '备货印花 PDA 任务不得写空生产单 ID')
assert(stockTask?.productionOrderNo === undefined, '备货印花 PDA 任务不得写空生产单号')
if (stockTask) registerPdaGenericProcessTask({ ...stockTask, startedAt: '2026-07-15 10:00:00' })
const stockMobileTask = getMobileExecutionTaskById(stockCreated.order.taskId)
assert(stockMobileTask?.sourceType === 'STOCK', '备货印花移动索引来源必须是 STOCK')
assert(stockMobileTask?.stockMaterialId === realStock.stockMaterialId, '备货印花移动索引必须保留 stockMaterialId')
assert(stockMobileTask?.productionOrderId === undefined, '备货印花移动索引不得回填生产单 ID')
const stockWarehouseLinkage = applyPrintWarehouseLinkageAfterAction({
  success: true,
  sourceType: 'PRINT',
  sourceId: stockCreated.order.printOrderId,
  taskId: stockCreated.order.taskId,
  actionCode: 'PRINT_FINISH_TRANSFER',
  previousStatus: 'TRANSFERRING',
  nextStatus: 'WAIT_HANDOVER',
  objectQty: stockCreated.order.plannedQty,
  qtyUnit: stockCreated.order.qtyUnit,
})
const stockWarehouseRecord = getProcessWarehouseRecordById(stockWarehouseLinkage.createdWaitHandoverWarehouseRecordId)
assert(stockWarehouseRecord?.sourceType === 'STOCK', '备货印花仓记录来源必须是 STOCK')
assert(stockWarehouseRecord?.stockMaterialId === realStock.stockMaterialId, '备货印花仓记录必须保留 stockMaterialId')
assert(stockWarehouseRecord?.sourceProductionOrderId === undefined, '备货印花仓记录不得保留空生产单 ID')
const stockSubmit = submitPrintHandover(stockCreated.order.taskId, { submittedQty: stockCreated.order.plannedQty })
const stockPdaHead = listHandoverOrdersByTaskId(stockCreated.order.taskId)[0]
assert(stockPdaHead?.sourceType === 'STOCK', '备货印花 PDA 交出单来源必须是 STOCK')
assert(stockPdaHead?.stockMaterialId === realStock.stockMaterialId, '备货印花 PDA 交出单必须保留 stockMaterialId')
assert(stockPdaHead?.productionOrderId === undefined, '备货印花 PDA 交出单不得写生产单 ID')
assert(stockPdaHead?.productionOrderNo === undefined, '备货印花 PDA 交出单不得写生产单号')
assert(JSON.stringify(getPdaHandoverSourceDisplay(stockPdaHead!)) === JSON.stringify({ label: '备货物料', value: `${realStock.stockMaterialName} / ${realStock.stockMaterialId}` }), '备货印花 PDA 页面必须展示备货物料')
const stockPdaHtml = renderPdaHandoverDetailPage(stockPdaHead!.handoverId)
assert(stockPdaHtml.includes('备货手动创建') && stockPdaHtml.includes('备货物料'), '备货印花 PDA 必须显示统一来源与对象')
assert(stockSubmit.handoverRecord.sourceType === 'STOCK', '备货印花 PDA 交出记录来源必须是 STOCK')
assert(stockSubmit.handoverRecord.stockMaterialId === realStock.stockMaterialId, '备货印花 PDA 交出记录必须保留 stockMaterialId')
assert(stockSubmit.handoverRecord.stockMaterialName === realStock.stockMaterialName, '备货印花 PDA 交出记录必须保留 stockMaterialName')
assert(stockSubmit.handoverRecord.productionOrderId === undefined, '备货印花 PDA 交出记录不得写生产单 ID')
assert(stockSubmit.handoverRecord.productionOrderNo === undefined, '备货印花 PDA 交出记录不得写生产单号')
const stockHandoverRecord = listProcessHandoverRecords({ sourceWorkOrderId: stockCreated.order.printOrderId })
  .find((record) => record.sourceType === 'STOCK')
assert(stockHandoverRecord?.stockMaterialId === realStock.stockMaterialId, '备货印花交出回写必须保留 stockMaterialId')
assert(stockHandoverRecord?.sourceProductionOrderId === undefined, '备货印花交出回写不得保留空生产单 ID')

const productionOrder = orders.find((order) => order.sourceType === 'PRODUCTION_ORDER')!
const productionTask = listPdaGenericProcessTasks().find((task) => task.taskId === productionOrder.taskId)
assert(productionTask?.sourceType === 'PRODUCTION_ORDER', '生产单印花 PDA 任务来源必须是 PRODUCTION_ORDER')
assert(productionTask?.productionOrderId === productionOrder.sourceProductionOrderId, '生产单印花 PDA 任务必须保留生产单 ID')
assert(productionTask?.stockMaterialId === undefined, '生产单印花 PDA 任务不得携带备货来源')
if (productionTask) registerPdaGenericProcessTask({ ...productionTask, startedAt: productionTask.startedAt || '2026-07-15 10:00:00' })
const productionWarehouseLinkage = applyPrintWarehouseLinkageAfterAction({
  success: true,
  sourceType: 'PRINT',
  sourceId: productionOrder.printOrderId,
  taskId: productionOrder.taskId,
  actionCode: 'PRINT_FINISH_TRANSFER',
  previousStatus: 'TRANSFERRING',
  nextStatus: 'WAIT_HANDOVER',
  objectQty: productionOrder.plannedQty,
})
const productionWarehouseRecord = getProcessWarehouseRecordById(productionWarehouseLinkage.createdWaitHandoverWarehouseRecordId)
assert(productionWarehouseRecord?.sourceType === 'PRODUCTION_ORDER', '生产单印花仓记录来源必须是 PRODUCTION_ORDER')
assert(productionWarehouseRecord?.sourceProductionOrderId === productionOrder.sourceProductionOrderId, '生产单印花仓记录必须保留生产单 ID')
assert(productionWarehouseRecord?.stockMaterialId === undefined, '生产单印花仓记录不得携带备货来源')
const productionSubmit = submitPrintHandover(productionOrder.taskId, { submittedQty: productionOrder.plannedQty })
const productionPdaHead = listHandoverOrdersByTaskId(productionOrder.taskId)[0]
assert(productionPdaHead?.sourceType === 'PRODUCTION_ORDER', '生产单印花 PDA 交出单来源必须是 PRODUCTION_ORDER')
assert(productionPdaHead?.productionOrderId === productionOrder.sourceProductionOrderId, '生产单印花 PDA 交出单必须保留生产单 ID')
assert(productionPdaHead?.productionOrderNo === productionOrder.sourceProductionOrderNo, '生产单印花 PDA 交出单必须保留生产单号')
assert(productionPdaHead?.stockMaterialId === undefined, '生产单印花 PDA 交出单不得携带备货来源')
assert(JSON.stringify(getPdaHandoverSourceDisplay(productionPdaHead!)) === JSON.stringify({ label: '生产单号', value: productionOrder.sourceProductionOrderNo }), '生产单印花 PDA 页面必须展示生产单号')
const productionPdaHtml = renderPdaHandoverDetailPage(productionPdaHead!.handoverId)
assert(productionPdaHtml.includes('生产单自动生成') && productionPdaHtml.includes('生产单号'), '生产单印花 PDA 必须显示统一来源与对象')
assert(productionSubmit.handoverRecord.productionOrderId === productionOrder.sourceProductionOrderId, '生产单印花 PDA 交出记录必须保留生产单 ID')
assert(productionSubmit.handoverRecord.productionOrderNo === productionOrder.sourceProductionOrderNo, '生产单印花 PDA 交出记录必须保留生产单号')
assert(productionSubmit.handoverRecord.stockMaterialId === undefined, '生产单印花 PDA 交出记录不得携带备货来源')
assert(productionSubmit.handoverRecord.stockMaterialName === undefined, '生产单印花 PDA 交出记录不得携带备货名称')
const productionHandoverRecord = listProcessHandoverRecords({ sourceWorkOrderId: productionOrder.printOrderId })
  .find((record) => record.sourceType === 'PRODUCTION_ORDER')
assert(productionHandoverRecord?.sourceProductionOrderId === productionOrder.sourceProductionOrderId, '生产单印花交出回写必须保留生产单 ID')
assert(productionHandoverRecord?.stockMaterialId === undefined, '生产单印花交出回写不得携带备货来源')

orders.forEach((order) => {
  const task = tasks.find((item) => item.taskId === order.taskId)
  assert(task, `印花加工单 ${order.printOrderNo} 未关联任务`)
  assert(getPrintWorkOrderByTaskId(order.taskId)?.printOrderId === order.printOrderId, `${order.printOrderNo} 与任务关联断裂`)
  assert((task?.taskQrValue || '').startsWith('FCS:TASK:v1:'), `${order.printOrderNo} 缺少任务二维码`)
  assert(order.targetTransferWarehouseName === '中转区域', `${order.printOrderNo} 接收方不是中转区域`)
  assert(!/裁床仓|裁片仓/.test(order.targetTransferWarehouseName), `${order.printOrderNo} 错误指向裁床仓`)

  const printNode = getPrintExecutionNodeRecord(order.printOrderId, 'PRINT')
  if (printNode?.startedAt) {
    assert(Boolean(printNode.printerNo), `${order.printOrderNo} 打印开始缺少打印机编号`)
  }
  if (printNode?.finishedAt) {
    assert((printNode.outputQty ?? 0) > 0, `${order.printOrderNo} 打印结束缺少完成数量`)
  }

  const transferNode = getPrintExecutionNodeRecord(order.printOrderId, 'TRANSFER')
  if (transferNode?.startedAt) {
    assert(Boolean(transferNode.startedAt), `${order.printOrderNo} 转印开始未记录时间`)
  }
  if (transferNode?.finishedAt) {
    assert((transferNode.usedMaterialQty ?? 0) > 0, `${order.printOrderNo} 转印结束缺少原料使用`)
    assert((transferNode.actualCompletedQty ?? 0) > 0, `${order.printOrderNo} 转印结束缺少实际完成`)
  }

  const handoverHead = getPrintOrderHandoverHead(order.printOrderId)
  const shouldHaveHandover =
    order.status === 'WAIT_DELIVERY' ||
    order.status === 'HANDOVER_SUBMITTED' ||
    order.status === 'RECEIVER_WRITTEN_BACK' ||
    order.status === 'WAIT_REVIEW' ||
    order.status === 'COMPLETED' ||
    order.status === 'REJECTED'
  if (task?.startedAt && shouldHaveHandover) {
    assert(Boolean(order.handoverOrderId || handoverHead?.handoverOrderId || handoverHead?.handoverId), `${order.printOrderNo} 开工后缺少交出单`)
  }

  const handoverRecords = getPrintOrderHandoverRecords(order.printOrderId)
  handoverRecords.forEach((record) => {
    assert(Boolean(record.handoverRecordQrValue), `${order.printOrderNo} 存在缺少二维码的交出记录`)
  })

  const handoverSummary = getPrintOrderHandoverSummary(order.printOrderId)
  const review = getPrintReviewRecordByOrderId(order.printOrderId)
  if (review) {
    assert(handoverSummary.writtenBackQty > 0, `${order.printOrderNo} 未回写就进入审核`)
  }
  if (review?.reviewStatus === 'REJECTED') {
    assert(Boolean(review.rejectReason?.trim()), `${order.printOrderNo} 审核驳回缺少原因`)
  }
})

const machineList = listPrintMachineOptions('ID-F002')
assert(machineList.length > 0, '印花工厂未配置打印机')

console.log('[check-printing-workflow] 印花加工单、任务节点、交出与审核链路通过')
console.table(
  orders.map((order) => {
    const task = tasks.find((item) => item.taskId === order.taskId)
    const printNode = getPrintExecutionNodeRecord(order.printOrderId, 'PRINT')
    const transferNode = getPrintExecutionNodeRecord(order.printOrderId, 'TRANSFER')
    const handoverSummary = getPrintOrderHandoverSummary(order.printOrderId)
    const review = getPrintReviewRecordByOrderId(order.printOrderId)

    return {
      印花单号: order.printOrderNo,
      印花任务: order.taskNo,
      任务二维码: task?.taskQrValue ? '已生成' : '缺失',
      当前状态: getPrintWorkOrderStatusLabel(order.status),
      打印机编号: printNode?.printerNo || '—',
      原料使用: transferNode?.usedMaterialQty ?? 0,
      实际完成: transferNode?.actualCompletedQty ?? 0,
      交出记录: handoverSummary.recordCount,
      待回写: handoverSummary.pendingWritebackCount,
      审核状态: review ? (review.reviewStatus === 'PASS' ? '已完成' : review.reviewStatus === 'REJECTED' ? '已驳回' : '待审核') : '未进入审核',
    }
  }),
)
