import {
  getAvailableOnboardingPpicOptions,
  isActivePpicTeamLeader,
  SEWING_OUTSOURCING_DEMO_CURRENT_PPIC,
} from './factory-onboarding-ppic.ts'
import {
  createEffectiveTaskAssignment,
  getEffectiveTaskAssignment,
  listEffectiveTaskAssignments,
  type EffectiveTaskAssignment,
} from './effective-task-assignments.ts'
import { POST_FINISHING_SEWING_TASK_TYPE_LABEL, type PostFinishingSewingTaskType } from './post-finishing-full-flow.ts'
import type { ProductionReturnMilestoneProjection } from './production-return-fulfillment.ts'
import {
  ensureSewingCutPieceReturnWorkflowDemo,
  listSewingCutPieceReturnRequests,
  type SewingCutPieceReturnRequest,
} from './sewing-cut-piece-return-workflow.ts'
import { ensureSewingOutsourcingSampleDemo } from './sewing-outsourcing-demo.ts'
import {
  listSewingOutsourcingReturnTrackingRows,
  type SewingOutsourcingReturnTrackingRow,
} from './sewing-outsourcing-return-tracking.ts'
import {
  ensureSewingOutsourcingSupplementDemo,
  listSewingSupplementTrackingRows,
  type SewingSupplementTrackingRow,
} from './sewing-outsourcing-supplement-tracking.ts'
import {
  listSewingSampleApprovalRecords,
  summarizeSampleApprovalStructuredComments,
  type SewingOutsourcingTaskKind,
  type SewingSampleApprovalRecord,
} from './sewing-sample-approval-suggestion.ts'
import { getRuntimeTaskById } from './runtime-process-tasks.ts'

export const SEWING_OUTSOURCING_WORKBENCH_NOW = '2026-09-01 12:00:00'

export type SewingOutsourcingTaskHealth = 'ABNORMAL' | 'ATTENTION' | 'NORMAL' | 'DATA_INCOMPLETE'

export type SewingOutsourcingNextResponsibleParty =
  | 'PPIC'
  | 'CUTTING'
  | 'SEWING_FACTORY'
  | 'SAMPLE_APPROVER'
  | 'POST_FINISHING'
  | 'WAREHOUSE'

export interface SewingOutsourcingWorkbenchTimelineItem {
  timelineId: string
  occurredAt: string
  source: string
  title: string
  detail: string
}

export interface SewingOutsourcingWorkbenchSourceLink {
  label: string
  href: string
}

export interface SewingOutsourcingWorkbenchTaskRow {
  rowId: string
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  productionOrderNo: string
  taskNo: string
  factoryId: string
  factoryName: string
  ppicId: string
  ppicName: string
  taskKind: SewingOutsourcingTaskKind
  taskKindLabel: string
  styleCode: string
  styleName: string
  styleImageUrl: string
  styleImageAlt: string
  health: SewingOutsourcingTaskHealth
  nextResponsibleParty: SewingOutsourcingNextResponsibleParty
  nextAction: string
  dueAt: string
  impactSummary: string
  recentResult: string
  recentAt: string
  quantitySummaries: string[]
  sourceLinks: SewingOutsourcingWorkbenchSourceLink[]
  timeline: SewingOutsourcingWorkbenchTimelineItem[]
  healthReasons: string[]
}

export interface SewingOutsourcingWorkbenchQuery {
  viewerPpicId: string
  leaderView?: boolean
  selectedPpicId?: string
}

interface WorkbenchSignal {
  health: SewingOutsourcingTaskHealth
  nextResponsibleParty: SewingOutsourcingNextResponsibleParty
  nextAction: string
  dueAt: string
  impactSummary: string
  reason: string
  priority: number
}

interface WorkbenchDraft extends Omit<SewingOutsourcingWorkbenchTaskRow,
  'health' | 'nextResponsibleParty' | 'nextAction' | 'dueAt' | 'impactSummary' | 'recentResult' | 'recentAt' | 'healthReasons'> {
  signals: WorkbenchSignal[]
}

const HEALTH_RANK: Record<SewingOutsourcingTaskHealth, number> = {
  NORMAL: 0,
  ATTENTION: 1,
  ABNORMAL: 2,
  DATA_INCOMPLETE: 3,
}

export const SEWING_OUTSOURCING_HEALTH_LABEL: Record<SewingOutsourcingTaskHealth, string> = {
  ABNORMAL: '异常',
  ATTENTION: '需关注',
  NORMAL: '正常',
  DATA_INCOMPLETE: '数据不完整',
}

export const SEWING_OUTSOURCING_NEXT_PARTY_LABEL: Record<SewingOutsourcingNextResponsibleParty, string> = {
  PPIC: 'PPIC',
  CUTTING: '裁床',
  SEWING_FACTORY: '三方车缝工厂',
  SAMPLE_APPROVER: '批版人员',
  POST_FINISHING: '后道工厂',
  WAREHOUSE: '待交出仓',
}

const TASK_KIND_LABEL: Record<SewingOutsourcingTaskKind, string> = {
  INDEPENDENT_SEWING: '独立车缝',
  SEWING_IRON_PACK: '车缝+烫包',
  CUTTING_SEWING_IRON_PACK: '裁剪+车缝+烫包',
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function toSampleTaskKind(taskType: PostFinishingSewingTaskType): SewingOutsourcingTaskKind {
  if (taskType === 'SEWING_TO_IRON_PACK') return 'SEWING_IRON_PACK'
  if (taskType === 'CUTTING_TO_IRON_PACK') return 'CUTTING_SEWING_IRON_PACK'
  return 'INDEPENDENT_SEWING'
}

function ensureNormalWorkbenchDemo(): EffectiveTaskAssignment {
  const assignmentId = 'ASG-PPIC-WORKBENCH-NORMAL-001'
  const existing = getEffectiveTaskAssignment(assignmentId)
  if (existing) return existing
  const source = getEffectiveTaskAssignment('ASG-PPIC-SAMPLE-DEMO-INDEPENDENT')
  if (!source) throw new Error('缺少PPIC工作台正常任务演示来源。')
  const runtimeTask = getRuntimeTaskById('MERGED-CUT-SEW-IRON-PACK-DEMO-001')
  if (!runtimeTask) throw new Error('缺少PPIC工作台可移交执行任务演示来源。')
  return createEffectiveTaskAssignment({
    assignmentId,
    runtimeTaskId: runtimeTask.taskId,
    productionOrderId: runtimeTask.productionOrderId,
    productionOrderNo: runtimeTask.productionOrderNo,
    taskNo: runtimeTask.taskNo,
    factoryId: source.factoryId,
    factoryName: source.factoryName,
    source: 'DIRECT_DISPATCH',
    assignedQty: runtimeTask.scopeQty,
    skuLines: runtimeTask.scopeSkuLines.map((line) => ({ ...line })),
    processCodes: ['CUTTING', 'SEW', 'IRON_PACK'],
    frozenPrice: source.frozenPrice,
    priceCurrency: source.priceCurrency,
    priceUnit: source.priceUnit,
    businessAssignedAt: '2026-09-01 08:20:00',
    operatedAt: '2026-09-01 08:20:00',
    operatedBy: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
    allocationOperatorPpicId: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicId,
    allocationOperatorPpicName: SEWING_OUTSOURCING_DEMO_CURRENT_PPIC.ppicName,
  })
}

function pushUniqueSource(draft: WorkbenchDraft, source: SewingOutsourcingWorkbenchSourceLink): void {
  if (!draft.sourceLinks.some((item) => item.label === source.label && item.href === source.href)) draft.sourceLinks.push(source)
}

function pushQuantity(draft: WorkbenchDraft, value: string): void {
  if (value && !draft.quantitySummaries.includes(value)) draft.quantitySummaries.push(value)
}

function pushTimeline(draft: WorkbenchDraft, item: SewingOutsourcingWorkbenchTimelineItem): void {
  if (!draft.timeline.some((current) => current.timelineId === item.timelineId)) draft.timeline.push(item)
}

function pushSignal(draft: WorkbenchDraft, signal: WorkbenchSignal): void {
  if (!draft.signals.some((item) => item.reason === signal.reason && item.nextResponsibleParty === signal.nextResponsibleParty)) {
    draft.signals.push(signal)
  }
}

function assignmentBase(assignment: EffectiveTaskAssignment, input: {
  taskKind: SewingOutsourcingTaskKind
  styleCode: string
  styleName: string
  styleImageUrl: string
  styleImageAlt?: string
  ppicId?: string
  ppicName?: string
}): WorkbenchDraft {
  return {
    rowId: assignment.assignmentId,
    assignmentId: assignment.assignmentId,
    runtimeTaskId: assignment.runtimeTaskId,
    productionOrderId: assignment.productionOrderId,
    productionOrderNo: assignment.productionOrderNo || assignment.productionOrderId,
    taskNo: assignment.taskNo || assignment.runtimeTaskId,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    ppicId: input.ppicId || assignment.ppicId || '',
    ppicName: input.ppicName || assignment.ppicName || '',
    taskKind: input.taskKind,
    taskKindLabel: TASK_KIND_LABEL[input.taskKind],
    styleCode: input.styleCode,
    styleName: input.styleName,
    styleImageUrl: input.styleImageUrl,
    styleImageAlt: input.styleImageAlt || `${input.styleCode} ${input.styleName}款式实拍图`,
    quantitySummaries: [`分配 ${assignment.assignedQty.toLocaleString()}件`],
    sourceLinks: [],
    timeline: [{
      timelineId: `ASSIGNMENT::${assignment.assignmentId}`,
      occurredAt: assignment.businessAssignedAt,
      source: '车缝任务分配',
      title: `分配给${assignment.factoryName}`,
      detail: `执行任务${assignment.taskNo || assignment.runtimeTaskId}；PPIC责任快照为${input.ppicName || assignment.ppicName || '待核查'}。`,
    }],
    signals: [],
  }
}

function ensureDraft(
  drafts: Map<string, WorkbenchDraft>,
  assignment: EffectiveTaskAssignment,
  input: Parameters<typeof assignmentBase>[1],
): WorkbenchDraft {
  const existing = drafts.get(assignment.assignmentId)
  if (existing) {
    if (!existing.ppicId && input.ppicId) existing.ppicId = input.ppicId
    if (!existing.ppicName && input.ppicName) existing.ppicName = input.ppicName
    if (!existing.styleImageUrl && input.styleImageUrl) existing.styleImageUrl = input.styleImageUrl
    return existing
  }
  const draft = assignmentBase(assignment, input)
  drafts.set(assignment.assignmentId, draft)
  return draft
}

function addSampleFacts(draft: WorkbenchDraft, record: SewingSampleApprovalRecord): void {
  const sample = record.sample
  pushUniqueSource(draft, { label: '批版建议', href: `/fcs/sewing-outsourcing/sample-approval-suggestions?assignmentId=${encodeURIComponent(sample.assignmentId)}` })
  if (sample.factoryCompletedAt) pushTimeline(draft, {
    timelineId: `SAMPLE-COMPLETED::${sample.sampleId}`,
    occurredAt: sample.factoryCompletedAt,
    source: '产前版样衣',
    title: '三方车缝工厂完成产前版样衣',
    detail: `${sample.sampleNo}已制作完成，等待实物带回PPIC办公室。`,
  })
  if (sample.ppicReceivedAt) pushTimeline(draft, {
    timelineId: `SAMPLE-RECEIVED::${sample.sampleId}`,
    occurredAt: sample.ppicReceivedAt,
    source: '产前版样衣',
    title: 'PPIC收到实物',
    detail: `由${sample.ppicReceivedBy || sample.currentPpicName}确认收到产前版样衣。`,
  })
  if (sample.handedToApproverAt) pushTimeline(draft, {
    timelineId: `SAMPLE-HANDOFF::${sample.sampleId}`,
    occurredAt: sample.handedToApproverAt,
    source: '批版建议',
    title: '实物交给批版人员',
    detail: `接收团队：${sample.approverTeamName || '批版团队'}。`,
  })
  record.suggestionVersions.forEach((version) => {
    pushTimeline(draft, {
      timelineId: version.suggestionVersionId,
      occurredAt: version.uploadedAt,
      source: '批版建议',
      title: version.conclusion === 'NO_PROBLEM' ? '批版建议：无问题' : '批版建议：有问题',
      detail: summarizeSampleApprovalStructuredComments(version.structuredComments) || '批版人员确认无问题，可按当前资料生产大货。',
    })
    if (version.feedbackSentAt) pushTimeline(draft, {
      timelineId: `SAMPLE-FEEDBACK::${version.suggestionVersionId}`,
      occurredAt: version.feedbackSentAt,
      source: '批版建议',
      title: 'PPIC已反馈工厂',
      detail: version.feedbackNote || '批版建议已反馈给三方车缝工厂。',
    })
  })

  if (sample.status === 'WAITING_FACTORY_PRODUCTION') {
    pushSignal(draft, { health: 'NORMAL', nextResponsibleParty: 'SEWING_FACTORY', nextAction: '制作一件大货产前版样衣', dueAt: '按任务约定时间', impactSummary: '产前版样衣尚未制作', reason: '等待工厂制作产前版样衣', priority: 20 })
  } else if (sample.status === 'WAITING_RETURN_TO_PPIC') {
    pushSignal(draft, { health: 'ATTENTION', nextResponsibleParty: 'PPIC', nextAction: '把产前版样衣实物带回PPIC办公室', dueAt: '今日完成', impactSummary: '未带回前不能进入批版', reason: '产前版样衣待带回', priority: 72 })
  } else if (sample.status === 'PPIC_RECEIVED') {
    pushSignal(draft, { health: 'ATTENTION', nextResponsibleParty: 'PPIC', nextAction: '把产前版样衣移交批版人员', dueAt: '今日完成', impactSummary: '实物已到PPIC办公室', reason: '待移交批版人员', priority: 74 })
  } else if (sample.status === 'HANDED_TO_APPROVER' || sample.status === 'APPROVAL_IN_PROGRESS') {
    pushSignal(draft, { health: 'ATTENTION', nextResponsibleParty: 'SAMPLE_APPROVER', nextAction: '核对样衣、生产单图片、纸样及面辅料并上传批版建议', dueAt: '今日完成', impactSummary: '大货尚未获得批版建议', reason: '批版建议待完成', priority: 76 })
  } else if (sample.status === 'SUGGESTION_UPLOADED') {
    pushSignal(draft, { health: 'ATTENTION', nextResponsibleParty: 'PPIC', nextAction: '将批版建议反馈给外发工厂并确认收到', dueAt: '立即反馈', impactSummary: '批版建议已出，尚未完成反馈', reason: '批版建议待反馈', priority: 78 })
  } else {
    pushSignal(draft, { health: 'NORMAL', nextResponsibleParty: 'SEWING_FACTORY', nextAction: '按已反馈的批版建议生产大货', dueAt: '按回货节点', impactSummary: '批版建议已完成反馈', reason: '批版闭环完成', priority: 16 })
  }
}

function addSupplementFacts(draft: WorkbenchDraft, row: SewingSupplementTrackingRow): void {
  if (!row.hasConfirmedHandover) {
    pushUniqueSource(draft, { label: '交出与欠片', href: `/fcs/sewing-outsourcing/cut-piece-handover?tab=UNHANDED&assignmentId=${encodeURIComponent(row.assignmentId)}` })
    pushQuantity(draft, `待裁床交出 ${row.totalRequiredPieceQty.toLocaleString()}片`)
    pushSignal(draft, {
      health: 'ATTENTION',
      nextResponsibleParty: 'CUTTING',
      nextAction: '跟进裁床完成实际交出',
      dueAt: '尽快交出',
      impactSummary: `应交${row.totalRequiredPieceQty.toLocaleString()}片，当前尚未形成确认交出；交出前不判定欠片`,
      reason: '裁片尚未正式交出',
      priority: 70,
    })
    return
  }
  pushUniqueSource(draft, { label: '交出与欠片', href: `/fcs/sewing-outsourcing/cut-piece-handover?tab=${row.totalDebtPieceQty > 0 ? 'HANDED_WITH_DEBT' : 'HANDED_NO_DEBT'}&assignmentId=${encodeURIComponent(row.assignmentId)}` })
  row.supplementOrders.forEach((order) => pushTimeline(draft, {
    timelineId: `SUPPLEMENT::${order.id}`,
    occurredAt: order.createdAt,
    source: '裁床补料',
    title: `裁床发起补料单${order.recordNo}`,
    detail: `${order.reasonDetail}；当前${order.status}。`,
  }))
  row.followUpLogs.forEach((log) => pushTimeline(draft, {
    timelineId: log.logId,
    occurredAt: log.followedAt,
    source: 'PPIC跟进',
    title: log.result,
    detail: `下一步：${log.nextAction}${log.promisedAt ? `；承诺${log.promisedAt}` : ''}。`,
  }))
  if (row.totalDebtPieceQty <= 0) {
    pushQuantity(draft, '裁片已齐，不欠片')
    return
  }
  pushUniqueSource(draft, { label: '补料跟进', href: `/fcs/sewing-outsourcing/supplements?assignmentId=${encodeURIComponent(row.assignmentId)}` })
  pushQuantity(draft, `裁片欠片 ${row.totalDebtPieceQty.toLocaleString()}片`)
  const latestPromisedAt = row.followUpLogs.find((log) => log.promisedAt)?.promisedAt || ''
  const promiseOverdue = Boolean(latestPromisedAt && latestPromisedAt < SEWING_OUTSOURCING_WORKBENCH_NOW)
  const impactful = row.structuralMissingLineCount > 0
    || row.halfOrMoreMissingLineCount > 0
    || row.excludedMissingLineCount > 0
    || promiseOverdue
  if (!impactful) {
    pushSignal(draft, {
      health: 'NORMAL',
      nextResponsibleParty: 'PPIC',
      nextAction: '保留部位欠片明细，结合实际生产影响随任务跟进',
      dueAt: '随任务跟进',
      impactSummary: `当前最大部位缺口${Math.round(row.maximumMissingRatio * 100)}%，尚未达到结构性缺失且未逾承诺期限`,
      reason: '非结构性局部欠片暂不抬高首页异常',
      priority: 18,
    })
    return
  }
  const nextAction = row.availability === 'NO_SUPPLEMENT_ORDER'
    ? '跟进裁床按缺失部位发起补料'
    : row.availability === 'CUTTING_PROCESSING'
      ? '跟进裁床完成补料裁剪'
      : row.availability === 'WAITING_CUTTING_HANDOVER'
        ? '跟进裁床完成裁片实际交出'
        : '确认裁片实际交出后通知工厂领取'
  const latestPromise = latestPromisedAt || '按裁床最新承诺'
  const impactParts = [
    row.structuralMissingLineCount ? `${row.structuralMissingLineCount}个部位完整缺失` : '',
    row.halfOrMoreMissingLineCount ? `${row.halfOrMoreMissingLineCount}个部位缺口达到一半` : '',
    row.excludedMissingLineCount ? `${row.excludedMissingLineCount}个欠片部位已被排除` : '',
    promiseOverdue ? '裁床承诺已超期' : '',
  ].filter(Boolean)
  pushSignal(draft, {
    health: row.canHandToFactory ? 'ATTENTION' : 'ABNORMAL',
    nextResponsibleParty: row.canHandToFactory ? 'PPIC' : 'CUTTING',
    nextAction,
    dueAt: latestPromise,
    impactSummary: `${impactParts.join('；')}；当前欠${row.totalDebtPieceQty.toLocaleString()}片`,
    reason: '结构性缺片、部位排除或裁床承诺超期',
    priority: row.canHandToFactory ? 70 : 92,
  })
}

function focusReturnMilestone(row: SewingOutsourcingReturnTrackingRow): ProductionReturnMilestoneProjection {
  return row.returnProjection.milestones.find((milestone) => milestone.status !== 'REACHED')
    || row.returnProjection.milestones.at(-1)!
}

function addReturnFacts(draft: WorkbenchDraft, row: SewingOutsourcingReturnTrackingRow): void {
  pushUniqueSource(draft, { label: '回货跟进', href: `/fcs/sewing-outsourcing/returns?assignmentId=${encodeURIComponent(row.assignment.assignmentId)}` })
  pushQuantity(draft, `工厂申报 ${row.declaredQty.toLocaleString()}件`)
  pushQuantity(draft, `后道最终确认 ${row.confirmedQty.toLocaleString()}件`)
  row.deliveries.forEach((delivery) => pushTimeline(draft, {
    timelineId: `RETURN-DECLARED::${delivery.deliveryId}`,
    occurredAt: delivery.registeredAt,
    source: '后道回货',
    title: `工厂申报回货${delivery.lines.reduce((sum, line) => sum + line.registeredQty, 0)}件`,
    detail: `${delivery.deliveryOrderNo}；申报不计入正式回货。`,
  }))
  row.confirmationVersions.forEach((version) => pushTimeline(draft, {
    timelineId: version.confirmationVersionId,
    occurredAt: version.versionCreatedAt,
    source: '后道最终确认',
    title: `${version.status === 'ACTIVE' ? '当前生效' : '已被订正'}：${version.confirmedQty}件`,
    detail: `${version.deliveryOrderNo}；业务确认时间${version.confirmedAt}${version.correctionReason ? `；订正原因：${version.correctionReason}` : ''}。`,
  }))
  const focus = focusReturnMilestone(row)
  if (row.pendingPostFinishingQty > 0) pushSignal(draft, {
    health: 'ATTENTION',
    nextResponsibleParty: 'POST_FINISHING',
    nextAction: `核对工厂已申报但尚未最终确认的${row.pendingPostFinishingQty}件`,
    dueAt: '立即核对',
    impactSummary: `${row.pendingPostFinishingQty}件尚不能计入正式回货`,
    reason: '工厂申报待后道最终确认',
    priority: 100,
  })
  if (focus.cuttingShortfallQty > 0) pushSignal(draft, {
    health: 'ABNORMAL',
    nextResponsibleParty: 'CUTTING',
    nextAction: `跟进影响当前回货节点的${focus.cuttingShortfallQty}件裁片责任`,
    dueAt: focus.deadlineAt,
    impactSummary: `计划应回${focus.targetQty}件中，${focus.cuttingShortfallQty}件因裁片责任不足暂不归责工厂`,
    reason: '裁片责任不足影响回货节点',
    priority: 90,
  })
  if (focus.factoryPendingQty > 0) pushSignal(draft, {
    health: focus.status === 'OVERDUE' ? 'ABNORMAL' : 'ATTENTION',
    nextResponsibleParty: 'SEWING_FACTORY',
    nextAction: `跟进工厂当前应承担但尚未按期回货的${focus.factoryPendingQty}件`,
    dueAt: focus.deadlineAt,
    impactSummary: `工厂当前承担${focus.attributableTargetQty}件，按期确认${focus.confirmedQtyByDeadline}件`,
    reason: focus.status === 'OVERDUE' ? '工厂回货逾期' : '工厂回货节点待达成',
    priority: focus.status === 'OVERDUE' ? 96 : 68,
  })
  if (!row.pendingPostFinishingQty && !focus.cuttingShortfallQty && !focus.factoryPendingQty) pushSignal(draft, {
    health: focus.status === 'DUE_TODAY' ? 'ATTENTION' : 'NORMAL',
    nextResponsibleParty: focus.status === 'REACHED' ? 'PPIC' : 'SEWING_FACTORY',
    nextAction: focus.status === 'REACHED' ? '核对下一业务节点' : `按${Math.round(focus.ratio * 100)}%节点计划回货`,
    dueAt: focus.deadlineAt,
    impactSummary: `${Math.round(focus.ratio * 100)}%节点计划${focus.targetQty}件，当前按期确认${focus.confirmedQtyByDeadline}件`,
    reason: focus.status === 'DUE_TODAY' ? '回货节点今日到期' : '回货节点正常推进',
    priority: focus.status === 'DUE_TODAY' ? 64 : 14,
  })
}

function addCutPieceReturnFacts(draft: WorkbenchDraft, request: SewingCutPieceReturnRequest): void {
  pushUniqueSource(draft, { label: '裁片退仓', href: `/fcs/sewing-outsourcing/cut-piece-returns?requestId=${encodeURIComponent(request.requestId)}` })
  pushQuantity(draft, `PPIC建单退回 ${request.returnedGarmentQty.toLocaleString()}件衣服对应裁片`)
  request.events.forEach((event) => pushTimeline(draft, {
    timelineId: event.eventId,
    occurredAt: event.occurredAt,
    source: '裁片退仓',
    title: event.note,
    detail: `${event.actorName}（${event.actorRole}）`,
  }))
  if (request.status === 'APPROVED_WAITING_WAREHOUSE') {
    pushSignal(draft, { health: 'ATTENTION', nextResponsibleParty: 'WAREHOUSE', nextAction: '按PPIC建单结果接收并入仓', dueAt: '今日完成', impactSummary: 'PPIC已核查部位和数量，仓库只负责接收', reason: '裁片退仓待仓库接收', priority: 82 })
  } else if (request.status === 'WAREHOUSE_EXCEPTION') {
    pushSignal(draft, { health: 'ABNORMAL', nextResponsibleParty: 'WAREHOUSE', nextAction: '按异常记录重新接收或退回PPIC复核', dueAt: '立即处理', impactSummary: request.warehouseExceptionNote || '仓库接收异常', reason: '裁片退仓接收异常', priority: 94 })
  } else {
    pushSignal(draft, { health: 'NORMAL', nextResponsibleParty: 'PPIC', nextAction: '核对退仓已入仓结果并继续任务收尾', dueAt: '随任务收尾', impactSummary: '裁片退仓已完成入仓', reason: '裁片退仓闭环', priority: 12 })
  }
}

function legacyReturnDraft(request: SewingCutPieceReturnRequest): WorkbenchDraft {
  const taskKind: SewingOutsourcingTaskKind = 'INDEPENDENT_SEWING'
  return {
    rowId: `UNMATCHED-RETURN::${request.requestId}`,
    assignmentId: '',
    runtimeTaskId: '',
    productionOrderId: request.productionOrderId,
    productionOrderNo: request.productionOrderNo,
    taskNo: request.sewingTaskNo,
    factoryId: request.factoryId,
    factoryName: request.factoryName,
    ppicId: request.ppicId,
    ppicName: request.ppicName,
    taskKind,
    taskKindLabel: TASK_KIND_LABEL[taskKind],
    styleCode: request.spuCode,
    styleName: request.styleName,
    styleImageUrl: request.styleImageUrl,
    styleImageAlt: request.styleImageAlt,
    quantitySummaries: [],
    sourceLinks: [],
    timeline: [],
    signals: [{
      health: 'DATA_INCOMPLETE',
      nextResponsibleParty: 'PPIC',
      nextAction: '由负责人确认历史裁片退仓记录对应的新执行任务',
      dueAt: '阻断后续收尾前',
      impactSummary: '退仓记录未匹配到有效分配任务，禁止自动猜测归属',
      reason: '历史裁片退仓缺少有效分配任务关联',
      priority: 120,
    }],
  }
}

function finalizeDraft(draft: WorkbenchDraft): SewingOutsourcingWorkbenchTaskRow {
  if (!draft.ppicId || !draft.ppicName || !draft.factoryId || !draft.taskNo) pushSignal(draft, {
    health: 'DATA_INCOMPLETE',
    nextResponsibleParty: 'PPIC',
    nextAction: '由负责人补齐任务、工厂和PPIC责任关联',
    dueAt: '阻断任务推进前',
    impactSummary: '任务责任字段不完整',
    reason: '任务责任字段不完整',
    priority: 130,
  })
  if (!draft.signals.length) pushSignal(draft, {
    health: 'NORMAL',
    nextResponsibleParty: 'PPIC',
    nextAction: '按计划继续跟进',
    dueAt: '按任务计划',
    impactSummary: '当前无阻断事项',
    reason: '当前无异常',
    priority: 1,
  })
  const primary = [...draft.signals].sort((left, right) => right.priority - left.priority)[0]!
  const health = [...draft.signals].sort((left, right) => HEALTH_RANK[right.health] - HEALTH_RANK[left.health])[0]!.health
  const timeline = [...draft.timeline].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.timelineId.localeCompare(left.timelineId))
  const recent = timeline[0]
  return {
    ...draft,
    health,
    nextResponsibleParty: primary.nextResponsibleParty,
    nextAction: primary.nextAction,
    dueAt: primary.dueAt,
    impactSummary: primary.impactSummary,
    recentResult: recent?.title || '尚无业务动作',
    recentAt: recent?.occurredAt || '',
    timeline,
    healthReasons: [...new Set(draft.signals.filter((signal) => signal.health === health).map((signal) => signal.reason))],
  }
}

function buildRows(): SewingOutsourcingWorkbenchTaskRow[] {
  ensureSewingOutsourcingSampleDemo()
  ensureNormalWorkbenchDemo()
  ensureSewingOutsourcingSupplementDemo()
  listSewingOutsourcingReturnTrackingRows(SEWING_OUTSOURCING_WORKBENCH_NOW)
  ensureSewingCutPieceReturnWorkflowDemo()

  const assignments = listEffectiveTaskAssignments().filter((assignment) => assignment.status === 'EFFECTIVE')
  const assignmentById = new Map(assignments.map((assignment) => [assignment.assignmentId, assignment]))
  const drafts = new Map<string, WorkbenchDraft>()

  listSewingSampleApprovalRecords().forEach((record) => {
    const assignment = assignmentById.get(record.assignmentId)
    if (!assignment) return
    const sample = record.sample
    const draft = ensureDraft(drafts, assignment, {
      taskKind: sample.taskKind,
      styleCode: sample.styleCode,
      styleName: sample.styleName,
      styleImageUrl: sample.styleImageUrl,
      ppicId: sample.currentPpicId,
      ppicName: sample.currentPpicName,
    })
    addSampleFacts(draft, record)
  })

  listSewingSupplementTrackingRows().forEach((row) => {
    const assignment = assignmentById.get(row.assignmentId)
    if (!assignment) return
    const draft = ensureDraft(drafts, assignment, {
      taskKind: row.taskKind as SewingOutsourcingTaskKind,
      styleCode: row.styleCode,
      styleName: row.styleName,
      styleImageUrl: row.styleImageUrl,
      ppicId: row.ppicId,
      ppicName: row.ppicName,
    })
    addSupplementFacts(draft, row)
  })

  listSewingOutsourcingReturnTrackingRows(SEWING_OUTSOURCING_WORKBENCH_NOW).forEach((row) => {
    const styleImageUrl = row.productionOrder.skus[0]?.imageUrl || '/tshirt-sample.jpg'
    const taskKind = toSampleTaskKind(row.taskType)
    const draft = ensureDraft(drafts, row.assignment, {
      taskKind,
      styleCode: row.productionOrder.styleNo,
      styleName: row.productionOrder.styleName,
      styleImageUrl,
      styleImageAlt: `${row.productionOrder.styleNo} ${row.productionOrder.styleName}款式实拍图`,
      ppicId: row.ppicId,
      ppicName: row.ppicName,
    })
    draft.taskKindLabel = POST_FINISHING_SEWING_TASK_TYPE_LABEL[row.taskType]
    addReturnFacts(draft, row)
  })

  listSewingCutPieceReturnRequests().forEach((request) => {
    const assignment = assignments.find((item) => item.taskNo === request.sewingTaskNo && item.factoryId === request.factoryId)
    const draft = assignment
      ? ensureDraft(drafts, assignment, {
        taskKind: 'INDEPENDENT_SEWING',
        styleCode: request.spuCode,
        styleName: request.styleName,
        styleImageUrl: request.styleImageUrl,
        styleImageAlt: request.styleImageAlt,
        ppicId: request.ppicId,
        ppicName: request.ppicName,
      })
      : legacyReturnDraft(request)
    if (!assignment) drafts.set(draft.rowId, draft)
    addCutPieceReturnFacts(draft, request)
  })

  return [...drafts.values()]
    .map(finalizeDraft)
    .sort((left, right) => (
      HEALTH_RANK[right.health] - HEALTH_RANK[left.health]
      || right.dueAt.localeCompare(left.dueAt)
      || left.taskNo.localeCompare(right.taskNo)
    ))
}

export function listSewingOutsourcingWorkbenchRows(
  query: SewingOutsourcingWorkbenchQuery,
): SewingOutsourcingWorkbenchTaskRow[] {
  const viewerPpicId = query.viewerPpicId.trim()
  if (!viewerPpicId) throw new Error('工作台必须从当前登录PPIC身份读取，不能使用无身份的全量视图。')
  if (query.leaderView && !isActivePpicTeamLeader(viewerPpicId)) {
    throw new Error('只有当前登录的PPIC团队负责人可以查看团队任务。')
  }
  let rows = buildRows()
  if (!query.leaderView) rows = rows.filter((row) => row.ppicId === viewerPpicId)
  if (query.leaderView && query.selectedPpicId) rows = rows.filter((row) => row.ppicId === query.selectedPpicId)
  return clone(rows)
}

export function getSewingOutsourcingWorkbenchRow(
  rowId: string,
  query: SewingOutsourcingWorkbenchQuery,
): SewingOutsourcingWorkbenchTaskRow | null {
  const row = listSewingOutsourcingWorkbenchRows(query).find((item) => item.rowId === rowId)
  return row ? clone(row) : null
}

export function listSewingOutsourcingWorkbenchPpicOptions(): Array<{
  ppicId: string
  ppicName: string
  taskCount: number
}> {
  const rows = buildRows()
  const taskCountByPpic = new Map<string, number>()
  rows.forEach((row) => taskCountByPpic.set(row.ppicId, (taskCountByPpic.get(row.ppicId) || 0) + 1))
  return getAvailableOnboardingPpicOptions()
    .filter((option) => option.role === 'MEMBER' && (taskCountByPpic.get(option.ppicId) || 0) > 0)
    .map((option) => ({ ppicId: option.ppicId, ppicName: option.ppicName, taskCount: taskCountByPpic.get(option.ppicId) || 0 }))
    .sort((left, right) => right.taskCount - left.taskCount || left.ppicName.localeCompare(right.ppicName))
}
