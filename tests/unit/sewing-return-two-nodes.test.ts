import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyTaskFulfillmentPolicy } from '../../src/data/fcs/task-fulfillment-policy.ts'
import { createSewingDeliverySlaSnapshot, projectSewingDeliverySla, formatSewingDeliveryQueryWallClock, formatOperationLocalWallClock } from '../../src/data/fcs/sewing-delivery-sla.ts'
import { buildProductionReturnRulePreview, projectProductionReturnFulfillment } from '../../src/data/fcs/production-return-fulfillment.ts'
import { renderProductionContractMasterTemplate } from '../../src/pages/print/templates/production-contract-master-template.ts'
import type { ProductionContract } from '../../src/data/fcs/production-contracts.ts'

const taskKinds = [
  { task: { processCode: 'SEW', processNameZh: '车缝', taskUnitType: 'PROCESS_TASK' }, kind: 'INDEPENDENT_SEWING', days: [4, 9] },
  { task: { processCode: 'MERGED', processNameZh: '车缝＋烫包', taskUnitType: 'MERGED_PRODUCTION_TASK', mergedTaskType: 'SEWING_IRON_PACK' }, kind: 'SEWING_TO_IRON_PACK', days: [5, 10] },
  { task: { processCode: 'MERGED', processNameZh: '裁剪＋车缝＋烫包', taskUnitType: 'MERGED_PRODUCTION_TASK', mergedTaskType: 'CUTTING_SEWING_IRON_PACK' }, kind: 'CUTTING_TO_IRON_PACK', days: [6, 12] },
] as const
for (const row of taskKinds) test(`${row.kind}: two cumulative nodes use 35%/100%, assignment day one and upward rounding`, () => {
  const policy = classifyTaskFulfillmentPolicy(row.task)
  const preview = buildProductionReturnRulePreview({ assignedQty: 101, businessAssignedAt: '2026-10-01 09:00:00', policy })!
  assert.deepEqual(preview.milestones.map(node => [node.ratio, node.naturalDay, node.targetQty]), [[0.35, row.days[0], 36], [1, row.days[1], 101]])
  const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: row.kind, runtimeTaskId: row.kind, productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 101, businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-03 09:00:00', slaKind: row.kind })
  assert.deepEqual(snapshot.milestones.map(node => [node.ratio, node.targetQty, node.deadlineAt]), preview.milestones.map(node => [node.ratio, node.targetQty, node.deadlineAt]))
})

test('legacy active SLA is monitored by two nodes without mutating its stored three-node facts', () => {
  const source = createSewingDeliverySlaSnapshot({ assignmentId: 'old', runtimeTaskId: 'old', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 100, businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-01 09:00:00', slaKind: 'INDEPENDENT_SEWING' })
  const legacy = { ...source, ruleVersion: 'PPIC-20261008-NATURAL-DAYS', milestones: [
    { ratio: 0.3 as const, hoursAfterAcceptance: 96, targetQty: 30, deadlineAt: '2026-10-04 23:59:59' },
    { ratio: 0.7 as const, hoursAfterAcceptance: 192, targetQty: 70, deadlineAt: '2026-10-08 23:59:59' },
    { ratio: 1 as const, hoursAfterAcceptance: 216, targetQty: 100, deadlineAt: '2026-10-09 23:59:59' },
  ] }
  const before = JSON.stringify(legacy)
  assert.deepEqual(projectSewingDeliverySla(legacy, [], '2026-10-05 09:00:00').milestones.map(node => node.ratio), [0.35, 1])
  assert.equal(JSON.stringify(legacy), before)
  assert.deepEqual(projectSewingDeliverySla({ ...legacy, active: false }, [], '2026-10-05 09:00:00').milestones.map(node => node.ratio), [0.3, 0.7, 1])
})

test('legacy active production return projection also uses two current nodes and retains the original snapshot', () => {
  const source = { snapshotId: 'old', assignmentId: 'A', runtimeTaskId: 'T', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 100, assignmentDate: '2026-10-01', fulfillmentRuleCode: 'SEWING_ONLY' as const, active: true, ruleVersion: 'PPIC-20261008-NATURAL-DAYS', milestones: [
    { ratio: 0.3 as const, naturalDay: 4, targetQty: 30, deadlineDate: '2026-10-04', deadlineAt: '2026-10-04 23:59:59' },
    { ratio: 0.7 as const, naturalDay: 8, targetQty: 70, deadlineDate: '2026-10-08', deadlineAt: '2026-10-08 23:59:59' },
    { ratio: 1 as const, naturalDay: 9, targetQty: 100, deadlineDate: '2026-10-09', deadlineAt: '2026-10-09 23:59:59' },
  ] }
  const before = JSON.stringify(source)
  const projection = projectProductionReturnFulfillment({ snapshot: source, receipts: [], today: '2026-10-05' })
  assert.deepEqual(projection.milestones.map(node => [node.ratio, node.targetQty]), [[0.35, 35], [1, 100]])
  assert.equal(JSON.stringify(source), before)
})

test('new contract replaces both printed three-node tables while historical original remains unchanged', () => {
  const policy = classifyTaskFulfillmentPolicy(taskKinds[0].task)
  const preview = buildProductionReturnRulePreview({ assignedQty: 100, businessAssignedAt: '2026-10-01 09:00:00', policy })!
  const contract = { contractNo: 'SC-TEST', version: 1, factoryName: '测试工厂', assignedQty: 100, assignmentDate: '2026-10-01', generatedAt: '2026-10-01 09:00:00', generatedBy: '生产计划员', returnRuleSnapshot: { ...preview }, templateSnapshot: { taskDetails: [], ppicName: 'PPIC', factoryPicName: 'PIC', pickupDate: 'Belum diambil', taskTypeId: 'NON-GABUNGAN', processTypeId: 'JAHIT', dayCalculationId: 'KALENDER', returnQuantityBasis: 'ASSIGNMENT_ESTIMATE' } } as unknown as ProductionContract
  const html = renderProductionContractMasterTemplate(contract)
  assert.match(html, /data-contract-return-table="two-nodes"/)
  assert.match(html, /data-contract-rule-table="two-nodes"/)
  assert.match(html, /35%/)
  assert.match(html, /100%/)
  assert.match(html, /预估/)
  assert.doesNotMatch(html, /data-contract-field="HARI_3"/)
  const legacy = structuredClone(contract)
  legacy.returnRuleSnapshot.milestones = [{ ratio: 0.3, naturalDay: 4, targetQty: 30, deadlineDate: '2026-10-04', deadlineAt: '2026-10-04 23:59:59' }, { ratio: 0.7, naturalDay: 8, targetQty: 70, deadlineDate: '2026-10-08', deadlineAt: '2026-10-08 23:59:59' }, { ratio: 1, naturalDay: 9, targetQty: 100, deadlineDate: '2026-10-09', deadlineAt: '2026-10-09 23:59:59' }]
  const old = renderProductionContractMasterTemplate(legacy)
  assert.doesNotMatch(old, /data-contract-return-table="two-nodes"/)
  assert.match(old, /data-contract-field="HARI_3"/)
})

test('formal return basis sets targets and completion without overwriting the assigned quantity', () => {
  const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'formal', runtimeTaskId: 'formal', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 500, expectedReturnQty: 200, quantityStatus: 'READY', returnQuantityBasisVersionId: 'BASIS-1', businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-01 09:00:00', slaKind: 'INDEPENDENT_SEWING' })
  const receipts = [{ recordId: 'r', submittedQty: 200, receivedQty: 200, submittedAt: '2026-10-02 08:00:00', receivedAt: '2026-10-02 09:00:00' }]
  const projection = projectSewingDeliverySla(snapshot, receipts, '2026-10-03 09:00:00')
  assert.equal(projection.snapshot.assignedQty, 500)
  assert.deepEqual(projection.milestones.map(node => node.targetQty), [70, 200])
  assert.equal(projection.completed, true)
  assert.equal(projection.remainingQty, 0)
  assert.equal(projection.progressRatio, 1)
  const policy = classifyTaskFulfillmentPolicy(taskKinds[0].task)
  const preview = buildProductionReturnRulePreview({ assignedQty: 500, expectedReturnQty: 200, quantityStatus: 'READY', businessAssignedAt: '2026-10-01 09:00:00', policy })!
  const formal = projectProductionReturnFulfillment({ snapshot: { ...preview, snapshotId: 'P', assignmentId: 'formal', runtimeTaskId: 'formal', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', active: true }, receipts: [], today: '2026-10-10', usesCutPieceResponsibility: true, responsibilityVersions: [{ responsibilityVersionId: 'OLD-KIT-50', assignmentId: 'formal', totalResponsibilityQty: 50, createdAt: '2026-10-01 09:00:00' }] })
  assert.deepEqual(formal.milestones.map(node => [node.targetQty, node.attributableTargetQty, node.cuttingShortfallQty]), [[70, 70, 0], [200, 200, 0]])
  assert.equal(formal.remainingQty, 200)
})

test('unresolved expected quantity cannot produce targets, a percentage or a completed task', () => {
  const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'pending', runtimeTaskId: 'pending', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 100, expectedReturnQty: null, quantityStatus: 'WAIT_HANDOVER', businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-01 09:00:00', slaKind: 'INDEPENDENT_SEWING' })
  const projection = projectSewingDeliverySla(snapshot, [{ recordId: 'r', submittedQty: 100, receivedQty: 100, submittedAt: '2026-10-02 08:00:00', receivedAt: '2026-10-02 09:00:00' }], '2026-10-10 09:00:00')
  assert.deepEqual(projection.milestones, [])
  assert.equal(projection.completed, false)
  assert.equal(projection.progressRatio, null)
  assert.equal(projection.remainingQty, null)
  const policy = classifyTaskFulfillmentPolicy(taskKinds[0].task)
  const preview = buildProductionReturnRulePreview({ assignedQty: 100, expectedReturnQty: null, quantityStatus: 'AMBIGUOUS', businessAssignedAt: '2026-10-01 09:00:00', policy })!
  const formal = projectProductionReturnFulfillment({ snapshot: { ...preview, snapshotId: 'P', assignmentId: 'pending', runtimeTaskId: 'pending', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', active: true }, receipts: [], today: '2026-10-10' })
  assert.deepEqual(formal.milestones, [])
  assert.equal(formal.remainingQty, null)
  assert.equal(formal.highestRiskStatus, 'UPCOMING')
  const missingStart = projectProductionReturnFulfillment({ snapshot: { ...preview, expectedReturnQty: 100, quantityStatus: 'READY', assignmentDate: '', snapshotId: 'P', assignmentId: 'pending', runtimeTaskId: 'pending', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', active: true }, receipts: [], today: '2026-10-10' })
  assert.deepEqual(missingStart.milestones, [])
  assert.equal(missingStart.highestRiskStatus, 'UPCOMING')
})

test('formal late entry counts the actual on-time receipt without altering either business time', () => {
  const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'late-entry', runtimeTaskId: 'late-entry', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 100, expectedReturnQty: 100, quantityStatus: 'READY', businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-01 09:00:00', slaKind: 'INDEPENDENT_SEWING' })
  const fact = { recordId: 'r-late-entry', submittedQty: 100, receivedQty: 100, submittedAt: '2026-10-05 08:00:00', receivedAt: '2026-10-04 16:00:00' }
  assert.equal(projectSewingDeliverySla(snapshot, [fact], '2026-10-06 09:00:00').confirmedReceivedQty, 0)
  const projection = projectSewingDeliverySla(snapshot, [{ ...fact, isLateEntry: true }], '2026-10-06 09:00:00')
  assert.equal(projection.confirmedReceivedQty, 100)
  assert.equal(projection.milestones[0]?.result, 'ON_TIME')
  assert.equal(projection.milestones[0]?.firstReachedAt, fact.receivedAt)
  assert.equal(fact.submittedAt, '2026-10-05 08:00:00')
  assert.equal(fact.receivedAt, '2026-10-04 16:00:00')
})

test('R34/R44: a receipt after a node deadline by milliseconds cannot become on-time through truncation', () => {
  const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'millisecond-boundary', runtimeTaskId: 'millisecond-boundary', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 100, expectedReturnQty: 100, quantityStatus: 'READY', businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-01 09:00:00', slaKind: 'INDEPENDENT_SEWING' })
  const boundary = '2026-10-04 23:59:59'
  const fact = { recordId: 'r-subsecond', submittedQty: 100, receivedQty: 100, submittedAt: boundary, receivedAt: boundary }
  assert.equal(projectSewingDeliverySla(snapshot, [fact], '2026-10-06 09:00:00').milestones[0]!.result, 'ON_TIME')
  assert.equal(projectSewingDeliverySla(snapshot, [{ ...fact, receivedAt: boundary + '.000' }], '2026-10-06 09:00:00').milestones[0]!.result, 'ON_TIME')
  const late = projectSewingDeliverySla(snapshot, [{ ...fact, receivedAt: boundary + '.500' }], '2026-10-06 09:00:00')
  assert.notEqual(late.milestones[0]!.result, 'ON_TIME')
  assert.equal(late.milestones[0]!.firstReachedAt, boundary + '.500')
  assert.equal(late.confirmedReceivedQty, 100)
  const immediately = formatSewingDeliveryQueryWallClock(new Date('2026-10-04T16:59:59.500Z'))
  assert.equal(immediately, boundary + '.500')
  assert.equal(formatOperationLocalWallClock(new Date('2026-10-04T16:59:59.500Z')), boundary)
  assert.equal(projectSewingDeliverySla(snapshot, [{ ...fact, receivedAt: immediately }], immediately).confirmedReceivedQty, 100)
})

test('node quantity bases freeze the first target while later delivery changes the current expected total', () => {
  const milestoneQuantityBases = { 0.35: { expectedReturnQty: 200, basisVersionId: 'BASIS-AT-D4' }, 1: { expectedReturnQty: 500, basisVersionId: 'BASIS-AT-D9' } }
  const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'basis-cutoff', runtimeTaskId: 'basis-cutoff', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 500, expectedReturnQty: 500, quantityStatus: 'READY', businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-01 09:00:00', slaKind: 'INDEPENDENT_SEWING' })
  const projected = projectSewingDeliverySla({ ...snapshot, milestoneQuantityBases }, [], '2026-10-10 09:00:00')
  assert.deepEqual(projected.milestones.map(node => [node.ratio, node.targetQty, node.returnQuantityBasisVersionId]), [[0.35, 70, 'BASIS-AT-D4'], [1, 500, 'BASIS-AT-D9']])
  assert.equal(projected.remainingQty, 500)
  const withBases = createSewingDeliverySlaSnapshot({ assignmentId: 'basis-create', runtimeTaskId: 'basis-create', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 500, expectedReturnQty: 500, quantityStatus: 'READY', milestoneQuantityBases, businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-01 09:00:00', slaKind: 'INDEPENDENT_SEWING' })
  assert.deepEqual(withBases.milestones.map(node => node.targetQty), [70, 500])
  const policy = classifyTaskFulfillmentPolicy(taskKinds[0].task), preview = buildProductionReturnRulePreview({ assignedQty: 500, expectedReturnQty: 500, quantityStatus: 'READY', businessAssignedAt: '2026-10-01 09:00:00', policy })!
  const formal = projectProductionReturnFulfillment({ snapshot: { ...preview, milestoneQuantityBases, snapshotId: 'P', assignmentId: 'basis-cutoff', runtimeTaskId: 'basis-cutoff', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', active: true }, receipts: [], today: '2026-10-10' })
  assert.deepEqual(formal.milestones.map(node => [node.ratio, node.targetQty, node.responsibilityQtyAtCutoff, node.responsibilityVersionId]), [[0.35, 70, 200, 'BASIS-AT-D4'], [1, 500, 500, 'BASIS-AT-D9']])
})

test('an unknown historical node basis remains visible as pending and cannot complete despite current full receipt', () => {
  const milestoneQuantityBases = { 0.35: { expectedReturnQty: null, basisVersionId: 'UNRESOLVED-D4' }, 1: { expectedReturnQty: 500, basisVersionId: 'BASIS-AT-D9' } }
  const snapshot = createSewingDeliverySlaSnapshot({ assignmentId: 'unknown-cutoff', runtimeTaskId: 'unknown-cutoff', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', assignedQty: 500, expectedReturnQty: 500, quantityStatus: 'READY', businessAssignedAt: '2026-10-01 09:00:00', acceptedAt: '2026-10-01 09:00:00', slaKind: 'INDEPENDENT_SEWING' })
  const projected = projectSewingDeliverySla({ ...snapshot, milestoneQuantityBases }, [{ recordId: 'full', submittedQty: 500, receivedQty: 500, submittedAt: '2026-10-08 08:00:00', receivedAt: '2026-10-08 09:00:00' }], '2026-10-10 09:00:00')
  assert.equal(projected.quantityBasisPending, true)
  assert.equal(projected.completed, false)
  assert.equal(projected.remainingQty, 0)
  assert.deepEqual(projected.milestones.map(node => node.ratio), [1])
  assert.deepEqual(projected.missingMilestones, [{ ratio: 0.35, deadlineAt: '2026-10-04 23:59:59' }])
  const policy = classifyTaskFulfillmentPolicy(taskKinds[0].task), preview = buildProductionReturnRulePreview({ assignedQty: 500, expectedReturnQty: 500, quantityStatus: 'READY', businessAssignedAt: '2026-10-01 09:00:00', policy })!
  const formal = projectProductionReturnFulfillment({ snapshot: { ...preview, milestoneQuantityBases, snapshotId: 'P', assignmentId: 'unknown-cutoff', runtimeTaskId: 'unknown-cutoff', productionOrderId: 'PO', factoryId: 'F', factoryName: '工厂', active: true }, receipts: [{ receiptId: 'full', assignmentId: 'unknown-cutoff', factoryId: 'F', confirmedQty: 500, confirmedDate: '2026-10-08', confirmed: true }], today: '2026-10-10' })
  assert.equal(formal.quantityBasisPending, true)
  assert.equal(formal.completed, false)
  assert.equal(formal.highestRiskStatus, 'UPCOMING')
  assert.deepEqual(formal.missingMilestones, [{ ratio: 0.35, deadlineDate: '2026-10-04', deadlineAt: '2026-10-04 23:59:59' }])
  assert.deepEqual(formal.milestones.map(node => node.ratio), [1])
  assert.equal(formal.remainingQty, 0)
  const historical = projectSewingDeliverySla({ ...snapshot, active: false, milestoneQuantityBases }, [], '2026-10-10 09:00:00')
  assert.deepEqual(historical.milestones.map(node => node.targetQty), [175, 500])
  assert.equal(historical.quantityBasisPending, false)
})
