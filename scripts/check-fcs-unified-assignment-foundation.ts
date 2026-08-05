import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  MERGED_PRODUCTION_TASK_DEFINITIONS,
  isAssignableProductionExecutionTask,
  resolveMergedProductionTaskType,
} from '../src/data/fcs/merged-production-task.ts'
import {
  evaluateFixedMergedTask,
  listRuntimeExecutionTasks,
  listRuntimeProcessTasks,
} from '../src/data/fcs/runtime-process-tasks.ts'
import {
  resolveProductionOrderTaskBoundary,
  shouldGenerateInternalCraftOrderForProductionOrder,
} from '../src/data/fcs/task-generation-boundaries.ts'
import { productionOrders, type ProductionOrder } from '../src/data/fcs/production-orders.ts'
import {
  classifyTaskFulfillmentPolicy,
  type TaskFulfillmentPolicyInput,
} from '../src/data/fcs/task-fulfillment-policy.ts'
import {
  createEffectiveTaskAssignment,
  listCurrentEffectiveTaskAssignments,
  listEffectiveTaskAssignmentAuditLogs,
  listEffectiveTaskAssignments,
  resetEffectiveTaskAssignmentsForTests,
} from '../src/data/fcs/effective-task-assignments.ts'
import {
  calculateNaturalDayDeadline,
  createProductionReturnRuleSnapshot,
  generateAndSaveProductionReturnReminders,
  listProductionReturnReminderLogs,
  projectProductionReturnFulfillment,
  recordProductionReturnReceipt,
  resetProductionReturnSnapshotSequenceForTests,
  resolveReturnReceiptAssignment,
} from '../src/data/fcs/production-return-fulfillment.ts'
import {
  addSignedContractScans,
  generateProductionContract,
  listMissingSignedContractScanTodos,
  listProductionContractAuditLogs,
  listProductionContracts,
  resetProductionContractsForTests,
} from '../src/data/fcs/production-contracts.ts'
import { buildPrintDocument } from '../src/data/fcs/print-template-registry.ts'
import {
  POST_STAGE_FLOW_NODES,
  POST_STAGE_PROCESSES,
  normalizeHistoricalPostProcessCode,
} from '../src/data/fcs/post-stage-taxonomy.ts'
import { buildPostStageExecutionSequence } from '../src/data/fcs/post-process-route.ts'
import { getProcessDefinitionByCode, listProcessDefinitions } from '../src/data/fcs/process-craft-dict.ts'
import { processTypes } from '../src/data/fcs/process-types.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import {
  listBlockingSpecialCraftTaskOrdersForMergedTask,
  listSpecialCraftTaskOrders,
} from '../src/data/fcs/special-craft-task-orders.ts'
import {
  listGeneratedProductionPreparationOrderArtifacts,
  listGeneratedProductionTaskArtifacts,
} from '../src/data/fcs/production-artifact-generation.ts'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function listFilesRecursively(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir)
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relativeDir, entry.name)
    return entry.isDirectory() ? listFilesRecursively(child) : [child]
  })
}

function policy(input: Partial<TaskFulfillmentPolicyInput>): ReturnType<typeof classifyTaskFulfillmentPolicy> {
  return classifyTaskFulfillmentPolicy({
    processCode: 'SEWING',
    processBusinessCode: 'SEWING',
    processNameZh: '车缝',
    taskUnitType: 'SINGLE_PROCESS_TASK',
    coveredProcesses: [],
    assignmentGranularity: 'SKU',
    ...input,
  })
}

function orderWithMergedType(
  mergedTaskType: 'SEWING_IRON_PACK' | 'CUTTING_SEWING_IRON_PACK',
): ProductionOrder {
  const base = structuredClone(productionOrders[0])
  return {
    ...base,
    productionOrderId: `CHECK-${mergedTaskType}`,
    productionOrderNo: `CHECK-${mergedTaskType}`,
    taskBreakdownSummary: {
      ...base.taskBreakdownSummary,
      wholeOrderTaskCount: 0,
      mergedTaskType,
      taskTypesTop3: [MERGED_PRODUCTION_TASK_DEFINITIONS[mergedTaskType].label],
      coveredProcessNames: [...MERGED_PRODUCTION_TASK_DEFINITIONS[mergedTaskType].requiredSourceProcessCodes],
    },
  }
}

// 1. 合并任务只有两种固定责任范围。
assert.deepEqual(Object.keys(MERGED_PRODUCTION_TASK_DEFINITIONS), ['SEWING_IRON_PACK', 'CUTTING_SEWING_IRON_PACK'])
assert.deepEqual(MERGED_PRODUCTION_TASK_DEFINITIONS.SEWING_IRON_PACK.requiredSourceProcessCodes, ['SEWING', 'IRON_PACK'])
assert.equal(MERGED_PRODUCTION_TASK_DEFINITIONS.SEWING_IRON_PACK.auxiliarySpecialExecutorMode, 'CENTRAL_FACTORY')
assert.equal(MERGED_PRODUCTION_TASK_DEFINITIONS.SEWING_IRON_PACK.generatesCentralAuxiliarySpecialOrders, true)
assert.deepEqual(MERGED_PRODUCTION_TASK_DEFINITIONS.CUTTING_SEWING_IRON_PACK.requiredSourceProcessCodes, ['CUTTING', 'SEWING', 'IRON_PACK'])
assert.equal(MERGED_PRODUCTION_TASK_DEFINITIONS.CUTTING_SEWING_IRON_PACK.auxiliarySpecialExecutorMode, 'FOLLOW_MERGED_TASK_FACTORY')
assert.equal(MERGED_PRODUCTION_TASK_DEFINITIONS.CUTTING_SEWING_IRON_PACK.generatesCentralAuxiliarySpecialOrders, false)
assert.equal(MERGED_PRODUCTION_TASK_DEFINITIONS.SEWING_IRON_PACK.assignmentGranularity, 'SKU')
assert.equal(MERGED_PRODUCTION_TASK_DEFINITIONS.CUTTING_SEWING_IRON_PACK.assignmentGranularity, 'SKU')

assert.equal(resolveMergedProductionTaskType([{ processCode: 'SEW' }, { processCode: 'IRON_PACK' }]), 'SEWING_IRON_PACK')
assert.equal(resolveMergedProductionTaskType([{ processCode: 'CUT_PANEL' }, { processCode: 'SEW' }, { processCode: 'IRON_PACK' }]), 'CUTTING_SEWING_IRON_PACK')
assert.equal(resolveMergedProductionTaskType([{ processCode: 'CUT_PANEL' }, { processCode: 'IRON_PACK' }]), null)
assert.equal(resolveMergedProductionTaskType([{ processCode: 'SEW' }, { processCode: 'BUTTONHOLE' }, { processCode: 'IRON_PACK' }]), null)
assert.equal(resolveMergedProductionTaskType([{ processCode: 'DYE' }, { processCode: 'SEW' }, { processCode: 'IRON_PACK' }]), null)

// 2. 准备阶段及后道内部流程节点不进入通用任务清单、分配或合并。
assert.equal(isAssignableProductionExecutionTask({ stageCode: 'PREP', defaultDocType: 'PREPARATION_ORDER', processCode: 'DYE' }), false)
assert.equal(isAssignableProductionExecutionTask({ stageCode: 'POST', defaultDocType: 'TASK', processCode: 'BUTTONHOLE' }), false)
assert.equal(isAssignableProductionExecutionTask({ stageCode: 'POST', defaultDocType: 'TASK', processCode: 'BUTTON_ATTACH' }), false)
assert.equal(isAssignableProductionExecutionTask({ stageCode: 'POST', defaultDocType: 'TASK', processCode: 'IRON_PACK' }), true)

const runtimeTasks = listRuntimeProcessTasks()
const executionTasks = listRuntimeExecutionTasks()
assert.equal(runtimeTasks.some((task) => task.stageCode === 'PREP'), false, '生产准备加工单由专用领域承载，不进入通用运行时任务库')
assert.equal(executionTasks.some((task) => task.stageCode === 'PREP'), false, '生产准备工序不得进入通用任务清单')
assert.equal(executionTasks.some((task) => ['BUTTONHOLE', 'BUTTON_ATTACH'].includes(task.processBusinessCode || task.processCode)), false)
const preparationOrderArtifacts = listGeneratedProductionPreparationOrderArtifacts()
const productionTaskArtifacts = listGeneratedProductionTaskArtifacts()
assert(preparationOrderArtifacts.length > 0, '生产准备工序必须生成加工单')
assert(preparationOrderArtifacts.every((artifact) => artifact.artifactType === 'PREPARATION_ORDER' && artifact.stageCode === 'PREP'))
assert(productionTaskArtifacts.every((artifact) => artifact.artifactType === 'TASK' && artifact.stageCode !== 'PREP'))

const demoOrderTasks = runtimeTasks.filter((task) => task.productionOrderId === 'PO-202603-0102')
const demoVisibleTasks = executionTasks.filter((task) => task.productionOrderId === 'PO-202603-0102')
assert.deepEqual(demoVisibleTasks.map((task) => task.mergedTaskType), ['CUTTING_SEWING_IRON_PACK'])
assert(demoOrderTasks.filter((task) => task.taskUnitType !== 'MERGED_PRODUCTION_TASK').every((task) => task.executionEnabled === false && Boolean(task.mergedIntoTaskId)))
assert(demoOrderTasks.some((task) => task.processBusinessCode === 'EMBROIDERY' && task.mergedIntoTaskId))
assert(demoOrderTasks.some((task) => task.processBusinessCode === 'SPECIAL_CRAFT' && task.mergedIntoTaskId))

const mergeCandidateTasks = runtimeTasks.filter((task) => task.productionOrderId === 'PO-202603-0101')
const mergeCandidateSourceTasks = mergeCandidateTasks.filter((task) =>
  task.executionEnabled
  && ['CUT_PANEL', 'SEW', 'IRON_PACK'].includes(task.processBusinessCode || ''),
)
assert.deepEqual(
  mergeCandidateSourceTasks.map((task) => task.processBusinessCode),
  ['CUT_PANEL', 'SEW', 'IRON_PACK'],
  '页面必须有一张来源干净、尚未合并的裁剪+车缝+烫包生产单',
)
assert(mergeCandidateSourceTasks.find((task) => task.processBusinessCode === 'IRON_PACK')?.sourceEntryId.endsWith('-process-iron-pack'))
assert.equal(mergeCandidateTasks.filter((task) => task.processBusinessCode === 'IRON_PACK').length, 1, '技术包烫包不得再叠加字典覆盖 Mock')
const mergeCandidateEvaluation = evaluateFixedMergedTask(mergeCandidateSourceTasks.map((task) => task.taskId))
assert.equal(mergeCandidateEvaluation.ok, true)
assert.equal(mergeCandidateEvaluation.mergedTaskType, 'CUTTING_SEWING_IRON_PACK')
const mergeCandidateCentralCraftOrders = listSpecialCraftTaskOrders().filter((taskOrder) => taskOrder.productionOrderId === 'PO-202603-0101')
assert(mergeCandidateCentralCraftOrders.length > 0)
assert(mergeCandidateCentralCraftOrders.every((taskOrder) => taskOrder.status === '待领料'))
assert.equal(listBlockingSpecialCraftTaskOrdersForMergedTask('PO-202603-0101').length, 0)

// 3. 中央辅助/特种工艺加工单是否生成，由合并责任范围唯一决定。
const sewingMergedOrder = orderWithMergedType('SEWING_IRON_PACK')
const cuttingMergedOrder = orderWithMergedType('CUTTING_SEWING_IRON_PACK')
assert.equal(resolveProductionOrderTaskBoundary(sewingMergedOrder).kind, 'SEWING_IRON_PACK')
assert.equal(shouldGenerateInternalCraftOrderForProductionOrder(sewingMergedOrder), true)
assert.equal(resolveProductionOrderTaskBoundary(cuttingMergedOrder).kind, 'CUTTING_SEWING_IRON_PACK')
assert.equal(shouldGenerateInternalCraftOrderForProductionOrder(cuttingMergedOrder), false)

// 4. 合同判断与回货规则判断分离，并严格按三组自然日节点。
const sewingPolicy = policy({})
const sewingIronPackPolicy = policy({ taskUnitType: 'MERGED_PRODUCTION_TASK', mergedTaskType: 'SEWING_IRON_PACK' })
const cuttingSewingIronPackPolicy = policy({ taskUnitType: 'MERGED_PRODUCTION_TASK', mergedTaskType: 'CUTTING_SEWING_IRON_PACK' })
const printingPolicy = policy({ processCode: 'PRINT', processBusinessCode: 'PRINT', processNameZh: '印花', assignmentGranularity: 'ORDER' })
assert.equal(sewingPolicy.contractRequired, true)
assert.deepEqual(sewingPolicy.milestones.map((item) => item.naturalDay), [4, 8, 9])
assert.equal(sewingIronPackPolicy.contractRequired, true)
assert.deepEqual(sewingIronPackPolicy.milestones.map((item) => item.naturalDay), [5, 9, 10])
assert.equal(cuttingSewingIronPackPolicy.contractRequired, true)
assert.deepEqual(cuttingSewingIronPackPolicy.milestones.map((item) => item.naturalDay), [6, 9, 12])
assert.equal(printingPolicy.contractRequired, false)
assert.deepEqual(printingPolicy.milestones, [])
assert.equal(calculateNaturalDayDeadline('2026-08-05 23:59:59', 4), '2026-08-08')

// 5. 价格与分配事实冻结；改派时旧分配保留并失效。
resetEffectiveTaskAssignmentsForTests()
resetProductionReturnSnapshotSequenceForTests()
resetProductionContractsForTests()

const assignmentV1 = createEffectiveTaskAssignment({
  assignmentId: 'ASG-CHECK-001',
  runtimeTaskId: 'TASK-CHECK-SEWING',
  productionOrderId: 'PO-CHECK-001',
  productionOrderNo: 'PO-CHECK-001',
  taskNo: 'TASK-CHECK-SEWING',
  factoryId: 'FAC-A',
  factoryName: 'A工厂',
  source: 'DIRECT_DISPATCH',
  assignedQty: 101,
  skuLines: [{ skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', qty: 101 }],
  processCodes: ['SEWING'],
  frozenPrice: 1200,
  priceCurrency: 'IDR',
  priceUnit: '件',
  businessAssignedAt: '2026-08-04 09:00:00',
  operatedAt: '2026-08-04 09:00:00',
  operatedBy: 'PPIC-01',
})
const returnV1 = createProductionReturnRuleSnapshot({
  assignmentId: assignmentV1.assignmentId,
  runtimeTaskId: assignmentV1.runtimeTaskId,
  productionOrderId: assignmentV1.productionOrderId,
  factoryId: assignmentV1.factoryId,
  factoryName: assignmentV1.factoryName,
  assignedQty: assignmentV1.assignedQty,
  businessAssignedAt: assignmentV1.businessAssignedAt,
  policy: sewingPolicy,
})
assert(returnV1)
assert.deepEqual(returnV1.milestones.map((item) => item.targetQty), [31, 71, 101])
const contractV1 = generateProductionContract({
  assignment: assignmentV1,
  policy: sewingPolicy,
  returnRuleSnapshot: returnV1,
  processNames: ['车缝'],
  generatedAt: '2026-08-04 09:00:01',
  generatedBy: 'PPIC-01',
})
assert(contractV1)

const assignmentV2 = createEffectiveTaskAssignment({
  assignmentId: 'ASG-CHECK-002',
  runtimeTaskId: 'TASK-CHECK-SEWING',
  productionOrderId: 'PO-CHECK-001',
  productionOrderNo: 'PO-CHECK-001',
  taskNo: 'TASK-CHECK-SEWING',
  factoryId: 'FAC-B',
  factoryName: 'B工厂',
  source: 'REASSIGNMENT',
  assignedQty: 101,
  skuLines: [{ skuCode: 'SKU-BLACK-M', color: '黑色', size: 'M', qty: 101 }],
  processCodes: ['SEWING'],
  frozenPrice: 1250,
  priceCurrency: 'IDR',
  priceUnit: '件',
  businessAssignedAt: '2026-08-05 10:00:00',
  operatedAt: '2026-08-05 10:00:00',
  operatedBy: 'PPIC-02',
  replaceReason: '改派加工厂',
})
assert.equal(listCurrentEffectiveTaskAssignments('TASK-CHECK-SEWING')[0]?.assignmentId, assignmentV2.assignmentId)
assert.equal(listEffectiveTaskAssignments('TASK-CHECK-SEWING').find((item) => item.assignmentId === assignmentV1.assignmentId)?.status, 'SUPERSEDED')
assert.deepEqual(listEffectiveTaskAssignmentAuditLogs('TASK-CHECK-SEWING').map((item) => item.action), ['CREATED', 'SUPERSEDED', 'CREATED'])

const returnV2 = createProductionReturnRuleSnapshot({
  assignmentId: assignmentV2.assignmentId,
  runtimeTaskId: assignmentV2.runtimeTaskId,
  productionOrderId: assignmentV2.productionOrderId,
  factoryId: assignmentV2.factoryId,
  factoryName: assignmentV2.factoryName,
  assignedQty: assignmentV2.assignedQty,
  businessAssignedAt: assignmentV2.businessAssignedAt,
  policy: sewingPolicy,
})
assert(returnV2)
const contractV2 = generateProductionContract({
  assignment: assignmentV2,
  policy: sewingPolicy,
  returnRuleSnapshot: returnV2,
  processNames: ['车缝'],
  generatedAt: '2026-08-05 10:00:01',
  generatedBy: 'PPIC-02',
  lineageRuntimeTaskId: assignmentV1.runtimeTaskId,
})
assert(contractV2)
const versionedContracts = listProductionContracts().sort((left, right) => left.version - right.version)
assert.equal(versionedContracts.length, 2)
assert.equal(versionedContracts[0].status, 'INVALIDATED')
assert.equal(versionedContracts[0].replacedByContractId, contractV2.contractId)
assert.equal(versionedContracts[1].status, 'EFFECTIVE')
assert.deepEqual(versionedContracts.map((item) => item.version), [1, 2])
assert(listProductionContractAuditLogs().some((item) => item.action === 'INVALIDATED'))

// 6. 每个节点只产生截止前1天、截止当天、逾期后首日三次提醒。
for (const today of ['2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10', '2026-08-10']) {
  generateAndSaveProductionReturnReminders({ snapshots: [returnV2], today })
}
const firstNodeReminderLogs = listProductionReturnReminderLogs({ assignmentId: assignmentV2.assignmentId })
assert.equal(firstNodeReminderLogs.length, 3)
assert.deepEqual(firstNodeReminderLogs.map((item) => item.reminderType), ['DUE_TOMORROW', 'DUE_TODAY', 'OVERDUE'])
assert(firstNodeReminderLogs.find((item) => item.reminderType === 'OVERDUE')?.message.includes('唯一一次逾期警告'))

recordProductionReturnReceipt({
  receiptId: 'RET-CHECK-001',
  assignmentId: assignmentV2.assignmentId,
  factoryId: assignmentV2.factoryId,
  confirmedQty: 31,
  confirmedDate: '2026-08-08',
  confirmed: true,
})
const returnProjection = projectProductionReturnFulfillment({
  snapshot: returnV2,
  today: '2026-08-08',
  receipts: [{ receiptId: 'RET-CHECK-001', assignmentId: assignmentV2.assignmentId, factoryId: assignmentV2.factoryId, confirmedQty: 31, confirmedDate: '2026-08-08', confirmed: true }],
})
assert.equal(returnProjection.confirmedReturnedQty, 31)
assert.equal(returnProjection.milestones[0].status, 'REACHED')
assert.equal(resolveReturnReceiptAssignment({ productionOrderId: assignmentV2.productionOrderId, factoryId: assignmentV2.factoryId, skuCodes: ['SKU-BLACK-M'], confirmedDate: '2026-08-08' }).resolution, 'MATCHED')
assert.equal(resolveReturnReceiptAssignment({ productionOrderId: assignmentV1.productionOrderId, factoryId: assignmentV1.factoryId, skuCodes: ['SKU-BLACK-M'], confirmedDate: '2026-08-08' }).resolution, 'MATCHED')

// 7. 合同在工厂确定后生成，只接受 JPG/PNG，打印仅表达责任和回货规则。
assert.equal(listMissingSignedContractScanTodos().map((item) => item.contractId).includes(contractV2.contractId), true)
assert.throws(() => addSignedContractScans(contractV2.contractId, [{
  fileName: '合同.pdf',
  mimeType: 'application/pdf' as never,
  size: 100,
  dataUrl: 'data:application/pdf;base64,AA==',
  uploadedAt: '2026-08-05 11:00:00',
  uploadedBy: 'PPIC-02',
}]), /只支持JPG或PNG图片/)
addSignedContractScans(contractV2.contractId, [
  { fileName: '合同第1页.jpg', mimeType: 'image/jpeg', size: 100, dataUrl: 'data:image/jpeg;base64,AA==', uploadedAt: '2026-08-05 11:01:00', uploadedBy: 'PPIC-02' },
  { fileName: '合同第2页.png', mimeType: 'image/png', size: 120, dataUrl: 'data:image/png;base64,AA==', uploadedAt: '2026-08-05 11:01:01', uploadedBy: 'PPIC-02' },
])
assert.equal(listProductionContracts({ assignmentId: assignmentV2.assignmentId })[0]?.scans.length, 2)
assert.equal(listMissingSignedContractScanTodos().some((item) => item.contractId === contractV2.contractId), false)
const printDocument = buildPrintDocument({ documentType: 'PRODUCTION_CONTRACT', sourceType: 'PRODUCTION_CONTRACT_RECORD', sourceId: contractV2.contractId })
assert.equal(printDocument.paperType, 'A4')
const printText = JSON.stringify(printDocument)
assert(printText.includes('自然日回货规则'))
assert(!printText.includes('frozenPrice') && !printText.includes('派单价') && !printText.includes('总加工费'))

// 8. 后道是阶段，实际工序只有三项；质检、复检只是回货流程节点。
assert.deepEqual(POST_STAGE_PROCESSES.map((item) => item.code), ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK'])
assert.deepEqual(POST_STAGE_FLOW_NODES.map((item) => item.code), ['ARRIVAL_CONFIRM', 'QC', 'RECHECK', 'HANDOVER'])
assert.equal(normalizeHistoricalPostProcessCode('IRONING'), 'IRON_PACK')
assert.equal(normalizeHistoricalPostProcessCode('PACKAGING'), 'IRON_PACK')
assert.equal(getProcessDefinitionByCode('POST_FINISHING'), undefined)
assert.equal(getProcessDefinitionByCode('QC'), undefined)
assert.equal(getProcessDefinitionByCode('RECHECK'), undefined)
assert(getProcessDefinitionByCode('BUTTONHOLE'))
assert(getProcessDefinitionByCode('BUTTON_ATTACH'))
assert(getProcessDefinitionByCode('IRON_PACK'))
assert.equal(processTypes.some((item) => ['PROC_QC', 'PROC_RECHECK', 'PROC_FINISHING'].includes(item.code)), false)
assert.deepEqual(buildPostStageExecutionSequence({
  postRouteId: 'CHECK-POST',
  productionOrderId: 'PO-CHECK',
  productionOrderNo: 'PO-CHECK',
  sewingTaskId: 'TASK-CHECK',
  sewingTaskNo: 'TASK-CHECK',
  postExecutionMode: 'MANAGED_POST_FACTORY_EXECUTES',
  sewingFactoryId: 'FAC-SEW',
  sewingFactoryName: '车缝厂',
  managedPostFactoryId: 'FAC-POST',
  managedPostFactoryName: '后道工厂',
  finishedWarehouseId: 'WH-FINISHED',
  finishedWarehouseName: '成衣仓',
  requiresReceivingQc: true,
  requiresPostExecution: true,
  requiresFinalRecheck: true,
  requiredPostProcessCodes: ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK'],
  currentNode: 'WAIT_RECEIVING_QC',
  createdAt: '2026-08-04 09:00:00',
  updatedAt: '2026-08-04 09:00:00',
}).map((item) => item.code), ['ARRIVAL_CONFIRM', 'QC', 'BUTTONHOLE', 'BUTTON_ATTACH', 'IRON_PACK', 'RECHECK', 'HANDOVER'])

const activeProcessCodes = new Set(listProcessDefinitions().filter((item) => item.isActive).map((item) => item.processCode))
for (const forbiddenCode of ['POST_FINISHING', 'QC', 'RECHECK', 'IRONING', 'PACKAGING']) assert.equal(activeProcessCodes.has(forbiddenCode), false)
const activeFactoryAbilities = listFactoryMasterRecords().flatMap((factory) => factory.processAbilities.filter((ability) => (ability.status ?? 'ACTIVE') !== 'DISABLED'))
for (const forbiddenCode of ['POST_FINISHING', 'QC', 'RECHECK', 'IRONING', 'PACKAGING']) {
  assert.equal(activeFactoryAbilities.some((ability) => ability.processCode === forbiddenCode), false, `工厂能力不得保留 ${forbiddenCode}`)
}

// 9. 统一分配、竞价、PDA、合同和线上进度页面都使用同一口径。
const workbenchSource = read('src/pages/unified-dispatch-workbench.ts')
const tenderSource = read('src/pages/dispatch-tenders.ts')
const pdaDetailSource = read('src/pages/pda-exec-detail.ts')
const progressSource = read('src/pages/production-order-progress-tracking.ts')
const contractPrintSource = read('src/pages/production-contract-print.ts')
const contractCenterSource = read('src/pages/production-contract-center.ts')
const taskBreakdownSource = read('src/pages/task-breakdown.ts')
const packageSource = read('package.json')

for (const requiredText of [
  '创建合并任务', '搜索生产单', '车缝+烫包', '裁剪+车缝+烫包',
  '请再次确认', '车缝的辅料配料情况以及库存情况', '普通裁片齐套', '裁床放行数量',
  '裁床确认目标数量', '菲票装袋', '信息不完善只提示风险，不阻断生产分配',
  '同一SKU不能拆数量', 'BAG_AWARE', 'FREE', '不生成拆袋重装待办',
  '谨慎确认价格，一经提交确认不得修改。', '生产合同已生成', '是否立即打印合同',
]) assert(workbenchSource.includes(requiredText), `统一分配页缺少：${requiredText}`)
assert(workbenchSource.includes("dialog.mode === 'BIDDING'"))
assert(tenderSource.includes('viewAwardSecondConfirm'))
assert(tenderSource.includes('谨慎确认价格，一经提交确认不得修改。'))
assert(tenderSource.includes('中标分配及合同已生成'))

const pdaMergedBranch = pdaDetailSource.slice(
  pdaDetailSource.indexOf('function renderPdaFixedMergedTaskPage'),
  pdaDetailSource.indexOf('export function renderPdaExecDetailPage'),
)
for (const requiredText of ['本厂责任范围', '开始生产', 'PDA 只负责接单、开始和交出']) assert(pdaMergedBranch.includes(requiredText))
assert(!pdaMergedBranch.includes('complete-fixed-merged-task'))
assert(!pdaMergedBranch.includes('执行里程碑'))

for (const requiredText of ['生产单进度跟踪', '回货履约', '违反回货规则', '截止前1天提醒', '截止当天提醒', '逾期后首日警告', '同一节点各类提醒只产生一次']) {
  assert(progressSource.includes(requiredText), `生产单进度页缺少：${requiredText}`)
}
assert(!progressSource.includes('超过1天已升级'))
assert(contractPrintSource.includes('分配日期为第 1 个自然日'))
assert(contractPrintSource.includes('合同仅打印日期，不打印具体时间'))
assert(contractPrintSource.includes('逾期后首日分别提醒'))
assert(contractPrintSource.includes('同一节点各类提醒仅产生一次'))
assert(!contractPrintSource.includes('升级警告'))
assert(!contractPrintSource.includes('派单价') && !contractPrintSource.includes('总加工费'))
assert(workbenchSource.includes('accept="image/jpeg,image/png"'))
assert(contractCenterSource.includes('待上传扫描图'))
assert(taskBreakdownSource.includes('listRuntimeProcessTasks') && taskBreakdownSource.includes('.filter(isAssignableProductionExecutionTask)'))

// 10. 清理旧连续工序、组合任务、产值计算模型及相关页面/检查命令。
const sourceText = listFilesRecursively('src')
  .filter((file) => /\.(ts|tsx|js|mjs|json)$/.test(file))
  .map((file) => read(file))
  .join('\n')
for (const forbiddenText of [
  'CONTINUOUS_PROCESS', 'COMBINED_PROCESS_TASK', 'areRouteEntriesContinuous',
  'routeParallelAcceptanceMode', 'MERGED_TASK_CUTTING_COMPLETION', 'cutCompletionPartRows',
  'outputValueCalcMode', 'referenceOutputValue', 'defaultDailyOutputValue',
  '默认日可供给产值', '产值计算', '连续型',
]) assert.equal(sourceText.includes(forbiddenText), false, `src 仍保留旧模型：${forbiddenText}`)
for (const deletedPath of [
  'src/pages/continuous-dispatch.ts', 'src/pages/dispatch-board.ts', 'src/pages/capacity.ts',
  'src/pages/factory-capacity-profile.ts', 'src/pages/sewing-dispatch-workbench.ts',
  'src/data/fcs/process-craft-output-value-explainer.ts', 'src/data/fcs/output-value-field-display.ts',
]) assert.equal(fs.existsSync(path.join(repoRoot, deletedPath)), false, `旧文件仍存在：${deletedPath}`)
for (const forbiddenCommand of [
  'check:continuous-process-route-eligibility', 'check:process-craft-output-value-rules',
  'check:factory-capacity-profile', 'check:capacity-calendar-ia', 'check:dispatch-board-assignment',
  'check:sewing-dispatch-workbench', 'check:sewing-delivery-sla',
]) assert.equal(packageSource.includes(forbiddenCommand), false, `package.json 仍保留旧命令：${forbiddenCommand}`)

for (const materialImage of [
  'public/materials/accessory-button.jpg',
  'public/materials/accessory-zipper.jpg',
  'public/materials/accessory-label.jpg',
]) assert(fs.statSync(path.join(repoRoot, materialImage)).size > 0, `真实物料图缺失：${materialImage}`)

console.log('统一任务分配、固定合并任务、合同、回货与数据清理专项检查通过')
