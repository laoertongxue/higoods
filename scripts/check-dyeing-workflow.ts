import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import assert from 'node:assert/strict'

import {
  completeDyeing,
  createDyeWorkOrderFromStock,
  getDyeExecutionNodeRecord,
  getDyeOrderHandoverSummary,
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  hasDirectPackingToReviewOrCompleteTransition,
  listDyeFormulaRecords,
  listDyeMobileExecutionTasks,
  listDyeReportRows,
  listDyeReviewRecords,
  listDyeVatSchedules,
  listDyeWorkOrders,
  validateDyeStartPayload,
  prepareFormalProductionOrderDyeWorkOrderSync,
} from '../src/data/fcs/dyeing-task-domain.ts'
import { getMobileExecutionTaskById } from '../src/data/fcs/mobile-execution-task-index.ts'
import { listPdaGenericProcessTasks, registerPdaGenericProcessTask } from '../src/data/fcs/pda-task-mock-factory.ts'
import { submitDyeHandover } from '../src/data/fcs/process-execution-writeback.ts'
import { applyDyeWarehouseLinkageAfterAction } from '../src/data/fcs/process-warehouse-linkage-service.ts'
import { getProcessWarehouseRecordById, listProcessHandoverRecords } from '../src/data/fcs/process-warehouse-domain.ts'
import { ensureHandoverOrderForStartedTask, getPdaHandoverSourceDisplay, listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'
import { listFactoryWaitProcessStockItems, upsertFactoryWaitProcessStockItem } from '../src/data/fcs/factory-internal-warehouse.ts'
import { buildTaskDeliveryCardPrintDocByRecordId, buildTaskRouteCardPrintDoc } from '../src/data/fcs/task-print-cards.ts'
import { getProcessWorkOrderById } from '../src/data/fcs/process-work-order-domain.ts'
import {
  filterDyeWorkOrderOnlineRows,
  listDyeWorkOrderOnlineRows,
} from '../src/data/fcs/dye-work-order-online-view.ts'
import {
  confirmSupplementAndGenerateProcessWorkOrders,
  listSupplementDraftsForTesting,
} from '../src/pages/process-factory/cutting/supplement-management.ts'
import { renderProcessDyeOrdersPage } from '../src/pages/process-dye-orders.ts'
import { renderCraftDyeingWorkOrdersPage } from '../src/pages/process-factory/dyeing/work-orders.ts'
import { renderCraftDyeingWorkOrderDetailPage } from '../src/pages/process-factory/dyeing/work-order-detail.ts'
import { renderPdaHandoverDetailPage } from '../src/pages/pda-handover-detail.ts'

const repoRoot = process.cwd()
const dyePages = [
  'src/pages/process-factory/dyeing/work-orders.ts',
  'src/pages/process-factory/dyeing/warehouse.ts',
  'src/pages/process-factory/dyeing/dye-orders.ts',
  'src/pages/process-factory/dyeing/reports.ts',
]

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function assertIncludes(source: string, expected: string, label: string): void {
  assert(source.includes(expected), `${label} 缺少：${expected}`)
}

function assertNotIncludes(source: string, disallowed: string, label: string): void {
  assert(!source.includes(disallowed), `${label} 不应包含：${disallowed}`)
}

function makeText(parts: string[]): string {
  return parts.join('')
}

function main(): void {
  const dyePdaTerms = [
    makeText(['染色', 'PDA']),
    makeText(['染色', ' ', 'PDA']),
    makeText(['Dyeing', ' ', 'PDA']),
    makeText(['PDA', '染色']),
  ]
  const placeholderTerms = [
    makeText(['sca', 'ffold']),
    makeText(['Sca', 'ffold']),
    makeText(['占', '位']),
    makeText(['TO', 'DO']),
    makeText(['coming', ' soon']),
    makeText(['敬', '请', '期待']),
    makeText(['骨', '架']),
    makeText(['仅', '展示']),
    makeText(['mo', 'ck']),
  ]
  const printTerms = [
    makeText(['print', 'Order']),
    makeText(['print', 'OrderNo']),
    makeText(['pattern', 'No']),
    makeText(['印', '花']),
    makeText(['花', '型']),
    makeText(['打', '印', '机']),
    makeText(['转', '印']),
    makeText(['printer', 'No']),
  ]

  for (const file of dyePages) {
    const source = readFile(file)
    placeholderTerms.forEach((term) => assertNotIncludes(source, term, file))
    dyePdaTerms.forEach((term) => assertNotIncludes(source, term, file))
  }

  const workOrdersSource = readFile('src/pages/process-factory/dyeing/work-orders.ts')
  const workOrderDetailSource = readFile('src/pages/process-factory/dyeing/work-order-detail.ts')
  const processWorkOrderDomainSource = readFile('src/data/fcs/process-work-order-domain.ts')
  const taskPrintCardsSource = readFile('src/data/fcs/task-print-cards.ts')
  const processPrepAdapterSource = readFile('src/data/fcs/page-adapters/process-prep-pages-adapter.ts')
  const platformOrdersSource = readFile('src/pages/process-dye-orders.ts')
  const appShellSource = readFile('src/data/app-shell-config.ts')
  const warehouseSource = readFile('src/pages/process-factory/dyeing/warehouse.ts')
  const routesSource = readFile('src/router/routes-fcs.ts')
  const formulaSource = readFile('src/pages/process-factory/dyeing/dye-orders.ts')
  const reportsSource = readFile('src/pages/process-factory/dyeing/reports.ts')
  const taskDetailSource = readFile('src/pages/pda-exec-detail.ts')
  const handoverSource = readFile('src/pages/pda-handover.ts')
  const handoverDetailSource = readFile('src/pages/pda-handover-detail.ts')

  assertIncludes(workOrdersSource, '染色加工单', '染色加工单页面')
  ;['查看', '编辑', '日志', '打印流程卡'].forEach((term) => {
    assertIncludes(workOrdersSource, term, '染色加工单页面')
  })
  assertNotIncludes(workOrdersSource, "buildTaskRouteCardPrintLink('DYEING_WORK_ORDER', order.dyeOrderId)", '染色加工单页面不再使用旧任务流转卡')
  assertNotIncludes(workOrdersSource, '打印任务交货卡', '染色加工单页面不得提前增加打印任务交货卡入口')
  assertIncludes(appShellSource, '染色待加工仓', '染厂管理菜单')
  assertIncludes(appShellSource, '染色待交出仓', '染厂管理菜单')
  assertIncludes(warehouseSource, 'renderCraftDyeingWaitHandoverWarehousePage', '染色待交出仓页面')
  assertIncludes(warehouseSource, '出库记录', '染色待交出仓页面')
  assertIncludes(warehouseSource, '打印任务交货卡', '染色待交出仓出库记录')
  assertIncludes(warehouseSource, 'buildTaskDeliveryCardPrintLink(item.handoverRecordId)', '染色任务交货卡必须使用 handoverRecordId')
  assertIncludes(
    routesSource,
    "renderRouteRedirect('/fcs/craft/dyeing/wait-process-warehouse', '正在跳转到染色待加工仓')",
    '染色旧仓库入口',
  )
  assertIncludes(formulaSource, '染色配方', '染色配方页面')
  assertIncludes(reportsSource, '等待原因', '染色统计页面')
  assertIncludes(reportsSource, '节点耗时', '染色统计页面')
  assertIncludes(reportsSource, '染缸利用', '染色统计页面')
  assertIncludes(reportsSource, '已登记实收差异', '染色统计页面')
  assertIncludes(reportsSource, '染色有差异交出记录数', '染色统计页面')
  assertIncludes(taskDetailSource, '染色任务', '任务详情页面')
  assertIncludes(taskDetailSource, '染缸编号', '任务详情页面')
  assertIncludes(taskDetailSource, '待送货', '任务详情页面')

  const sourceIdentitySnapshot = () => listPdaGenericProcessTasks()
    .filter((task) => task.taskId.startsWith('TASK-DYE-'))
    .map((task) => ({
      taskId: task.taskId,
      sourceType: task.sourceType,
      productionOrderId: task.productionOrderId,
      productionOrderNo: task.productionOrderNo,
      sourceProductionOrderId: task.sourceProductionOrderId,
      stockMaterialId: task.stockMaterialId,
      stockMaterialName: task.stockMaterialName,
    }))
  let orders = listDyeWorkOrders()
  const supplementSeed = listSupplementDraftsForTesting().find((draft) =>
    draft.sourceType === 'cut-order'
    && draft.materialDemands.some((item) => item.printRequired && item.dyeRequired),
  )
  assert(supplementSeed, '缺少真实印染补料场景')
  const supplementDraft = structuredClone(supplementSeed)
  supplementDraft.confirmationIdentity = 'task9-dye-source-display'
  supplementDraft.supplyRiskConfirmed = true
  const supplementResult = confirmSupplementAndGenerateProcessWorkOrders(supplementDraft, '任务9来源检查')
  if (!supplementResult.ok) throw new Error(`真实补料确认必须成功：${supplementResult.message}`)
  orders = listDyeWorkOrders()
  const supplementDyeRef = supplementResult.record.processWorkOrderRefs.find((item) => item.processType === 'DYE')
  assert(supplementDyeRef, '真实补料必须生成染色加工单')
  const productionDyeOrder = listDyeWorkOrders().find((order) => order.sourceType === 'PRODUCTION_ORDER')
  assert(productionDyeOrder, '缺少生产单来源染色加工单')
  const supplementPlatformHtml = renderProcessDyeOrdersPage({ sourceType: 'CUT_PIECE_SUPPLEMENT', selectedWorkOrderId: supplementDyeRef.workOrderId })
  assert(supplementPlatformHtml.includes(supplementDyeRef.workOrderNo), '平台染色页未展示真实补料加工单')
  assert(!supplementPlatformHtml.includes(productionDyeOrder.dyeOrderNo), '平台染色来源筛选混入生产单来源')
  const supplementFactoryHtml = renderCraftDyeingWorkOrdersPage({ sourceType: 'CUT_PIECE_SUPPLEMENT' })
  assert(supplementFactoryHtml.includes(supplementDyeRef.workOrderNo), '工厂染色列表未展示真实补料加工单')
  assert(!supplementFactoryHtml.includes(productionDyeOrder.dyeOrderNo), '工厂染色来源筛选混入生产单来源')
  const supplementDyeDetail = renderCraftDyeingWorkOrderDetailPage(supplementDyeRef.workOrderId)
  const supplementDyeOrder = getProcessWorkOrderById(supplementDyeRef.workOrderId)
  assert(supplementDyeOrder, '未找到真实补料染色加工单')
  for (const expected of [
    '裁片补料生成',
    supplementResult.record.recordNo,
    supplementDraft.sourceNo,
    supplementDraft.productionOrderNo,
    supplementDyeOrder.sourceSnapshot.techPackVersionLabel,
]) {
    assert(Boolean(expected) && supplementDyeDetail.includes(String(expected)), `真实补料染色详情缺少：${expected || '空值'}`)
    assert(Boolean(expected) && supplementPlatformHtml.includes(String(expected)), `平台补料染色详情缺少：${expected || '空值'}`)
  }
  assert(supplementPlatformHtml.includes(`物料编码：</span>${supplementDyeOrder.materialSku}`), '平台补料染色详情必须展示冻结物料编码')
  assert(supplementPlatformHtml.includes(`物料名称：</span>${supplementDyeOrder.materialName}`), '平台补料染色详情必须展示冻结物料名称')
  assert(supplementPlatformHtml.includes(`BOM 行标识：</span>${supplementDyeOrder.sourceSnapshot.bomItemId}`), '平台补料染色详情必须将 BOM 行标识独立展示')
  const supplementRouteCard = buildTaskRouteCardPrintDoc({ sourceType: 'DYEING_WORK_ORDER', sourceId: supplementDyeRef.workOrderId })
  assert(supplementRouteCard.summaryRows.some((row) => row.label === '加工单来源' && row.value === '裁片补料生成'), '补料染色流转卡来源错误')
  assert(supplementRouteCard.summaryRows.some((row) => row.label === '补料单' && row.value === supplementResult.record.recordNo), '补料染色流转卡缺少补料单')
  const supplementDyeTask = listPdaGenericProcessTasks().find((task) => task.taskId === supplementDyeOrder.taskId)
  assert(supplementDyeTask, '补料染色加工单缺少 PDA 任务')
  registerPdaGenericProcessTask({ ...supplementDyeTask, status: 'IN_PROGRESS', startedAt: '2026-07-23 09:00:00' })
  const supplementHandover = ensureHandoverOrderForStartedTask(supplementDyeTask.taskId)
  const supplementPdaHtml = renderPdaHandoverDetailPage(supplementHandover.handoverOrderId)
  assert(supplementPdaHtml.includes('裁片补料生成') && supplementPdaHtml.includes('补料单'), '补料染色 PDA 必须显示统一来源与对象')
  assert(supplementPdaHtml.includes(supplementResult.record.recordNo), '补料染色 PDA 缺少补料单号')
  const productionPlatformHtml = renderProcessDyeOrdersPage({ sourceType: 'PRODUCTION_ORDER' })
  const productionFactoryHtml = renderCraftDyeingWorkOrdersPage({ sourceType: 'PRODUCTION_ORDER' })
  assert(productionPlatformHtml.includes(productionDyeOrder.dyeOrderNo) && productionFactoryHtml.includes(productionDyeOrder.dyeOrderNo), '生产单来源染色筛选未命中真实加工单')
  assert(!productionPlatformHtml.includes(supplementDyeRef.workOrderNo) && !productionFactoryHtml.includes(supplementDyeRef.workOrderNo), '生产单来源染色筛选混入补料加工单')
  const onlineRows = listDyeWorkOrderOnlineRows()
  const sourceFilterRows = [
    { ...onlineRows[0]!, dyeOrderId: 'SOURCE-PRODUCTION', sourceType: 'PRODUCTION_ORDER' as const },
    { ...onlineRows[0]!, dyeOrderId: 'SOURCE-STOCK', sourceType: 'STOCK' as const },
    { ...onlineRows[0]!, dyeOrderId: 'SOURCE-SUPPLEMENT', sourceType: 'CUT_PIECE_SUPPLEMENT' as const },
  ]
  for (const sourceType of ['PRODUCTION_ORDER', 'STOCK', 'CUT_PIECE_SUPPLEMENT'] as const) {
    const filteredBySource = filterDyeWorkOrderOnlineRows(sourceFilterRows, { sourceType })
    assert.equal(filteredBySource.length, 1, `染色加工单来源筛选 ${sourceType} 必须精确命中一项`)
    assert.equal(filteredBySource[0]?.sourceType, sourceType, `染色加工单来源筛选 ${sourceType} 不得混入其他来源`)
  }
  const runtimeDyeLockTerms = [
    makeText(['前置染色', '未完成']),
    makeText(['前置染色', '加工单']),
    makeText(['染色完成后', '自动解锁印花']),
    makeText(['解锁', '印花']),
  ]
  for (const disallowed of runtimeDyeLockTerms) {
    assert(![workOrdersSource, workOrderDetailSource, taskPrintCardsSource, processPrepAdapterSource].some((source) => source.includes(disallowed)), `染色展示层不得包含运行时锁定逻辑：${disallowed}`)
  }
  const taskSourcesBeforeRepeatedQueries = sourceIdentitySnapshot()
  listDyeWorkOrders()
  getDyeWorkOrderByTaskId(orders[0]!.taskId)
  assert.deepEqual(sourceIdentitySnapshot(), taskSourcesBeforeRepeatedQueries, '重复 list/get 染色加工单不得改写 PDA 任务来源字段')
  assert(orders.length >= 6, '染色加工单数据不足')
  assert(orders.every((order) => Boolean(order.taskId && order.taskNo)), '染色加工单必须关联染色任务')
  assert(orders.every((order) => order.taskQrValue.startsWith('FCS:TASK:v1:')), '染色任务必须有任务二维码')
  assert(orders.some((order) => order.status === 'WAIT_HANDOVER'), '染色任务必须包含待送货状态')
  assert(onlineRows.some((order) => order.handoverStatus === 'FULL_HANDOVER' && order.downstreamReceivedQty < order.handedOverQty), '染色任务必须覆盖全部交出后下游尚未收齐，且不能把下游接收混入交出状态')
  assert(onlineRows.every((order) => Boolean(order.receiverName.trim() && order.receiverWarehouseName.trim())), '每张染色加工单必须解析唯一接收方和目标仓')
  assert(orders.every((order) => !order.targetTransferWarehouseName.includes('裁床仓') && !order.targetTransferWarehouseName.includes('裁片仓')), '染色完成后不能直接进入裁床仓')
  assert(orders.some((order) => Boolean(order.handoverOrderId)), '开工后的染色任务必须有交出单')
  const stockTemplate = listFactoryWaitProcessStockItems().find((item) => item.itemKind === '面料' && item.receivedQty > 0 && item.materialSku)!
  const stockFactory = listDyeWorkOrders().find(o=>o.dyeFactoryId==='ID-F002')!
  const realStock = upsertFactoryWaitProcessStockItem({
    ...stockTemplate,
    stockItemId: 'WPS-DYE-WORKFLOW-QUALIFIED',
    sourceRecordId: 'INB-DYE-WORKFLOW-QUALIFIED',
    sourceRecordNo: 'RK-DYE-WORKFLOW-QUALIFIED',
    factoryId: stockFactory.dyeFactoryId,
    factoryName: stockFactory.dyeFactoryName,
    warehouseId: `FIW-${stockFactory.dyeFactoryId}-WAIT_PROCESS`,
    warehouseName: `${stockFactory.dyeFactoryName} · 待加工仓`,
    processCode: 'DYE',
    processName: '染色',
    itemName: '染色流程合格备货面料',
    materialSku: 'FAB-DYE-WORKFLOW-QUALIFIED',
    expectedQty: 160,
    receivedQty: 160,
    differenceQty: 0,
    status: '已入待加工仓',
    abnormalReason: undefined,
  })
  const stockCreated = createDyeWorkOrderFromStock({
    stockMaterialId: realStock.stockItemId,
    stockMaterialName: realStock.itemName,
    materialSku: realStock.materialSku!,
    factoryId: stockFactory.dyeFactoryId,
    plannedQty: 80,
    qtyUnit: realStock.unit,
    plannedFinishAt: '2026-07-31 18:00',
    processName: '常规染色',
    targetColor: '海军蓝',
  })
  assert(stockCreated.ok && stockCreated.order, `备货必须可以直接创建染色加工单：${stockCreated.message}`)
  assert.equal(stockCreated.order.sourceType, 'STOCK', '备货染色加工单来源必须是 STOCK')
  assert.equal(stockCreated.order.stockMaterialId, realStock.stockItemId, '备货染色加工单必须保留 stockMaterialId')
  assert(!stockCreated.order.sourceProductionOrderId, '备货染色加工单不得伪造生产单')
  const stockPlatformHtml = renderProcessDyeOrdersPage({ sourceType: 'STOCK', selectedWorkOrderId: stockCreated.order.dyeOrderId })
  const stockFactoryHtml = renderCraftDyeingWorkOrdersPage({ sourceType: 'STOCK' })
  assert(stockPlatformHtml.includes(stockCreated.order.dyeOrderNo) && stockFactoryHtml.includes(stockCreated.order.dyeOrderNo), '备货来源染色筛选未命中真实加工单')
  assert(!stockPlatformHtml.includes(supplementDyeRef.workOrderNo) && !stockFactoryHtml.includes(supplementDyeRef.workOrderNo), '备货来源染色筛选混入补料加工单')
  assert(stockPlatformHtml.includes('备货手动创建') && !stockPlatformHtml.includes('所属生产单：</span>-'), '平台备货染色详情不得展示空生产单')
  const stockRouteCard = buildTaskRouteCardPrintDoc({ sourceType: 'DYEING_WORK_ORDER', sourceId: stockCreated.order.dyeOrderId })
  assert.equal(stockRouteCard.workOrderSourceType, 'STOCK', '备货任务流转卡必须保留备货来源类型')
  assert.equal(stockRouteCard.stockMaterialId, realStock.stockItemId, '备货任务流转卡必须保留备货物料 ID')
  assert(stockRouteCard.summaryRows.some((row) => row.label === '加工单来源' && row.value === '备货手动创建'), '备货染色任务流转卡必须展示统一来源标签')
  assert(stockRouteCard.summaryRows.some((row) => row.label === '备货物料' && row.value === realStock.itemName), '备货任务流转卡必须展示备货物料，不得展示空生产单号')
  assert(!stockRouteCard.summaryRows.some((row) => row.value === '按备货创建'), '备货任务流转卡不得使用“按备货创建”占位生产单号')
  const stockTask = listPdaGenericProcessTasks().find((task) => task.taskId === stockCreated.order!.taskId)
  assert(stockTask, '备货染色加工单必须注册 PDA 任务')
  assert.equal(stockTask.sourceType, 'STOCK', '备货染色 PDA 任务来源必须是 STOCK')
  assert.equal(stockTask.stockMaterialId, realStock.stockItemId, '备货染色 PDA 任务必须保留 stockMaterialId')
  assert.equal(stockTask.stockMaterialName, realStock.itemName, '备货染色 PDA 任务必须保留 stockMaterialName')
  assert.equal(stockTask.productionOrderId, undefined, '备货染色 PDA 任务不得写空生产单 ID')
  assert.equal(stockTask.productionOrderNo, undefined, '备货染色 PDA 任务不得写空生产单号')
  registerPdaGenericProcessTask({ ...stockTask, startedAt: '2026-07-15 10:00:00' })
  const stockMobileTask = getMobileExecutionTaskById(stockCreated.order.taskId)
  assert.equal(stockMobileTask?.sourceType, 'STOCK', '备货染色移动索引来源必须是 STOCK')
  assert.equal(stockMobileTask?.stockMaterialId, realStock.stockItemId, '备货染色移动索引必须保留 stockMaterialId')
  assert.equal(stockMobileTask?.productionOrderId, undefined, '备货染色移动索引不得回填生产单 ID')
  const stockWarehouseLinkage = applyDyeWarehouseLinkageAfterAction({
    success: true,
    sourceType: 'DYE',
    sourceId: stockCreated.order.dyeOrderId,
    taskId: stockCreated.order.taskId,
    actionCode: 'DYE_FINISH_PACKING',
    previousStatus: 'PACKING',
    nextStatus: 'WAIT_HANDOVER',
    objectQty: stockCreated.order.plannedQty,
    qtyUnit: stockCreated.order.qtyUnit,
  })
  assert.equal(stockWarehouseLinkage.success, false, '没有实际包装节点不能用动作参数伪造入仓')
  assert.throws(()=>submitDyeHandover(stockCreated.order!.taskId,{submittedQty:stockCreated.order!.plannedQty}),/逐卷建单/)
  ensureHandoverOrderForStartedTask(stockCreated.order.taskId)
  const stockPdaHead = listHandoverOrdersByTaskId(stockCreated.order.taskId)[0]
  assert.equal(stockPdaHead?.sourceType, 'STOCK', '备货染色 PDA 交出单来源必须是 STOCK')
  assert.equal(stockPdaHead?.stockMaterialId, realStock.stockItemId, '备货染色 PDA 交出单必须保留 stockMaterialId')
  assert.equal(stockPdaHead?.productionOrderId, undefined, '备货染色 PDA 交出单不得写生产单 ID')
  assert.equal(stockPdaHead?.productionOrderNo, undefined, '备货染色 PDA 交出单不得写生产单号')
  assert.deepEqual(getPdaHandoverSourceDisplay(stockPdaHead!), { label: '备货物料', value: `${realStock.itemName} / ${realStock.stockItemId}` }, '备货染色 PDA 页面必须展示备货物料')
  const stockPdaHtml = renderPdaHandoverDetailPage(stockPdaHead!.handoverId)
  assert(stockPdaHtml.includes('备货手动创建') && stockPdaHtml.includes('备货物料'), '备货染色 PDA 必须显示统一来源与对象')
  assert.equal(listProcessHandoverRecords({sourceWorkOrderId:stockCreated.order.dyeOrderId}).length,0,'旧入口被阻断后不能产生另一份交出账')

  const productionOrder = orders.find((order) => order.sourceType === 'PRODUCTION_ORDER')!
  const productionTask = listDyeMobileExecutionTasks().find((task) => task.taskId === productionOrder.taskId)
  assert.equal(productionTask?.sourceType, 'PRODUCTION_ORDER', '生产单染色 PDA 任务来源必须是 PRODUCTION_ORDER')
  assert.equal(productionTask?.productionOrderId, productionOrder.sourceProductionOrderId, '生产单染色 PDA 任务必须保留生产单 ID')
  assert.equal(productionTask?.stockMaterialId, undefined, '生产单染色 PDA 任务不得携带备货来源')
  if (productionTask) registerPdaGenericProcessTask({ ...productionTask, startedAt: productionTask.startedAt || '2026-07-15 10:00:00' })
  const productionWarehouseLinkage = applyDyeWarehouseLinkageAfterAction({
    success: true,
    sourceType: 'DYE',
    sourceId: productionOrder.dyeOrderId,
    taskId: productionOrder.taskId,
    actionCode: 'DYE_FINISH_PACKING',
    previousStatus: 'PACKING',
    nextStatus: 'WAIT_HANDOVER',
    objectQty: productionOrder.plannedQty,
  })
  assert.equal(productionWarehouseLinkage.success, false, '生产单没有实际包装节点也不能伪造入仓')
  assert.throws(()=>submitDyeHandover(productionOrder.taskId,{submittedQty:productionOrder.plannedQty}),/逐卷建单/)
  ensureHandoverOrderForStartedTask(productionOrder.taskId)
  const productionPdaHead = listHandoverOrdersByTaskId(productionOrder.taskId)[0]
  assert.equal(productionPdaHead?.sourceType, 'PRODUCTION_ORDER', '生产单染色 PDA 交出单来源必须是 PRODUCTION_ORDER')
  assert.equal(productionPdaHead?.productionOrderId, productionOrder.sourceProductionOrderId, '生产单染色 PDA 交出单必须保留生产单 ID')
  assert.equal(productionPdaHead?.productionOrderNo, productionOrder.sourceProductionOrderNo, '生产单染色 PDA 交出单必须保留生产单号')
  assert.equal(productionPdaHead?.stockMaterialId, undefined, '生产单染色 PDA 交出单不得携带备货来源')
  assert.deepEqual(getPdaHandoverSourceDisplay(productionPdaHead!), { label: '生产单号', value: productionOrder.sourceProductionOrderNo }, '生产单染色 PDA 页面必须展示生产单号')
  const productionPdaHtml = renderPdaHandoverDetailPage(productionPdaHead!.handoverId)
  assert(productionPdaHtml.includes('生产单自动生成') && productionPdaHtml.includes('生产单号'), '生产单染色 PDA 必须显示统一来源与对象')
  const downstreamPartialRow = onlineRows.find((order) => order.handoverStatus === 'FULL_HANDOVER' && order.downstreamReceivedQty > 0 && order.downstreamReceivedQty < order.handedOverQty)
  assert(downstreamPartialRow, '需要至少一条全部交出、下游部分接收的染色加工单')
  assert(getDyeOrderHandoverSummary(downstreamPartialRow.dyeOrderId).writtenBackQty > 0, '下游部分接收必须来自真实接收回写')

  const startValidation = validateDyeStartPayload({})
  assert(!startValidation.ok, '没有染缸编号时不能进入染色中')

  const vatSchedules = listDyeVatSchedules()
  assert(vatSchedules.length > 0, '需要染缸排期数据')
  assert(vatSchedules.every((item) => Boolean(item.dyeVatNo && item.capacityQty > 0)), '染缸排期必须包含染缸编号和容量')

  const formulas = listDyeFormulaRecords()
  assert(formulas.length > 0, '需要染色配方数据')
  assert(formulas.every((item) => Boolean(item.dyeOrderId || item.taskId)), '染色配方必须关联染色加工单或染色任务')
  assert(formulas.every((item) => !('handoverOrderId' in item) && !('taskQrValue' in item)), '染色配方不能创建交出单或任务二维码')

  const reportRows = listDyeReportRows()
  assert(orders.every((order) => reportRows.some((row) => row.dyeOrderId === order.dyeOrderId)), '染色统计需要覆盖所有加工单')
  assert(reportRows.some((row) => row.waitingReason.length > 0), '报表必须展示等待原因')
  assert(reportRows.some((row) => row.durationHours >= 0), '报表必须展示节点耗时')
  assert(reportRows.some((row) => row.dyeVatNo), '报表必须展示染缸利用')

  const reviews = listDyeReviewRecords()
  assert(reviews.some((review) => review.reviewStatus === 'REJECTED' && Boolean(review.rejectReason)), '审核驳回必须有驳回原因')
  assert(!hasDirectPackingToReviewOrCompleteTransition(), '包装后必须先进入待送货')

  const handoverLinkedOrders = orders.filter((order) => getDyeOrderHandoverSummary(order.dyeOrderId).recordCount > 0)
  assert(handoverLinkedOrders.length > 0, '染色交出必须使用通用交出单和交出记录')
  assert(handoverLinkedOrders.every((order) => getDyeOrderHandoverSummary(order.dyeOrderId).recordCount >= 1), '每条染色交出记录都要存在')

  const packingOrder = orders.find((order) => order.status === 'WAIT_HANDOVER')
  assert(packingOrder, '包装完成后必须进入待送货')
  assert(getDyeWorkOrderByTaskId(packingOrder.taskId)?.status === 'WAIT_HANDOVER', '包装后待送货节点缺失')

  const baselineOrder = orders.find((order) => order.dyeOrderId === 'DWO-006')
  assert(baselineOrder && !baselineOrder.requiresWaterSoluble && baselineOrder.status === 'DYEING', 'DWO-006 必须保持普通染色执行中基线')
  const recordedInput = getDyeExecutionNodeRecord(baselineOrder.dyeOrderId,'DYE')!.inputQty!
  assert.throws(()=>completeDyeing(baselineOrder.dyeOrderId,{inputQty:recordedInput+1,outputQty:recordedInput}),/不能修改/,'完工不能篡改已扣库投入')
  assert.throws(()=>completeDyeing(baselineOrder.dyeOrderId,{outputQty:recordedInput+1}),/不能超过/)
  completeDyeing(baselineOrder.dyeOrderId,{outputQty:recordedInput-1,operatorName:'普通染色基线检查员'})
  assert.equal(getDyeExecutionNodeRecord(baselineOrder.dyeOrderId,'DYE')?.lossQty,1)

  printTerms.forEach((term) => {
    assertNotIncludes(workOrdersSource, term, '染色加工单页面')
    assertNotIncludes(formulaSource, term, '染色配方页面')
    assertNotIncludes(reportsSource, term, '染色统计页面')
    const dyeDataSource = readFile('src/data/fcs/dyeing-task-domain.ts')
    assertNotIncludes(dyeDataSource, term, '染色数据域')
  })

  assertNotIncludes(handoverSource, ['交出', '头'].join(''), '交出单列表页面')
  assertNotIncludes(handoverDetailSource, ['交出', '头'].join(''), '交出单详情页面')

  console.log('[check-dyeing-workflow] PASS')
  console.log(`  染色加工单: ${orders.length}`)
  console.log(`  染色配方: ${formulas.length}`)
  console.log(`  染缸排期: ${vatSchedules.length}`)
  console.log(`  待审核: ${reviews.filter((review) => review.reviewStatus === 'WAIT_REVIEW').length}`)
}

main()
