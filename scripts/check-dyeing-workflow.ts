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
  listDyeReportRows,
  listDyeReviewRecords,
  listDyeVatSchedules,
  listDyeWorkOrders,
  validateDyeStartPayload,
  prepareFormalProductionOrderDyeWorkOrderSync,
} from '../src/data/fcs/dyeing-task-domain.ts'
import {
  completeCombinedDyeingTask,
  correctCombinedDyeingResult,
  createCombinedDyeingTask,
  deleteCombinedDyeingTask,
} from '../src/data/fcs/combined-dyeing-domain.ts'
import { buildDyeWorkOrderCombinedDyeingView } from '../src/data/fcs/dye-work-order-combined-dyeing-view.ts'
import {
  removeCombinedDyeingTaskIdFromUrl,
  resolveCombinedDyeingDeepLink,
  shouldClearCombinedDyeingOverlay,
} from '../src/data/fcs/combined-dyeing-deep-link.ts'
import { getMobileExecutionTaskById } from '../src/data/fcs/mobile-execution-task-index.ts'
import { listPdaGenericProcessTasks, registerPdaGenericProcessTask } from '../src/data/fcs/pda-task-mock-factory.ts'
import { submitDyeHandover } from '../src/data/fcs/process-execution-writeback.ts'
import { applyDyeWarehouseLinkageAfterAction } from '../src/data/fcs/process-warehouse-linkage-service.ts'
import { getProcessWarehouseRecordById, listProcessHandoverRecords } from '../src/data/fcs/process-warehouse-domain.ts'
import { getPdaHandoverSourceDisplay, listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'
import { listFactoryWaitProcessStockItems, upsertFactoryWaitProcessStockItem } from '../src/data/fcs/factory-internal-warehouse.ts'
import { buildTaskDeliveryCardPrintDocByRecordId, buildTaskRouteCardPrintDoc } from '../src/data/fcs/task-print-cards.ts'

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
  assertIncludes(reportsSource, '差异面料米数', '染色统计页面')
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
  const orders = listDyeWorkOrders()
  const taskSourcesBeforeRepeatedQueries = sourceIdentitySnapshot()
  listDyeWorkOrders()
  getDyeWorkOrderByTaskId(orders[0]!.taskId)
  assert.deepEqual(sourceIdentitySnapshot(), taskSourcesBeforeRepeatedQueries, '重复 list/get 染色加工单不得改写 PDA 任务来源字段')
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

  const combinedDemoA = getDyeWorkOrderById('DYE-COMBINED-DEMO-001')!
  const combinedDemoB = getDyeWorkOrderById('DYE-COMBINED-DEMO-002')!
  const noHistoryOrder = orders.find((order) => order.sourceType === 'PRODUCTION_ORDER' && order.formalProductionOrderSnapshot && !order.combinedDyeing)!
  assert(combinedDemoA && combinedDemoB && noHistoryOrder, '需要合并染色联动展示测试加工单')
  assert.equal(buildDyeWorkOrderCombinedDyeingView(noHistoryOrder), undefined, '无合并历史的生产单加工单不得伪造合并投影')
  const noHistorySnapshot = noHistoryOrder.formalProductionOrderSnapshot!
  assert(noHistorySnapshot, '无合并历史测试加工单必须有生产单快照')
  const autoSyncOnlyOrder = {
    ...structuredClone(noHistoryOrder),
    autoSyncHistory: [{
      changeRecordId: 'CHANGE-AUTO-SYNC-ONLY',
      before: structuredClone(noHistorySnapshot),
      after: { ...structuredClone(noHistorySnapshot), plannedQty: noHistorySnapshot.plannedQty + 10 },
      syncedAt: '2026-07-16 07:10:00',
    }],
  }
  const changeImpactOnlyOrder = {
    ...structuredClone(noHistoryOrder),
    changeImpact: [{
      changeRecordId: 'CHANGE-IMPACT-ONLY',
      before: structuredClone(noHistorySnapshot),
      after: { ...structuredClone(noHistorySnapshot), plannedQty: noHistorySnapshot.plannedQty + 20 },
      reason: '已执行' as const,
      recordedAt: '2026-07-16 07:20:00',
      suggestedAction: '业务人员确认变更影响',
    }],
  }
  const changeOnlyVariants = [
    autoSyncOnlyOrder,
    changeImpactOnlyOrder,
    {
      ...structuredClone(noHistoryOrder),
      autoSyncHistory: autoSyncOnlyOrder.autoSyncHistory,
      changeImpact: changeImpactOnlyOrder.changeImpact,
    },
  ]
  changeOnlyVariants.forEach((order, index) => {
    const view = buildDyeWorkOrderCombinedDyeingView(order)!
    assert(view, `仅生产变更记录场景 ${index + 1} 仍需返回详情投影`)
    assert.equal(view.hasCombinedDyeingHistory, false, `仅生产变更记录场景 ${index + 1} 不得伪造合并染色历史`)
    assert.equal(view.activeTask, undefined, `仅生产变更记录场景 ${index + 1} 不得伪造活动任务`)
    assert.equal(view.requiredQty, 0, `仅生产变更记录场景 ${index + 1} 的合并需求必须为 0`)
    assert.equal(view.currentEffectiveAllocationQty, 0, `仅生产变更记录场景 ${index + 1} 的有效分配必须为 0`)
    assert.equal(view.unmetQty, 0, `仅生产变更记录场景 ${index + 1} 的未满足必须为 0`)
    assert.deepEqual(view.history, [], `仅生产变更记录场景 ${index + 1} 的合并任务历史必须为空`)
    assert.deepEqual(view.allocationVersions, [], `仅生产变更记录场景 ${index + 1} 的分配版本必须为空`)
  })

  const combinedTask = createCombinedDyeingTask({
    dyeWorkOrderIds: [combinedDemoA.dyeOrderId, combinedDemoB.dyeOrderId],
    createdBy: '染厂主管',
    createdAt: '2026-07-16 08:00:00',
  })
  const waitingProjection = buildDyeWorkOrderCombinedDyeingView(getDyeWorkOrderById(combinedDemoA.dyeOrderId)!)!
  assert.equal(waitingProjection.hasCombinedDyeingHistory, true, '活动任务必须标记存在合并染色历史')
  assert.equal(waitingProjection.activeTask?.taskNo, combinedTask.taskNo, '活动合并任务必须投影平台任务号')
  assert.equal(waitingProjection.occupiedByActiveTask, true, '待染色任务必须显示当前占用')
  assert.equal(waitingProjection.currentEffectiveAllocationQty, 0, '待染色任务尚无有效分配')
  assert.equal(waitingProjection.satisfaction, 'UNMET', '待染色任务必须显示未满足')
  const activeAndDeletedTasks = [
    { taskId: combinedTask.taskId, status: 'WAIT_DYEING' },
    { taskId: 'COMBINED-DYE-DELETED', status: 'DELETED' },
  ]
  assert.deepEqual(resolveCombinedDyeingDeepLink(`?taskId=${combinedTask.taskId}`, activeAndDeletedTasks), { kind: 'detail', taskId: combinedTask.taskId }, '活动任务深链必须解析为目标详情')
  assert.deepEqual(resolveCombinedDyeingDeepLink('?taskId=COMBINED-DYE-DELETED', activeAndDeletedTasks), { kind: 'detail', taskId: 'COMBINED-DYE-DELETED' }, '已删除任务深链必须仍解析为历史详情')
  assert.deepEqual(resolveCombinedDyeingDeepLink('?taskId=NOT-FOUND', activeAndDeletedTasks), { kind: 'invalid', taskId: 'NOT-FOUND' }, '不存在任务深链必须安全识别为非法')
  assert.deepEqual(resolveCombinedDyeingDeepLink('', activeAndDeletedTasks), { kind: 'none' }, '无 taskId 查询时必须保持列表')
  assert.equal(shouldClearCombinedDyeingOverlay({ kind: 'none' }, ''), false, '无 query 不得清除人工打开的创建或详情 overlay')
  assert.equal(shouldClearCombinedDyeingOverlay({ kind: 'none' }, combinedTask.taskId), true, '外部移除 query 时必须关闭此前由深链打开的详情')
  assert.equal(shouldClearCombinedDyeingOverlay({ kind: 'invalid', taskId: 'NOT-FOUND' }, combinedTask.taskId), true, '非法 taskId 必须清除旧深链详情')
  assert.equal(removeCombinedDyeingTaskIdFromUrl('/fcs/craft/dyeing/combined-dyeing?taskId=COMBINED-DYE-001&from=work-order#history'), '/fcs/craft/dyeing/combined-dyeing?from=work-order#history', '关闭深链详情必须只移除 taskId 并保留其他查询和 hash')

  completeCombinedDyeingTask(combinedTask.taskId, {
    actualInputQty: 1250,
    actualOutputQty: 1200,
    completedBy: '染厂主管',
    completedAt: '2026-07-16 09:00:00',
  })
  const fullProjection = buildDyeWorkOrderCombinedDyeingView(getDyeWorkOrderById(combinedDemoA.dyeOrderId)!)!
  const partialProjection = buildDyeWorkOrderCombinedDyeingView(getDyeWorkOrderById(combinedDemoB.dyeOrderId)!)!
  assert.equal(fullProjection.currentEffectiveAllocationQty, 600, '第一张加工单必须按顺序足量分配')
  assert.equal(fullProjection.satisfaction, 'FULL', '第一张加工单必须显示已满足')
  assert.equal(partialProjection.currentEffectiveAllocationQty, 400, '第二张加工单必须显示当前有效分配')
  assert.equal(partialProjection.satisfaction, 'FULL', '第二张加工单必须显示已满足')
  assert.equal(partialProjection.unmetQty, 0, '第二张加工单足量后未满足数量必须为 0')
  assert.equal(partialProjection.allocationVersions[0]?.excessQty, 200, '超量完成必须保留领域版本的权威超出数量')

  const beforeSnapshot = getDyeWorkOrderById(combinedDemoB.dyeOrderId)!.formalProductionOrderSnapshot!
  const protectedChange = prepareFormalProductionOrderDyeWorkOrderSync({
    ...beforeSnapshot,
    plannedQty: 450,
    dyeProcessName: beforeSnapshot.processName,
  }, { changeRecordId: 'CHANGE-DYE-WORKFLOW-COMBINED-001', recordedAt: '2026-07-16 09:10:00' })
  assert.equal(protectedChange.outcome, 'PROTECTED', '活动合并任务中的加工单变更必须保护原快照')
  protectedChange.commit()
  const impactedProjection = buildDyeWorkOrderCombinedDyeingView(getDyeWorkOrderById(combinedDemoB.dyeOrderId)!)!
  assert.equal(impactedProjection.changeImpacts.length, 1, '详情投影必须保留生产单变更影响')
  assert.equal(impactedProjection.changeImpacts[0]!.before.plannedQty, 400, '变更影响必须保留变更前数量')
  assert.equal(impactedProjection.changeImpacts[0]!.after.plannedQty, 450, '变更影响必须显示变更后数量')
  assert.equal(getDyeWorkOrderById(combinedDemoB.dyeOrderId)!.plannedQty, 400, '受保护加工单不得覆盖原执行快照')

  correctCombinedDyeingResult(combinedTask.taskId, {
    actualInputQty: 1150,
    actualOutputQty: 1100,
    reason: '复核后更正产出',
    correctedBy: '染厂主管',
    correctedAt: '2026-07-16 10:00:00',
  })
  const correctedProjection = buildDyeWorkOrderCombinedDyeingView(getDyeWorkOrderById(combinedDemoB.dyeOrderId)!)!
  assert.equal(correctedProjection.satisfaction, 'FULL', '更正后必须按当前版本显示已满足')
  assert.equal(correctedProjection.currentEffectiveAllocationQty, 400, '更正后有效分配必须重算')
  assert.deepEqual(correctedProjection.allocationVersions.map((version) => version.versionNo), [1, 2], '更正前后分配版本必须永久保留')
  assert.deepEqual(correctedProjection.allocationVersions.map((version) => version.excessQty), [200, 100], '更正前后必须保留各自不同的权威超出数量')
  assert.equal(correctedProjection.allocationVersions.filter((version) => version.current).length, 1, '只能有一个当前分配版本')

  const activeDetailSource = readFile('src/pages/process-factory/dyeing/work-order-detail.ts')
  ;['合并染色', '成员已锁定', '当前有效分配', '生产单变更影响', '建议动作'].forEach((text) => {
    assertIncludes(activeDetailSource, text, '染色加工单详情联动')
  })

  deleteCombinedDyeingTask(combinedTask.taskId, {
    deletedBy: '染厂主管',
    deletedAt: '2026-07-16 11:00:00',
    reason: '现场复核后删除任务',
  })
  const deletedProjection = buildDyeWorkOrderCombinedDyeingView(getDyeWorkOrderById(combinedDemoB.dyeOrderId)!)!
  assert.equal(deletedProjection.hasCombinedDyeingHistory, true, '软删除后仍必须标记存在合并染色历史')
  assert.equal(deletedProjection.activeTask, undefined, '已删除任务不得伪装为当前占用')
  assert.equal(deletedProjection.occupiedByActiveTask, false, '已删除任务必须解除当前占用')
  assert.equal(deletedProjection.currentEffectiveAllocationQty, 400, '删除已完成任务后有效分配事实仍保留')
  assert.equal(deletedProjection.history[0]?.status, 'DELETED', '已删除任务必须保留历史事实')
  assert.equal(deletedProjection.history[0]?.deleteReason, '现场复核后删除任务', '删除历史必须保留删除原因')
  assert.deepEqual(deletedProjection.allocationVersions.map((version) => version.excessQty), [200, 100], '软删除后投影仍必须永久保留每版超出数量')
  assertIncludes(activeDetailSource, '历史任务', '删除后详情必须继续展示历史事实')

  const stockTemplate = listFactoryWaitProcessStockItems().find((item) => item.itemKind === '面料' && item.receivedQty > 0 && item.materialSku)!
  const realStock = upsertFactoryWaitProcessStockItem({
    ...stockTemplate,
    stockItemId: 'WPS-DYE-WORKFLOW-QUALIFIED',
    sourceRecordId: 'INB-DYE-WORKFLOW-QUALIFIED',
    sourceRecordNo: 'RK-DYE-WORKFLOW-QUALIFIED',
    factoryId: orders[0]!.dyeFactoryId,
    factoryName: orders[0]!.dyeFactoryName,
    warehouseId: `FIW-${orders[0]!.dyeFactoryId}-WAIT_PROCESS`,
    warehouseName: `${orders[0]!.dyeFactoryName} · 待加工仓`,
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
  assert.equal(buildDyeWorkOrderCombinedDyeingView(stockCreated.order), undefined, '备货加工单不得显示生产单合并染色投影')
  const stockRouteCard = buildTaskRouteCardPrintDoc({ sourceType: 'DYEING_WORK_ORDER', sourceId: stockCreated.order.dyeOrderId })
  assert.equal(stockRouteCard.workOrderSourceType, 'STOCK', '备货任务流转卡必须保留备货来源类型')
  assert.equal(stockRouteCard.stockMaterialId, realStock.stockItemId, '备货任务流转卡必须保留备货物料 ID')
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
  const stockWarehouseRecord = getProcessWarehouseRecordById(stockWarehouseLinkage.createdWaitHandoverWarehouseRecordId)
  assert.equal(stockWarehouseRecord?.sourceType, 'STOCK', '备货染色仓记录来源必须是 STOCK')
  assert.equal(stockWarehouseRecord?.stockMaterialId, realStock.stockItemId, '备货染色仓记录必须保留 stockMaterialId')
  assert.equal(stockWarehouseRecord?.sourceProductionOrderId, undefined, '备货染色仓记录不得保留空生产单 ID')
  assert.equal(stockWarehouseRecord?.sourceDemandId, undefined, '备货染色仓记录不得保留空需求 ID')
  const stockSubmit = submitDyeHandover(stockCreated.order.taskId, { submittedQty: stockCreated.order.plannedQty })
  const stockDeliveryCard = buildTaskDeliveryCardPrintDocByRecordId(stockSubmit.handoverRecord.handoverRecordId || stockSubmit.handoverRecord.recordId)
  assert.equal(stockDeliveryCard.sourceType, 'STOCK', '备货任务交货卡必须保留备货来源类型')
  assert.equal(stockDeliveryCard.stockMaterialId, realStock.stockItemId, '备货任务交货卡必须保留备货物料 ID')
  assert(stockDeliveryCard.summaryRows.some((row) => row.label === '备货物料' && row.value === realStock.itemName), '备货任务交货卡必须展示备货物料')
  assert(!stockDeliveryCard.summaryRows.some((row) => row.label === '生产单号'), '备货任务交货卡不得展示空生产单号')
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
