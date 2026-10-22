import { buildInspectionSnapshotFromConfigurations } from './quality-management-records.ts'
import {buildEffectiveAssignmentStaticFixture} from './effective-task-assignments.ts'
import { hasSewingSampleStaticDefaults, registerSewingSampleStaticDefaults } from './sewing-sample-approval-suggestion.ts'
import {
  createEffectiveTaskAssignment,
  getEffectiveTaskAssignment,
} from './effective-task-assignments.ts'
import { mockFactories } from './factory-mock-data.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from './factory-onboarding-ppic.ts'
import { getFactoryActivePpicSnapshot } from './factory-master-store.ts'
import { productionOrders } from './production-orders.ts'
import {
  createSewingSampleApprovalRecord,
  initializeSewingSampleApprovalSuggestionForAssignment,
  type SewingSampleApprovalRecord,
} from './sewing-sample-approval-suggestion.ts'

export const SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS = {
  independent: 'ASG-PPIC-SAMPLE-DEMO-INDEPENDENT',
  sewingIronPack: 'ASG-PPIC-SAMPLE-DEMO-SEW-IRON',
  cuttingSewingIronPack: 'ASG-PPIC-SAMPLE-DEMO-CUT-SEW-IRON',
} as const

export const SEWING_SAMPLE_STATIC_VERSION = 'quality-20261022-v1'
const sampleDemoApprover = { actorId: 'SAMPLE-APPROVER-DEMO-001', actorName: '批版人员 林慧', role: 'SAMPLE_APPROVER' as const }
const sampleDemoComments = {
  fabricApprovalComment: '面料裁片按色组编号顺序配套，不得混用色差批次。',
  processComment: '口袋位置按纸样上移1cm，侧缝顺直车缝。',
  materialUsageComment: '花边安装保持自然松量，不得强拉起皱。',
  otherComment: '后续大货按本次批版建议执行。',
}
let readOnlySampleDefaults: SewingSampleApprovalRecord[] | undefined

function getDemoSource(index = 0) {
  const productionOrder = productionOrders.filter((item) => (
    item.techPackSnapshot?.bomItems.some((bom) => bom.type === '面料' || bom.type === '辅料')
    && item.demandSnapshot.skuLines.length > 0
  ))[index]
  if (!productionOrder) throw new Error('缺少批版建议演示生产单')
  const factory = mockFactories.find((item) => item.id === 'ID-F021')
  if (!factory) throw new Error('缺少批版建议演示三方车缝工厂')
  return { productionOrder, factory, sku: productionOrder.demandSnapshot.skuLines[0]! }
}

/** The same three static samples, constructed without loading/capturing/restoring live assignments or sample records. */
export function getDefaultSewingSampleApprovalRecords(): SewingSampleApprovalRecord[] {
  if (!readOnlySampleDefaults) {
    const specs = [
      { assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.independent, runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-INDEPENDENT', taskNo: 'SEW-DEMO-001', processCodes: ['SEW'] },
      { assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.sewingIronPack, runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-SEW-IRON', taskNo: 'SEW-IRON-DEMO-001', processCodes: ['SEW', 'IRON_PACK'] },
      { assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.cuttingSewingIronPack, runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-CUT-SEW-IRON', taskNo: 'CUT-SEW-IRON-DEMO-001', processCodes: ['CUTTING', 'SEW', 'IRON_PACK'] },
    ]
    const defaults = specs.map((spec, index) => {
      const { productionOrder, factory } = getDemoSource(index)
      const ppic = getFactoryActivePpicSnapshot(factory.id)
      if (!ppic) throw new Error('缺少批版建议演示工厂的有效PPIC')
      return createSewingSampleApprovalRecord({ ...spec, productionOrderId: productionOrder.productionOrderId,
        productionOrderNo: productionOrder.productionOrderNo, factoryId: factory.id, factoryName: factory.name,
        ppicId: ppic.ppicId, ppicName: ppic.ppicName, operatedAt: '2026-09-01 09:00:00' }, {
        snapshot: productionOrder.techPackSnapshot, styleCode: productionOrder.demandSnapshot.spuCode,
        styleName: productionOrder.demandSnapshot.spuName,
      })!
    })
    for (const [index, photo, receivedAt, handedAt] of [
      [1, '/jacket-sample.jpg', '2026-09-01 11:00:00', '2026-09-01 11:10:00'],
      [2, '/dress-sample-1.jpg', '2026-09-01 10:20:00', '2026-09-01 10:30:00'],
    ] as const) {
      const sample = defaults[index].sample
      Object.assign(sample, { status: 'HANDED_TO_APPROVER', ppicReceivedSamplePhotoUrls: [photo], ppicReceivedAt: receivedAt,
        ppicReceivedBy: sample.currentPpicName, handedToApproverAt: handedAt, handedToApproverBy: sample.currentPpicName,
        approverTeamName: '大货批版组' })
    }
    const record = defaults[2], sample = record.sample
    const standard = buildInspectionSnapshotFromConfigurations({ sourceKind: 'PRE_PRODUCTION_SAMPLE', styleCode: sample.styleCode })
    standard.id = `STATIC-SAMPLE-STANDARD:${SEWING_SAMPLE_STATIC_VERSION}`
    standard.selectedAt = '2026-09-01T03:40:00.000Z'
    record.inspectionStandardSnapshot = standard
    record.currentApproverId = sampleDemoApprover.actorId
    record.currentApproverName = sampleDemoApprover.actorName
    Object.assign(sample, { status: 'SUGGESTION_UPLOADED', approverReceivedAt: '2026-09-01 10:40:00',
      approverReceivedBy: sampleDemoApprover.actorName, approverReceivedInstant: '2026-09-01T03:40:00.000Z' })
    record.suggestionVersions = [{ suggestionVersionId: 'SAS-000001', suggestionNo: `BPJY-${sample.taskNo}`,
      assignmentId: record.assignmentId, runtimeTaskId: sample.runtimeTaskId, sampleId: sample.sampleId,
      conclusion: 'HAS_PROBLEM', structuredComments: { ...sampleDemoComments }, approvalSheetPhotoUrls: [],
      referenceSnapshots: structuredClone(record.referenceSnapshots),
      issues: [{ itemId: standard.items[0].id, note: '按尺寸表核对口袋位置及侧缝。' }],
      uploadedAt: '2026-09-01 11:20:00', uploadedInstant: '2026-09-01T04:20:00.000Z',
      uploadedById: sampleDemoApprover.actorId, uploadedByName: sampleDemoApprover.actorName }]
    record.latestSuggestionVersionId = record.suggestionVersions[0].suggestionVersionId
    readOnlySampleDefaults = defaults
  }
  return structuredClone(readOnlySampleDefaults)
}

function ensureAssignment(input: {
  assignmentId: string
  runtimeTaskId: string
  taskNo: string
  processCodes: string[]
}) {
  const existing = getEffectiveTaskAssignment(input.assignmentId)
  if (existing) {
    // Default registration preserves any saved sample before checking its assignment.
    initializeSewingSampleApprovalSuggestionForAssignment(existing)
    return existing
  }
  const { productionOrder, factory, sku } = getDemoSource(input.processCodes.includes('CUTTING') ? 2 : input.processCodes.includes('IRON_PACK') ? 1 : 0)
  return createEffectiveTaskAssignment({
    assignmentId: input.assignmentId,
    runtimeTaskId: input.runtimeTaskId,
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo: productionOrder.productionOrderNo,
    taskNo: input.taskNo,
    factoryId: factory.id,
    factoryName: factory.name,
    source: 'DIRECT_DISPATCH',
    assignedQty: 1000,
    skuLines: [{ skuCode: sku.skuCode, color: sku.color, size: sku.size, qty: 1000 }],
    processCodes: input.processCodes,
    frozenPrice: 1500,
    priceCurrency: 'IDR',
    priceUnit: '件',
    businessAssignedAt: '2026-09-01 09:00:00',
    operatedAt: '2026-09-01 09:00:00',
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
}

export function ensureSewingOutsourcingSampleDemo():typeof SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS {
  if (hasSewingSampleStaticDefaults(SEWING_SAMPLE_STATIC_VERSION)) return SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS
  return registerSewingSampleStaticDefaults(SEWING_SAMPLE_STATIC_VERSION, getDefaultSewingSampleApprovalRecords(), () => (
    buildEffectiveAssignmentStaticFixture(() => {
      ensureAssignment({ assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.independent,
        runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-INDEPENDENT', taskNo: 'SEW-DEMO-001', processCodes: ['SEW'] })
      ensureAssignment({ assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.sewingIronPack,
        runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-SEW-IRON', taskNo: 'SEW-IRON-DEMO-001', processCodes: ['SEW', 'IRON_PACK'] })
      ensureAssignment({ assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.cuttingSewingIronPack,
        runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-CUT-SEW-IRON', taskNo: 'CUT-SEW-IRON-DEMO-001', processCodes: ['CUTTING', 'SEW', 'IRON_PACK'] })
      return SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS
    })
  ))
}
