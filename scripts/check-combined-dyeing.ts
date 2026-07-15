import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  allocateCombinedDyeingOutput,
  completeCombinedDyeingTask,
  correctCombinedDyeingResult,
  createCombinedDyeingTask,
  deleteCombinedDyeingTask,
  getActiveCombinedDyeingMembership,
  getCombinedDyeingTaskById,
  getEffectiveDyeingFulfillment,
  listCombinedDyeingTasks,
  parseCombinedDyeingQuantityMinorUnits,
  type CombinedDyeingMemberSnapshot,
} from '../src/data/fcs/combined-dyeing-domain.ts'
import {
  createDyeWorkOrderFromStock,
  getDyeWorkOrderById,
  listDyeExecutionNodeRecords,
  listDyeWorkOrders,
  registerFormalProductionOrderDyeWorkOrder,
  type DyeWorkOrder,
} from '../src/data/fcs/dyeing-task-domain.ts'
import { listProcessWorkOrderStockMaterials } from '../src/data/fcs/process-work-order-stock.ts'

const memberA: CombinedDyeingMemberSnapshot = {
  dyeWorkOrderId: 'DYE-WO-A',
  dyeWorkOrderNo: '染色加工单-A',
  productionOrderId: 'PO-A',
  productionOrderNo: 'PO-001',
  productionOrderOrderedAt: '2026-07-15 08:00:00',
  requiredQty: 600,
  effectiveSatisfiedQtyBeforeTask: 0,
  qtyUnit: 'Yard',
}

const memberB: CombinedDyeingMemberSnapshot = {
  dyeWorkOrderId: 'DYE-WO-B',
  dyeWorkOrderNo: '染色加工单-B',
  productionOrderId: 'PO-B',
  productionOrderNo: 'PO-002',
  productionOrderOrderedAt: '2026-07-15T09:00:00',
  requiredQty: 400,
  effectiveSatisfiedQtyBeforeTask: 0,
  qtyUnit: 'Yard',
}

const memberC: CombinedDyeingMemberSnapshot = {
  dyeWorkOrderId: 'DYE-WO-C',
  dyeWorkOrderNo: '染色加工单-C',
  productionOrderId: 'PO-C',
  productionOrderNo: 'PO-003',
  productionOrderOrderedAt: '2026-07-15 09:00:00',
  requiredQty: 200,
  effectiveSatisfiedQtyBeforeTask: 0,
  qtyUnit: 'Yard',
}

function allocationSummary(actualOutputQty: number) {
  return allocateCombinedDyeingOutput([memberC, memberA, memberB], actualOutputQty)
}

function toMinorUnits(value: number): number {
  return Math.round(value * 1000)
}

function assertQuantityConservation(
  members: readonly CombinedDyeingMemberSnapshot[],
  actualOutputQty: number,
): void {
  const result = allocateCombinedDyeingOutput(members, actualOutputQty)
  const actualOutputMinor = toMinorUnits(actualOutputQty)
  const allocatedMinor = result.allocations.reduce((sum, item) => sum + toMinorUnits(item.allocatedQty), 0)
  assert.equal(allocatedMinor + toMinorUnits(result.excessQty), actualOutputMinor, '分配数量与超出数量之和必须等于规范化实际产出')
  for (const allocation of result.allocations) {
    const remainingNeedMinor = toMinorUnits(allocation.requiredQty) - toMinorUnits(allocation.effectiveSatisfiedQtyBeforeTask)
    assert.equal(
      toMinorUnits(allocation.allocatedQty) + toMinorUnits(allocation.unmetQty),
      remainingNeedMinor,
      `${allocation.dyeWorkOrderNo}/${allocation.productionOrderNo} 的分配数量与未满足数量必须等于剩余需求`,
    )
  }
  assert(result.allocations.every((item) => Number.isFinite(item.allocatedQty) && Number.isFinite(item.unmetQty)), '所有成员数量输出必须有限')
  assert(Number.isFinite(result.excessQty), '超出数量必须有限')
}

let lifecycleWorkOrderSequence = 0

function registerLifecycleWorkOrder(overrides: Partial<{
  factoryId: string
  materialId: string
  materialName: string
  targetColor: string
  processName: string
  plannedQty: number
  orderedAt: string
}> = {}): DyeWorkOrder {
  lifecycleWorkOrderSequence += 1
  const suffix = String(lifecycleWorkOrderSequence).padStart(3, '0')
  return registerFormalProductionOrderDyeWorkOrder({
    workOrderId: `DYE-COMBINED-LIFE-${suffix}`,
    workOrderNo: `RSJG-COMBINED-LIFE-${suffix}`,
    productionOrderId: `PO-COMBINED-LIFE-${suffix}`,
    productionOrderNo: `PO-COMBINED-${suffix}`,
    orderedAt: overrides.orderedAt ?? `2026-07-16 ${String(8 + (lifecycleWorkOrderSequence % 8)).padStart(2, '0')}:00:00`,
    techPackVersionId: `TP-COMBINED-${suffix}`,
    techPackVersionLabel: '技术包 V1',
    materialId: overrides.materialId ?? 'MAT-COMBINED-001',
    materialName: overrides.materialName ?? '合并染色面料',
    targetColor: overrides.targetColor ?? '深蓝',
    plannedQty: overrides.plannedQty ?? 100,
    qtyUnit: '米',
    processCodes: ['DYE'],
    processName: overrides.processName ?? '活性染色',
    factoryId: overrides.factoryId ?? 'FAC-COMBINED-DYE',
    factoryName: `染厂-${overrides.factoryId ?? 'FAC-COMBINED-DYE'}`,
    spuCode: `SPU-COMBINED-${suffix}`,
    spuName: `合并染色款-${suffix}`,
    requiredDeliveryDate: '2026-07-25 18:00:00',
  })
}

function checkCombinedDyeingLifecycle(): void {
  const baseA = registerLifecycleWorkOrder({ plannedQty: 60, orderedAt: '2026-07-16 08:00:00' })
  const baseB = registerLifecycleWorkOrder({ plannedQty: 40, orderedAt: '2026-07-16 09:00:00' })
  assert.throws(() => createCombinedDyeingTask({ workOrders: [baseA], createdBy: '计划员', createdAt: '2026-07-16 10:00:00' }), /至少.*2/, '少于 2 张加工单必须拒绝')
  assert.throws(() => createCombinedDyeingTask({ workOrders: [{ ...baseA, productionOrderIds: [] }, baseB], createdBy: '计划员' }), /只能关联一张生产单/, '生产单 ID 列表为空必须拒绝')
  assert.throws(() => createCombinedDyeingTask({ workOrders: [{ ...baseA, productionOrderIds: undefined }, baseB], createdBy: '计划员' }), /只能关联一张生产单/, '生产单 ID 列表缺失必须拒绝')

  const stock = listProcessWorkOrderStockMaterials({ processCode: 'DYE' })[0]!
  assert(stock, '测试前置：必须存在真实染色备货库存')
  const stockResult = createDyeWorkOrderFromStock({
    stockMaterialId: stock.stockMaterialId,
    stockMaterialName: stock.stockMaterialName,
    materialSku: stock.materialSku,
    factoryId: stock.factoryId,
    plannedFinishAt: '2026-07-25 18:00',
    plannedQty: Math.min(10, stock.availableQty),
    qtyUnit: stock.qtyUnit,
    processName: '活性染色',
    targetColor: '深蓝',
  })
  assert(stockResult.ok && stockResult.order, '测试前置：真实备货染色加工单必须创建成功')
  assert.throws(() => createCombinedDyeingTask({ workOrders: [baseA, stockResult.order!], createdBy: '计划员' }), /生产单来源/, 'STOCK 加工单必须拒绝')
  assert.throws(() => createCombinedDyeingTask({ workOrders: [baseA, registerLifecycleWorkOrder({ factoryId: 'FAC-OTHER' })], createdBy: '计划员' }), /染厂/, '不同染厂必须拒绝')
  assert.throws(() => createCombinedDyeingTask({ workOrders: [baseA, registerLifecycleWorkOrder({ materialId: 'MAT-OTHER' })], createdBy: '计划员' }), /面料/, '不同面料必须拒绝')
  assert.throws(() => createCombinedDyeingTask({ workOrders: [baseA, registerLifecycleWorkOrder({ targetColor: '黑色' })], createdBy: '计划员' }), /目标颜色/, '不同目标颜色必须拒绝')
  assert.throws(() => createCombinedDyeingTask({ workOrders: [baseA, registerLifecycleWorkOrder({ processName: '分散染色' })], createdBy: '计划员' }), /染色工艺/, '不同染色工艺必须拒绝')

  const created = createCombinedDyeingTask({
    workOrders: [baseB, baseA],
    createdBy: '计划员',
    createdAt: '2026-07-16 10:00:00',
    remark: '同缸染色',
  })
  assert.equal(created.status, 'WAIT_DYEING')
  assert.equal(created.members.length, 2)
  assert.equal(created.actualInputQty, undefined, '创建时不得填写实际投入')
  assert.equal(created.actualOutputQty, undefined, '创建时不得填写实际产出')
  assert.throws(() => createCombinedDyeingTask({ workOrders: [baseA, registerLifecycleWorkOrder()], createdBy: '计划员' }), /已加入未删除/, '活动任务成员不得再次占用')
  assert.equal(getActiveCombinedDyeingMembership(baseA.dyeOrderId)?.taskId, created.taskId)

  const returned = getCombinedDyeingTaskById(created.taskId)!
  returned.members[0]!.requiredQty = 999
  assert.notEqual(getCombinedDyeingTaskById(created.taskId)!.members[0]!.requiredQty, 999, '任务和成员返回值必须深克隆')

  assert.throws(() => completeCombinedDyeingTask(created.taskId, {
    actualInputQty: 0,
    actualOutputQty: 0,
    completedBy: '染厂主管',
    completedAt: '2026-07-16 13:00:00',
    remark: '零投入',
  }), /投入.*大于 0/, '实际投入必须大于 0')
  assert.throws(() => completeCombinedDyeingTask(created.taskId, {
    actualInputQty: 100.0001,
    actualOutputQty: 0,
    completedBy: '染厂主管',
    completedAt: '2026-07-16 13:00:00',
    remark: '精度错误',
  }), /最多 3 位小数/, '实际投入必须遵循三位小数合同')

  const factsBeforeCompletion = {
    combinedTasks: listCombinedDyeingTasks({ includeDeleted: true }).length,
    dyeWorkOrders: listDyeWorkOrders().length,
    dyeNodes: listDyeExecutionNodeRecords().length,
  }
  const completed = completeCombinedDyeingTask(created.taskId, {
    actualInputQty: 100,
    actualOutputQty: 70,
    completedBy: '染厂主管',
    completedAt: '2026-07-16 13:00:00',
    remark: '短产完成',
  })
  assert.equal(completed.status, 'COMPLETED')
  assert.equal(completed.allocationVersions.length, 1)
  assert.equal(completed.allocationVersions[0]!.versionNo, 1)
  assert.equal(completed.allocationVersions[0]!.current, true)
  assert.deepEqual(completed.allocationVersions[0]!.allocations.map((item) => [item.allocatedQty, item.satisfaction]), [[60, 'FULL'], [10, 'PARTIAL']])
  assert.deepEqual({
    combinedTasks: listCombinedDyeingTasks({ includeDeleted: true }).length,
    dyeWorkOrders: listDyeWorkOrders().length,
    dyeNodes: listDyeExecutionNodeRecords().length,
  }, factsBeforeCompletion, '一次完成不得生成投缸、补染、继续染、后续任务或新加工单记录')
  assert.throws(() => completeCombinedDyeingTask(created.taskId, {
    actualInputQty: 100,
    actualOutputQty: 70,
    completedBy: '染厂主管',
    completedAt: '2026-07-16 13:01:00',
    remark: '重复',
  }), /只能完成一次/, '任务只能完成一次')

  const beforeBlankCorrection = getCombinedDyeingTaskById(created.taskId)
  assert.throws(() => correctCombinedDyeingResult(created.taskId, {
    actualInputQty: 100,
    actualOutputQty: 50,
    reason: '',
    correctedBy: '主管',
    correctedAt: '2026-07-16 13:59:00',
  }), /更正原因不能为空/, '更正原因必填')
  assert.deepEqual(getCombinedDyeingTaskById(created.taskId), beforeBlankCorrection, '更正校验失败不得改写 current 版本')

  const corrected = correctCombinedDyeingResult(created.taskId, {
    actualInputQty: 100,
    actualOutputQty: 50,
    reason: '复秤修正',
    correctedBy: '主管',
    correctedAt: '2026-07-16 14:00:00',
  })
  assert.equal(corrected.allocationVersions.length, 2)
  assert.equal(corrected.allocationVersions[0]!.current, false)
  assert.equal(corrected.allocationVersions[1]!.versionNo, 2)
  assert.equal(corrected.allocationVersions[1]!.current, true)
  const beforeRejectedMemberCorrection = getCombinedDyeingTaskById(created.taskId)
  assert.throws(() => correctCombinedDyeingResult(created.taskId, {
    actualInputQty: 100,
    actualOutputQty: 50,
    reason: '非法更换成员',
    correctedBy: '主管',
    correctedAt: '2026-07-16 14:01:00',
    members: [],
  } as never), /不接受字段：members/, '更正不得修改成员或合并身份')
  assert.deepEqual(getCombinedDyeingTaskById(created.taskId), beforeRejectedMemberCorrection, '非法更正不得污染任务')
  corrected.allocationVersions[1]!.allocations[0]!.allocatedQty = 999
  assert.notEqual(getCombinedDyeingTaskById(created.taskId)!.allocationVersions[1]!.allocations[0]!.allocatedQty, 999, '版本和分配返回值必须深克隆')

  const fulfillmentA = getEffectiveDyeingFulfillment(baseA.dyeOrderId)
  const fulfillmentB = getEffectiveDyeingFulfillment(baseB.dyeOrderId)
  assert.deepEqual([fulfillmentA.effectiveSatisfiedQty, fulfillmentA.remainingNeedQty, fulfillmentA.satisfaction], [50, 10, 'PARTIAL'])
  assert.deepEqual([fulfillmentB.effectiveSatisfiedQty, fulfillmentB.remainingNeedQty, fulfillmentB.satisfaction], [0, 40, 'UNMET'])
  const projectedA = getDyeWorkOrderById(baseA.dyeOrderId)!.combinedDyeing
  assert.deepEqual(
    [projectedA?.currentTaskId, projectedA?.effectiveSatisfiedQty, projectedA?.remainingNeedQty, projectedA?.satisfaction, projectedA?.occupiedByActiveTask],
    [created.taskId, 50, 10, 'PARTIAL', true],
    '染色加工单必须读取合并任务当前投影',
  )

  const beforeBlankDelete = getCombinedDyeingTaskById(created.taskId)
  assert.throws(() => deleteCombinedDyeingTask(created.taskId, {
    deletedBy: '计划主管',
    deletedAt: '2026-07-16 14:59:00',
    reason: '',
  }), /删除原因不能为空/, '删除原因必填')
  assert.deepEqual(getCombinedDyeingTaskById(created.taskId), beforeBlankDelete, '删除校验失败不得提前改写状态')

  const deletedCompleted = deleteCombinedDyeingTask(created.taskId, {
    deletedBy: '计划主管',
    deletedAt: '2026-07-16 15:00:00',
    reason: '任务归档删除',
  })
  assert.equal(deletedCompleted.status, 'DELETED')
  assert.equal(listCombinedDyeingTasks().some((item) => item.taskId === created.taskId), false, '默认列表排除已删除')
  assert.equal(listCombinedDyeingTasks({ includeDeleted: true }).some((item) => item.taskId === created.taskId), true, 'includeDeleted 保留历史')
  assert.equal(getEffectiveDyeingFulfillment(baseA.dyeOrderId).effectiveSatisfiedQty, 50, '删除已完成任务不得撤回有效满足量')
  assert.equal(getActiveCombinedDyeingMembership(baseA.dyeOrderId), undefined, '删除必须释放活动占用')
  assert.throws(() => correctCombinedDyeingResult(created.taskId, {
    actualInputQty: 100,
    actualOutputQty: 60,
    reason: '删除后修正',
    correctedBy: '主管',
    correctedAt: '2026-07-16 16:00:00',
  }), /已删除/, '已删除任务不得更正')
  assert.throws(() => deleteCombinedDyeingTask(created.taskId, { deletedBy: '主管', deletedAt: '2026-07-16 16:00:00', reason: '重复删除' }), /已删除/, '重复删除明确拒绝')

  const followA = registerLifecycleWorkOrder({ plannedQty: 40, orderedAt: '2026-07-16 10:00:00' })
  const followTask = createCombinedDyeingTask({ workOrders: [baseA, followA], createdBy: '计划员' })
  assert.notEqual(followTask.taskId, created.taskId, '删除后新任务 ID 仍必须唯一')
  assert.notEqual(followTask.taskNo, created.taskNo, '删除后新任务号仍必须唯一')
  assert.equal(followTask.members.find((item) => item.dyeWorkOrderId === baseA.dyeOrderId)?.effectiveSatisfiedQtyBeforeTask, 50, '下一任务必须扣除历史有效分配')
  const waitingDelete = deleteCombinedDyeingTask(followTask.taskId, { deletedBy: '计划员', deletedAt: '2026-07-16 17:00:00', reason: '计划取消' })
  assert.equal(waitingDelete.status, 'DELETED', '待染色任务允许软删除')
  assert.equal(getActiveCombinedDyeingMembership(baseA.dyeOrderId), undefined, '删除待染色任务释放全部占用')

  const startedA = { ...registerLifecycleWorkOrder({ plannedQty: 20 }), status: 'DYEING' as const }
  const startedB = { ...registerLifecycleWorkOrder({ plannedQty: 20 }), status: 'DEHYDRATING' as const }
  const startedTask = createCombinedDyeingTask({ workOrders: [startedA, startedB], createdBy: '计划员' })
  assert.equal(startedTask.status, 'WAIT_DYEING', '已开始但未被活动合并任务占用的来源加工单仍可创建合并任务')
  deleteCombinedDyeingTask(startedTask.taskId, { deletedBy: '计划员', deletedAt: '2026-07-16 17:10:00', reason: '验证后取消' })

  const zeroA = registerLifecycleWorkOrder({ plannedQty: 10 })
  const zeroB = registerLifecycleWorkOrder({ plannedQty: 10 })
  const zeroTask = createCombinedDyeingTask({ workOrders: [zeroA, zeroB], createdBy: '计划员' })
  const zeroCompleted = completeCombinedDyeingTask(zeroTask.taskId, {
    actualInputQty: 20,
    actualOutputQty: 0,
    completedBy: '染厂主管',
    completedAt: '2026-07-16 18:00:00',
    remark: '零产出终止',
  })
  assert(zeroCompleted.allocationVersions[0]!.allocations.every((item) => item.satisfaction === 'UNMET'), '实际产出 0 合法且不得生成后续任务')

  const fullA = registerLifecycleWorkOrder({ plannedQty: 10 })
  const fullB = registerLifecycleWorkOrder({ plannedQty: 10 })
  const fullTask = createCombinedDyeingTask({ workOrders: [fullA, fullB], createdBy: '计划员' })
  completeCombinedDyeingTask(fullTask.taskId, {
    actualInputQty: 20,
    actualOutputQty: 20,
    completedBy: '染厂主管',
    completedAt: '2026-07-16 18:10:00',
    remark: '足量完成',
  })
  deleteCombinedDyeingTask(fullTask.taskId, { deletedBy: '计划员', deletedAt: '2026-07-16 18:20:00', reason: '已完成归档' })
  assert.throws(
    () => createCombinedDyeingTask({ workOrders: [fullA, registerLifecycleWorkOrder({ plannedQty: 10 })], createdBy: '计划员' }),
    /已全部满足/,
    '已全部满足的加工单即使释放占用也无需再次参加',
  )
}

function main(): void {
  const domainSource = readFileSync(new URL('../src/data/fcs/combined-dyeing-domain.ts', import.meta.url), 'utf8')
  assert(!domainSource.includes('Date.parse'), '合并染色排序不得重新引入环境相关 Date.parse')
  assert(!/\bnew\s+Date\s*\(/.test(domainSource), '合并染色排序不得重新引入环境相关 new Date')

  const partial = allocationSummary(800)
  assert.deepEqual(
    partial.allocations.map(({ productionOrderNo, allocatedQty, satisfaction, unmetQty }) => ({
      productionOrderNo,
      allocatedQty,
      satisfaction,
      unmetQty,
    })),
    [
      { productionOrderNo: 'PO-001', allocatedQty: 600, satisfaction: 'FULL', unmetQty: 0 },
      { productionOrderNo: 'PO-002', allocatedQty: 200, satisfaction: 'PARTIAL', unmetQty: 200 },
      { productionOrderNo: 'PO-003', allocatedQty: 0, satisfaction: 'UNMET', unmetQty: 200 },
    ],
    '800 Yard 必须先满足最早下单的 A，再部分满足同时间但单号更小的 B',
  )
  assert.equal(partial.excessQty, 0, '未超过总需求时不得产生余量')

  const excess = allocationSummary(1300)
  assert.deepEqual(
    excess.allocations.map(({ productionOrderNo, allocatedQty, satisfaction, unmetQty }) => ({
      productionOrderNo,
      allocatedQty,
      satisfaction,
      unmetQty,
    })),
    [
      { productionOrderNo: 'PO-001', allocatedQty: 600, satisfaction: 'FULL', unmetQty: 0 },
      { productionOrderNo: 'PO-002', allocatedQty: 400, satisfaction: 'FULL', unmetQty: 0 },
      { productionOrderNo: 'PO-003', allocatedQty: 200, satisfaction: 'FULL', unmetQty: 0 },
    ],
    '产出不得分配超过成员剩余需求',
  )
  assert.equal(excess.excessQty, 100, '超过总需求的 100 Yard 必须单独返回')

  const zero = allocationSummary(0)
  assert(zero.allocations.every((item) => item.allocatedQty === 0 && item.satisfaction === 'UNMET'), '0 产出合法且所有未满足成员都应为未满足')
  assert.equal(zero.excessQty, 0)

  const alreadySatisfied = allocateCombinedDyeingOutput([
    { ...memberA, effectiveSatisfiedQtyBeforeTask: 600 },
    { ...memberB, effectiveSatisfiedQtyBeforeTask: 100 },
  ], 350)
  assert.deepEqual(
    alreadySatisfied.allocations.map((item) => [item.productionOrderNo, item.allocatedQty, item.satisfaction, item.unmetQty]),
    [
      ['PO-001', 0, 'FULL', 0],
      ['PO-002', 300, 'FULL', 0],
    ],
    '分配只计算本任务前尚未满足的数量',
  )
  assert.equal(alreadySatisfied.excessQty, 50)

  const decimal = allocateCombinedDyeingOutput([
    { ...memberA, requiredQty: 0.1 },
    { ...memberB, requiredQty: 0.2 },
  ], 0.1 + 0.2)
  assert.deepEqual(
    decimal.allocations.map((item) => [item.allocatedQty, item.satisfaction, item.unmetQty]),
    [
      [0.1, 'FULL', 0],
      [0.2, 'FULL', 0],
    ],
    '小数数量不得因浮点残差误判为部分满足',
  )
  assert.equal(decimal.excessQty, 0)
  assertQuantityConservation([
    { ...memberA, requiredQty: 0.1 },
    { ...memberB, requiredQty: 0.2 },
  ], 0.1 + 0.2)

  const thousandth = allocateCombinedDyeingOutput([{ ...memberA, requiredQty: 0.999 }], 0.999)
  assert.deepEqual(
    thousandth.allocations.map((item) => [item.allocatedQty, item.satisfaction, item.unmetQty]),
    [[0.999, 'FULL', 0]],
    '0.999 必须作为合法的千分之一精度数量完整分配',
  )
  assert.equal(thousandth.excessQty, 0)
  assertQuantityConservation([{ ...memberA, requiredQty: 0.999 }], 0.999)

  assert.equal(parseCombinedDyeingQuantityMinorUnits(2.002), 2002, '2.002 必须精确解析为 2002 个最小单位')
  assert.equal(parseCombinedDyeingQuantityMinorUnits(10.001), 10001, '10.001 必须精确解析为 10001 个最小单位')
  assert.equal(parseCombinedDyeingQuantityMinorUnits(1e3), 1_000_000, '科学计数写法 1e3 必须解析为 1000')
  assert.equal(parseCombinedDyeingQuantityMinorUnits(1e-3), 1, '科学计数写法 1e-3 必须解析为 0.001')
  assert.equal(parseCombinedDyeingQuantityMinorUnits(0.1 + 0.2), 300, '0.1 + 0.2 只允许消除固定 EPSILON 范围内的机器尾差')
  assert.throws(() => parseCombinedDyeingQuantityMinorUnits(0.0001), /最多 3 位小数/, '0.0001 必须拒绝')
  assert.throws(() => parseCombinedDyeingQuantityMinorUnits(2.0021), /最多 3 位小数/, '2.0021 必须拒绝')
  assert.throws(() => parseCombinedDyeingQuantityMinorUnits(999_999_999_999.9999), /最多 3 位小数/, '大数量第四位小数必须拒绝')

  const exactThreeDecimals = allocateCombinedDyeingOutput([
    { ...memberA, requiredQty: 2.002 },
    { ...memberB, requiredQty: 10.001 },
  ], 12.003)
  assert.deepEqual(
    exactThreeDecimals.allocations.map((item) => [item.allocatedQty, item.satisfaction, item.unmetQty]),
    [
      [2.002, 'FULL', 0],
      [10.001, 'FULL', 0],
    ],
    '合法三位小数必须精确分配且不得产生尾差',
  )
  assertQuantityConservation([
    { ...memberA, requiredQty: 2.002 },
    { ...memberB, requiredQty: 10.001 },
  ], 12.003)

  const safeLargeQty = 999_999_999_999.999
  const safeLargeMinorUnits = parseCombinedDyeingQuantityMinorUnits(safeLargeQty)
  assert.equal(safeLargeMinorUnits, 999_999_999_999_999, '安全大数必须精确解析为整数最小单位')
  assert(Number.isSafeInteger(safeLargeMinorUnits), '数量解析函数只能输出安全整数')
  const safeLarge = allocateCombinedDyeingOutput([{ ...memberA, requiredQty: safeLargeQty }], safeLargeQty)
  assert.equal(safeLarge.allocations[0]!.allocatedQty, safeLargeQty, '安全整数范围内的大数量必须原值守恒')
  assert.equal(safeLarge.allocations[0]!.unmetQty, 0)
  assert.equal(safeLarge.excessQty, 0)
  assertQuantityConservation([{ ...memberA, requiredQty: safeLargeQty }], safeLargeQty)

  assert.throws(() => allocationSummary(0.9999), /最多 3 位小数/, '实际产出超过 3 位小数必须拒绝')
  assert.throws(() => allocationSummary(1e-19), /最多 3 位小数/, '非零微量实际产出不得静默规范化为 0')
  assert.throws(() => allocationSummary(-1e-19), /不得小于 0/, '负数微量实际产出必须按负数拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: 1.0001 }], 0), /染色加工单-A\/生产单 PO-001.*需求数量最多 3 位小数/, '成员需求超精度错误必须定位加工单和生产单')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: 1_000_000_000_000.0001 }], 0), /最多 3 位小数/, '大数量真实第四位小数不得被容差吞掉')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: 999_999_999_999.9999 }], 0), /最多 3 位小数/, '接近合法大数的第四位小数不得被改写到相邻数量')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, effectiveSatisfiedQtyBeforeTask: 0.0001 }], 0), /染色加工单-A\/生产单 PO-001.*任务前已满足数量最多 3 位小数/, '任务前已满足数量超精度错误必须定位加工单和生产单')
  assert.throws(() => allocationSummary(Number.MAX_VALUE), /安全上限/, '实际产出超过安全上限必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: Number.MAX_VALUE }], 0), /安全上限/, '成员需求超过安全上限必须拒绝')
  assert.throws(
    () => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: safeLargeQty, effectiveSatisfiedQtyBeforeTask: Number.MAX_VALUE }], 0),
    /安全上限/,
    '任务前已满足数量超过安全上限必须拒绝',
  )

  for (const invalidOutput of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => allocationSummary(invalidOutput), /实际产出数量/, `必须拒绝非法实际产出：${invalidOutput}`)
  }
  assert.throws(() => allocateCombinedDyeingOutput([], 0), /至少包含 1 个成员/, '领域分配至少需要一个成员')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: 0 }], 0), /需求数量/, '需求数量必须大于 0')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: -1 }], 0), /需求数量/, '需求数量不得为负数')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, requiredQty: Number.NaN }], 0), /需求数量/, '需求数量必须是有限数')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, effectiveSatisfiedQtyBeforeTask: -1 }], 0), /任务前已满足数量/, '任务前已满足数量不得为负数')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, effectiveSatisfiedQtyBeforeTask: Number.NaN }], 0), /任务前已满足数量/, '任务前已满足数量必须是有限数')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, effectiveSatisfiedQtyBeforeTask: 601 }], 0), /任务前已满足数量/, '任务前已满足数量不得超过需求')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, qtyUnit: '   ' }], 0), /染色加工单-A\/生产单 PO-001.*数量单位不能为空/, '空单位错误必须定位加工单和生产单')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, qtyUnit: '米' }], 0), /染色加工单-B\/生产单 PO-002.*数量单位必须一致/, '混合单位错误必须定位加工单和生产单')
  const trimmedUnit = allocateCombinedDyeingOutput([{ ...memberA, qtyUnit: ' Yard ' }, memberB], 0)
  assert(trimmedUnit.allocations.every((item) => item.qtyUnit === 'Yard'), '成员单位必须 trim 后比较并返回')

  const identityFields = [
    ['dyeWorkOrderId', '染色加工单 ID'],
    ['dyeWorkOrderNo', '染色加工单号'],
    ['productionOrderId', '生产单 ID'],
    ['productionOrderNo', '生产单号'],
  ] as const
  for (const [field, label] of identityFields) {
    assert.throws(
      () => allocateCombinedDyeingOutput([{ ...memberA, [field]: '' }], 0),
      new RegExp(`${label}不能为空`),
      `${label}空字符串必须拒绝`,
    )
    assert.throws(
      () => allocateCombinedDyeingOutput([{ ...memberA, [field]: '   ' }], 0),
      new RegExp(`${label}不能为空`),
      `${label}纯空格必须拒绝`,
    )
  }

  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, dyeWorkOrderId: memberA.dyeWorkOrderId }], 0), /染色加工单/, '重复染色加工单必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, dyeWorkOrderNo: memberA.dyeWorkOrderNo }], 0), /染色加工单/, '重复染色加工单号必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, productionOrderId: memberA.productionOrderId }], 0), /生产单/, '重复生产单必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, productionOrderNo: memberA.productionOrderNo }], 0), /生产单/, '重复生产单号必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, dyeWorkOrderId: ` ${memberA.dyeWorkOrderId} ` }], 0), /染色加工单/, 'trim 后重复染色加工单 ID 必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, dyeWorkOrderNo: ` ${memberA.dyeWorkOrderNo} ` }], 0), /染色加工单/, 'trim 后重复染色加工单号必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, productionOrderId: ` ${memberA.productionOrderId} ` }], 0), /生产单/, 'trim 后重复生产单 ID 必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([memberA, { ...memberB, productionOrderNo: ` ${memberA.productionOrderNo} ` }], 0), /生产单/, 'trim 后重复生产单号必须拒绝')

  const canonicalIdentity = allocateCombinedDyeingOutput([{
    ...memberA,
    dyeWorkOrderId: ` ${memberA.dyeWorkOrderId} `,
    dyeWorkOrderNo: ` ${memberA.dyeWorkOrderNo} `,
    productionOrderId: ` ${memberA.productionOrderId} `,
    productionOrderNo: ` ${memberA.productionOrderNo} `,
  }], 0).allocations[0]!
  assert.deepEqual(
    [canonicalIdentity.dyeWorkOrderId, canonicalIdentity.dyeWorkOrderNo, canonicalIdentity.productionOrderId, canonicalIdentity.productionOrderNo],
    [memberA.dyeWorkOrderId, memberA.dyeWorkOrderNo, memberA.productionOrderId, memberA.productionOrderNo],
    '分配结果必须输出 trim 后的成员身份',
  )

  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '' }], 0), /下单时间/, '空下单时间必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: 'not-a-date' }], 0), /下单时间/, '非法下单时间必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-02-30 08:00:00' }], 0), /下单时间/, '不存在的日历日期必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-07-15 24:00:00' }], 0), /下单时间/, '非法小时必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-07-15 09:00' }], 0), /下单时间/, '缺少秒的时间格式必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-07-15T09:00:00Z' }], 0), /无时区/, '显式 Z 时区必须拒绝')
  assert.throws(() => allocateCombinedDyeingOutput([{ ...memberA, productionOrderOrderedAt: '2026-07-15T09:00:00+08:00' }], 0), /无时区/, '显式 offset 时区必须拒绝')

  const originalTimezone = process.env.TZ
  const allocationOrderByTimezone = (timezone: string): string[] => {
    process.env.TZ = timezone
    return allocateCombinedDyeingOutput([memberC, memberB, memberA], 0).allocations.map((item) => item.productionOrderNo)
  }
  try {
    assert.deepEqual(allocationOrderByTimezone('UTC'), ['PO-001', 'PO-002', 'PO-003'], 'UTC 环境必须保持固定排序')
    assert.deepEqual(allocationOrderByTimezone('Asia/Shanghai'), ['PO-001', 'PO-002', 'PO-003'], '上海时区环境必须保持相同排序')
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ
    else process.env.TZ = originalTimezone
  }

  const inputWithManualAllocation = Object.freeze([
    Object.freeze({ ...memberC, allocatedQty: 999 }),
    Object.freeze({ ...memberA, allocatedQty: 999 }),
    Object.freeze({ ...memberB, allocatedQty: 999 }),
  ])
  const inputSnapshot = structuredClone(inputWithManualAllocation)
  const calculated = allocateCombinedDyeingOutput(inputWithManualAllocation, 800)
  assert.deepEqual(inputWithManualAllocation, inputSnapshot, '纯函数不得修改输入数组或成员对象')
  assert.deepEqual(calculated.allocations.map((item) => item.allocatedQty), [600, 200, 0], '外部传入的人工分配值必须被忽略，结果只能由领域函数计算')

  checkCombinedDyeingLifecycle()

  console.log('✓ 合并染色分配与任务生命周期领域检查通过')
}

main()
