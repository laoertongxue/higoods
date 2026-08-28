import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  KOL_GOTO_SALE_TYPES,
  KOL_GOTO_WHOLE_ORDER_FIXED_TOTAL_PRICE_IDR,
  KOL_GOTO_WHOLE_ORDER_PROCESS_CODE,
  isKolGotoFactory,
  isKolGotoProductionOrder,
  isKolGotoSaleType,
  isKolGotoWholeOrderTask,
  normalizeKolGotoFactoryId,
} from '../src/data/fcs/kol-goto-special-flow.ts'
import {
  KOL_GOTO_FACTORY_CODE,
  KOL_GOTO_FACTORY_ID,
} from '../src/data/fcs/factory-mock-data.ts'
import {
  buildKolGotoWholeOrderTask,
  buildProcessTasksForProductionOrder,
  captureProcessTaskStore,
  processTasks,
  restoreProcessTaskStore,
  upsertKolGotoWholeOrderTask,
  type ProcessTask,
} from '../src/data/fcs/process-tasks.ts'
import {
  clearRuntimeProcessTasksCache,
  evaluateFixedMergedTask,
  getRuntimeTaskById,
  listRuntimeProcessTasks,
  acceptRuntimeTaskAssignment,
  rejectRuntimeTaskAssignment,
  setRuntimeTaskAssignMode,
  upsertRuntimeTaskTender,
  validateRuntimeFactoryAssignment,
  batchDispatchRuntimeTasks,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  buildFormalProductionOrderProcessSnapshots,
} from '../src/data/fcs/production-process-work-order-service.ts'
import {
  listProcessWorkOrders,
} from '../src/data/fcs/process-work-order-domain.ts'
import {
  setProcessWorkOrderGenerationCommitFailureForTest,
} from '../src/data/fcs/process-work-order-generation-service.ts'
import {
  buildProductionOrderFromDemands,
  productionOrders,
  type ProductionOrder,
} from '../src/data/fcs/production-orders.ts'
import { state } from '../src/pages/production/context.ts'
import { renderProductionOrderDetailPage } from '../src/pages/production/detail-domain.ts'
import { renderProductionOrdersPage } from '../src/pages/production/orders-domain.ts'
import { renderTaskBreakdownPage } from '../src/pages/task-breakdown.ts'
import {
  applyCreatedProductionOrderGroups,
  type CreatedProductionOrderGroup,
} from '../src/pages/production/demand-domain.ts'
import {
  createFactoryInternalWarehouseMutationSnapshot,
  findFactoryInternalWarehouseByFactoryAndKind,
  listFactoryInternalWarehouses,
  listFactoryWaitHandoverStockItems,
  listFactoryWaitProcessStockItems,
  listFactoryWarehouseInboundRecords,
  listFactoryWarehouseOutboundRecords,
  restoreFactoryInternalWarehouseMutationSnapshot,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import {
  capturePdaHandoverState,
  findPdaHandoverHead,
  listHandoverOrdersByTaskId,
  restorePdaHandoverState,
  upsertPdaHandoutRecordMock,
} from '../src/data/fcs/pda-handover-events.ts'
import {
  completeKolGotoWholeOrderTask,
  getKolGotoHandoutQty,
  listKolGotoHandoutRecords,
  listKolGotoPickupBatches,
  listKolGotoPickupLines,
  setKolGotoPickupFailureStepForTest,
  submitKolGotoHandout,
  submitKolGotoPickup,
} from '../src/data/fcs/kol-goto-pda-domain.ts'
import {
  captureKolGotoFixedTotalLedgerStore,
  listKolGotoFixedTotalLedgers,
  restoreKolGotoFixedTotalLedgerStore,
  setKolGotoFixedTotalLedgerFailureForTest,
} from '../src/data/fcs/kol-goto-fixed-total-ledger.ts'
import {
  getFactoryMobileTodos,
} from '../src/data/fcs/factory-mobile-todos.ts'
import {
  kolGotoAdminPermissionKeys,
  kolGotoOperatorPermissionKeys,
  listFactoryPdaRoles,
} from '../src/data/fcs/store-domain-pda.ts'
import {
  listPdaAwardedTenderNoticesByFactoryId,
  listPdaBiddingTendersByFactoryId,
  listPdaQuotedTendersByFactoryId,
} from '../src/data/fcs/pda-mobile-mock.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { settlementLinkedMockFactoryOutput } from '../src/data/fcs/settlement-linked-mock-factory.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { listPdaMobileExecutionTasks } from '../src/data/fcs/process-mobile-task-binding.ts'
import { getSettlementEffectiveInfoByFactory } from '../src/data/fcs/settlement-change-requests.ts'
import { listPreSettlementLedgers } from '../src/data/fcs/pre-settlement-ledger-repository.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function listFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir)
  if (!fs.existsSync(absoluteDir)) return []
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativeDir, entry.name)
    return entry.isDirectory() ? listFiles(child) : [child]
  })
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100
}

function buildKolOrder(
  base: ProductionOrder,
  suffix: string,
  saleType: (typeof KOL_GOTO_SALE_TYPES)[number],
  processCodes: Array<'DYE' | 'PRINT'>,
): ProductionOrder {
  assert(base.techPackSnapshot, 'KOL 契约需要一份冻结技术包')
  const sourceProcessTemplate = productionOrders
    .flatMap((order) => order.techPackSnapshot?.processEntries ?? [])
    .find(Boolean)
  assert(sourceProcessTemplate, '缺少可克隆的技术包工序模板')
  const sourceFabric = base.techPackSnapshot.bomItems.find((item) => item.type === '面料')
  assert(sourceFabric, 'KOL 冻结技术包缺少面料 BOM')
  const productionOrderId = `PO-KOL-CHECK-${suffix}`
  const demandId = `DEM-KOL-CHECK-${suffix}`
  const demandSnapshot = {
    ...structuredClone(base.demandSnapshot),
    saleType,
  }
  const retainedEntries = base.techPackSnapshot.processEntries.filter(
    (entry) => entry.processCode !== 'DYE' && entry.processCode !== 'PRINT',
  )
  const generatedEntries = processCodes.map((processCode, index) => ({
    ...structuredClone(sourceProcessTemplate),
    id: `PROCESS-KOL-CHECK-${suffix}-${processCode}-${index + 1}`,
    entryType: 'PROCESS_BASELINE' as const,
    stageCode: 'PREP' as const,
    stageName: '生产准备',
    processCode,
    processName: processCode === 'DYE' ? '成衣染色' : '数码印花',
    assignmentGranularity: 'ORDER' as const,
    defaultDocType: 'DEMAND' as const,
    taskTypeMode: 'PROCESS' as const,
    isSpecialCraft: false,
    linkedBomItemIds: [sourceFabric.id],
  }))
  return {
    ...structuredClone(base),
    productionOrderId,
    productionOrderNo: productionOrderId,
    demandId,
    sourceDemandIds: [demandId],
    legacyOrderNo: productionOrderId,
    status: 'EXECUTING',
    demandSnapshot,
    sourceDemandSnapshots: [structuredClone(demandSnapshot)],
    taskBreakdownSummary: {
      isBrokenDown: false,
      taskTypesTop3: [],
      generatedTaskUnitCount: 0,
      wholeOrderTaskCount: 0,
      coveredProcessNames: [],
    },
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_STARTED', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeCount: 0, awardedCount: 0, cancelledCount: 0 },
    directDispatchSummary: { activeCount: 0, completedCount: 0 },
    auditLogs: [],
    createdAt: '2026-08-19 08:00:00',
    updatedAt: '2026-08-19 08:00:00',
    techPackSnapshot: {
      ...structuredClone(base.techPackSnapshot),
      snapshotId: `TPS-KOL-CHECK-${suffix}`,
      productionOrderId,
      productionOrderNo: productionOrderId,
      processEntries: [...retainedEntries, ...generatedEntries],
    },
  }
}

function expectThrow(action: () => unknown, message: string): void {
  assert.throws(action, Error, message)
}

const originalOrders = structuredClone(productionOrders)
const originalDemands = structuredClone(state.demands)
const originalTasks = captureProcessTaskStore()
const originalWarehouse = createFactoryInternalWarehouseMutationSnapshot()
const originalHandover = capturePdaHandoverState()
const originalLedgers = captureKolGotoFixedTotalLedgerStore()

try {
  // 1. 特殊范围只认两个精确售卖类型和同一个 KOL 工厂身份。
  assert.deepEqual(KOL_GOTO_SALE_TYPES, ['KOL样衣', 'KOL样品小单'])
  assert.equal(isKolGotoSaleType('KOL样衣'), true)
  assert.equal(isKolGotoSaleType('KOL样品小单'), true)
  for (const value of ['kol样衣', 'KOL 样衣', 'KOL样衣 ', '样衣', '', null, undefined]) {
    assert.equal(isKolGotoSaleType(value), false, `售卖类型不应模糊命中：${String(value)}`)
  }
  assert.equal(normalizeKolGotoFactoryId(KOL_GOTO_FACTORY_ID), KOL_GOTO_FACTORY_ID)
  assert.equal(normalizeKolGotoFactoryId(KOL_GOTO_FACTORY_CODE), KOL_GOTO_FACTORY_ID)
  assert.equal(normalizeKolGotoFactoryId('KOL-GOTO-X'), null)
  assert.equal(isKolGotoFactory(KOL_GOTO_FACTORY_CODE), true)
  const kolGotoFactory = listFactoryMasterRecords().find((factory) => isKolGotoFactory(factory.id))
  assert(kolGotoFactory, '缺少 KOL-GOTO 工厂档案')
  assert.equal(kolGotoFactory.eligibility.allowDispatch, false)
  assert.equal(kolGotoFactory.eligibility.allowBid, false)
  assert.equal(kolGotoFactory.eligibility.allowExecute, true)
  assert.equal(kolGotoFactory.eligibility.allowSettle, true)
  assert(kolGotoFactory.processAbilities.every((ability) => ability.canReceiveTask === false))
  assert.deepEqual(kolGotoFactory.taskAcceptanceConfig, {
    singleProcessEnabled: false,
    canAcceptSewingIronPack: false,
    canAcceptCuttingSewingIronPack: false,
  })

  const baseKolOrder = productionOrders.find((order) => isKolGotoProductionOrder(order) && order.techPackSnapshot)
  assert(baseKolOrder?.techPackSnapshot, '缺少 KOL 冻结技术包生产单')
  assert.equal(baseKolOrder.mainFactorySnapshot.tier, 'THIRD_PARTY')
  assert.equal(baseKolOrder.mainFactorySnapshot.type, 'MICRO_SEWING')
  const printDyeKolDemand = state.demands.find((demand) => demand.demandId === 'DEM-202603-0092')
  assert(printDyeKolDemand, '缺少同时需要印花、染色的 KOL 正向验收需求')
  const printDyeKolOrder = buildProductionOrderFromDemands({
    ...structuredClone(baseKolOrder),
    productionOrderId: 'PO-KOL-CHECK-PRINT-DYE-FIXTURE',
    demandId: printDyeKolDemand.demandId,
    selectedTechPackVersionId: undefined,
  }, [printDyeKolDemand], '检查员')
  assert.deepEqual(
    buildFormalProductionOrderProcessSnapshots(printDyeKolOrder).flatMap((item) => item.processCodes).sort(),
    ['DYE', 'PRINT'],
    'KOL 正向验收需求必须同时派生印花、染色加工单快照',
  )
  assert.equal(isKolGotoProductionOrder({ sourceDemandSnapshots: [], mainFactoryId: KOL_GOTO_FACTORY_ID }), false)
  assert.equal(isKolGotoProductionOrder({
    mainFactoryId: KOL_GOTO_FACTORY_ID,
    sourceDemandSnapshots: [
      structuredClone(baseKolOrder.demandSnapshot),
      { ...structuredClone(baseKolOrder.demandSnapshot), saleType: '备货' },
    ],
  }), false, '混合售卖类型不能命中 KOL 特殊流')
  assert.equal(isKolGotoProductionOrder({
    mainFactoryId: 'ID-F001',
    sourceDemandSnapshots: [structuredClone(baseKolOrder.demandSnapshot)],
  }), false, 'KOL 售卖类型但主工厂不是 KOL-GOTO 时不得进入特殊流程')
  const mixedKolDemand = {
    ...structuredClone(state.demands[0]),
    demandId: 'DEM-KOL-CHECK-MIXED-KOL',
    saleType: 'KOL样衣' as const,
  }
  const mixedOrdinaryDemand = {
    ...structuredClone(state.demands[0]),
    demandId: 'DEM-KOL-CHECK-MIXED-ORDINARY',
    saleType: '备货' as const,
  }
  expectThrow(() => buildProductionOrderFromDemands({
    ...structuredClone(baseKolOrder),
    productionOrderId: 'PO-KOL-CHECK-MIXED',
    demandId: mixedKolDemand.demandId,
  }, [mixedKolDemand, mixedOrdinaryDemand], '检查员'), 'KOL 与普通售卖类型不得混合生成生产单')

  // 2. 生产需求转单立即拆解；四种印染组合只生成相应加工单和一张整单任务，且可重放。
  const comboOrders = [
    buildKolOrder(baseKolOrder, 'NONE', 'KOL样衣', []),
    buildKolOrder(baseKolOrder, 'DYE', 'KOL样衣', ['DYE']),
    buildKolOrder(baseKolOrder, 'PRINT', 'KOL样品小单', ['PRINT']),
    buildKolOrder(baseKolOrder, 'BOTH', 'KOL样品小单', ['DYE', 'PRINT']),
  ]
  assert.deepEqual(
    comboOrders.map((order) => buildFormalProductionOrderProcessSnapshots(order).flatMap((item) => item.processCodes).sort()),
    [[], ['DYE'], ['PRINT'], ['DYE', 'PRINT']],
  )
  const createdGroups: CreatedProductionOrderGroup[] = comboOrders.map((order) => ({ demands: [], order }))
  applyCreatedProductionOrderGroups(createdGroups, '2026-08-19 08:10:00')
  applyCreatedProductionOrderGroups(createdGroups, '2026-08-19 08:10:00')
  for (const order of comboOrders) {
    const persistedOrders = productionOrders.filter((item) => item.productionOrderId === order.productionOrderId)
    const persistedTasks = processTasks.filter((task) => task.productionOrderId === order.productionOrderId)
    assert.equal(persistedOrders.length, 1, `${order.productionOrderId} 重放后只能保留一张生产单`)
    assert.equal(persistedTasks.length, 1, `${order.productionOrderId} 只能有一张整单任务`)
    const task = persistedTasks[0]
    assert.equal(isKolGotoWholeOrderTask(task), true)
    assert.equal(task.acceptanceStatus, 'ACCEPTED')
    assert.equal(task.acceptedBy, '系统')
    assert.equal(task.assignedFactoryId, KOL_GOTO_FACTORY_ID)
    assert.equal(task.assignmentMode, 'DIRECT')
    assert.equal(task.assignmentStatus, 'ASSIGNED')
    assert.equal(task.pricingMode, 'FIXED_TOTAL')
    assert.equal(task.fixedTotalPrice, KOL_GOTO_WHOLE_ORDER_FIXED_TOTAL_PRICE_IDR)
    assert.equal(task.processCode, KOL_GOTO_WHOLE_ORDER_PROCESS_CODE)
    assert.equal(task.taskUnitType, 'WHOLE_ORDER_TASK')
    assert.equal(task.status, 'NOT_STARTED')
    assert.equal(task.auditLogs.filter((log) => log.action === 'AUTO_BREAKDOWN').length, 1)
    assert(task.coveredProcesses?.every((process) => process.processCode !== 'DYE' && process.processCode !== 'PRINT'))
    assert(task.detailRows?.every((row) => row.sourceRefs.processCode !== 'DYE' && row.sourceRefs.processCode !== 'PRINT'))
    const expectedCodes = buildFormalProductionOrderProcessSnapshots(order).flatMap((item) => item.processCodes).sort()
    const actualCodes = listProcessWorkOrders()
      .filter((workOrder) => workOrder.sourceSnapshot.productionOrderId === order.productionOrderId)
      .map((workOrder) => workOrder.processType)
      .filter((code): code is 'DYE' | 'PRINT' => code === 'DYE' || code === 'PRINT')
      .sort()
    assert.deepEqual(actualCodes, expectedCodes, `${order.productionOrderId} 印染加工单组合错误`)
  }
  const actualKolTaskIds = processTasks.filter((task) => isKolGotoWholeOrderTask(task)).map((task) => task.taskId).sort()
  const projectedKolTaskIds = listPdaGenericProcessTasks().filter((task) => isKolGotoWholeOrderTask(task)).map((task) => task.taskId).sort()
  assert.deepEqual(projectedKolTaskIds, actualKolTaskIds, 'PDA 必须动态投影全部 KOL 整单任务，不能只保留一条静态克隆')
  for (const taskId of actualKolTaskIds) {
    const task = processTasks.find((item) => item.taskId === taskId)!
    assert(task.qty > 0, `${taskId} 的整单任务数量必须大于 0`)
    assert(Number(task.fixedTotalPrice) > 0, `${taskId} 必须冻结有效整单总价`)
    const taskPickupLines = listKolGotoPickupLines(taskId)
    assert(taskPickupLines.length > 0, `${taskId} 必须能从冻结 BOM 生成加工领料清单`)
    for (const line of taskPickupLines) {
      assert(line.materialImageUrl.startsWith('/'), `${taskId} / ${line.materialName} 必须使用本地稳定物料图`)
      assert(fs.existsSync(path.join(repoRoot, 'public', line.materialImageUrl)), `${taskId} / ${line.materialName} 图片文件不存在`)
    }
  }
  clearRuntimeProcessTasksCache()
  const mobileKolTasks = listPdaMobileExecutionTasks().filter((task) => isKolGotoWholeOrderTask(task))
  assert.equal(new Set(mobileKolTasks.map((task) => task.taskNo || task.taskId)).size, mobileKolTasks.length, 'PDA 聚合层不得重复显示同一 KOL 整单任务')
  assert.deepEqual(mobileKolTasks.map((task) => task.taskId).sort(), actualKolTaskIds)

  const malformedGuardTask = processTasks.find((task) => task.productionOrderId === comboOrders[0].productionOrderId)!
  const originalProcessCode = malformedGuardTask.processCode
  try {
    malformedGuardTask.processCode = 'PROC_SEW'
    expectThrow(
      () => upsertKolGotoWholeOrderTask(comboOrders[0], '2026-08-19 08:15:00', '检查员'),
      '已存在的伪整单任务不能被幂等入口静默接受',
    )
  } finally {
    malformedGuardTask.processCode = originalProcessCode
  }

  // 3. 转单故障必须整体回滚，不能留下生产单、任务、加工单或需求状态半成品。
  const rollbackOrder = buildKolOrder(baseKolOrder, 'ROLLBACK', 'KOL样衣', ['DYE'])
  const rollbackDemand = {
    ...structuredClone(state.demands[0]),
    demandId: rollbackOrder.demandId,
    saleType: 'KOL样衣',
    hasProductionOrder: false,
    productionOrderId: undefined,
    demandStatus: 'PENDING_CONVERT' as const,
  }
  state.demands = [...state.demands, rollbackDemand]
  const beforeRollbackDemand = structuredClone(state.demands.find((item) => item.demandId === rollbackDemand.demandId))
  setProcessWorkOrderGenerationCommitFailureForTest('DYE', 1)
  expectThrow(
    () => applyCreatedProductionOrderGroups([{ demands: [rollbackDemand], order: rollbackOrder }], '2026-08-19 08:20:00'),
    '染色加工单提交故障应回滚整批转单',
  )
  setProcessWorkOrderGenerationCommitFailureForTest(null)
  assert.equal(productionOrders.some((order) => order.productionOrderId === rollbackOrder.productionOrderId), false)
  assert.equal(processTasks.some((task) => task.productionOrderId === rollbackOrder.productionOrderId), false)
  assert.equal(listProcessWorkOrders().some((item) => item.sourceSnapshot.productionOrderId === rollbackOrder.productionOrderId), false)
  assert.deepEqual(state.demands.find((item) => item.demandId === rollbackDemand.demandId), beforeRollbackDemand)

  // 4. 普通分配、合并、竞价、接单、拒单、派单与 KOL 工厂候选均失败关闭。
  clearRuntimeProcessTasksCache()
  const kolTaskId = processTasks.find((task) => task.productionOrderId === comboOrders[0].productionOrderId)!.taskId
  assert.equal(getRuntimeTaskById(kolTaskId), null, 'KOL 整单任务不应进入普通派工运行时列表')
  assert.equal(listRuntimeProcessTasks().some((task) => isKolGotoWholeOrderTask(task)), false, 'KOL 整单任务的整单粒度派生任务也不得进入普通派工运行时')
  assert.equal(evaluateFixedMergedTask([kolTaskId]).ok, false)
  expectThrow(() => setRuntimeTaskAssignMode(kolTaskId, 'BIDDING', '检查员'), 'KOL 不能转竞价')
  expectThrow(() => upsertRuntimeTaskTender(kolTaskId, {
    tenderId: 'TENDER-KOL-CHECK',
    biddingDeadline: '2026-08-20 12:00:00',
    taskDeadline: '2026-08-31',
  }, '检查员'), 'KOL 不能发起招标')
  expectThrow(() => acceptRuntimeTaskAssignment(kolTaskId, {
    factoryId: KOL_GOTO_FACTORY_ID,
    acceptedAt: '2026-08-19 09:00:00',
    acceptedBy: '检查员',
  }), 'KOL 不能手工接单')
  expectThrow(() => rejectRuntimeTaskAssignment(kolTaskId, {
    factoryId: KOL_GOTO_FACTORY_ID,
    reason: '检查',
    rejectedAt: '2026-08-19 09:00:00',
    rejectedBy: '检查员',
  }), 'KOL 不能拒单')
  assert.equal(validateRuntimeFactoryAssignment({ taskIds: [kolTaskId], factoryId: 'ID-F001' }).valid, false)
  const ordinaryRuntimeTask = listRuntimeProcessTasks().find((task) => !isKolGotoWholeOrderTask(task))
  assert(ordinaryRuntimeTask, '缺少非 KOL 普通任务回归样例')
  assert.equal(validateRuntimeFactoryAssignment({ taskIds: [ordinaryRuntimeTask.taskId], factoryId: KOL_GOTO_FACTORY_ID }).valid, false)
  assert.equal(batchDispatchRuntimeTasks({
    taskIds: [kolTaskId],
    factoryId: 'ID-F001',
    factoryName: '普通工厂',
    acceptDeadline: '2026-08-20',
    taskDeadline: '2026-08-31',
    by: '检查员',
  }).ok, false)
  const dispatchSource = read('src/pages/unified-dispatch-workbench.ts')
  assert(dispatchSource.includes('if (isKolGotoFactory(factory.id) || isKolGotoWholeOrderTask(task)) return false'))

  // 5. 接单只读、无竞价数据；角色权限和待办只保留 KOL 所需能力。
  assert.equal(listPdaBiddingTendersByFactoryId(KOL_GOTO_FACTORY_ID).length, 0)
  assert.equal(listPdaQuotedTendersByFactoryId(KOL_GOTO_FACTORY_ID).length, 0)
  assert.equal(listPdaAwardedTenderNoticesByFactoryId(KOL_GOTO_FACTORY_ID).length, 0)
  const kolRoles = listFactoryPdaRoles(KOL_GOTO_FACTORY_ID).sort((a, b) => a.roleId.localeCompare(b.roleId))
  assert.deepEqual(kolRoles.map((role) => role.roleId), ['ROLE_ADMIN', 'ROLE_OPERATOR'])
  assert.deepEqual(kolRoles.find((role) => role.roleId === 'ROLE_OPERATOR')?.permissionKeys, kolGotoOperatorPermissionKeys)
  assert.deepEqual(kolRoles.find((role) => role.roleId === 'ROLE_ADMIN')?.permissionKeys, kolGotoAdminPermissionKeys)
  assert.deepEqual(kolGotoOperatorPermissionKeys, ['PICKUP_CONFIRM', 'HANDOUT_CREATE', 'TASK_FINISH'])
  assert(kolGotoAdminPermissionKeys.every((permission) => (
    kolGotoOperatorPermissionKeys.includes(permission as (typeof kolGotoOperatorPermissionKeys)[number])
    || ['SETTLEMENT_VIEW', 'SETTLEMENT_CONFIRM', 'SETTLEMENT_DISPUTE', 'SETTLEMENT_CHANGE_REQUEST'].includes(permission)
  )))
  const operatorTodos = getFactoryMobileTodos(KOL_GOTO_FACTORY_ID, 'ROLE_OPERATOR')
  assert(operatorTodos.every((todo) => ['加工领料', '待交出'].includes(todo.todoType)))
  assert(operatorTodos.every((todo) => !['待报价', '待接单', '待接收', '待确认接收', '待加工填报'].includes(todo.todoType)))
  assert(getFactoryMobileTodos(KOL_GOTO_FACTORY_ID, 'ROLE_ADMIN').every((todo) => ['加工领料', '待交出', '对账待确认'].includes(todo.todoType)))
  assert.equal(operatorTodos.some((todo) => todo.todoType === '对账待确认'), false)

  // 6. KOL 仓管只保留一个待加工仓和唯一默认库位，领料依据冻结 BOM 自动成对入出库。
  const kolWarehouses = listFactoryInternalWarehouses().filter((warehouse) => warehouse.factoryId === KOL_GOTO_FACTORY_ID)
  assert.equal(kolWarehouses.length, 1)
  assert.equal(kolWarehouses[0].warehouseKind, 'WAIT_PROCESS')
  assert.equal(kolWarehouses[0].areaList.length, 1)
  assert.equal(kolWarehouses[0].areaList[0].shelfList.length, 1)
  assert.equal(kolWarehouses[0].areaList[0].shelfList[0].locationList.length, 1)
  assert.equal(listFactoryWaitHandoverStockItems().some((item) => item.factoryId === KOL_GOTO_FACTORY_ID), false)

  const executionOrder = buildKolOrder(baseKolOrder, 'EXECUTION', 'KOL样衣', [])
  applyCreatedProductionOrderGroups([{ demands: [], order: executionOrder }], '2026-08-19 09:00:00')
  const executionTask = processTasks.find((task) => task.productionOrderId === executionOrder.productionOrderId)
  assert(executionTask && isKolGotoWholeOrderTask(executionTask), '执行场景未生成 KOL 整单任务')
  expectThrow(() => submitKolGotoHandout({
    taskId: executionTask.taskId,
    qty: 1,
    submittedAt: '2026-08-19 09:05:00',
    submittedBy: '操作员',
    clientSubmissionId: 'CHECK-HANDOUT-BEFORE-PICKUP',
  }), '首次领料前不能交出')

  const pickupLines = listKolGotoPickupLines(executionTask.taskId)
  assert(pickupLines.some((line) => line.materialType === '面料'))
  assert(pickupLines.some((line) => line.materialType === '辅料'))
  const orderQty = executionOrder.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  for (const line of pickupLines) {
    const bom = executionOrder.techPackSnapshot!.bomItems.find((item) => item.id === line.bomItemId)!
    assert.equal(line.plannedQty, roundQty(orderQty * bom.unitConsumption * (1 + bom.lossRate)))
    assert(line.materialImageUrl.startsWith('/'), `${line.materialName} 必须使用本地稳定物料图`)
    assert(fs.existsSync(path.join(repoRoot, 'public', line.materialImageUrl)), `${line.materialName} 图片文件不存在`)
  }
  const beforeInboundCount = listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).length
  const beforeOutboundCount = listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).length
  const beforeStockCount = listFactoryWaitProcessStockItems().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).length
  const firstLine = pickupLines[0]
  const secondLine = pickupLines[1] ?? pickupLines[0]
  const firstQty = Math.min(1, firstLine.remainingQty)
  const secondQty = Math.min(1, secondLine.remainingQty)

  expectThrow(() => submitKolGotoPickup({
    taskId: executionTask.taskId,
    quantities: { [firstLine.bomItemId]: 0.001 },
    pickedAt: '2026-08-19 09:08:00',
    pickedBy: '操作员',
    clientSubmissionId: 'CHECK-PICKUP-ROUND-TO-ZERO',
  }), '两位小数计量后为零的领料不能自动开工')
  assert.equal(processTasks.find((task) => task.taskId === executionTask.taskId)?.status, 'NOT_STARTED')

  setKolGotoPickupFailureStepForTest('AFTER_OUTBOUND')
  expectThrow(() => submitKolGotoPickup({
    taskId: executionTask.taskId,
    quantities: { [firstLine.bomItemId]: firstQty },
    pickedAt: '2026-08-19 09:10:00',
    pickedBy: '操作员',
    clientSubmissionId: 'CHECK-PICKUP-FAIL',
  }), '加工领料任一步失败必须整体回滚')
  setKolGotoPickupFailureStepForTest(null)
  assert.equal(listKolGotoPickupBatches(executionTask.taskId).length, 0)
  assert.equal(processTasks.find((task) => task.taskId === executionTask.taskId)?.status, 'NOT_STARTED')
  assert.equal(listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).length, beforeInboundCount)
  assert.equal(listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).length, beforeOutboundCount)

  const firstBatch = submitKolGotoPickup({
    taskId: executionTask.taskId,
    quantities: { [firstLine.bomItemId]: firstQty },
    pickedAt: '2026-08-19 09:15:00',
    pickedBy: '操作员',
    clientSubmissionId: 'CHECK-PICKUP-001',
  })
  const replayedBatch = submitKolGotoPickup({
    taskId: executionTask.taskId,
    quantities: { [firstLine.bomItemId]: firstQty },
    pickedAt: '2026-08-19 09:15:00',
    pickedBy: '操作员',
    clientSubmissionId: 'CHECK-PICKUP-001',
  })
  assert.equal(replayedBatch.pickupBatchId, firstBatch.pickupBatchId)
  const guardedExecutionTask = processTasks.find((task) => task.taskId === executionTask.taskId)!
  const executionProcessCode = guardedExecutionTask.processCode
  try {
    guardedExecutionTask.processCode = 'PROC_SEW'
    expectThrow(() => submitKolGotoPickup({
      taskId: executionTask.taskId,
      quantities: { [firstLine.bomItemId]: firstQty },
      pickedAt: '2026-08-19 09:15:00',
      pickedBy: '操作员',
      clientSubmissionId: 'CHECK-PICKUP-001',
    }), '幂等领料重放也必须先校验 KOL 整单任务身份')
  } finally {
    guardedExecutionTask.processCode = executionProcessCode
  }
  submitKolGotoPickup({
    taskId: executionTask.taskId,
    quantities: { [secondLine.bomItemId]: secondQty },
    pickedAt: '2026-08-19 10:15:00',
    pickedBy: '操作员',
    clientSubmissionId: 'CHECK-PICKUP-002',
  })
  assert.equal(listKolGotoPickupBatches(executionTask.taskId).length, 2)
  const startedTask = processTasks.find((task) => task.taskId === executionTask.taskId)!
  assert.equal(startedTask.status, 'IN_PROGRESS')
  assert.equal(startedTask.auditLogs.filter((log) => log.action === 'AUTO_START_ON_PICKUP').length, 1)
  assert.equal(startedTask.auditLogs.filter((log) => log.action === 'MATERIAL_PICKUP').length, 1)
  assert.equal(listPdaGenericProcessTasks().find((task) => task.taskId === executionTask.taskId)?.status, 'IN_PROGRESS')
  const expectedRecordDelta = firstBatch.lines.length + 1
  const kolInbound = listFactoryWarehouseInboundRecords().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).slice(beforeInboundCount)
  const kolOutbound = listFactoryWarehouseOutboundRecords().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).slice(beforeOutboundCount)
  const kolStock = listFactoryWaitProcessStockItems().filter((item) => item.factoryId === KOL_GOTO_FACTORY_ID).slice(beforeStockCount)
  assert.equal(kolInbound.length, expectedRecordDelta)
  assert.equal(kolOutbound.length, expectedRecordDelta)
  assert.equal(kolStock.length, expectedRecordDelta)
  assert(kolInbound.every((record) => record.sourceRecordType === 'KOL_PROCESSING_PICKUP' && record.status === '已入库'))
  assert(kolOutbound.every((record) => record.sourceRecordType === 'KOL_PROCESSING_PICKUP' && record.status === '已出库'))
  assert(kolStock.every((record) => record.availableQty === 0 && record.issuedQty === record.receivedQty && record.status === '已领用'))
  assert.deepEqual(kolInbound.map((item) => item.sourceRecordId).sort(), kolOutbound.map((item) => item.sourceRecordId).sort())

  // 7. 发起交出可多次且直接累计加工量；作废记录不计有效量；完成只看有效累计等于任务量。
  expectThrow(() => submitKolGotoHandout({
    taskId: executionTask.taskId,
    qty: 0.001,
    submittedAt: '2026-08-19 10:30:00',
    submittedBy: '操作员',
    clientSubmissionId: 'CHECK-HANDOUT-ROUND-TO-ZERO',
  }), '两位小数计量后为零的交出不能生成记录')
  assert.equal(listKolGotoHandoutRecords(executionTask.taskId).length, 0)
  const handoutOneQty = Math.floor(executionTask.qty * 0.4)
  const handoutTwoQty = Math.max(1, Math.floor(executionTask.qty * 0.2))
  const handoutOne = submitKolGotoHandout({
    taskId: executionTask.taskId,
    qty: handoutOneQty,
    submittedAt: '2026-08-19 11:00:00',
    submittedBy: '操作员',
    clientSubmissionId: 'CHECK-HANDOUT-001',
  })
  const replayedHandout = submitKolGotoHandout({
    taskId: executionTask.taskId,
    qty: handoutOneQty,
    submittedAt: '2026-08-19 11:00:00',
    submittedBy: '操作员',
    clientSubmissionId: 'CHECK-HANDOUT-001',
  })
  assert.equal(replayedHandout.recordId, handoutOne.recordId)
  const guardedHandoutTask = processTasks.find((task) => task.taskId === executionTask.taskId)!
  try {
    guardedHandoutTask.processCode = 'PROC_SEW'
    expectThrow(() => submitKolGotoHandout({
      taskId: executionTask.taskId,
      qty: handoutOneQty,
      submittedAt: '2026-08-19 11:00:00',
      submittedBy: '操作员',
      clientSubmissionId: 'CHECK-HANDOUT-001',
    }), '幂等交出重放也必须先校验 KOL 整单任务身份')
  } finally {
    guardedHandoutTask.processCode = executionProcessCode
  }
  const handoutTwo = submitKolGotoHandout({
    taskId: executionTask.taskId,
    qty: handoutTwoQty,
    submittedAt: '2026-08-19 12:00:00',
    submittedBy: '操作员',
    clientSubmissionId: 'CHECK-HANDOUT-002',
  })
  assert.equal(listKolGotoHandoutRecords(executionTask.taskId).length, 2)
  assert.equal(listHandoverOrdersByTaskId(executionTask.taskId).length, 1)
  assert.equal(listHandoverOrdersByTaskId(executionTask.taskId)[0].headType, 'HANDOUT')
  assert(listKolGotoHandoutRecords(executionTask.taskId).every((record) => (
    record.status === 'WRITTEN_BACK'
    && record.handoverRecordStatus === 'WRITTEN_BACK_MATCHED'
  )), 'KOL 交出记录必须直接计入，不得停留在待回写加工填报')
  const directAccountedHead = listHandoverOrdersByTaskId(executionTask.taskId)[0]
  assert.equal(directAccountedHead.recordCount, 2)
  assert.equal(directAccountedHead.pendingWritebackCount, 0)
  assert.equal(directAccountedHead.submittedQtyTotal, handoutOneQty + handoutTwoQty)
  assert.equal(directAccountedHead.writtenBackQtyTotal, handoutOneQty + handoutTwoQty)
  assert.equal(getKolGotoHandoutQty(executionTask.taskId), handoutOneQty + handoutTwoQty)
  expectThrow(() => completeKolGotoWholeOrderTask({
    taskId: executionTask.taskId,
    completedAt: '2026-08-19 12:10:00',
    completedBy: '操作员',
  }), '交出未达到计划数量时不能完成')
  upsertPdaHandoutRecordMock({ ...handoutTwo, handoverRecordStatus: 'VOIDED' })
  assert.equal(listKolGotoHandoutRecords(executionTask.taskId).length, 2, '作废记录仍应保留历史')
  assert.equal(getKolGotoHandoutQty(executionTask.taskId), handoutOneQty, '作废交出不得计入有效加工量')
  submitKolGotoHandout({
    taskId: executionTask.taskId,
    qty: executionTask.qty - handoutOneQty,
    submittedAt: '2026-08-19 13:00:00',
    submittedBy: '操作员',
    clientSubmissionId: 'CHECK-HANDOUT-003',
  })
  assert.equal(getKolGotoHandoutQty(executionTask.taskId), executionTask.qty)
  const handoutHeadId = listHandoverOrdersByTaskId(executionTask.taskId)[0].handoverId
  setKolGotoFixedTotalLedgerFailureForTest(true)
  expectThrow(() => completeKolGotoWholeOrderTask({
    taskId: executionTask.taskId,
    completedAt: '2026-08-19 13:10:00',
    completedBy: '操作员',
  }), '固定总价流水失败时任务完成必须回滚')
  assert.equal(processTasks.find((task) => task.taskId === executionTask.taskId)?.status, 'IN_PROGRESS')
  assert.equal(findPdaHandoverHead(handoutHeadId)?.completionStatus, 'OPEN')
  assert.equal(listKolGotoFixedTotalLedgers().filter((ledger) => ledger.taskId === executionTask.taskId).length, 0)
  const completedTask = completeKolGotoWholeOrderTask({
    taskId: executionTask.taskId,
    completedAt: '2026-08-19 13:10:00',
    completedBy: '操作员',
  })
  completeKolGotoWholeOrderTask({
    taskId: executionTask.taskId,
    completedAt: '2026-08-19 13:10:00',
    completedBy: '操作员',
  })
  assert.equal(completedTask.status, 'DONE')
  assert.equal(completedTask.handoverStatus, 'CLOSED')
  assert.equal(listPdaGenericProcessTasks().find((task) => task.taskId === executionTask.taskId)?.status, 'DONE')
  const completedHead = findPdaHandoverHead(handoutHeadId)
  assert.equal(completedHead?.completionStatus, 'COMPLETED')
  assert.equal(completedHead?.handoverOrderStatus, 'CLOSED')
  assert.equal(completedHead?.pendingWritebackCount, 0)
  assert.equal(completedHead?.submittedQtyTotal, executionTask.qty)
  assert.equal(completedHead?.writtenBackQtyTotal, executionTask.qty)
  assert.equal(completedHead?.qtyDiffTotal, 0)
  const completionLedgers = listKolGotoFixedTotalLedgers().filter((ledger) => ledger.taskId === executionTask.taskId)
  assert.equal(completionLedgers.length, 1)
  assert.equal(completionLedgers[0].sourceType, 'TASK_COMPLETION')
  assert.equal(completionLedgers[0].priceSourceType, 'TASK_FIXED_TOTAL')
  assert.equal(completionLedgers[0].qty, 1)
  assert.equal(completionLedgers[0].originalAmount, executionTask.fixedTotalPrice)
  assert.equal(completedTask.auditLogs.some((log) => log.action === 'REPORT_PROCESS'), false)
  expectThrow(() => submitKolGotoPickup({
    taskId: executionTask.taskId,
    quantities: { [firstLine.bomItemId]: 0.01 },
    pickedAt: '2026-08-19 14:00:00',
    pickedBy: '操作员',
    clientSubmissionId: 'CHECK-PICKUP-AFTER-DONE',
  }), '完成后不能继续领料')
  expectThrow(() => submitKolGotoHandout({
    taskId: executionTask.taskId,
    qty: 1,
    submittedAt: '2026-08-19 14:00:00',
    submittedBy: '操作员',
    clientSubmissionId: 'CHECK-HANDOUT-AFTER-DONE',
  }), '完成后不能继续交出')

  // 8. 结算联动 Mock 对 KOL 独立为一单、一任务、一完成流水，无回货批次和逐批价格。
  const linkedKolOrders = settlementLinkedMockFactoryOutput.productionOrders.filter((order) => isKolGotoProductionOrder(order))
  const linkedKolTasks = settlementLinkedMockFactoryOutput.processTasks.filter((task) => isKolGotoWholeOrderTask(task, linkedKolOrders.find((order) => order.productionOrderId === task.productionOrderId)))
  const linkedKolLedgers = settlementLinkedMockFactoryOutput.taskEarningLedgers.filter((ledger) => isKolGotoFactory(ledger.factoryId))
  const linkedKolLines = settlementLinkedMockFactoryOutput.statementDraftLines.filter((line) => isKolGotoFactory(line.settlementPartyId))
  assert.equal(linkedKolOrders.length, 1)
  assert.equal(linkedKolTasks.length, 1)
  assert.equal(linkedKolTasks[0].assignmentMode, 'DIRECT')
  assert.equal(linkedKolTasks[0].pricingMode, 'FIXED_TOTAL')
  assert.equal(linkedKolLedgers.length, 1)
  assert.equal(linkedKolLedgers[0].sourceType, 'TASK_COMPLETION')
  assert.equal(linkedKolLedgers[0].priceSourceType, 'TASK_FIXED_TOTAL')
  assert.equal(linkedKolLedgers[0].qty, 1)
  assert.equal(linkedKolLedgers[0].returnInboundBatchId, undefined)
  assert.equal(settlementLinkedMockFactoryOutput.returnInboundBatches.some((batch) => isKolGotoFactory(batch.returnFactoryId)), false)
  assert.equal(linkedKolLines.length, 1)
  assert.equal(linkedKolLines[0].statementLineGrainType, 'TASK_COMPLETION')
  assert.equal(linkedKolLines[0].pricingSourceType, 'FIXED_TOTAL')
  assert.equal(linkedKolLines[0].returnInboundBatchId, undefined)
  assert.equal(getSettlementEffectiveInfoByFactory(KOL_GOTO_FACTORY_CODE)?.factoryId, KOL_GOTO_FACTORY_CODE)
  assert.equal(getSettlementEffectiveInfoByFactory(KOL_GOTO_FACTORY_ID)?.factoryId, KOL_GOTO_FACTORY_CODE)
  assert.deepEqual(
    listPreSettlementLedgers({ factoryId: KOL_GOTO_FACTORY_CODE }).map((ledger) => ledger.ledgerNo).sort(),
    listPreSettlementLedgers({ factoryId: KOL_GOTO_FACTORY_ID }).map((ledger) => ledger.ledgerNo).sort(),
    'KOL 工厂编码和内部编号必须查询到同一组预结算流水',
  )
  const kolFixedTotalLedgers = listPreSettlementLedgers({ factoryId: KOL_GOTO_FACTORY_ID })
    .filter((ledger) => ledger.priceSourceType === 'TASK_FIXED_TOTAL')
  assert.equal(
    new Set(kolFixedTotalLedgers.map((ledger) => ledger.ledgerId)).size,
    kolFixedTotalLedgers.length,
    '静态联动 Mock 与完成命令写入不得重复计算同一张 KOL 整单任务流水',
  )
  assert.deepEqual(
    kolFixedTotalLedgers.map((ledger) => ledger.ledgerId).sort(),
    listKolGotoFixedTotalLedgers().map((ledger) => ledger.ledgerId).sort(),
    '存在真实 KOL 完成流水时，预结算仓库必须停用独立联动 Mock 的 KOL 兜底流水',
  )
  assert(kolFixedTotalLedgers.every((ledger) => ledger.settlementAmount === KOL_GOTO_WHOLE_ORDER_FIXED_TOTAL_PRICE_IDR))

  // 9. 结构守卫防止伪 KOL 任务误命中；非 KOL 仍按原任务、竞价、回货和角色逻辑运行。
  const realKolTask = buildKolGotoWholeOrderTask(baseKolOrder)
  assert.equal(isKolGotoWholeOrderTask({ ...realKolTask, assignedFactoryId: 'ID-F001' }), false)
  assert.equal(isKolGotoWholeOrderTask({ ...realKolTask, processCode: 'PROC_SEW' }), false)
  assert.equal(isKolGotoWholeOrderTask({ ...realKolTask, productionOrderId: ordinaryRuntimeTask.productionOrderId }), false)
  const ordinaryOrder = productionOrders.find((order) => !isKolGotoProductionOrder(order) && order.techPackSnapshot)
  assert(ordinaryOrder, '缺少非 KOL 生产单回归样例')
  const ordinaryTasks = buildProcessTasksForProductionOrder(ordinaryOrder, '2026-08-19 15:00:00', '检查员')
  assert(ordinaryTasks.length > 0)
  assert(ordinaryTasks.every((task) => task.taskUnitType !== 'WHOLE_ORDER_TASK'))
  assert(listRuntimeProcessTasks().some((task) => !isKolGotoWholeOrderTask(task) && task.assignmentMode === 'BIDDING'))
  assert(settlementLinkedMockFactoryOutput.taskEarningLedgers.some((ledger) => !isKolGotoFactory(ledger.factoryId) && ledger.sourceType === 'RETURN_INBOUND_BATCH'))
  const ordinaryFactory = listFactoryMasterRecords().find((factory) => !isKolGotoFactory(factory.id) && factory.status === 'active')
  assert(ordinaryFactory, '缺少普通工厂回归样例')
  assert(listFactoryPdaRoles(ordinaryFactory.id).length >= 2)

  // 10. 管理端列表和详情必须读取 KOL 整单事实，不显示人工拆解、竞价、接收草稿或普通后道模块。
  const orderListHtml = renderProductionOrdersPage()
  const kolRowAnchor = `data-order-id="${baseKolOrder.productionOrderId}"`
  const kolRowAnchorIndex = orderListHtml.indexOf(kolRowAnchor)
  assert(kolRowAnchorIndex >= 0, '生产单列表缺少 KOL 样例行')
  const kolRowStart = orderListHtml.lastIndexOf('<tr', kolRowAnchorIndex)
  const kolRowEnd = orderListHtml.indexOf('</tr>', kolRowAnchorIndex)
  const kolRowHtml = orderListHtml.slice(kolRowStart, kolRowEnd + 5)
  assert(kolRowHtml.includes('KOL 整单任务'))
  assert(kolRowHtml.includes('三方工厂'))
  assert(kolRowHtml.includes('小微缝纫'))
  assert(!kolRowHtml.includes('中央工厂'), 'KOL-GOTO 生产单不得沿用错误的中央工厂快照')
  assert(!kolRowHtml.includes('接收草稿'), 'KOL 生产单列表行不得出现接收草稿入口')
  assert(!kolRowHtml.includes('物料检查'), 'KOL 生产单列表行不得出现普通物料检查入口')

  const kolDetailHtml = renderProductionOrderDetailPage(baseKolOrder.productionOrderId)
  assert(kolDetailHtml.includes('KOL 整单任务已自动拆解'))
  assert(kolDetailHtml.includes('系统固定分配: 1'))
  assert(kolDetailHtml.includes('系统自动接收: 1'))
  assert(kolDetailHtml.includes('无接收草稿 · 无待领料状态'))
  assert(!kolDetailHtml.includes('>拆解任务</button>'), 'KOL 生产单详情不得出现人工拆解入口')
  assert(!kolDetailHtml.includes('>接收状态</h3>'), 'KOL 生产单详情不得出现普通接收状态卡')
  assert(!kolDetailHtml.includes('>竞价情况</h3>'), 'KOL 生产单详情不得出现竞价模块')
  assert(!kolDetailHtml.includes('>后道任务</h3>'), 'KOL 生产单详情不得出现普通后道模块')
  assert(!kolDetailHtml.includes('查看物料检查'), 'KOL 生产单详情不得出现普通物料检查入口')
  const taskListHtml = renderTaskBreakdownPage(baseKolOrder.productionOrderNo)
  const kolTaskAnchorIndex = taskListHtml.indexOf(baseKolOrder.productionOrderNo)
  assert(kolTaskAnchorIndex >= 0, '管理端任务清单必须展示 KOL 整单任务')
  const kolTaskRowStart = taskListHtml.lastIndexOf('<tr', kolTaskAnchorIndex)
  const kolTaskRowEnd = taskListHtml.indexOf('</tr>', kolTaskAnchorIndex)
  const kolTaskRowHtml = taskListHtml.slice(kolTaskRowStart, kolTaskRowEnd + 5)
  assert(kolTaskRowHtml.includes('KOL整单任务'))
  assert(kolTaskRowHtml.includes('系统固定分配并自动接收'))
  assert(kolTaskRowHtml.includes('无需分配'))
  assert(!kolTaskRowHtml.includes('去分配'), 'KOL 整单任务不得从任务清单进入普通派工')
  assert(!kolTaskRowHtml.includes('竞价'), 'KOL 整单任务行不得出现竞价入口')
  const kolExecSource = read('src/pages/pda-kol-goto-exec.ts')
  assert(kolExecSource.includes('absolute inset-x-0 bottom-[72px]'), 'KOL 执行动作条必须位于 72px 底部导航上方')
  assert(!kolExecSource.includes('fixed inset-x-0 bottom-0 z-20 grid grid-cols-3'), 'KOL 执行动作条不得覆盖 PDA 底部导航')
  assert(kolExecSource.includes('data-skip-page-rerender="true"'), 'KOL 数量输入和局部动作不得触发整页重绘')
  assert(kolExecSource.includes("window.confirm('完成后不能继续加工领料或发起交出"), 'KOL 完成必须二次确认')
  const settlementPageSource = read('src/pages/pda-settlement.ts')
  assert(settlementPageSource.includes('data-kol-unsettled-ledgers'), 'KOL 管理员必须能查看未进对账单的逐任务收入流水')
  assert(settlementPageSource.includes("ledger.priceSourceType === 'TASK_FIXED_TOTAL'"), 'KOL 未结算流水必须限定整单固定总价')

  // 11. 删除门禁：旧“生产单任务生成规则”和五步配置在活动代码、路由、脚本、测试和包脚本中为零。
  const governedFiles = [
    ...listFiles('src'),
    ...listFiles('scripts'),
    ...listFiles('tests'),
    'package.json',
  ].filter((file) => /\.(?:ts|tsx|js|mjs|json)$/.test(file) && file !== 'scripts/check-kol-goto-special-flow.ts')
  const forbiddenTokens = [
    'production-task-generation-rules',
    'task-generation-rules',
    'WHOLE_ORDER_FIVE_STEP',
    'generationRuleId',
    'generationRuleName',
    'pdaStepTemplateCode',
    'wholeOrderEnabled',
    'wholeOrderRule',
    'check:production-task-generation-rules',
    'check-production-task-generation-rules',
  ]
  const leftovers = governedFiles.flatMap((file) => {
    const content = read(file)
    return forbiddenTokens.filter((token) => content.includes(token)).map((token) => `${file}:${token}`)
  })
  assert.deepEqual(leftovers, [])
  assert.equal(fs.existsSync(path.join(repoRoot, 'src/data/fcs/production-task-generation-rules.ts')), false)
  assert.equal(fs.existsSync(path.join(repoRoot, 'src/pages/production/task-generation-rules.ts')), false)
  assert(read('src/data/fcs/process-tasks.ts').includes("'WHOLE_ORDER_TASK'"), true, '中性整单任务结构边界必须保留')
  assert(read('src/pages/pda-warehouse-wait-handover.ts').includes('KOL-GOTO 不使用待交出仓'))
  assert(read('src/pages/pda-warehouse-stocktake.ts').includes('KOL-GOTO 不开放盘点与库存调整'))
  assert(read('src/pages/pda-warehouse-inbound-records.ts').includes('加工领料入库记录'))
  assert(read('src/pages/pda-warehouse-inbound-records.ts').includes('无需仓管再次接收'))
  assert(read('src/pages/pda-warehouse-outbound-records.ts').includes('加工领料出库记录'))
  assert(read('src/pages/pda-warehouse-outbound-records.ts').includes('无需仓管再次发料或回写'))
  const notifySource = read('src/pages/pda-notify.ts')
  assert(notifySource.includes("{ value: '加工领料', label: '加工领料' }"))
  assert(notifySource.includes("if (!isKolGotoFactory(factoryId)) return FILTERS"), '普通工厂待办筛选必须保持原分支')
  const notifyDetailSource = read('src/pages/pda-notify-detail.ts')
  assert(notifyDetailSource.includes('getFactoryMobileTodos(runtime.factoryId, runtime.roleId)'))
  assert(notifyDetailSource.includes('runtime && isKolGotoFactory(runtime.factoryId)'))
  const dueSoonSource = read('src/pages/pda-notify-due-soon.ts')
  assert(dueSoonSource.includes("new Set<DueSoonCategory>(['全部', '执行类'])"))
  assert(dueSoonSource.includes("if (!isKolGotoFactory(factoryId)) return CATEGORIES"), '普通工厂即将逾期分类必须保持原分支')
  const factoryProfileSource = read('src/pages/factory-profile.ts')
  assert(factoryProfileSource.includes('普通派单：关闭'))
  assert(factoryProfileSource.includes('KOL-GOTO 的开始条件由特殊流程固定，不提供可编辑开关。'))
  assert(read('src/main-handlers/pda-handlers.ts').includes('closePdaExecDetailDialogsOnEscape'))
  assert(read('src/pages/pda-exec.ts').includes("task.status === 'IN_PROGRESS' ? '加工中' : '未开工'"))
  const execDetailSource = read('src/pages/pda-exec-detail.ts')
  assert(execDetailSource.includes('KOL 整单任务不能手工开工；首次加工领料后系统自动开工。'))
  assert(execDetailSource.includes('KOL 整单任务不使用关键节点上报。'))
  assert(execDetailSource.includes('KOL 整单任务不使用暂停上报。'))
  assert(execDetailSource.includes('KOL 整单任务只能通过“完成”入口结束。'))

  console.log('KOL-GOTO 特殊流程专项契约通过：11 组，全部断言通过。')
} finally {
  setProcessWorkOrderGenerationCommitFailureForTest(null)
  setKolGotoPickupFailureStepForTest(null)
  setKolGotoFixedTotalLedgerFailureForTest(false)
  productionOrders.splice(0, productionOrders.length, ...structuredClone(originalOrders))
  state.demands = structuredClone(originalDemands)
  restoreProcessTaskStore(originalTasks)
  restoreFactoryInternalWarehouseMutationSnapshot(originalWarehouse)
  restorePdaHandoverState(originalHandover)
  restoreKolGotoFixedTotalLedgerStore(originalLedgers)
  clearRuntimeProcessTasksCache()
}
