import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import assert from 'node:assert/strict'

import {
  completeDyeing,
  createDyeWorkOrderFromStock,
  getDyeExecutionNodeRecord,
  getDyeOrderHandoverSummary,
  getDyeWorkOrderByTaskId,
  hasDirectPackingToReviewOrCompleteTransition,
  listDyeFormulaRecords,
  listDyeReportRows,
  listDyeReviewRecords,
  listDyeVatSchedules,
  listDyeWorkOrders,
  validateDyeStartPayload,
} from '../src/data/fcs/dyeing-task-domain.ts'
import { getMobileExecutionTaskById } from '../src/data/fcs/mobile-execution-task-index.ts'
import { listPdaGenericProcessTasks, registerPdaGenericProcessTask } from '../src/data/fcs/pda-task-mock-factory.ts'
import { submitDyeHandover } from '../src/data/fcs/process-execution-writeback.ts'
import { applyDyeWarehouseLinkageAfterAction } from '../src/data/fcs/process-warehouse-linkage-service.ts'
import { getProcessWarehouseRecordById, listProcessHandoverRecords } from '../src/data/fcs/process-warehouse-domain.ts'
import { getPdaHandoverSourceDisplay, listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'
import { listFactoryWaitProcessStockItems } from '../src/data/fcs/factory-internal-warehouse.ts'

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
    makeText(['trans', 'fer']),
  ]

  for (const file of dyePages) {
    const source = readFile(file)
    placeholderTerms.forEach((term) => assertNotIncludes(source, term, file))
    dyePdaTerms.forEach((term) => assertNotIncludes(source, term, file))
  }

  const workOrdersSource = readFile('src/pages/process-factory/dyeing/work-orders.ts')
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
  ;['按需求创建', '选择染色需求', '染色需求单号'].forEach((term) => {
    assertNotIncludes(platformOrdersSource, term, '平台染色加工单页面')
  })
  assertIncludes(workOrdersSource, '打印任务流转卡', '染色加工单页面')
  assertIncludes(workOrdersSource, "buildTaskRouteCardPrintLink('DYEING_WORK_ORDER', order.dyeOrderId)", '染色加工单打印任务流转卡必须使用 DYEING_WORK_ORDER + dyeOrderId')
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
  assertIncludes(reportsSource, '差异面料米数', '染色统计页面')
  assertIncludes(reportsSource, '染色有差异交出记录数', '染色统计页面')
  assertIncludes(taskDetailSource, '染色任务', '任务详情页面')
  assertIncludes(taskDetailSource, '染缸编号', '任务详情页面')
  assertIncludes(taskDetailSource, '待送货', '任务详情页面')

  const orders = listDyeWorkOrders()
  assert(orders.length >= 6, '染色加工单数据不足')
  assert(orders.every((order) => Boolean(order.taskId && order.taskNo)), '染色加工单必须关联染色任务')
  assert(orders.every((order) => order.taskQrValue.startsWith('FCS:TASK:v1:')), '染色任务必须有任务二维码')
  assert(orders.some((order) => order.status === 'WAIT_HANDOVER'), '染色任务必须包含待送货状态')
  assert(orders.some((order) => order.status === 'WAIT_REVIEW'), '染色任务必须包含待审核状态')
  assert(orders.every((order) => order.receiverName === '中转区域' || order.receiverName === '仓库'), '接收方必须是中转区域或仓库')
  assert(orders.every((order) => !order.targetTransferWarehouseName.includes('裁床仓') && !order.targetTransferWarehouseName.includes('裁片仓')), '染色完成后不能直接进入裁床仓')
  assert(orders.some((order) => Boolean(order.handoverOrderId)), '开工后的染色任务必须有交出单')
  orders.forEach((order) => {
    if (order.sourceType === 'PRODUCTION_ORDER') {
      assert(Boolean(order.sourceProductionOrderId), `${order.dyeOrderNo} 生产单来源必须有唯一 sourceProductionOrderId`)
      assert(!order.stockMaterialId, `${order.dyeOrderNo} 生产单来源不得携带 stockMaterialId`)
      return
    }
    assert(order.sourceType === 'STOCK', `${order.dyeOrderNo} 来源类型只能是生产单或备货`)
    assert(Boolean(order.stockMaterialId), `${order.dyeOrderNo} 备货来源必须有 stockMaterialId`)
    assert(!order.sourceProductionOrderId, `${order.dyeOrderNo} 备货来源不得伪造 sourceProductionOrderId`)
  })

  const realStock = listFactoryWaitProcessStockItems().find((item) => item.itemKind === '面料' && item.receivedQty > 0 && item.materialSku)!
  const stockCreated = createDyeWorkOrderFromStock({
    stockMaterialId: realStock.stockItemId,
    stockMaterialName: realStock.itemName,
    materialSku: realStock.materialSku!,
    factoryId: orders[0]!.dyeFactoryId,
    plannedQty: 80,
    qtyUnit: realStock.unit,
    plannedFinishAt: '2026-07-31 18:00',
    processName: '常规染色',
    targetColor: '海军蓝',
  })
  assert(stockCreated.ok && stockCreated.order, '备货必须可以直接创建染色加工单')
  assert.equal(stockCreated.order.sourceType, 'STOCK', '备货染色加工单来源必须是 STOCK')
  assert.equal(stockCreated.order.stockMaterialId, realStock.stockItemId, '备货染色加工单必须保留 stockMaterialId')
  assert(!stockCreated.order.sourceProductionOrderId, '备货染色加工单不得伪造生产单')
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
  const stockWarehouseRecord = getProcessWarehouseRecordById(stockWarehouseLinkage.createdWaitHandoverWarehouseRecordId)
  assert.equal(stockWarehouseRecord?.sourceType, 'STOCK', '备货染色仓记录来源必须是 STOCK')
  assert.equal(stockWarehouseRecord?.stockMaterialId, realStock.stockItemId, '备货染色仓记录必须保留 stockMaterialId')
  assert.equal(stockWarehouseRecord?.sourceProductionOrderId, undefined, '备货染色仓记录不得保留空生产单 ID')
  assert.equal(stockWarehouseRecord?.sourceDemandId, undefined, '备货染色仓记录不得保留空需求 ID')
  const stockSubmit = submitDyeHandover(stockCreated.order.taskId, { submittedQty: stockCreated.order.plannedQty })
  const stockPdaHead = listHandoverOrdersByTaskId(stockCreated.order.taskId)[0]
  assert.equal(stockPdaHead?.sourceType, 'STOCK', '备货染色 PDA 交出单来源必须是 STOCK')
  assert.equal(stockPdaHead?.stockMaterialId, realStock.stockItemId, '备货染色 PDA 交出单必须保留 stockMaterialId')
  assert.equal(stockPdaHead?.productionOrderId, undefined, '备货染色 PDA 交出单不得写生产单 ID')
  assert.equal(stockPdaHead?.productionOrderNo, undefined, '备货染色 PDA 交出单不得写生产单号')
  assert.deepEqual(getPdaHandoverSourceDisplay(stockPdaHead!), { label: '备货物料', value: `${realStock.itemName} / ${realStock.stockItemId}` }, '备货染色 PDA 页面必须展示备货物料')
  assert.equal(stockSubmit.handoverRecord.sourceType, 'STOCK', '备货染色 PDA 交出记录来源必须是 STOCK')
  assert.equal(stockSubmit.handoverRecord.stockMaterialId, realStock.stockItemId, '备货染色 PDA 交出记录必须保留 stockMaterialId')
  assert.equal(stockSubmit.handoverRecord.stockMaterialName, realStock.itemName, '备货染色 PDA 交出记录必须保留 stockMaterialName')
  assert.equal(stockSubmit.handoverRecord.productionOrderId, undefined, '备货染色 PDA 交出记录不得写生产单 ID')
  assert.equal(stockSubmit.handoverRecord.productionOrderNo, undefined, '备货染色 PDA 交出记录不得写生产单号')
  const stockHandoverRecord = listProcessHandoverRecords({ sourceWorkOrderId: stockCreated.order.dyeOrderId })
    .find((record) => record.sourceType === 'STOCK')
  assert.equal(stockHandoverRecord?.stockMaterialId, realStock.stockItemId, '备货染色交出回写必须保留 stockMaterialId')
  assert.equal(stockHandoverRecord?.sourceProductionOrderId, undefined, '备货染色交出回写不得保留空生产单 ID')

  const productionOrder = orders.find((order) => order.sourceType === 'PRODUCTION_ORDER')!
  const productionTask = listPdaGenericProcessTasks().find((task) => task.taskId === productionOrder.taskId)
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
  const productionWarehouseRecord = getProcessWarehouseRecordById(productionWarehouseLinkage.createdWaitHandoverWarehouseRecordId)
  assert.equal(productionWarehouseRecord?.sourceType, 'PRODUCTION_ORDER', '生产单染色仓记录来源必须是 PRODUCTION_ORDER')
  assert.equal(productionWarehouseRecord?.sourceProductionOrderId, productionOrder.sourceProductionOrderId, '生产单染色仓记录必须保留生产单 ID')
  assert.equal(productionWarehouseRecord?.stockMaterialId, undefined, '生产单染色仓记录不得携带备货来源')
  const productionSubmit = submitDyeHandover(productionOrder.taskId, { submittedQty: productionOrder.plannedQty })
  const productionPdaHead = listHandoverOrdersByTaskId(productionOrder.taskId)[0]
  assert.equal(productionPdaHead?.sourceType, 'PRODUCTION_ORDER', '生产单染色 PDA 交出单来源必须是 PRODUCTION_ORDER')
  assert.equal(productionPdaHead?.productionOrderId, productionOrder.sourceProductionOrderId, '生产单染色 PDA 交出单必须保留生产单 ID')
  assert.equal(productionPdaHead?.productionOrderNo, productionOrder.sourceProductionOrderNo, '生产单染色 PDA 交出单必须保留生产单号')
  assert.equal(productionPdaHead?.stockMaterialId, undefined, '生产单染色 PDA 交出单不得携带备货来源')
  assert.deepEqual(getPdaHandoverSourceDisplay(productionPdaHead!), { label: '生产单号', value: productionOrder.sourceProductionOrderNo }, '生产单染色 PDA 页面必须展示生产单号')
  assert.equal(productionSubmit.handoverRecord.productionOrderId, productionOrder.sourceProductionOrderId, '生产单染色 PDA 交出记录必须保留生产单 ID')
  assert.equal(productionSubmit.handoverRecord.productionOrderNo, productionOrder.sourceProductionOrderNo, '生产单染色 PDA 交出记录必须保留生产单号')
  assert.equal(productionSubmit.handoverRecord.stockMaterialId, undefined, '生产单染色 PDA 交出记录不得携带备货来源')
  assert.equal(productionSubmit.handoverRecord.stockMaterialName, undefined, '生产单染色 PDA 交出记录不得携带备货名称')
  const productionHandoverRecord = listProcessHandoverRecords({ sourceWorkOrderId: productionOrder.dyeOrderId })
    .find((record) => record.sourceType === 'PRODUCTION_ORDER')
  assert.equal(productionHandoverRecord?.sourceProductionOrderId, productionOrder.sourceProductionOrderId, '生产单染色交出回写必须保留生产单 ID')
  assert.equal(productionHandoverRecord?.stockMaterialId, undefined, '生产单染色交出回写不得携带备货来源')

  const waitReviewOrder = orders.find((order) => order.status === 'WAIT_REVIEW')
  assert(waitReviewOrder, '需要至少一条待审核染色加工单')
  assert(getDyeOrderHandoverSummary(waitReviewOrder.dyeOrderId).writtenBackQty > 0, '接收方回写后才能进入待审核')

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
  completeDyeing(baselineOrder.dyeOrderId, { inputQty: 1200, outputQty: 1101, operatorName: '普通染色基线检查员' })
  const baselineCompletedNode = getDyeExecutionNodeRecord(baselineOrder.dyeOrderId, 'DYE')
  assert.equal(baselineCompletedNode?.inputQty, 1200, '普通染色必须保留调用方 inputQty 基线行为')
  assert.equal(baselineCompletedNode?.outputQty, 1101, '普通染色 outputQty 超过旧节点投入时不得被组合单上限误伤')
  assert.equal(baselineCompletedNode?.lossQty, 99, '普通染色必须继续按调用方投入计算损耗')

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
