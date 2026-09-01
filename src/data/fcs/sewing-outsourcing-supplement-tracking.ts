import { listEffectiveTaskAssignments } from './effective-task-assignments.ts'
import { getCurrentSewingTaskResponsibility } from './sewing-outsourcing-responsibility.ts'
import {
  ensureSewingCutPieceResponsibilityDemo,
  ensureSewingCutPieceResponsibilityOverviewDemos,
  getSewingCutPieceResponsibilityProjection,
  listSewingCutPieceHandoverEvents,
  SEWING_CUT_PIECE_WAIT_HANDOVER_DEMO_ASSIGNMENT_ID,
  type SewingCutPieceProjectionLine,
} from './sewing-cut-piece-responsibility.ts'
import { getSewingSampleApprovalRecord } from './sewing-sample-approval-suggestion.ts'
import {
  completeSupplementOrder,
  getSupplementOrder,
  listSupplementOrders,
  registerSupplementOrder,
  type SupplementOrderLifecycle,
} from './cutting/supplement-order-registry.ts'

export type SewingSupplementAvailability =
  | 'NO_SUPPLEMENT_ORDER'
  | 'CUTTING_PROCESSING'
  | 'WAITING_CUTTING_HANDOVER'
  | 'READY_FOR_FACTORY'

export interface SewingSupplementFollowUpLog {
  logId: string
  commandId: string
  assignmentId: string
  runtimeTaskId: string
  followedAt: string
  followedByPpicId: string
  followedByPpicName: string
  result: string
  nextAction: string
  promisedAt: string
}

export interface SewingSupplementTrackingRow {
  assignmentId: string
  runtimeTaskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  factoryId: string
  factoryName: string
  ppicId: string
  ppicName: string
  taskKind: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  hasConfirmedHandover: boolean
  totalRequiredPieceQty: number
  totalHandedOverPieceQty: number
  missingLines: SewingCutPieceProjectionLine[]
  totalDebtPieceQty: number
  structuralMissingLineCount: number
  halfOrMoreMissingLineCount: number
  excludedMissingLineCount: number
  maximumMissingRatio: number
  supplementOrders: SupplementOrderLifecycle[]
  availability: SewingSupplementAvailability
  canHandToFactory: boolean
  followUpLogs: SewingSupplementFollowUpLog[]
}

const followUpLogs = new Map<string, SewingSupplementFollowUpLog>()
const commandResults = new Map<string, string>()
let followUpSequence = 0

function clone<T>(value: T): T {
  return structuredClone(value)
}

function currentPpic(runtimeTaskId: string, fallback: { ppicId: string; ppicName: string }) {
  const responsibility = getCurrentSewingTaskResponsibility(runtimeTaskId)
  return responsibility
    ? { ppicId: responsibility.ppicId, ppicName: responsibility.ppicName }
    : fallback
}

function orderMatchesMissingLine(order: SupplementOrderLifecycle, line: SewingCutPieceProjectionLine): boolean {
  const tokens = [line.partCode, line.partName].map((item) => item.trim().toLowerCase()).filter(Boolean)
  const haystack = [
    order.reason,
    order.reasonDetail,
    order.lineSummary,
    ...order.materialDemands.flatMap((item) => [item.patternPart || '', item.patternName || '']),
  ].join(' ').toLowerCase()
  return tokens.some((token) => haystack.includes(token))
}

function resolveAvailability(
  debtPieceQty: number,
  orders: SupplementOrderLifecycle[],
): SewingSupplementAvailability {
  if (debtPieceQty <= 0) return 'READY_FOR_FACTORY'
  if (!orders.length) return 'NO_SUPPLEMENT_ORDER'
  if (orders.some((item) => item.status === '未完成')) return 'CUTTING_PROCESSING'
  return 'WAITING_CUTTING_HANDOVER'
}

export function recordSewingSupplementFollowUp(input: {
  commandId: string
  assignmentId: string
  ppicId: string
  result: string
  nextAction: string
  promisedAt?: string
  followedAt: string
}): SewingSupplementFollowUpLog {
  const replayId = commandResults.get(input.commandId)
  if (replayId) return clone(followUpLogs.get(replayId)!)
  const projection = getSewingCutPieceResponsibilityProjection(input.assignmentId)
  const owner = currentPpic(projection.context.runtimeTaskId, {
    ppicId: projection.context.ppicId,
    ppicName: projection.context.ppicName,
  })
  if (owner.ppicId !== input.ppicId) throw new Error('只有当前任务PPIC可以登记补料协同跟进。')
  const result = input.result.trim()
  const nextAction = input.nextAction.trim()
  if (!result || !nextAction) throw new Error('请填写本次跟进结果和下一步动作。')
  followUpSequence += 1
  const log: SewingSupplementFollowUpLog = {
    logId: `SUP-FOLLOW-${String(followUpSequence).padStart(5, '0')}`,
    commandId: input.commandId,
    assignmentId: input.assignmentId,
    runtimeTaskId: projection.context.runtimeTaskId,
    followedAt: input.followedAt,
    followedByPpicId: owner.ppicId,
    followedByPpicName: owner.ppicName,
    result,
    nextAction,
    promisedAt: input.promisedAt?.trim() || '',
  }
  followUpLogs.set(log.logId, log)
  commandResults.set(input.commandId, log.logId)
  return clone(log)
}

export function listSewingSupplementFollowUps(assignmentId: string): SewingSupplementFollowUpLog[] {
  return [...followUpLogs.values()]
    .filter((item) => item.assignmentId === assignmentId)
    .sort((left, right) => right.followedAt.localeCompare(left.followedAt) || right.logId.localeCompare(left.logId))
    .map(clone)
}

export function listSewingSupplementTrackingRows(): SewingSupplementTrackingRow[] {
  const orders = listSupplementOrders()
  const rows: SewingSupplementTrackingRow[] = []
  listEffectiveTaskAssignments()
    .filter((assignment) => assignment.status === 'EFFECTIVE')
    .forEach((assignment) => {
      let projection
      try {
        projection = getSewingCutPieceResponsibilityProjection(assignment.assignmentId)
      } catch {
        return
      }
      const missingLines = projection.lines.filter((line) => line.debtPieceQty > 0)
      const halfOrMoreMissingLineCount = missingLines.filter((line) => line.shortageShape === 'AT_LEAST_HALF_MISSING').length
      const excludedMissingLineCount = missingLines.filter((line) => line.excludedFromEffectiveKit).length
      const maximumMissingRatio = missingLines.reduce((maximum, line) => (
        Math.max(maximum, line.requiredPieceQty > 0 ? line.debtPieceQty / line.requiredPieceQty : 0)
      ), 0)
      const relatedOrders = orders.filter((order) => (
        (order.productionOrderId && order.productionOrderId === assignment.productionOrderId)
        || (order.productionOrderNo && order.productionOrderNo === assignment.productionOrderNo)
      ) && (!missingLines.length || missingLines.some((line) => orderMatchesMissingLine(order, line))))
      const owner = currentPpic(assignment.runtimeTaskId, {
        ppicId: projection.context.ppicId,
        ppicName: projection.context.ppicName,
      })
      const sample = getSewingSampleApprovalRecord(assignment.assignmentId)
      const hasConfirmedHandover = listSewingCutPieceHandoverEvents(assignment.assignmentId).length > 0
      const availability = hasConfirmedHandover
        ? resolveAvailability(projection.totalDebtPieceQty, relatedOrders)
        : 'NO_SUPPLEMENT_ORDER'
      rows.push({
        assignmentId: assignment.assignmentId,
        runtimeTaskId: assignment.runtimeTaskId,
        taskNo: assignment.taskNo || assignment.runtimeTaskId,
        productionOrderId: assignment.productionOrderId,
        productionOrderNo: assignment.productionOrderNo || assignment.productionOrderId,
        factoryId: assignment.factoryId,
        factoryName: assignment.factoryName,
        ppicId: owner.ppicId,
        ppicName: owner.ppicName,
        taskKind: sample?.sample.taskKind || 'INDEPENDENT_SEWING',
        styleCode: sample?.sample.styleCode || assignment.productionOrderNo || assignment.productionOrderId,
        styleName: sample?.sample.styleName || '车缝外发款式',
        styleImageUrl: sample?.sample.styleImageUrl || '/tshirt-sample.jpg',
        hasConfirmedHandover,
        totalRequiredPieceQty: projection.totalRequiredPieceQty,
        totalHandedOverPieceQty: projection.totalHandedOverPieceQty,
        missingLines: clone(missingLines),
        totalDebtPieceQty: projection.totalDebtPieceQty,
        structuralMissingLineCount: projection.structuralMissingLineCount,
        halfOrMoreMissingLineCount,
        excludedMissingLineCount,
        maximumMissingRatio,
        supplementOrders: clone(relatedOrders),
        availability,
        canHandToFactory: hasConfirmedHandover && availability === 'READY_FOR_FACTORY',
        followUpLogs: listSewingSupplementFollowUps(assignment.assignmentId),
      })
    })
  return rows.sort((left, right) => Number(right.totalDebtPieceQty > 0) - Number(left.totalDebtPieceQty > 0) || left.taskNo.localeCompare(right.taskNo))
}

export const SEWING_SUPPLEMENT_DEMO_ORDER_ID = 'SUP-PPIC-DEMO-POCKET-001'
export const SEWING_SUPPLEMENT_WAIT_HANDOVER_DEMO_ORDER_ID = 'SUP-PPIC-DEMO-LACE-001'

export function ensureSewingOutsourcingSupplementDemo(): SewingSupplementTrackingRow {
  ensureSewingCutPieceResponsibilityOverviewDemos()
  const projection = ensureSewingCutPieceResponsibilityDemo()
  const context = projection.context
  if (!getSupplementOrder(SEWING_SUPPLEMENT_DEMO_ORDER_ID)) {
    registerSupplementOrder({
      id: SEWING_SUPPLEMENT_DEMO_ORDER_ID,
      recordNo: 'BL-PPIC-20260901-001',
      cutOrderId: 'CUT-PPIC-DEMO-POCKET',
      cutOrderNo: 'CUT-PPIC-DEMO-POCKET',
      productionOrderId: context.productionOrderId,
      productionOrderNo: context.productionOrderNo || context.productionOrderId,
      reason: '裁片部位未及时裁出',
      reasonDetail: 'SKU-BLACK-M的口袋整部位尚未交给三方车缝工厂，由裁床发起补料。',
      totalQty: 1000,
      lineSummary: '黑色 / M / 口袋 1000片',
      lines: [{ color: '黑色', size: 'M', supplementQty: 1000 }],
      materialDemands: [{
        key: 'SUP-PPIC-DEMO-POCKET-MATERIAL',
        materialPatternMappingId: 'MAP-PPIC-DEMO-POCKET',
        sourceBomItemId: 'BOM-PPIC-DEMO-MAIN',
        techPackVersionId: context.requirementSnapshotId,
        materialSku: 'FABRIC-SPU-2024-004-MAIN',
        materialName: '针织棉主面料',
        materialTypeLabel: '主面料',
        materialImageUrl: '/materials/fabric-main.jpg',
        materialImageAlt: '针织棉主面料正式物料图',
        materialAlias: '主面料',
        materialRole: '面料A',
        roleSource: 'BOM',
        roleConfirmStatus: '已确认',
        patternId: 'PATTERN-PPIC-DEMO-POCKET',
        patternName: '口袋纸样',
        requiredQty: 25,
        unit: '米',
        printRequired: false,
        dyeRequired: false,
        processNote: '裁床补裁口袋1000片',
        originalCutOrderId: 'CUT-PPIC-DEMO-POCKET',
        originalCutOrderNo: 'CUT-PPIC-DEMO-POCKET',
        color: '黑色',
        spec: 'M',
        patternPart: '口袋',
      }],
      createdAt: '2026-09-01 08:30:00',
      createdBy: '裁床补料员 王敏',
    }, 'CUTTING')
  }
  const waitingProjection = getSewingCutPieceResponsibilityProjection(SEWING_CUT_PIECE_WAIT_HANDOVER_DEMO_ASSIGNMENT_ID)
  if (!getSupplementOrder(SEWING_SUPPLEMENT_WAIT_HANDOVER_DEMO_ORDER_ID)) {
    registerSupplementOrder({
      id: SEWING_SUPPLEMENT_WAIT_HANDOVER_DEMO_ORDER_ID,
      recordNo: 'BL-PPIC-20260901-002',
      cutOrderId: 'CUT-PPIC-DEMO-LACE',
      cutOrderNo: 'CUT-PPIC-DEMO-LACE',
      productionOrderId: waitingProjection.context.productionOrderId,
      productionOrderNo: waitingProjection.context.productionOrderNo || waitingProjection.context.productionOrderId,
      reason: '裁片数量不足',
      reasonDetail: '黑色/M花边仅交400片，裁床已补裁剩余400片，等待实际转交车缝工厂。',
      totalQty: 400,
      lineSummary: '黑色 / M / 花边 400片',
      lines: [{ color: '黑色', size: 'M', supplementQty: 400 }],
      materialDemands: [],
      createdAt: '2026-09-01 09:00:00',
      createdBy: '裁床补料员 王敏',
    }, 'CUTTING')
    completeSupplementOrder({
      id: SEWING_SUPPLEMENT_WAIT_HANDOVER_DEMO_ORDER_ID,
      completedAt: '2026-09-01 16:30:00',
      completedBy: '裁床补料员 王敏',
      actorRole: 'CUTTING',
    })
  }
  ;[
    ['CMD-SUP-FOLLOW-DEMO-001', '已联系裁床确认口袋整部位未完成裁剪。', '裁床补料员确认物料和纸样。', '2026-09-01 11:00:00', '2026-09-01 09:00:00'],
    ['CMD-SUP-FOLLOW-DEMO-002', '裁床已创建补料单，等待备料。', '跟进备料完成时间。', '2026-09-01 15:00:00', '2026-09-01 11:10:00'],
    ['CMD-SUP-FOLLOW-DEMO-003', '主面料已备齐，待排入裁剪。', '跟进裁剪完成并转待交出仓。', '2026-09-02 10:00:00', '2026-09-01 15:20:00'],
    ['CMD-SUP-FOLLOW-DEMO-004', '裁床承诺次日上午完成口袋裁片。', '确认实际裁片交出记录，未交出前不可告知工厂已可领取。', '2026-09-02 11:00:00', '2026-09-01 17:30:00'],
  ].forEach(([commandId, result, nextAction, promisedAt, followedAt]) => {
    recordSewingSupplementFollowUp({
      commandId,
      assignmentId: context.assignmentId,
      ppicId: context.ppicId,
      result,
      nextAction,
      promisedAt,
      followedAt,
    })
  })
  return listSewingSupplementTrackingRows().find((item) => item.assignmentId === context.assignmentId)!
}

export function resetSewingSupplementTrackingForTests(): void {
  followUpLogs.clear()
  commandResults.clear()
  followUpSequence = 0
}
