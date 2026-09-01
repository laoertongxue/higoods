import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  createEffectiveTaskAssignment,
  resetEffectiveTaskAssignmentsForTests,
} from '../src/data/fcs/effective-task-assignments.ts'
import {
  getFactoryActivePpicSnapshot,
  listSewingFactoriesWithoutActivePpic,
  listSewingFactoryMasterRecords,
  upsertFactoryMasterRecord,
} from '../src/data/fcs/factory-master-store.ts'
import {
  FACTORY_ONBOARDING_PPIC_OPTIONS,
  PPIC_TEAM_LEADER_LINGYUN,
  SEWING_OUTSOURCING_DEMO_CURRENT_PPIC,
  getAvailableOnboardingPpicOptions,
} from '../src/data/fcs/factory-onboarding-ppic.ts'
import {
  getCurrentSewingTaskResponsibility,
  listSewingTaskResponsibilityVersions,
  resetSewingTaskResponsibilityTransfersForTests,
  transferSewingTaskResponsibility,
} from '../src/data/fcs/sewing-outsourcing-responsibility.ts'

const activePpics = getAvailableOnboardingPpicOptions()
assert(activePpics.length >= 21, 'PPIC原型主数据必须覆盖20+人的团队规模')
assert.equal(PPIC_TEAM_LEADER_LINGYUN.ppicName, '凌云')
assert.equal(PPIC_TEAM_LEADER_LINGYUN.role, 'TEAM_LEADER')
assert.deepEqual(
  FACTORY_ONBOARDING_PPIC_OPTIONS.filter((item) => item.role === 'TEAM_LEADER' && item.status === '启用').map((item) => item.ppicName).sort(),
  ['凌云', '婕哥'].sort(),
)

const sewingFactories = listSewingFactoryMasterRecords()
assert(sewingFactories.length > 0)
assert.deepEqual(listSewingFactoriesWithoutActivePpic(), [], '所有正式车缝工厂必须补齐唯一有效PPIC')
assert(
  new Set(sewingFactories.map((factory) => factory.assignedPpicId)).size >= 8,
  '车缝工厂PPIC补齐数据必须体现多人分工，不能批量复制到同一默认人员',
)
for (const factory of sewingFactories) {
  const snapshot = getFactoryActivePpicSnapshot(factory.id)
  assert(snapshot, `${factory.name}必须有唯一有效PPIC`)
  assert.equal(snapshot.ppicId, factory.assignedPpicId)
  assert.equal(snapshot.ppicName, factory.assignedPpicName)
}

const factory = sewingFactories.find((item) => item.id === 'ID-F021') ?? sewingFactories[0]
const originalFactory = structuredClone(factory)
const originalPpic = getFactoryActivePpicSnapshot(factory.id)
assert(originalPpic)
const nextPpic = activePpics.find((item) => item.ppicId !== originalPpic.ppicId && item.role !== 'TEAM_LEADER')
assert(nextPpic)
const transferTarget = activePpics.find((item) => ![originalPpic.ppicId, nextPpic.ppicId].includes(item.ppicId) && item.role !== 'TEAM_LEADER')
assert(transferTarget)

resetEffectiveTaskAssignmentsForTests()
resetSewingTaskResponsibilityTransfersForTests()

try {
  assert.equal(getCurrentSewingTaskResponsibility('TASKGEN-202603-0015-003__ORDER'), null, '选定工厂前不能提前生成任务PPIC')

  assert.throws(
    () => createEffectiveTaskAssignment({
      assignmentId: 'ASG-PPIC-RESP-NON-PPIC-001',
      runtimeTaskId: 'TASK-PPIC-RESP-NON-PPIC-001',
      productionOrderId: 'PO-PPIC-RESP-NON-PPIC-001',
      factoryId: factory.id,
      factoryName: factory.name,
      source: 'DIRECT_DISPATCH',
      assignedQty: 10,
      skuLines: [{ skuCode: 'SKU-PPIC-RESP-NON-PPIC-001', color: 'Black', size: 'M', qty: 10 }],
      processCodes: ['SEW'],
      frozenPrice: 1500,
      priceCurrency: 'IDR',
      priceUnit: '件',
      businessAssignedAt: '2026-08-31 08:50:00',
      operatedAt: '2026-08-31 08:50:00',
      operatedBy: '生产计划员',
    }),
    /只能由当前登录的有效PPIC分配/,
    '生产计划员不得代替PPIC分配含车缝任务',
  )

  const firstAssignment = createEffectiveTaskAssignment({
    assignmentId: 'ASG-PPIC-RESP-001',
    runtimeTaskId: 'TASKGEN-202603-0015-003__ORDER',
    productionOrderId: 'PO-202603-0015',
    productionOrderNo: 'PO-202603-0015',
    taskNo: 'TASKGEN-202603-0015-003',
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'DIRECT_DISPATCH',
    assignedQty: 1400,
    skuLines: [{ skuCode: 'SKU-PPIC-001', color: 'Black', size: 'M', qty: 1400 }],
    processCodes: ['SEW'],
    frozenPrice: 1500,
    priceCurrency: 'IDR',
    priceUnit: '件',
    businessAssignedAt: '2026-08-31 09:00:00',
    operatedAt: '2026-08-31 09:05:00',
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
  assert.equal(firstAssignment.allocationOperatorPpicId, SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId)
  assert.equal(firstAssignment.allocationOperatorPpicName, SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName)
  assert.equal(firstAssignment.ppicId, originalPpic.ppicId)
  assert.equal(firstAssignment.ppicName, originalPpic.ppicName)
  assert.equal(getCurrentSewingTaskResponsibility(firstAssignment.runtimeTaskId)?.ppicId, originalPpic.ppicId)

  upsertFactoryMasterRecord({
    ...factory,
    assignedPpicId: nextPpic.ppicId,
    assignedPpicName: nextPpic.ppicName,
    assignedPpicPhone: nextPpic.mobilePhone,
    updatedAt: '2026-08-31 10:00:00',
  })
  assert.equal(getFactoryActivePpicSnapshot(factory.id)?.ppicId, nextPpic.ppicId)
  assert.equal(firstAssignment.ppicId, originalPpic.ppicId, '工厂主数据换人不能静默覆盖历史分配PPIC')
  assert.equal(getCurrentSewingTaskResponsibility(firstAssignment.runtimeTaskId)?.ppicId, originalPpic.ppicId, '未完成任务不能自动转给新PPIC')

  const laterAssignment = createEffectiveTaskAssignment({
    assignmentId: 'ASG-PPIC-RESP-002',
    runtimeTaskId: 'TASK-PPIC-LATER-001',
    productionOrderId: 'PO-PPIC-LATER-001',
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'DIRECT_DISPATCH',
    assignedQty: 100,
    skuLines: [{ skuCode: 'SKU-PPIC-LATER-001', color: 'White', size: 'L', qty: 100 }],
    processCodes: ['SEW'],
    frozenPrice: 1600,
    priceCurrency: 'IDR',
    priceUnit: '件',
    businessAssignedAt: '2026-08-31 10:10:00',
    operatedAt: '2026-08-31 10:11:00',
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
  assert.equal(laterAssignment.ppicId, nextPpic.ppicId, '主数据换人只影响后续新分配')

  const cuttingSewingIronPackAssignment = createEffectiveTaskAssignment({
    assignmentId: 'ASG-PPIC-CUT-SEW-IRON-PACK-001',
    runtimeTaskId: 'TASK-PPIC-CUT-SEW-IRON-PACK-001',
    productionOrderId: 'PO-PPIC-CUT-SEW-IRON-PACK-001',
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'DIRECT_DISPATCH',
    assignedQty: 80,
    skuLines: [{ skuCode: 'SKU-PPIC-CUT-SEW-IRON-PACK-001', color: 'Navy', size: 'M', qty: 80 }],
    processCodes: ['CUT_PANEL', 'SEW', 'IRON_PACK'],
    frozenPrice: 2400,
    priceCurrency: 'IDR',
    priceUnit: '件',
    businessAssignedAt: '2026-08-31 10:12:00',
    operatedAt: '2026-08-31 10:13:00',
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
  assert.equal(cuttingSewingIronPackAssignment.ppicId, nextPpic.ppicId, '裁剪+车缝+烫包也必须按承接工厂冻结任务PPIC')

  assert.throws(
    () => transferSewingTaskResponsibility({
      commandId: 'RESP-TRANSFER-NORMAL-PPIC-001',
      runtimeTaskId: firstAssignment.runtimeTaskId,
      targetPpicId: transferTarget.ppicId,
      reason: '负责人重新分工',
      remainingItems: ['跟进裁片交出', '跟进批版建议'],
      operatedAt: '2026-08-31 11:00:00',
      operatedByPpicId: nextPpic.ppicId,
    }),
    /仅PPIC团队负责人可发起责任移交/,
  )

  const transferred = transferSewingTaskResponsibility({
    commandId: 'RESP-TRANSFER-LINGYUN-001',
    runtimeTaskId: firstAssignment.runtimeTaskId,
    targetPpicId: transferTarget.ppicId,
    reason: '负责人调整工厂跟进分工',
    remainingItems: ['跟进裁片交出', '跟进批版建议'],
    operatedAt: '2026-08-31 11:05:00',
    operatedByPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
  })
  assert.equal(transferred.previousPpicId, originalPpic.ppicId)
  assert.equal(transferred.ppicId, transferTarget.ppicId)
  assert.equal(transferred.operatedByPpicId, PPIC_TEAM_LEADER_LINGYUN.ppicId)
  assert.equal(transferred.operatedByPpicName, '凌云')
  assert.deepEqual(transferred.remainingItems, ['跟进裁片交出', '跟进批版建议'])
  assert.equal(getCurrentSewingTaskResponsibility(firstAssignment.runtimeTaskId)?.ppicId, transferTarget.ppicId)

  const repeated = transferSewingTaskResponsibility({
    commandId: 'RESP-TRANSFER-LINGYUN-001',
    runtimeTaskId: firstAssignment.runtimeTaskId,
    targetPpicId: transferTarget.ppicId,
    reason: '负责人调整工厂跟进分工',
    remainingItems: ['跟进裁片交出', '跟进批版建议'],
    operatedAt: '2026-08-31 11:05:00',
    operatedByPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
  })
  assert.equal(repeated.responsibilityVersionId, transferred.responsibilityVersionId, '重复命令必须幂等返回原结果')

  const history = listSewingTaskResponsibilityVersions(firstAssignment.runtimeTaskId)
  assert.equal(history.length, 2)
  assert.equal(history[0].status, 'SUPERSEDED')
  assert.equal(history[1].status, 'CURRENT')
  assert.equal(history[1].previousVersionId, history[0].responsibilityVersionId)

  assert.throws(
    () => transferSewingTaskResponsibility({
      commandId: 'RESP-TRANSFER-NO-RUNTIME-001',
      runtimeTaskId: laterAssignment.runtimeTaskId,
      targetPpicId: transferTarget.ppicId,
      reason: '不存在的运行任务不得移交',
      remainingItems: ['待确认'],
      operatedAt: '2026-08-31 11:10:00',
      operatedByPpicId: PPIC_TEAM_LEADER_LINGYUN.ppicId,
    }),
    /任务不存在或已完结/,
  )
} finally {
  upsertFactoryMasterRecord(originalFactory)
  resetEffectiveTaskAssignmentsForTests()
  resetSewingTaskResponsibilityTransfersForTests()
}

const dispatchPageSource = readFileSync('src/pages/unified-dispatch-workbench.ts', 'utf8')
assert.ok(dispatchPageSource.includes('本次分配操作人：${escapeHtml(SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName)}（PPIC）'), '含车缝任务二次确认必须展示当前分配操作PPIC')
assert.ok(dispatchPageSource.includes('分配操作PPIC和任务PPIC均写入本次有效分配'), '页面必须解释分配操作人与任务责任人的双快照')

console.log('车缝外发PPIC唯一归属、任务冻结与负责人显式移交专项检查通过')
