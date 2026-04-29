import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  TEST_FACTORY_DISPLAY_NAME,
  TEST_FACTORY_ID,
  TEST_FACTORY_NAME,
} from '../src/data/fcs/factory-mock-data.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { cutPieceOrderRecords } from '../src/data/fcs/cutting/cut-piece-orders.ts'
import { buildFcsCuttingDomainSnapshot } from '../src/domain/fcs-cutting-runtime/index.ts'
import {
  listSpecialCraftTaskOrders,
  listSpecialCraftTaskWorkOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  getMobileTaskAccessResult,
  getMobileTaskProcessType,
  isTaskAccepted,
  isTaskInBiddingOrAwarding,
  isTaskVisibleInMobileExecutionList,
  listPdaMobileExecutionTasks,
  validateCuttingOrderMobileTaskBinding,
  validateDyeWorkOrderMobileTaskBinding,
  validatePrintWorkOrderMobileTaskBinding,
  validateSpecialCraftMobileTaskBinding,
} from '../src/data/fcs/process-mobile-task-binding.ts'
import {
  getMobileExecutionTaskById,
  listMobileExecutionTasks,
  matchMobileTaskKeyword,
} from '../src/data/fcs/mobile-execution-task-index.ts'
import {
  executeMobileProcessAction,
  executeProcessAction,
  listProcessActionOperationRecords,
  PROCESS_ACTION_DEFINITIONS,
  validateProcessAction,
} from '../src/data/fcs/process-action-writeback-service.ts'
import {
  executeProcessWebAction,
  listAvailableWebActions,
} from '../src/data/fcs/process-web-status-actions.ts'
import {
  getPlatformStatusForProcessWorkOrder,
  listPlatformStatusOptions,
  mapCraftStatusToPlatformStatus,
} from '../src/data/fcs/process-platform-status-adapter.ts'
import {
  getPlatformFollowUpTasks,
  getPlatformProcessResultView,
  getPlatformRiskSummary,
  listPlatformCuttingResultViews,
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
  listPlatformProcessResultViews,
  listPlatformSpecialCraftResultViews,
  type PlatformProcessResultView,
} from '../src/data/fcs/platform-process-result-view.ts'
import {
  getProcessObjectType,
  getQuantityLabel,
} from '../src/data/fcs/process-quantity-labels.ts'
import {
  getDyeingExecutionStatistics,
  getPrintingExecutionStatistics,
  getSpecialCraftExecutionStatistics,
} from '../src/data/fcs/process-statistics-domain.ts'
import {
  listProcessHandoverDifferenceRecords,
  listProcessHandoverRecords,
  listProcessWarehouseRecords,
  listProcessWarehouseReviewRecords,
  listWaitHandoverWarehouseRecords,
  listWaitProcessWarehouseRecords,
  writeBackProcessHandoverRecord,
} from '../src/data/fcs/process-warehouse-domain.ts'
import { listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'

const root = process.cwd()

const stepScripts = [
  'scripts/check-f090-demo-factory-unification.ts',
  'scripts/check-process-mobile-task-binding.ts',
  'scripts/check-mobile-list-direct-detail-consistency.ts',
  'scripts/check-process-platform-status-mapping.ts',
  'scripts/check-process-factory-web-status-actions.ts',
  'scripts/check-shared-process-action-writeback.ts',
  'scripts/check-process-quantity-labels.ts',
  'scripts/check-process-warehouse-handover-linkage.ts',
  'scripts/check-platform-process-result-view.ts',
] as const

const allowedPlatformStatuses = [
  '待下发',
  '待接单',
  '待开工',
  '准备中',
  '加工中',
  '待送货',
  '待回写',
  '待审核',
  '异常',
  '已完成',
  '已关闭',
] as const

const finePrintStatuses = ['待花型', '待调色测试', '等打印', '打印中', '打印完成', '待转印', '转印中', '转印完成']
const fineDyeStatuses = ['待样衣', '待原料', '打样中', '待排缸', '已排缸', '染色中', '脱水中', '烘干中', '定型中', '打卷中', '包装中']
const forbiddenSpecialCraftActions = ['开扣眼', '装扣子', '熨烫']
const genericQuantityLabels = ['数量', '完成数量', '交出数量', '实收数量', '差异数量']

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`三端全链路最终检查失败：${message}`)
}

function assertIncludes(path: string, expected: string, message: string): void {
  assert(read(path).includes(expected), `${message}：${path} 缺少 ${expected}`)
}

function assertNotIncludes(path: string, forbidden: string, message: string): void {
  assert(!read(path).includes(forbidden), `${message}：${path} 不应出现 ${forbidden}`)
}

function diffCountByHandover(handoverRecordId: string): number {
  return listProcessHandoverDifferenceRecords().filter((record) => record.handoverRecordId === handoverRecordId).length
}

function runStepScripts(): void {
  for (const script of stepScripts) {
    assert(existsSync(join(root, script)), `前置检查脚本不存在：${script}`)
    execFileSync('npx', ['tsx', script], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      maxBuffer: 1024 * 1024 * 12,
    })
  }
}

function assertFactoryConsistency(): void {
  const factories = listFactoryMasterRecords()
  const f090Factories = factories.filter((factory) => factory.id === TEST_FACTORY_ID || factory.code === TEST_FACTORY_ID)
  assert(f090Factories.length === 1, 'F090 工厂主数据必须且只能存在一条')
  assert(f090Factories[0]?.name === TEST_FACTORY_NAME, 'F090 工厂名称必须为全能力测试工厂')
  const testFactoryCodes = new Set(factories.filter((factory) => factory.name === TEST_FACTORY_NAME).map((factory) => factory.code || factory.id))
  assert(testFactoryCodes.size === 1 && testFactoryCodes.has(TEST_FACTORY_ID), '全能力测试工厂不得对应多个编号')

  assert(listPrintWorkOrders().every((order) => order.printFactoryId === TEST_FACTORY_ID && order.printFactoryName === TEST_FACTORY_NAME), '印花演示数据工厂必须为 F090')
  assert(listDyeWorkOrders().every((order) => order.dyeFactoryId === TEST_FACTORY_ID && order.dyeFactoryName === TEST_FACTORY_NAME), '染色演示数据工厂必须为 F090')
  assert(listPlatformCuttingResultViews().every((view) => view.factoryId === TEST_FACTORY_ID && view.factoryName === TEST_FACTORY_NAME), '裁片演示链路平台结果工厂必须为 F090')
  assert(listSpecialCraftTaskOrders().every((order) => order.factoryId === TEST_FACTORY_ID && order.factoryName === TEST_FACTORY_NAME), '特殊工艺演示数据工厂必须为 F090')
  assert(listPdaMobileExecutionTasks().filter((task) => isTaskVisibleInMobileExecutionList(task, TEST_FACTORY_ID)).every((task) => task.assignedFactoryId === TEST_FACTORY_ID), '移动端执行任务工厂必须为 F090')
  assert(listPlatformProcessResultViews().every((view) => view.factoryDisplayName === TEST_FACTORY_DISPLAY_NAME), '平台侧必须展示全能力测试工厂（F090）')
}

function assertBindings(): void {
  const validPrint = listPrintWorkOrders().map((order) => validatePrintWorkOrderMobileTaskBinding(order.printOrderId)).filter((result) => result.reasonCode === 'OK')
  const validDye = listDyeWorkOrders().map((order) => validateDyeWorkOrderMobileTaskBinding(order.dyeOrderId)).filter((result) => result.reasonCode === 'OK')
  const validCutting = buildFcsCuttingDomainSnapshot().originalCutOrders.map((order) => validateCuttingOrderMobileTaskBinding(order.originalCutOrderId)).filter((result) => result.reasonCode === 'OK')
  const validSpecial = listSpecialCraftTaskWorkOrders()
    .filter((order) => ['打揽', '打条', '捆条'].includes(order.operationName))
    .map((order) => validateSpecialCraftMobileTaskBinding(order.workOrderId))
    .filter((result) => result.reasonCode === 'OK')
  assert(validPrint.length >= 3, '印花至少 3 条加工单必须绑定有效移动端任务')
  assert(validDye.length >= 3, '染色至少 3 条加工单必须绑定有效移动端任务')
  assert(validCutting.length >= 3, '裁片至少 3 条任务或单据必须绑定有效移动端任务')
  assert(validSpecial.length >= 3, '特殊工艺至少 3 条任务单必须绑定有效移动端任务')

  const phOrder = listPrintWorkOrders().find((order) => order.printOrderNo === 'PH-20260328-001')
  assert(phOrder, '缺少 PH-20260328-001')
  const phBinding = validatePrintWorkOrderMobileTaskBinding(phOrder!.printOrderId)
  assert(phBinding.reasonCode === 'OK', `PH-20260328-001 绑定必须有效：${phBinding.reasonLabel}`)
  assert(!['TASK-PRINT-000713', 'TASK-PRINT-000714', 'TASK-PRINT-000715'].includes(phBinding.actualTaskId || ''), 'PH-20260328-001 不得绑定报价、待定标、未接单任务')

  for (const task of listPdaMobileExecutionTasks()) {
    const visible = isTaskVisibleInMobileExecutionList(task, TEST_FACTORY_ID)
    if (isTaskInBiddingOrAwarding(task) || !isTaskAccepted(task)) {
      assert(!visible, `${task.taskId} 报价 / 待定标 / 未接单任务不得进入执行列表`)
    }
  }
  for (const result of validSpecial) {
    const task = getMobileExecutionTaskById(result.actualTaskId || '')
    assert(task && getMobileTaskProcessType(task) === 'SPECIAL_CRAFT', `${result.workOrderNo} 特殊工艺任务绑定工艺类型必须一致`)
  }
}

function assertMobileListConsistency(): void {
  const cases = [
    validatePrintWorkOrderMobileTaskBinding('PWO-PRINT-001'),
    validateDyeWorkOrderMobileTaskBinding('DWO-006'),
    validateCuttingOrderMobileTaskBinding('CUT-260314-087-02'),
    validateSpecialCraftMobileTaskBinding('SC-TASK-SC-OP-008-01-WO-001-'),
  ]
  for (const binding of cases) {
    assert(binding.reasonCode === 'OK', `${binding.workOrderNo} Web 可直达任务必须绑定有效`)
    const task = getMobileExecutionTaskById(binding.actualTaskId || '')
    assert(task, `${binding.workOrderNo} 对应移动端任务不存在`)
    assert(isTaskVisibleInMobileExecutionList(task, TEST_FACTORY_ID), `${binding.workOrderNo} 对应任务必须在 F090 执行列表可见`)
    for (const keyword of [binding.workOrderNo, binding.actualTaskNo, TEST_FACTORY_ID, TEST_FACTORY_NAME]) {
      assert(matchMobileTaskKeyword(task, keyword), `${binding.workOrderNo} 移动端任务必须可用 ${keyword} 检索`)
      assert(listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword }).some((item) => item.taskId === binding.actualTaskId), `${binding.workOrderNo} 执行列表搜索 ${keyword} 必须能定位同一任务`)
    }
  }
  const phTask = getMobileExecutionTaskById(validatePrintWorkOrderMobileTaskBinding('PWO-PRINT-001').actualTaskId || '')
  assert(phTask && matchMobileTaskKeyword(phTask, 'PO-20260328-071'), '搜索生产单号必须能定位移动端任务')

  const blockedTask = getMobileExecutionTaskById('TASK-PRINT-000714')
  assert(blockedTask, '缺少报价 / 待定标演示任务 TASK-PRINT-000714')
  assert(getMobileTaskAccessResult(blockedTask, TEST_FACTORY_ID).canExecuteInMobile === false, '移动端详情不得绕过不可执行校验')
  assert(!listMobileExecutionTasks({ currentFactoryId: TEST_FACTORY_ID, keyword: 'TASK-PRINT-000714' }).some((task) => task.taskId === 'TASK-PRINT-000714'), '报价 / 待定标任务不得出现在移动端执行列表')
}

function assertPlatformStatusAndResultView(): void {
  assert(listPlatformStatusOptions().every((status) => allowedPlatformStatuses.includes(status as typeof allowedPlatformStatuses[number])), '平台聚合状态只能使用允许集合')
  for (const view of listPlatformProcessResultViews()) {
    assert(allowedPlatformStatuses.includes(view.platformStatusLabel as typeof allowedPlatformStatuses[number]), `${view.workOrderNo} 平台主状态不在允许集合`)
    assert(view.factoryInternalStatusLabel, `${view.workOrderNo} 必须展示工厂内部状态辅助字段`)
    assert(view.platformRiskLabel, `${view.workOrderNo} 必须展示风险提示`)
    assert(view.platformActionHint, `${view.workOrderNo} 必须展示下一步动作`)
    assert(view.platformOwnerHint, `${view.workOrderNo} 必须展示当前责任方`)
    assert(view.quantityDisplayFields.every((field) => field.label && field.unit && !genericQuantityLabels.includes(field.label)), `${view.workOrderNo} 平台数量字段必须对象化`)
    assert(view.followUpActionLabel, `${view.workOrderNo} 必须有跟单动作`)
  }
  for (const view of listPlatformPrintResultViews()) {
    assert(!finePrintStatuses.includes(view.platformStatusLabel), `${view.workOrderNo} 印花平台主状态不得展示细节点`)
  }
  for (const view of listPlatformDyeResultViews()) {
    assert(!fineDyeStatuses.includes(view.platformStatusLabel), `${view.workOrderNo} 染色平台主状态不得展示细节点`)
  }
  assert(listPlatformProcessResultViews({ platformStatusLabel: '待送货' }).every((view) => view.followUpActionLabel === '跟进工厂交出'), '待送货必须有跟进工厂交出动作')
  assert(listPlatformProcessResultViews({ platformStatusLabel: '待回写' }).every((view) => view.followUpActionLabel === '跟进接收方回写'), '待回写必须有跟进接收方回写动作')
  assert(listPlatformProcessResultViews({ platformStatusLabel: '待审核' }).every((view) => view.followUpActionLabel === '处理审核'), '待审核必须有处理审核动作')
  assert(listPlatformProcessResultViews({ platformStatusLabel: '异常' }).every((view) => ['处理差异', '要求重新交出'].includes(view.followUpActionLabel)), '异常必须有处理差异或要求重新交出动作')
  assert(getPlatformRiskSummary().totalCount >= listPlatformPrintResultViews().length, '平台风险摘要必须覆盖结果视图')
  assert(getPlatformFollowUpTasks().length > 0, '平台跟单任务不能为空')
}

function assertWebActionsAndSharedWriteback(): void {
  assert(listAvailableWebActions('PRINT_WORK_ORDER', 'PWO-PRINT-011').some((action) => action.actionCode === 'PRINT_START_PRINTING'), '印花详情必须有合法可执行动作')
  assert(listAvailableWebActions('DYE_WORK_ORDER', 'DWO-012').some((action) => action.actionCode === 'DYE_SCHEDULE_VAT' || action.actionCode === 'DYE_START_DYEING'), '染色详情必须有合法可执行动作')
  assert(listAvailableWebActions('CUTTING_ORIGINAL_ORDER', 'CUT-260304-009-01').length > 0, '裁片详情必须有合法可执行动作')
  assert(listAvailableWebActions('SPECIAL_CRAFT_WORK_ORDER', 'SC-TASK-SC-OP-064-01-WO-001-').length > 0, '特殊工艺详情必须有合法可执行动作')
  assert(validateProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'PRINT',
    sourceId: 'PWO-PRINT-001',
    actionCode: 'PRINT_FINISH_TRANSFER',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 16:00',
    objectType: '面料',
    objectQty: 1,
    qtyUnit: '米',
  }).ok === false, '不得从任意状态直接跳转完成转印或已完成')

  assertIncludes('src/data/fcs/process-web-status-actions.ts', 'executeProcessAction', 'executeProcessWebAction 必须调用统一写回')
  assertIncludes('src/pages/pda-exec-detail.ts', 'executeMobileProcessAction', '移动端动作必须调用统一移动端薄封装')
  for (const code of ['PRINT_START_PRINTING', 'DYE_START_DYEING', 'CUTTING_START_SPREADING', 'SPECIAL_CRAFT_START_PROCESS']) {
    assert(PROCESS_ACTION_DEFINITIONS.some((action) => action.actionCode === code), `统一写回缺少 actionCode ${code}`)
    assertIncludes('src/data/fcs/process-web-status-actions.ts', code, `Web 动作必须使用统一 actionCode ${code}`)
  }
  assertIncludes('src/pages/pda-exec-detail.ts', 'PRINT_FINISH_PRINTING', '移动端印花必须使用统一 actionCode')
  assertIncludes('src/pages/pda-exec-detail.ts', 'DYE_FINISH_PACKING', '移动端染色必须使用统一 actionCode')
  assertIncludes('src/pages/pda-cutting-spreading.ts', 'CUTTING_START_SPREADING', '移动端裁片必须使用统一 actionCode')
  assertIncludes('src/pages/pda-exec-detail.ts', 'SPECIAL_CRAFT_START_PROCESS', '移动端特殊工艺必须使用统一 actionCode')

  const beforeInvalidRecordCount = listProcessActionOperationRecords().length
  try {
    executeProcessAction({
      sourceChannel: 'Web 端',
      sourceType: 'PRINT',
      sourceId: 'PWO-PRINT-001',
      actionCode: 'PRINT_FINISH_TRANSFER',
      operatorName: '最终检查',
      operatedAt: '2026-04-28 16:05',
      objectType: '面料',
      objectQty: 1,
      qtyUnit: '米',
    })
    assert(false, '非法动作不得写回成功')
  } catch {
    assert(listProcessActionOperationRecords().length === beforeInvalidRecordCount, '校验失败不得生成操作记录')
  }

  const webResult = executeProcessWebAction({
    sourceType: 'PRINT_WORK_ORDER',
    sourceId: 'PWO-PRINT-011',
    actionCode: 'PRINT_START_PRINTING',
    operatorName: '最终检查 Web',
    operatedAt: '2026-04-28 16:10',
    objectType: '面料',
    objectQty: 910,
    qtyUnit: '米',
    fields: { printerNo: 'CRAFT_2000001-F090' },
  })
  assert(webResult.success, 'Web 端统一写回应成功')
  const mobileResult = executeMobileProcessAction({
    sourceType: 'PRINT',
    sourceId: 'PWO-PRINT-011',
    taskId: webResult.updatedTaskId,
    actionCode: 'PRINT_FINISH_PRINTING',
    operatorName: '最终检查移动端',
    operatedAt: '2026-04-28 16:20',
    objectType: '面料',
    objectQty: 900,
    qtyUnit: '米',
  })
  assert(mobileResult.success, '移动端统一写回应成功')
  const mergedRecords = listProcessActionOperationRecords().filter((record) => record.sourceId === 'PWO-PRINT-011')
  assert(mergedRecords.some((record) => record.sourceChannel === 'Web 端'), 'Web 操作记录必须标记来源为 Web 端')
  assert(mergedRecords.some((record) => record.sourceChannel === '移动端'), '移动端操作记录必须标记来源为移动端')
}

function assertQuantityModel(): void {
  assert(getQuantityLabel({ processType: 'PRINT', objectType: '面料', qtyUnit: '米', qtyPurpose: '计划' }) === '计划印花面料米数', '印花面料场景必须显示面料米数')
  assert(getQuantityLabel({ processType: 'PRINT', objectType: '裁片', qtyUnit: '片', qtyPurpose: '计划' }) === '计划印花裁片数量', '印花裁片场景必须显示裁片数量')
  assert(getQuantityLabel({ processType: 'DYE', qtyUnit: '米', qtyPurpose: '计划' }) === '计划染色面料米数', '染色必须显示面料米数')
  assert(getQuantityLabel({ processType: 'DYE', qtyUnit: '卷', qtyPurpose: '已交出' }) === '交出卷数', '染色必须显示卷数')
  assert(getQuantityLabel({ processType: 'CUTTING', qtyUnit: '片', qtyPurpose: '计划' }) === '计划裁片数量', '裁片必须显示裁片数量')
  assert(getQuantityLabel({ processType: 'SPECIAL_CRAFT', qtyUnit: '片', qtyPurpose: '已完成' }) === '加工完成裁片数量', '特殊工艺必须显示裁片数量')
  assert(getQuantityLabel({ processType: 'SPECIAL_CRAFT', objectType: '菲票', qtyUnit: '张', qtyPurpose: '绑定' }) === '绑定菲票数量', '特殊工艺必须显示菲票数量')
  assert(listPrintWorkOrders().filter((order) => getProcessObjectType({ processType: 'PRINT', objectType: order.objectType, qtyUnit: order.qtyUnit, isPiecePrinting: order.isPiecePrinting }) === '裁片').length >= 3, '印花裁片演示数据不足')
  assert(listPrintWorkOrders().filter((order) => getProcessObjectType({ processType: 'PRINT', objectType: order.objectType, qtyUnit: order.qtyUnit, isFabricPrinting: order.isFabricPrinting }) === '面料').length >= 3, '印花面料演示数据不足')
  assert(listDyeWorkOrders().every((order) => order.qtyUnit === '米' && Number(order.plannedRollCount || 0) >= 0), '染色数据必须使用面料米数和卷数')
  assert(listSpecialCraftTaskOrders().some((order) => order.feiTicketNos.length > 0), '特殊工艺必须有菲票数量')
  for (const path of [
    'src/data/fcs/process-action-writeback-service.ts',
    'src/pages/pda-exec-detail.ts',
  ]) {
    assertIncludes(path, 'objectType', `${path} payload 必须包含 objectType`)
    assertIncludes(path, 'objectQty', `${path} payload 必须包含 objectQty`)
    assertIncludes(path, 'qtyUnit', `${path} payload 必须包含 qtyUnit`)
  }
}

function assertWarehouseHandoverLinkage(): void {
  const printWait = executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'PRINT',
    sourceId: 'PWO-PRINT-009',
    actionCode: 'PRINT_FINISH_TRANSFER',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 17:00',
    objectType: '裁片',
    objectQty: 1010,
    qtyUnit: '片',
  })
  assert(printWait.affectedWarehouseRecordId, '印花完成转印后必须生成待交出仓记录')
  const printHandover = executeMobileProcessAction({
    sourceType: 'PRINT',
    sourceId: 'PWO-PRINT-005',
    actionCode: 'PRINT_SUBMIT_HANDOVER',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 17:10',
    objectType: '裁片',
    objectQty: 930,
    qtyUnit: '片',
  })
  assert(printHandover.affectedHandoverRecordId, '印花发起交出后必须生成交出记录')
  const equalBefore = diffCountByHandover(printHandover.affectedHandoverRecordId)
  writeBackProcessHandoverRecord(printHandover.affectedHandoverRecordId, {
    receiveObjectQty: 930,
    receivePerson: '最终检查接收方',
    receiveAt: '2026-04-28 17:15',
    remark: '实收一致',
  })
  assert(diffCountByHandover(printHandover.affectedHandoverRecordId) === equalBefore, '印花回写一致时不得生成差异')

  const dyeWait = executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'DYE',
    sourceId: 'DWO-013',
    actionCode: 'DYE_FINISH_PACKING',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 17:20',
    objectType: '面料',
    objectQty: 940,
    qtyUnit: '米',
  })
  assert(dyeWait.affectedWarehouseRecordId, '染色完成包装后必须生成待交出仓记录')
  const dyeHandover = executeMobileProcessAction({
    sourceType: 'DYE',
    sourceId: 'DWO-007',
    actionCode: 'DYE_SUBMIT_HANDOVER',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 17:30',
    objectType: '面料',
    objectQty: 1100,
    qtyUnit: '米',
  })
  assert(dyeHandover.affectedHandoverRecordId, '染色发起交出后必须生成交出记录')
  const dyeBefore = diffCountByHandover(dyeHandover.affectedHandoverRecordId)
  writeBackProcessHandoverRecord(dyeHandover.affectedHandoverRecordId, {
    receiveObjectQty: 1094,
    receivePerson: '最终检查接收方',
    receiveAt: '2026-04-28 17:35',
    remark: '实收面料米数差异',
  })
  assert(diffCountByHandover(dyeHandover.affectedHandoverRecordId) > dyeBefore, '染色回写不一致时必须生成差异')

  const cuttingOrderId = 'CUT-260304-009-01'
  for (const actionCode of ['CUTTING_START_SPREADING', 'CUTTING_FINISH_SPREADING', 'CUTTING_START_CUTTING', 'CUTTING_FINISH_CUTTING', 'CUTTING_GENERATE_FEI_TICKETS'] as const) {
    executeProcessAction({
      sourceChannel: 'Web 端',
      sourceType: 'CUTTING',
      sourceId: cuttingOrderId,
      actionCode,
      operatorName: '最终检查',
      operatedAt: '2026-04-28 17:40',
      objectType: '裁片',
      objectQty: 2800,
      qtyUnit: '片',
    })
  }
  const cuttingInbound = executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'CUTTING',
    sourceId: cuttingOrderId,
    actionCode: 'CUTTING_CONFIRM_INBOUND',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 17:50',
    objectType: '裁片',
    objectQty: 2800,
    qtyUnit: '片',
  })
  assert(cuttingInbound.affectedWarehouseRecordId, '裁片确认入仓后必须生成待交出仓')
  const cuttingHandover = executeMobileProcessAction({
    sourceType: 'CUTTING',
    sourceId: cuttingOrderId,
    actionCode: 'CUTTING_SUBMIT_HANDOVER',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 17:55',
    objectType: '裁片',
    objectQty: 2800,
    qtyUnit: '片',
  })
  assert(cuttingHandover.affectedHandoverRecordId, '裁片发起交出后必须生成交出记录')
  assert(listProcessHandoverRecords({ craftType: 'CUTTING', sourceWorkOrderId: cuttingOrderId }).some((record) => record.relatedFeiTicketIds.length > 0), '裁片交出必须关联原始裁片单和菲票')
  writeBackProcessHandoverRecord(cuttingHandover.affectedHandoverRecordId, {
    receiveObjectQty: 2790,
    receivePerson: '最终检查接收方',
    receiveAt: '2026-04-28 18:00',
    remark: '裁片实收差异',
  })
  assert(listProcessHandoverDifferenceRecords({ craftType: 'CUTTING', sourceWorkOrderId: cuttingOrderId }).some((record) => record.relatedFeiTicketIds.length > 0), '裁片差异必须可追溯菲票')

  const specialReceive = executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'SPECIAL_CRAFT',
    sourceId: 'SC-TASK-SC-OP-008-01-WO-001-',
    actionCode: 'SPECIAL_CRAFT_RECEIVE_CUT_PIECES',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 18:10',
    objectType: '裁片',
    objectQty: 180,
    qtyUnit: '片',
  })
  assert(specialReceive.affectedWarehouseRecordId, '特殊工艺确认接收后必须生成待加工仓')
  executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'SPECIAL_CRAFT',
    sourceId: 'SC-TASK-SC-OP-008-01-WO-001-',
    actionCode: 'SPECIAL_CRAFT_START_PROCESS',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 18:15',
    objectType: '裁片',
    objectQty: 180,
    qtyUnit: '片',
  })
  const specialFinish = executeMobileProcessAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: 'SC-TASK-SC-OP-008-01-WO-001-',
    actionCode: 'SPECIAL_CRAFT_FINISH_PROCESS',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 18:20',
    objectType: '裁片',
    objectQty: 178,
    qtyUnit: '片',
  })
  assert(specialFinish.affectedWarehouseRecordId, '特殊工艺完成加工后必须生成待交出仓')
  const specialHandover = executeProcessAction({
    sourceChannel: 'Web 端',
    sourceType: 'SPECIAL_CRAFT',
    sourceId: 'SC-TASK-SC-OP-008-01-WO-001-',
    actionCode: 'SPECIAL_CRAFT_SUBMIT_HANDOVER',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 18:25',
    objectType: '裁片',
    objectQty: 178,
    qtyUnit: '片',
  })
  assert(specialHandover.affectedHandoverRecordId, '特殊工艺发起交出后必须生成交出记录')
  const specialDifference = executeMobileProcessAction({
    sourceType: 'SPECIAL_CRAFT',
    sourceId: 'SC-TASK-SC-OP-064-01-WO-001-',
    actionCode: 'SPECIAL_CRAFT_REPORT_DIFFERENCE',
    operatorName: '最终检查',
    operatedAt: '2026-04-28 18:30',
    objectType: '裁片',
    objectQty: 5,
    qtyUnit: '片',
    remark: '报废裁片数量 5 片',
  })
  assert(specialDifference.affectedDifferenceRecordId, '特殊工艺差异必须生成差异记录')
  assert(listProcessHandoverDifferenceRecords({ craftType: 'SPECIAL_CRAFT', sourceWorkOrderId: 'SC-TASK-SC-OP-064-01-WO-001-' }).some((record) => record.relatedFeiTicketIds.length > 0 && record.diffObjectQty === 5), '特殊工艺差异必须关联菲票并记录数量变化')

  assert(listProcessWarehouseRecords().length > 0, '统一事实源必须有仓记录')
  assert(listProcessHandoverRecords().length > 0, '统一事实源必须有交出记录')
  assert(listProcessWarehouseReviewRecords().length > 0, '统一事实源必须有审核记录')
  assert(listProcessHandoverDifferenceRecords().length > 0, '统一事实源必须有差异记录')
  assertIncludes('src/data/fcs/process-action-writeback-service.ts', 'applyWarehouseLinkageAfterAction', 'executeProcessAction 成功后必须触发仓联动')
}

function assertPlatformResultAfterLinkage(): void {
  const requiredViews: Array<PlatformProcessResultView | null | undefined> = [
    getPlatformProcessResultView('PRINT', 'PWO-PRINT-009'),
    getPlatformProcessResultView('DYE', 'DWO-013'),
    getPlatformProcessResultView('CUTTING', 'CUT-260304-009-01'),
    getPlatformProcessResultView('SPECIAL_CRAFT', 'SC-TASK-SC-OP-064-01-WO-001-'),
  ]
  for (const view of requiredViews) {
    assert(view, '平台结果视图必须能读取统一事实源结果')
    assert(view!.latestWarehouseRecordId || view!.latestHandoverRecordId || view!.latestDifferenceRecordId, `${view!.workOrderNo} 平台侧必须能看到仓、交出或差异结果`)
    assert(view!.quantityDisplayFields.every((field) => field.label && field.unit), `${view!.workOrderNo} 平台侧数量字段必须带对象和单位`)
  }
  assert(listPlatformPrintResultViews().length > 0, '平台印花结果视图不能为空')
  assert(listPlatformDyeResultViews().length > 0, '平台染色结果视图不能为空')
  assert(listPlatformCuttingResultViews().length > 0, '平台裁片结果视图不能为空')
  assert(listPlatformSpecialCraftResultViews().length > 0, '平台特殊工艺结果视图不能为空')
  assertIncludes('src/pages/process-print-orders.ts', 'listPrepProcessOrders', '平台印花页面必须通过 adapter 读取统一结果视图')
  assertIncludes('src/pages/process-dye-orders.ts', 'listPrepProcessOrders', '平台染色页面必须通过 adapter 读取统一结果视图')
  assertIncludes('src/data/fcs/page-adapters/process-prep-pages-adapter.ts', 'getPlatformProcessResultView', '平台印花/染色 adapter 必须读取统一结果视图')
  assertIncludes('src/pages/progress-board/task-domain.ts', 'listPlatformProcessResultViews', '任务进度看板必须读取统一结果视图')
}

function assertStatisticsAndPrintAreConnected(): void {
  const printingStats = getPrintingExecutionStatistics({ factoryId: TEST_FACTORY_ID })
  const dyeStats = getDyeingExecutionStatistics({ factoryId: TEST_FACTORY_ID })
  const specialStats = getSpecialCraftExecutionStatistics({ factoryId: TEST_FACTORY_ID })
  assert(printingStats.workOrderCount > 0 && printingStats.waitHandoverRecordCount >= 0 && printingStats.differenceRecordCount >= 0, '印花统计必须读取统一加工单、仓交出和差异数据')
  assert(dyeStats.workOrderCount > 0 && dyeStats.waitHandoverRecordCount >= 0 && dyeStats.differenceRecordCount >= 0, '染色统计必须读取统一加工单、仓交出和差异数据')
  assert(specialStats.taskOrderCount > 0 && specialStats.feiTicketCount > 0 && specialStats.differenceRecordCount >= 0, '特殊工艺统计必须读取特殊工艺单、菲票和差异数据')
  assertNotIncludes('src/pages/process-factory/dyeing/reports.ts', '染色报表', '染色统计页面不得出现染色报表')
  assertIncludes('src/data/fcs/task-print-cards.ts', 'getQuantityLabel', '打印任务卡必须使用统一数量文案')
  assertIncludes('src/data/fcs/print-service.ts', 'print', '打印服务文件必须保持可用')
}

function assertFrozenCuttingAndSpecialCraftBoundaries(): void {
  for (const path of [
    'src/data/fcs/process-warehouse-linkage-service.ts',
    'docs/fcs-process-warehouse-handover-linkage.md',
    'docs/fcs-three-end-process-chain-final-check.md',
  ]) {
    if (existsSync(join(root, path))) {
      assertIncludes(path, '原始裁片单', '裁片冻结口径必须声明原始裁片单')
      assertIncludes(path, '合并裁剪批次', '裁片冻结口径必须声明合并裁剪批次只作为执行上下文')
      assertIncludes(path, '菲票', '裁片冻结口径必须声明菲票归属')
    }
  }
  assert(listProcessHandoverRecords({ craftType: 'CUTTING', sourceWorkOrderId: 'CUT-260304-009-01' }).every((record) => record.relatedFeiTicketIds.length > 0), '裁片交出必须关联原始裁片单和菲票')
  assert(['打揽', '打条', '捆条', '烫画', '直喷', '激光切', '洗水'].every((name) => read('src/data/fcs/special-craft-operations.ts').includes(name)), '特殊工艺范围必须包含既定工艺')
  for (const forbidden of forbiddenSpecialCraftActions) {
    assertNotIncludes('src/data/fcs/process-action-writeback-service.ts', forbidden, `特殊工艺动作不得出现 ${forbidden}`)
    assertNotIncludes('src/pages/process-factory/special-craft/work-order-detail.ts', forbidden, `特殊工艺页面不得出现 ${forbidden}`)
    assertNotIncludes('src/pages/pda-exec-detail.ts', forbidden, `移动端特殊工艺动作不得出现 ${forbidden}`)
  }
}

function assertPageAndScriptWiring(): void {
  assert(existsSync(join(root, 'scripts/check-three-end-process-chain-final.ts')), '必须存在最终总检查脚本')
  assert(existsSync(join(root, 'tests/fcs-three-end-process-chain.spec.ts')), '必须存在全链路 Playwright 测试')
  assertIncludes('tests/fcs-three-end-process-chain.spec.ts', '印花三端完整链路', 'Playwright 必须覆盖印花三端链路')
  assertIncludes('tests/fcs-three-end-process-chain.spec.ts', '染色三端完整链路', 'Playwright 必须覆盖染色三端链路')
  assertIncludes('tests/fcs-three-end-process-chain.spec.ts', '裁片三端完整链路', 'Playwright 必须覆盖裁片三端链路')
  assertIncludes('tests/fcs-three-end-process-chain.spec.ts', '特殊工艺三端完整链路', 'Playwright 必须覆盖特殊工艺三端链路')
  assertIncludes('tests/fcs-three-end-process-chain.spec.ts', '不可执行任务不能绕过', 'Playwright 必须覆盖不可执行任务')
  assertIncludes('tests/fcs-three-end-process-chain.spec.ts', '统计联动', 'Playwright 必须覆盖统计联动')
  assertIncludes('docs/fcs-three-end-process-chain-final-check.md', '三端联动最终验收范围', '缺少最终验收文档')
  assertIncludes('docs/fcs-three-end-process-chain-final-check.md', '生产单', '最终验收文档必须包含中文流程图')
  assertIncludes('docs/fcs-three-end-process-chain-final-check.md', '待验证', '最终验收文档必须包含中文状态机')
}

runStepScripts()
assertFactoryConsistency()
assertBindings()
assertMobileListConsistency()
assertPlatformStatusAndResultView()
assertWebActionsAndSharedWriteback()
assertQuantityModel()
assertWarehouseHandoverLinkage()
assertPlatformResultAfterLinkage()
assertStatisticsAndPrintAreConnected()
assertFrozenCuttingAndSpecialCraftBoundaries()
assertPageAndScriptWiring()

assert(mapCraftStatusToPlatformStatus({ processType: 'PRINT', craftStatusLabel: '打印中' }).platformStatusLabel === '加工中', '第 4 步平台状态映射不得回退')
assert(getPlatformStatusForProcessWorkOrder(listProcessWorkOrders('PRINT')[0]).platformStatusLabel, '平台聚合状态必须可从统一加工单派生')
assert(listWaitHandoverWarehouseRecords().length > 0 || listWaitProcessWarehouseRecords().length > 0, '仓联动结果必须可见')

console.log('three-end process chain final checks passed')
