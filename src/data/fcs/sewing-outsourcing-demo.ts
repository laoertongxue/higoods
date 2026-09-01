import {
  createEffectiveTaskAssignment,
  getEffectiveTaskAssignment,
} from './effective-task-assignments.ts'
import { mockFactories } from './factory-mock-data.ts'
import { SEWING_OUTSOURCING_DEMO_CURRENT_PPIC } from './factory-onboarding-ppic.ts'
import { productionOrders } from './production-orders.ts'
import {
  getSewingSampleApprovalRecord,
  handoffPreProductionSampleToApprover,
  markPreProductionSampleFactoryCompleted,
  receivePreProductionSampleByPpic,
  startSampleApproval,
  submitSampleApprovalSuggestion,
} from './sewing-sample-approval-suggestion.ts'

export const SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS = {
  independent: 'ASG-PPIC-SAMPLE-DEMO-INDEPENDENT',
  sewingIronPack: 'ASG-PPIC-SAMPLE-DEMO-SEW-IRON',
  cuttingSewingIronPack: 'ASG-PPIC-SAMPLE-DEMO-CUT-SEW-IRON',
} as const

function getDemoSource() {
  const productionOrder = productionOrders.find((item) => (
    item.techPackSnapshot?.bomItems.some((bom) => bom.type === '面料' || bom.type === '辅料')
    && item.demandSnapshot.skuLines.length > 0
  ))
  if (!productionOrder) throw new Error('缺少批版建议演示生产单')
  const factory = mockFactories.find((item) => item.id === 'ID-F021')
  if (!factory) throw new Error('缺少批版建议演示三方车缝工厂')
  return { productionOrder, factory, sku: productionOrder.demandSnapshot.skuLines[0]! }
}

function ensureAssignment(input: {
  assignmentId: string
  runtimeTaskId: string
  taskNo: string
  processCodes: string[]
}) {
  const existing = getEffectiveTaskAssignment(input.assignmentId)
  if (existing) return existing
  const { productionOrder, factory, sku } = getDemoSource()
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

export function ensureSewingOutsourcingSampleDemo(): typeof SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS {
  const independent = ensureAssignment({
    assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.independent,
    runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-INDEPENDENT',
    taskNo: 'SEW-DEMO-001',
    processCodes: ['SEW'],
  })
  const sewingIronPack = ensureAssignment({
    assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.sewingIronPack,
    runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-SEW-IRON',
    taskNo: 'SEW-IRON-DEMO-001',
    processCodes: ['SEW', 'IRON_PACK'],
  })
  const cuttingSewingIronPack = ensureAssignment({
    assignmentId: SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.cuttingSewingIronPack,
    runtimeTaskId: 'TASK-PPIC-SAMPLE-DEMO-CUT-SEW-IRON',
    taskNo: 'CUT-SEW-IRON-DEMO-001',
    processCodes: ['CUTTING', 'SEW', 'IRON_PACK'],
  })
  const factoryActor = { actorId: independent.factoryId, actorName: '三方车缝工厂样衣员', role: 'FACTORY' as const }
  const ppicActor = { actorId: independent.ppicId!, actorName: independent.ppicName!, role: 'PPIC' as const }
  const approverActor = { actorId: 'SAMPLE-APPROVER-DEMO-001', actorName: '批版人员 林慧', role: 'SAMPLE_APPROVER' as const }

  markPreProductionSampleFactoryCompleted({
    commandId: 'CMD-DEMO-SAMPLE-FACTORY-INDEPENDENT',
    assignmentId: independent.assignmentId,
    actor: factoryActor,
    samplePhotoUrls: ['/shirt-sample.jpg'],
    completedAt: '2026-09-01 10:00:00',
  })

  markPreProductionSampleFactoryCompleted({
    commandId: 'CMD-DEMO-SAMPLE-FACTORY-SEW-IRON',
    assignmentId: sewingIronPack.assignmentId,
    actor: factoryActor,
    samplePhotoUrls: ['/jacket-sample.jpg'],
    completedAt: '2026-09-01 10:10:00',
  })
  receivePreProductionSampleByPpic({
    commandId: 'CMD-DEMO-SAMPLE-RECEIVE-SEW-IRON',
    assignmentId: sewingIronPack.assignmentId,
    actor: ppicActor,
    receivedSamplePhotoUrls: ['/jacket-sample.jpg'],
    receivedAt: '2026-09-01 11:00:00',
  })
  handoffPreProductionSampleToApprover({
    commandId: 'CMD-DEMO-SAMPLE-HANDOFF-SEW-IRON',
    assignmentId: sewingIronPack.assignmentId,
    actor: ppicActor,
    approverTeamName: '大货批版组',
    handedAt: '2026-09-01 11:10:00',
  })

  markPreProductionSampleFactoryCompleted({
    commandId: 'CMD-DEMO-SAMPLE-FACTORY-CUT-SEW-IRON',
    assignmentId: cuttingSewingIronPack.assignmentId,
    actor: factoryActor,
    samplePhotoUrls: ['/dress-sample-1.jpg'],
    completedAt: '2026-09-01 09:40:00',
  })
  receivePreProductionSampleByPpic({
    commandId: 'CMD-DEMO-SAMPLE-RECEIVE-CUT-SEW-IRON',
    assignmentId: cuttingSewingIronPack.assignmentId,
    actor: ppicActor,
    receivedSamplePhotoUrls: ['/dress-sample-1.jpg'],
    receivedAt: '2026-09-01 10:20:00',
  })
  handoffPreProductionSampleToApprover({
    commandId: 'CMD-DEMO-SAMPLE-HANDOFF-CUT-SEW-IRON',
    assignmentId: cuttingSewingIronPack.assignmentId,
    actor: ppicActor,
    approverTeamName: '大货批版组',
    handedAt: '2026-09-01 10:30:00',
  })
  startSampleApproval({
    commandId: 'CMD-DEMO-SAMPLE-START-CUT-SEW-IRON',
    assignmentId: cuttingSewingIronPack.assignmentId,
    actor: approverActor,
  })
  submitSampleApprovalSuggestion({
    commandId: 'CMD-DEMO-SAMPLE-SUGGESTION-CUT-SEW-IRON',
    assignmentId: cuttingSewingIronPack.assignmentId,
    actor: approverActor,
    conclusion: 'HAS_PROBLEM',
    structuredComments: {
      fabricApprovalComment: '面料裁片按色组编号顺序配套，不得混用色差批次。',
      processComment: '口袋位置按纸样上移1cm，侧缝顺直车缝。',
      materialUsageComment: '花边安装保持自然松量，不得强拉起皱。',
      otherComment: '后续大货按本次批版建议执行。',
    },
    approvalSheetPhotoUrls: [],
    uploadedAt: '2026-09-01 11:20:00',
  })

  if (!getSewingSampleApprovalRecord(independent.assignmentId)) throw new Error('批版建议演示初始化失败')
  return SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS
}
